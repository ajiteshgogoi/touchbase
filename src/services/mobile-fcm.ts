import { supabase } from '../lib/supabase/client';
import { getFirebaseMessaging, initializeTokenRefresh } from '../lib/firebase';
import { platform } from '../utils/platform';
import { notificationDiagnostics } from './notification-diagnostics';

const DEBUG_PREFIX = '📱 [Mobile FCM]';

// Use localStorage instead of sessionStorage for better isolation across Chrome instances
export class MobileFCMService {
  private registration: ServiceWorkerRegistration | undefined = undefined;
  private applicationServerKey: Uint8Array | undefined = undefined;

  private urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  constructor() {
    console.log(`${DEBUG_PREFIX} Initialized with browser instance ID: ${platform.browserInstanceId}`);
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
    
    if (!deviceId) {
      // Use platform's device ID generation
      deviceId = platform.generateDeviceId();
    }

    console.log(`${DEBUG_PREFIX} Device ID:`, deviceId);
    return deviceId;
  }

  /**
   * Check if this is actually a mobile context
   */
  isMobileContext(): boolean {
    const deviceInfo = platform.getDeviceInfo();
    return deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios';
  }

  /**
   * Check if push notifications are supported
   */
  async isPushSupported(): Promise<boolean> {
    return 'serviceWorker' in navigator &&
           'PushManager' in window &&
           'Notification' in window;
  }

