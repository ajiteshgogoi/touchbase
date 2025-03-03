import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { getFirebaseMessaging } from '../lib/firebase';
import { platform } from '../utils/platform';
import { notificationDiagnostics } from './notification-diagnostics';

const DEBUG_PREFIX = '📱 [Mobile FCM]';

// Use localStorage instead of sessionStorage for better isolation across Chrome instances
const MOBILE_DEVICE_ID_KEY = 'mobile_fcm_device_id';
// Add a browser instance ID to prevent sync issues
const BROWSER_INSTANCE_KEY = 'browser_instance_id';

export class MobileFCMService {
  private registration: ServiceWorkerRegistration | undefined = undefined;
  private initialized = false;
  private browserInstanceId: string;
  private subscriptionPromise: Promise<boolean> | null = null;
  private isSubscribing = false;

  constructor() {
    // Generate a per-browser-instance ID that won't sync across Chrome instances
    let instanceId = localStorage.getItem(BROWSER_INSTANCE_KEY);
    if (!instanceId) {
      instanceId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(BROWSER_INSTANCE_KEY, instanceId);
    }
    this.browserInstanceId = instanceId;
    
    // Clear all stale locks
    this.isSubscribing = false;
    this.subscriptionPromise = null;
    this.isInitializing = false;
    this.initialized = false;
    
    console.log(`${DEBUG_PREFIX} Initialized with browser instance ID: ${this.browserInstanceId}`);
  }

  private async ensureManifestAccess(): Promise<boolean> {
    try {
      // Skip manifest check for iOS as it's not critical there
      if (platform.getDeviceInfo().deviceType === 'ios') {
        return true;
      }

      console.log(`${DEBUG_PREFIX} Verifying manifest access...`);
      const manifestResponse = await fetch('/manifest.json', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/manifest+json, application/json'
        }
      });
      
      if (!manifestResponse.ok) {
        console.error(`${DEBUG_PREFIX} Manifest access issue:`, manifestResponse.status);
        throw new Error(`Manifest HTTP error: ${manifestResponse.status}`);
      }
      
      const contentType = manifestResponse.headers.get('content-type');
      if (!contentType?.includes('application/manifest+json') && !contentType?.includes('application/json')) {
        console.error(`${DEBUG_PREFIX} Invalid manifest content-type:`, contentType);
        throw new Error(`Invalid manifest content-type: ${contentType}`);
      }

      // Try to parse manifest to ensure it's valid
      const manifest = await manifestResponse.json();
      if (!manifest) {
        throw new Error('Empty or invalid manifest');
      }
  
