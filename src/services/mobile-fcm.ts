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

  constructor() {
    // Generate a per-browser-instance ID that won't sync across Chrome instances
    let instanceId = localStorage.getItem(BROWSER_INSTANCE_KEY);
    if (!instanceId) {
      instanceId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(BROWSER_INSTANCE_KEY, instanceId);
    }
    this.browserInstanceId = instanceId;
    
    console.log(`${DEBUG_PREFIX} Initialized with browser instance ID: ${this.browserInstanceId}`);
  }

  private async ensureManifestAccess(): Promise<boolean> {
    try {
      console.log(`${DEBUG_PREFIX} Verifying manifest access...`);
      const manifestResponse = await fetch('/manifest.json', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/manifest+json'
        }
      });
      
      if (!manifestResponse.ok) {
        console.error(`${DEBUG_PREFIX} Manifest access issue:`, manifestResponse.status);
        return false;
      }
      
      const contentType = manifestResponse.headers.get('content-type');
      if (!contentType?.includes('application/manifest+json')) {
        console.error(`${DEBUG_PREFIX} Invalid manifest content-type:`, contentType);
        return false;
      }

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

  private initializationPromise: Promise<boolean> | null = null;

  async initialize(): Promise<boolean> {
    // Return existing initialization if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return true if already initialized
    if (this.initialized) {
      return true;
    }

    // Start new initialization
    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<boolean> {
    try {
      if (!await this.isPushSupported()) {
        console.error(`${DEBUG_PREFIX} Push notifications not supported`);
        return false;
      }

      // Check manifest access first
      const manifestAccessible = await this.ensureManifestAccess();
      if (!manifestAccessible) {
        console.error(`${DEBUG_PREFIX} Cannot access manifest.json - required for push registration`);
        return false;
      }

      const firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;

      // Find existing Firebase SW registration
      const existingRegistrations = await navigator.serviceWorker.getRegistrations();
      const existingFirebaseSW = existingRegistrations.find(reg =>
        reg.active?.scriptURL === firebaseSWURL
      );
      
      // Register or get existing Firebase service worker
      this.registration = existingFirebaseSW || await navigator.serviceWorker.register(firebaseSWURL, {
        scope: '/mobile-fcm/',
        updateViaCache: 'none'
      });

      // Always wait for activation, regardless of whether it's new or existing
      console.log(`${DEBUG_PREFIX} Waiting for service worker activation...`);
      await new Promise<void>((resolve) => {
        const sw = this.registration!.installing || this.registration!.waiting || this.registration!.active;
        
        if (!sw) {
          resolve();
          return;
        }

        if (sw.state === 'activated') {
          console.log(`${DEBUG_PREFIX} Service worker already activated`);
          resolve();
          return;
        }

        const listener = function() {
          console.log(`${DEBUG_PREFIX} Service worker state changed:`, sw.state);
          if (sw.state === 'activated') {
            console.log(`${DEBUG_PREFIX} Service worker activated successfully`);
            sw.removeEventListener('statechange', listener);
            resolve();
          }
        };
        sw.addEventListener('statechange', listener);
      });

      // Send initialization message to activated service worker
      console.log(`${DEBUG_PREFIX} Sending FCM initialization message to service worker...`);
      const initResponse = await this.sendMessageToSW({
        type: 'INIT_FCM',
        deviceInfo: {
          ...platform.getDeviceInfo(),
          deviceId: this.getDeviceId(),
          browserInstanceId: this.browserInstanceId
        }
      });

      console.log(`${DEBUG_PREFIX} FCM initialization response:`, initResponse);
      if (!initResponse.success) {
        throw new Error('FCM initialization failed in service worker');
      }

      // Give Firebase messaging time to fully initialize on mobile
      if (platform.getDeviceInfo().deviceType === 'android') {
        console.log(`${DEBUG_PREFIX} Waiting for mobile FCM initialization...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log(`${DEBUG_PREFIX} Mobile FCM initialization delay complete`);
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Service worker registration failed:`, error);
      await notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
      return false;
    } finally {
      // Clear initialization promise on completion
      this.initializationPromise = null;
      
      // If initialization failed, ensure state is reset
      if (!this.initialized) {
        this.registration = undefined;
      }
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
      // Make sure everything is initialized
      if (!this.initialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          throw new Error('Failed to initialize mobile FCM');
        }
      }

      // Make sure we have permission
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      if (!this.registration) {
        throw new Error('Service worker not registered');
      }

      // Get device identification
      const deviceId = this.getDeviceId();
      const deviceInfo = platform.getDeviceInfo();

      if (!this.registration) {
        throw new Error('Service worker not initialized');
      }

      // Check notification permission first
      if (Notification.permission !== 'granted') {
        console.log(`${DEBUG_PREFIX} No notification permission, requesting...`);
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission denied');
        }
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
          }

          console.log(`${DEBUG_PREFIX} Creating new push subscription...`);
          try {
            subscription = await this.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
            }).catch((error: any) => {
              if (error.name === 'NotAllowedError') {
                throw new Error('Push subscription not allowed by browser');
              }
              throw error;
            });
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

      // Generate FCM token using the subscription
      console.log(`${DEBUG_PREFIX} Starting FCM token generation with subscription:`, {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime
      });

      let token;
      try {
        token = await getToken(getFirebaseMessaging(), {
          vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
          serviceWorkerRegistration: this.registration
        });
      } catch (error: any) {
        // Clean up subscription on token generation failure
        await subscription.unsubscribe();
        throw new Error(`FCM token generation failed: ${error.message}`);
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
      // Update database first
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

      // Notify service worker to clean up
      if (this.registration?.active) {
        await this.sendMessageToSW({
          type: 'CLEAR_FCM_LISTENERS',
          deviceId: deviceId,
          browserInstanceId: this.browserInstanceId,
          forceUnsubscribe: true
        });
      }
      
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Cleanup failed:`, error);
    }
  }
}

export const mobileFCMService = new MobileFCMService();