  /**
   * Initialize the service but don't register for push yet
   */
  async initialize(retryDelay = 1000): Promise<boolean> {
    console.log(`${DEBUG_PREFIX} Starting initialization`);

    try {
      // Wait for valid session before proceeding
      const maxRetries = 3;
      let authToken = null;
      
      for (let i = 0; i < maxRetries; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          authToken = session.access_token;
          break;
        }
        // Wait between retries with increasing delay
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }

      if (!authToken) {
        throw new Error('No valid auth token available');
      }

      // Add delay to ensure auth token is properly propagated
      await new Promise(resolve => setTimeout(resolve, retryDelay));

      // Check Firebase version compatibility
      const firebase = await import('firebase/app');
      console.log(`${DEBUG_PREFIX} Firebase version:`, firebase.SDK_VERSION);
      
      // Verify minimum required version
      const version = firebase.SDK_VERSION || '0.0.0';
      const [majorStr = '0', minorStr = '0'] = version.split('.');
      const major = parseInt(majorStr, 10);
      const minor = parseInt(minorStr, 10);
      
      if (major < 11 || (major === 11 && minor < 2)) {
        throw new Error(`Firebase SDK version ${version} is not supported. Minimum required version is 11.2.0`);
      }

      // Check existing Firebase service workers
      console.log(`${DEBUG_PREFIX} Checking Firebase service worker status`);
      const registrations = await navigator.serviceWorker.getRegistrations();
      const firebaseSWs = registrations.filter(reg =>
        reg.active?.scriptURL.includes('firebase-messaging-sw.js')
      );
      
      if (firebaseSWs.length > 0) {
        // Only unregister if not in good state
        for (const reg of firebaseSWs) {
          if (reg.active?.state !== 'activated') {
            await reg.unregister();
            console.log(`${DEBUG_PREFIX} Unregistered inactive service worker`);
          } else {
            // If we have an active worker, use it
            this.registration = reg;
            console.log(`${DEBUG_PREFIX} Using existing active service worker`);
            return true;
          }
        }
        // Wait for cleanup if any workers were unregistered
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Initialize VAPID key
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey || vapidKey.length < 30) {
        throw new Error('Invalid VAPID key configuration');
      }

      // Convert VAPID key once and store for reuse
      try {
        this.applicationServerKey = this.urlB64ToUint8Array(vapidKey);
        console.log(`${DEBUG_PREFIX} VAPID key initialized successfully`);
      } catch (error) {
        console.error(`${DEBUG_PREFIX} Failed to convert VAPID key:`, error);
        throw new Error('Invalid VAPID key format');
      }
      
      // Test direct access to service worker file
      try {
        console.log(`${DEBUG_PREFIX} Testing direct access to service worker file...`);
        const swResponse = await fetch('/firebase-messaging-sw.js', {
          method: 'GET',
          cache: 'no-store',
        });
        
        if (!swResponse.ok) {
          console.error(`${DEBUG_PREFIX} Service worker file access failed:`, swResponse.status);
          throw new Error(`Service worker file HTTP error: ${swResponse.status}`);
        }
        
        const contentType = swResponse.headers.get('content-type');
        console.log(`${DEBUG_PREFIX} Service worker file accessible: ${swResponse.status}, type: ${contentType}`);
      } catch (swFetchError) {
        console.error(`${DEBUG_PREFIX} Service worker fetch test failed:`, swFetchError);
        // Continue anyway, but log the error
      }

      // Register new service worker if needed
      if (!this.registration) {
        console.log(`${DEBUG_PREFIX} Registering new Firebase service worker`);
        
        const firebaseSWURL = '/firebase-messaging-sw.js';
        try {
          this.registration = await navigator.serviceWorker.register(firebaseSWURL, {
            scope: '/',  // Use root scope
            updateViaCache: 'imports'   // Cache imports but check main script
          });
        } catch (error) {
          console.error(`${DEBUG_PREFIX} Service worker registration failed:`, error);
          throw error;
        }
      }

      // Wait for the service worker to be activated
      console.log(`${DEBUG_PREFIX} Waiting for service worker activation...`);
      const maxWaitTime = 10000;
      
      const sw = this.registration!.installing || this.registration!.waiting;
      if (sw) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Service worker activation timeout')), maxWaitTime);
          sw.addEventListener('statechange', (e: Event) => {
            const target = e.target as ServiceWorker;
            if (target.state === 'activated') {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }

      if (!this.registration?.active) {
        throw new Error('Service worker failed to activate');
      }

      console.log(`${DEBUG_PREFIX} Service worker activated successfully`);
      
      // Get current user for token refresh
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be authenticated');
      }

      // Starting Firebase messaging initialization
      console.log(`${DEBUG_PREFIX} Starting Firebase messaging initialization...`);
      
      // Wait for Firebase messaging to be fully initialized with timeout
      const timeout = 1500;
      const startTime = Date.now();
      let messaging;
      let attempts = 0;
      
      while (Date.now() - startTime < timeout) {
        attempts++;
        console.log(`${DEBUG_PREFIX} Attempt ${attempts} to initialize Firebase messaging...`);
        
        messaging = await getFirebaseMessaging();
        if (messaging?.app?.options?.messagingSenderId) {
          const timeElapsed = Date.now() - startTime;
          console.log(`${DEBUG_PREFIX} Firebase messaging successfully initialized after ${timeElapsed}ms (${attempts} attempts)`);
          console.log(`${DEBUG_PREFIX} Messaging config verified:`, {
            messagingSenderId: messaging.app.options.messagingSenderId.substring(0, 8) + '...',
            isInitialized: true,
            timeToInit: timeElapsed
          });
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!messaging) {
        throw new Error('Firebase messaging initialization returned null');
      }
      
      if (!messaging.app?.options?.messagingSenderId) {
        throw new Error('Firebase messaging not properly configured');
      }

      // Verify Firebase configuration is consistent
      const appId = messaging.app.options.appId;
      if (!appId || appId !== import.meta.env.VITE_FIREBASE_APP_ID) {
        console.error(`${DEBUG_PREFIX} Firebase app ID mismatch`, {
          clientAppId: appId,
          envAppId: import.meta.env.VITE_FIREBASE_APP_ID
        });
        throw new Error('Firebase configuration mismatch between client and service worker');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify service worker state after delay
      if (!this.registration?.active || this.registration.active.state !== 'activated') {
        throw new Error('Service worker not properly activated after initialization');
      }

      // Verify Firebase messaging instance is still ready after delay
      if (!await getFirebaseMessaging()) {
        throw new Error('Firebase messaging not properly initialized after delay');
      }

      return true;
    } catch (error: any) {
      const deviceInfo = platform.getDeviceInfo();
      const diagnosticInfo = {
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack?.split('\n')
        },
        environment: {
          notificationPermission: Notification.permission,
          serviceWorkerSupport: 'serviceWorker' in navigator,
          pushManagerSupport: 'PushManager' in window,
          registrationState: this.registration?.active?.state
        }
      };
      
      console.error(`${DEBUG_PREFIX} Initialization failed:`, diagnosticInfo);
      await notificationDiagnostics.handleFCMError(error, deviceInfo);
      
      // Only cleanup on specific errors that require it
      if (error.message?.includes('Service worker registration failed') ||
          error.message?.includes('Service worker failed to activate')) {
        await this.cleanup();
      }
      return false;
    }
  }

  /**
   * Request notification permission separately from token generation
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }
    
    // Check current permission
    if (Notification.permission === 'granted') {
      return true;
    }
    
    // Request permission
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(userId: string): Promise<boolean> {
    try {
      console.log(`${DEBUG_PREFIX} Starting new subscription attempt...`);

      // Verify service worker state first
      if (!this.registration?.active) {
        console.log(`${DEBUG_PREFIX} Initializing before subscription...`);
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          throw new Error('Failed to initialize before subscription');
        }
      }

      // Check notification permission early
      console.log(`${DEBUG_PREFIX} Checking notification permission...`);
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      // Initialize VAPID key if not already done
      if (!this.applicationServerKey) {
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey || vapidKey.length < 30) {
          throw new Error('Invalid VAPID key configuration');
        }
        this.applicationServerKey = this.urlB64ToUint8Array(vapidKey);
      }

      // Early IndexedDB check before proceeding
      console.log(`${DEBUG_PREFIX} Verifying IndexedDB access...`);
      try {
        const request = indexedDB.open('fcm-test-db');
        await new Promise<void>((resolve, reject) => {
          request.onerror = () => reject(new Error('IndexedDB access denied - check browser settings'));
          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
        });
        console.log(`${DEBUG_PREFIX} IndexedDB access confirmed`);
      } catch (error) {
        console.error(`${DEBUG_PREFIX} IndexedDB access error:`, error);
        throw new Error('Browser storage access denied - check privacy settings and third-party cookie settings');
      }

      // Let shared initialization handle FCM token generation and database updates
      await initializeTokenRefresh(userId);
      
      console.log(`${DEBUG_PREFIX} Push notification subscription completed successfully`);
      return true;
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Failed to subscribe to push notifications:`, error);
      await notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
      return false;
    }
  }

  /**
   * Cleanup and unsubscribe
   */
  /**
   * Unsubscribe a specific device
   */
  async unsubscribeDevice(userId: string, deviceId: string): Promise<void> {
    try {
      console.log(`${DEBUG_PREFIX} Unsubscribing device ${deviceId}...`);

      // If this is the current device, clean up FCM resources
      const currentDeviceId = this.getDeviceId();
      if (deviceId === currentDeviceId) {
        console.log(`${DEBUG_PREFIX} Cleaning up current device resources...`);
        const pushSubscription = await this.registration?.pushManager.getSubscription();
        if (pushSubscription) {
          console.log(`${DEBUG_PREFIX} Removing push subscription...`);
          await pushSubscription.unsubscribe();
        }

        // Clear registration reference for current device
        this.registration = undefined;
        this.applicationServerKey = undefined;
      }

      // Delete subscription from database with proper user_id match
      await supabase
        .from('push_subscriptions')
        .delete()
        .match({
          user_id: userId,
          device_id: deviceId
        });

      console.log(`${DEBUG_PREFIX} Device unsubscribed successfully`);
    } catch (error) {
      const cleanupError = error as Error;
      console.error(`${DEBUG_PREFIX} Device unsubscribe failed:`, {
        errorName: cleanupError.name,
        errorMessage: cleanupError.message,
        errorStack: cleanupError.stack,
        deviceId,
        userId
      });
      throw error;
    }
  }

  /**
   * Cleanup all resources for current device
   */
  async cleanup(): Promise<void> {
    try {
      const deviceId = this.getDeviceId();
      console.log(`${DEBUG_PREFIX} Starting cleanup for current device ${deviceId}...`);

      // Clean up push subscription if exists
      const pushSubscription = await this.registration?.pushManager.getSubscription();
      if (pushSubscription) {
        console.log(`${DEBUG_PREFIX} Removing push subscription...`);
        await pushSubscription.unsubscribe();
      }

      // Delete all subscriptions for this browser instance
      await supabase
        .from('push_subscriptions')
        .delete()
        .match({
          device_id: deviceId,
          browser_instance: platform.browserInstanceId
        });

      // Clear registration reference
      this.registration = undefined;
      this.applicationServerKey = undefined;

      console.log(`${DEBUG_PREFIX} Cleanup completed successfully`);
    } catch (error) {
      const cleanupError = error as Error;
      console.error(`${DEBUG_PREFIX} Cleanup failed:`, {
        errorName: cleanupError.name,
        errorMessage: cleanupError.message,
        errorStack: cleanupError.stack,
        browserInstance: platform.browserInstanceId,
        registrationState: this.registration?.active?.state
      });
      // Even if cleanup fails, ensure all state is cleared
      this.registration = undefined;
      this.applicationServerKey = undefined;
    }
  }
}

export const mobileFCMService = new MobileFCMService();