      console.log(`${DEBUG_PREFIX} Manifest access successful:`, {
        contentType,
        name: manifest.name,
        hasIcons: !!manifest.icons?.length
      });
      return true;
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Failed to access manifest:`, error);
      return false;
    }
  }

  private generateDeviceId(): string {
    const deviceInfo = platform.getDeviceInfo();
    
    // Include browser instance ID to differentiate between Chrome instances
    const browserInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      vendor: navigator.vendor,
      instanceId: this.browserInstanceId
    };
    
    // Combine device info and browser characteristics
    const deviceSignature = JSON.stringify({
      type: deviceInfo.deviceType,
      brand: deviceInfo.deviceBrand,
      browser: deviceInfo.browserInfo,
      screen: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      ...browserInfo
    });

    // Create a stable but unique ID
    const devicePrefix = deviceInfo.deviceType;
    const deviceHash = btoa(deviceSignature).slice(0, 12);
    const uniqueId = `${devicePrefix}-${deviceHash}-${this.browserInstanceId.slice(0, 8)}`;

    console.log(`${DEBUG_PREFIX} Generated device ID:`, {
      devicePrefix,
      deviceHash,
      browserInstanceId: this.browserInstanceId,
      uniqueId
    });

    return uniqueId;
  }

  private getDeviceId(): string {
    // Try to get existing device ID
    const storageKey = `${MOBILE_DEVICE_ID_KEY}-${this.browserInstanceId}`;
    let deviceId = localStorage.getItem(storageKey);
    
    if (!deviceId) {
      // Generate and store new device ID
      deviceId = this.generateDeviceId();
      localStorage.setItem(storageKey, deviceId);
    }

    return deviceId;
  }

  /**
   * Check if this is actually a mobile context
   */
  isMobileContext(): boolean {
    const deviceInfo = platform.getDeviceInfo();
    return deviceInfo.deviceType === 'android' ||
           deviceInfo.deviceType === 'ios' ||
           deviceInfo.isPWA ||
           deviceInfo.isTWA;
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
  /**
   * Helper to send messages to the service worker
   */
  private async sendMessageToSW(message: any): Promise<any> {
    if (!this.registration?.active) {
      throw new Error('No active service worker registration');
    }
    
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
      };
      
      this.registration!.active!.postMessage(message, [messageChannel.port2]);
      
      // Set timeout for response
      setTimeout(() => {
        reject(new Error('Service worker message timeout'));
      }, 3000);
    });
  }

  private isInitializing = false;
  private maxRetries = 3;

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    console.log(`${DEBUG_PREFIX} Starting initialization`);

    try {
      // Only clean up Firebase service worker registrations
      console.log(`${DEBUG_PREFIX} Cleaning up old Firebase service worker registrations`);
      const registrations = await navigator.serviceWorker.getRegistrations();
      const firebaseSWs = registrations.filter(reg =>
        reg.active?.scriptURL.includes('firebase-messaging-sw.js')
      );
      
      if (firebaseSWs.length > 0) {
        await Promise.all(firebaseSWs.map(reg => reg.unregister()));
        console.log(`${DEBUG_PREFIX} Unregistered ${firebaseSWs.length} Firebase service worker(s)`);
        // Allow time for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`${DEBUG_PREFIX} No existing Firebase service workers found`);
      }

      // Reset state
      this.initialized = false;
      this.subscriptionPromise = null;
      this.isSubscribing = false;

      // Try initialization with retries
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        console.log(`${DEBUG_PREFIX} Initialization attempt ${attempt}/${this.maxRetries}`);
        try {
          const result = await this._initialize();
          this.initialized = result;
          return result;
        } catch (error) {
          console.error(`${DEBUG_PREFIX} Initialization attempt ${attempt} failed:`, error);
          
          if (attempt === this.maxRetries) {
            this.initialized = false;
            this.registration = undefined;
            await notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
            return false;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Fatal initialization error:`, error);
      this.initialized = false;
      this.registration = undefined;
      return false;
    } finally {
      this.isInitializing = false;
    }
    return false;
  }

  private async _initialize(): Promise<boolean> {
    try {
      if (!await this.isPushSupported()) {
        throw new Error('Push notifications not supported');
      }

      if (!await this.ensureManifestAccess()) {
        throw new Error('Cannot access manifest.json - required for push registration');
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

      // No existing Firebase service worker, register new one
      console.log(`${DEBUG_PREFIX} Registering new Firebase service worker`);
      
      const firebaseSWURL = '/firebase-messaging-sw.js';
      this.registration = await navigator.serviceWorker.register(firebaseSWURL, {
        scope: '/',
        updateViaCache: 'imports'
      });

      // Wait for the service worker to be activated with timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          const sw = this.registration!.installing || this.registration!.waiting || this.registration!.active;
          if (!sw) {
            reject(new Error('No service worker found'));
            return;
          }

          // If already activated, resolve immediately
          if (sw.state === 'activated') {
            resolve();
            return;
          }

          // Otherwise wait for activation
          const timeout = setTimeout(() => {
            sw.removeEventListener('statechange', listener);
            reject(new Error('Service worker activation timeout'));
          }, 10000);

          const listener = () => {
            if (sw.state === 'activated') {
              clearTimeout(timeout);
              sw.removeEventListener('statechange', listener);
              resolve();
            }
          };
          sw.addEventListener('statechange', listener);
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Overall service worker timeout')), 15000)
        )
      ]);

      // Wait for service worker activation with timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          const sw = this.registration!.installing || this.registration!.waiting || this.registration!.active;
          if (!sw) {
            reject(new Error('No service worker found after registration'));
            return;
          }

          if (sw.state === 'activated') {
            resolve();
            return;
          }

          const listener = () => {
            if (sw.state === 'activated') {
              sw.removeEventListener('statechange', listener);
              resolve();
            }
          };
          sw.addEventListener('statechange', listener);
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Service worker activation timeout')), 10000)
        )
      ]);

      // Initialize Firebase messaging
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        throw new Error('Failed to initialize Firebase messaging');
      }

      // Ensure push service is available before proceeding
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const applicationServerKey = this.urlBase64ToUint8Array(vapidKey);
      const pushSupported = await this.registration.pushManager.permissionState({
        userVisibleOnly: true,
        applicationServerKey
      });
      
      if (pushSupported !== 'granted') {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Initialize service worker
      const deviceInfo = platform.getDeviceInfo();
      const initResponse = await this.sendMessageToSW({
        type: 'INIT_FCM',
        deviceInfo: {
          ...deviceInfo,
          deviceId: this.getDeviceId(),
          browserInstanceId: this.browserInstanceId
        }
      });

      if (!initResponse?.success) {
        throw new Error('FCM initialization failed in service worker');
      }
      
      // Wait for service worker to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for service worker to be fully active with timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          if (this.registration?.active?.state === 'activated') {
            resolve();
            return;
          }
          
          const sw = this.registration?.active;
          if (sw) {
            const listener = () => {
              if (sw.state === 'activated') {
                sw.removeEventListener('statechange', listener);
                resolve();
              }
            };
            sw.addEventListener('statechange', listener);
          }
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Service worker activation timeout')), 10000)
        )
      ]);

      // Verify setup with test token
      const testToken = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.registration
      });

      if (!testToken) {
        throw new Error('No FCM token generated');
      }

      // Validate token format (allow longer tokens)
      if (!/^[A-Za-z0-9:_\-\/]+$/.test(testToken)) {
        throw new Error('Invalid FCM token format');
      }

      this.initialized = true;
      this.isInitializing = false;
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
          registrationState: this.registration?.active?.state,
          vapidKeyExists: !!import.meta.env.VITE_VAPID_PUBLIC_KEY
        }
      };
      
      console.error(`${DEBUG_PREFIX} Initialization failed:`, diagnosticInfo);
      await notificationDiagnostics.handleFCMError(error, deviceInfo);
      
      // Cleanup on error
      await this.cleanup();
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
    // Clear any existing subscription state first
    if (this.isSubscribing || this.subscriptionPromise) {
      console.log(`${DEBUG_PREFIX} Cleaning up existing subscription state...`);
      this.subscriptionPromise = null;
      this.isSubscribing = false;

      // Give a small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Ensure we're properly initialized before subscribing
    if (!this.initialized) {
      console.log(`${DEBUG_PREFIX} Initializing before subscription...`);
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        throw new Error('Failed to initialize before subscription');
      }
    }

    // Set subscription lock
    if (this.isSubscribing) {
      console.log(`${DEBUG_PREFIX} Another subscription attempt started, skipping`);
      return false;
    }

    this.isSubscribing = true;

    // Create new subscription promise
    this.subscriptionPromise = this._subscribeToPushNotifications(userId);

    try {
      const result = await this.subscriptionPromise;
      return result;
    } finally {
      // Clear locks regardless of success or failure
      this.isSubscribing = false;
      this.subscriptionPromise = null;
    }
  }

  private async _subscribeToPushNotifications(userId: string): Promise<boolean> {
    try {
      console.log(`${DEBUG_PREFIX} Starting new subscription attempt...`);

      // Make sure everything is initialized
      if (!this.initialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          throw new Error('Failed to initialize mobile FCM');
        }
      }

      if (!this.registration) {
        throw new Error('Service worker not registered');
      }

      // Get device identification
      const deviceId = this.getDeviceId();
      const deviceInfo = platform.getDeviceInfo();

      // Single permission check
      console.log(`${DEBUG_PREFIX} Checking notification permission...`);
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      // Add delay before checking subscription to ensure push service is ready
      console.log(`${DEBUG_PREFIX} Adding pre-subscription delay...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify push service is ready before proceeding
      for (let attempt = 1; attempt <= 3; attempt++) {
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        const applicationServerKey = this.urlBase64ToUint8Array(vapidKey);
        const permState = await this.registration.pushManager.permissionState({
          userVisibleOnly: true,
          applicationServerKey
        });
        
        if (permState === 'granted') break;
        
        console.log(`${DEBUG_PREFIX} Waiting for push service (attempt ${attempt})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Check existing subscription and permissions
      console.log(`${DEBUG_PREFIX} Checking existing push subscription...`);
      let subscription = await this.registration.pushManager.getSubscription();

      // Check permission state for the subscription
      const pushPermissionState = await this.registration.pushManager.permissionState({
        userVisibleOnly: true,
        applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
      });

      console.log(`${DEBUG_PREFIX} Push permission state:`, pushPermissionState);

      // Only proceed if permission is granted and we either have no subscription or need a new one
      if (pushPermissionState === 'granted') {
        const now = Date.now();
        const isExpired = subscription?.expirationTime ? subscription.expirationTime < now : false;

        if (!subscription || isExpired) {
          if (subscription) {
            console.log(`${DEBUG_PREFIX} Removing expired subscription...`);
            await subscription.unsubscribe();
            
            // Add delay after unsubscribe on Android
            if (deviceInfo.deviceType === 'android') {
              console.log(`${DEBUG_PREFIX} Adding post-unsubscribe delay for Android...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }

          console.log(`${DEBUG_PREFIX} Creating new push subscription...`);
          try {
            try {
              const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
              const applicationServerKey = this.urlBase64ToUint8Array(vapidKey);
              
              // Log VAPID key details for debugging
              console.log(`${DEBUG_PREFIX} VAPID key details:`, {
                original: vapidKey,
                length: applicationServerKey.length
              });

              const options = {
                userVisibleOnly: true,
                applicationServerKey
              };
              
              console.log(`${DEBUG_PREFIX} Push subscription options:`, {
                ...options,
                swScope: this.registration.scope,
                swState: this.registration.active?.state
              });
              
              // Handle subscription with retries
              for (let subAttempt = 1; subAttempt <= 3; subAttempt++) {
                try {
                  subscription = await this.registration.pushManager.subscribe(options);
                  break;
                } catch (subError) {
                  if (subAttempt === 3) throw subError;
                  console.log(`${DEBUG_PREFIX} Subscription attempt ${subAttempt} failed, retrying...`);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              }

              // Add delay after subscription before token generation
              console.log(`${DEBUG_PREFIX} Adding post-subscription delay...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (subError: any) {
              console.error(`${DEBUG_PREFIX} Detailed subscription error:`, {
                name: subError.name,
                message: subError.message,
                code: subError.code,
                stack: subError.stack?.split('\n'),
                details: subError.details,
                swScope: this.registration.scope,
                swState: this.registration.active?.state
              });
              throw subError;
            }
          } catch (error: any) {
            console.error(`${DEBUG_PREFIX} Push subscription error:`, {
              name: error.name,
              message: error.message,
              stack: error.stack
            });
            throw new Error(`Push subscription failed: ${error.message}`);
          }
        }
      } else {
        throw new Error(`Push permission denied (state: ${pushPermissionState})`);
      }

      if (!subscription) {
        throw new Error('Failed to create push subscription');
      }

      // Verify push service state before token generation
      console.log(`${DEBUG_PREFIX} Verifying push service state...`);
      const pushManager = this.registration?.pushManager;
      if (!pushManager) {
        throw new Error('Push manager not available');
      }

      // Test push manager permission state
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const applicationServerKey = this.urlBase64ToUint8Array(vapidKey);
      const permissionState = await pushManager.permissionState({
        userVisibleOnly: true,
        applicationServerKey
      });
      console.log(`${DEBUG_PREFIX} Push permission state:`, permissionState);

      if (permissionState !== 'granted') {
        throw new Error(`Push permission not granted: ${permissionState}`);
      }

      // Generate FCM token using the subscription
      console.log(`${DEBUG_PREFIX} Starting FCM token generation with subscription:`, {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        pushManager: 'available',
        permissionState
      });

      let token;
      try {
        const messaging = getFirebaseMessaging();
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        console.log(`${DEBUG_PREFIX} FCM token generation started with VAPID key length:`, vapidKey.length);
        
        token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: this.registration
        });

        // Verify the token was generated
        if (!token) {
          throw new Error('FCM token generation returned empty token');
        }

        console.log(`${DEBUG_PREFIX} FCM token generated successfully:`, {
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 8) + '...',
          subscriptionEndpoint: subscription.endpoint
        });
      } catch (error: any) {
        // Log detailed error info
        console.error(`${DEBUG_PREFIX} FCM token generation failed:`, {
          error: error.toString(),
          code: error.code,
          name: error.name,
          message: error.message,
          stack: error.stack,
          subscription: {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime
          },
          registration: {
            scope: this.registration?.scope,
            active: this.registration?.active?.state
          }
        });

        // Clean up subscription on token generation failure
        await subscription.unsubscribe();
        throw new Error(`FCM token generation failed: ${error.message} (${error.code || 'no code'})`);
      }

      if (!token) {
        await subscription.unsubscribe();
        throw new Error('Failed to generate FCM token');
      }

      console.log(`${DEBUG_PREFIX} Successfully generated FCM token`);

      // Check existing subscription first
      const { data: existingSub, error: subError } = await supabase
        .rpc('get_device_subscription', {
          p_user_id: userId,
          p_device_id: deviceId,
          p_browser_instance: this.browserInstanceId
        });

      if (subError) {
        console.error(`${DEBUG_PREFIX} Error checking subscription:`, subError);
        throw subError;
      }

      // Save token with browser instance info
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          fcm_token: token,
          device_id: deviceId,
          device_name: `${deviceInfo.deviceBrand} ${deviceInfo.browserInfo} (${this.browserInstanceId.slice(0, 8)})`,
          device_type: deviceInfo.deviceType,
          enabled: true,
          browser_instance: this.browserInstanceId,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          last_refresh: new Date().toISOString(),
          refresh_count: existingSub ? (existingSub.refresh_count || 0) + 1 : 0
        }, {
          onConflict: 'user_id,device_id,browser_instance'
        });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Subscribe failed:`, error);
      await notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
      return false;
    }
  }

  /**
   * Cleanup and unsubscribe
   */
  async cleanup(): Promise<void> {
    const deviceId = this.getDeviceId();
    
    try {
      console.log(`${DEBUG_PREFIX} Starting cleanup for device ${deviceId}...`);
      
      // Clear all state and locks first
      this.isSubscribing = false;
      this.isInitializing = false;
      this.subscriptionPromise = null;
      this.initialized = false;
      
      // Clean up Firebase service worker registrations
      const registrations = await navigator.serviceWorker.getRegistrations();
      const firebaseSWs = registrations.filter(reg =>
        reg.active?.scriptURL.includes('firebase-messaging-sw.js')
      );

      for (const reg of firebaseSWs) {
        try {
          // First try to clear FCM listeners if worker is active
          if (reg.active) {
            try {
              await this.sendMessageToSW({
                type: 'CLEAR_FCM_LISTENERS',
                deviceId: deviceId,
                browserInstanceId: this.browserInstanceId,
                forceUnsubscribe: true
              });
              console.log(`${DEBUG_PREFIX} Successfully cleared FCM listeners`);
            } catch (swError) {
              console.warn(`${DEBUG_PREFIX} Failed to clear FCM listeners:`, swError);
            }
          }
          
          // Then unregister the service worker
          const swUrl = reg.active?.scriptURL || 'unknown';
          console.log(`${DEBUG_PREFIX} Unregistering Firebase service worker:`, swUrl);
          await reg.unregister();
          console.log(`${DEBUG_PREFIX} Successfully unregistered Firebase service worker`);
        } catch (error) {
          console.error(`${DEBUG_PREFIX} Error during service worker cleanup:`, error);
        }
      }

      if (firebaseSWs.length === 0) {
        console.log(`${DEBUG_PREFIX} No Firebase service workers found to clean up`);
      }

      // Clean up push subscriptions
      const pushSubscription = await this.registration?.pushManager.getSubscription();
      if (pushSubscription) {
        console.log(`${DEBUG_PREFIX} Removing push subscription...`);
        await pushSubscription.unsubscribe();
      }

      // Update database last (after all local cleanup)
      await supabase
        .from('push_subscriptions')
        .update({
          enabled: false,
          fcm_token: null
        })
        .match({
          device_id: deviceId,
          browser_instance: this.browserInstanceId
        });

      // Clear registration reference
      this.registration = undefined;
      
      console.log(`${DEBUG_PREFIX} Cleanup completed successfully`);
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Cleanup failed:`, error);
      // Even if cleanup fails, ensure all state is cleared
      this.isSubscribing = false;
      this.isInitializing = false;
      this.subscriptionPromise = null;
      this.initialized = false;
      this.registration = undefined;
    }
  }
}

export const mobileFCMService = new MobileFCMService();