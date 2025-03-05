import { supabase } from '../lib/supabase/client';
import { initializeTokenRefresh, cleanupMessaging } from '../lib/firebase';
import { platform } from '../utils/platform';
import { notificationDiagnostics } from './notification-diagnostics';
import { mobileFCMService } from './mobile-fcm';

const DEBUG_PREFIX = '🖥️ [Desktop FCM]';

export class NotificationService {
  private registration: ServiceWorkerRegistration | undefined = undefined;
  private readonly firebaseSWURL: string;
  private isInitializing = false;

  constructor() {
    this.firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
    
    console.log(`${DEBUG_PREFIX} Service worker URL:`, this.firebaseSWURL);
    console.log(`${DEBUG_PREFIX} Initialized with browser instance ID:`, platform.browserInstanceId);
  }

  async getCurrentDeviceNotificationState(userId: string): Promise<boolean> {
    console.log(`${DEBUG_PREFIX} Checking device notification state...`);
    const deviceInfo = platform.getDeviceInfo();
    const isMobile = deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios';
    const deviceId = isMobile
      ? sessionStorage.getItem('mobile_fcm_device_id')
      : localStorage.getItem(platform.getDeviceStorageKey('device_id'));

    if (!deviceId) {
      console.log(`${DEBUG_PREFIX} No device ID found for ${isMobile ? 'mobile' : 'desktop'}`);
      return false;
    }
    
    const { data } = await supabase
      .rpc('get_device_notification_state', {
        p_user_id: userId,
        p_device_id: deviceId
      });

    console.log(`${DEBUG_PREFIX} Device notification state:`, {
      deviceId,
      deviceType: isMobile ? 'mobile' : 'desktop',
      enabled: !!data?.enabled
    });
    return !!data?.enabled;
  }

  async toggleDeviceNotifications(userId: string, deviceId: string, enabled: boolean): Promise<void> {
    console.log(`${DEBUG_PREFIX} Toggling device notifications:`, { deviceId, enabled });
    
    try {
      type DeviceSubscription = { enabled: boolean; fcm_token: string | null };
      
      const { data, error: fetchError } = await supabase
        .rpc('get_device_subscription', {
          p_user_id: userId,
          p_device_id: deviceId,
          p_browser_instance: platform.browserInstanceId
        });

      const subscription = data as DeviceSubscription;

      if (fetchError || !subscription) {
        throw new Error(`Failed to fetch device subscription: ${fetchError?.message || 'No data returned'}`);
      }

      console.log(`${DEBUG_PREFIX} Current subscription state:`, subscription);

      // If enabling notifications and no FCM token exists, need to resubscribe
      if (enabled && !subscription?.fcm_token) {
        if (deviceId === localStorage.getItem(platform.getDeviceStorageKey('device_id'))) {
          console.log(`${DEBUG_PREFIX} Resubscribing current device...`);
          await this.subscribeToPushNotifications(userId, true, enabled);
        } else {
          throw new Error('Cannot enable notifications for inactive device');
        }
      } else {
        console.log(`${DEBUG_PREFIX} Updating device enabled state:`, { deviceId, enabled });
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({ enabled })
          .match({ user_id: userId, device_id: deviceId, browser_instance: platform.browserInstanceId });

        if (updateError) {
          throw new Error(`Failed to update device notification state: ${updateError.message}`);
        }
      }

    } catch (error) {
      console.error(`${DEBUG_PREFIX} Error toggling device notifications:`, error);
      throw error;
    }
  }
  
  async cleanupAllDevices(): Promise<void> {
    console.log(`${DEBUG_PREFIX} Starting device cleanup...`);
    
    try {
      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        console.log(`${DEBUG_PREFIX} Delegating to mobile cleanup...`);
        await mobileFCMService.cleanup();
      } else {
        console.log(`${DEBUG_PREFIX} Cleaning up desktop device...`);
        await cleanupMessaging();
        
        const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
        if (deviceId) {
          const userId = (await supabase.auth.getSession()).data.session?.user.id;
          if (userId) {
            await this.unsubscribeFromPushNotifications(userId, deviceId, true);
          }
        }
        
        // Don't remove device ID on cleanup - let it remain stable
        console.log(`${DEBUG_PREFIX} Desktop cleanup completed`);
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Failed to cleanup devices:`, error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      console.log(`${DEBUG_PREFIX} FCM initialization already in progress`);
      return;
    }

    this.isInitializing = true;
    console.log(`${DEBUG_PREFIX} Initializing FCM...`);
    
    if (!('serviceWorker' in navigator)) {
      console.warn(`${DEBUG_PREFIX} Service workers not supported`);
      this.isInitializing = false;
      return;
    }

    try {
      // Wait for valid session before proceeding
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid auth token available');
      }

      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        console.log(`${DEBUG_PREFIX} Delegating to mobile initialization...`);
        await mobileFCMService.initialize();
      } else {
        console.log(`${DEBUG_PREFIX} Initializing desktop FCM...`);
        // Handle service worker registration for desktop
        const existingRegistrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of existingRegistrations) {
          if (reg.active?.scriptURL !== this.firebaseSWURL) {
            console.log(`${DEBUG_PREFIX} Unregistering old service worker:`, reg.active?.scriptURL);
            await reg.unregister();
          }
        }

        // Use existing or register new Firebase service worker
        console.log(`${DEBUG_PREFIX} Registering service worker...`);
        this.registration = existingRegistrations.find(reg => 
          reg.active?.scriptURL === this.firebaseSWURL
        ) || await navigator.serviceWorker.register(this.firebaseSWURL, {
          scope: '/',
          updateViaCache: 'none'
        });

        // Ensure service worker is active
        if (this.registration.installing || this.registration.waiting) {
          console.log(`${DEBUG_PREFIX} Waiting for service worker activation...`);
          await new Promise<void>((resolve) => {
            const sw = this.registration!.installing || this.registration!.waiting;
            if (!sw) {
              resolve();
              return;
            }
            sw.addEventListener('statechange', function listener(event: Event) {
                console.log(`${DEBUG_PREFIX} Service worker state changed:`, (event.target as ServiceWorker).state);
                if ((event.target as ServiceWorker).state === 'activated') {
                  console.log(`${DEBUG_PREFIX} Service worker activated successfully`);
                  sw.removeEventListener('statechange', listener);
                  resolve();
                }
              });
            });
          } else {
            console.log(`${DEBUG_PREFIX} Service worker already activated`);
          }
        }
  
        // Initialize token refresh if user is authenticated
        if (session.user) {
          console.log(`${DEBUG_PREFIX} Starting FCM initialization...`);
          
          // Get manifest to check version
          const manifestResponse = await fetch('/manifest.json');
          const manifest = await manifestResponse.json();
          
          // Send version info to service worker
          await new Promise<void>((resolve, reject) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => {
              if (event.data?.error === 'Service worker version mismatch') {
                console.log(`${DEBUG_PREFIX} Service worker version mismatch, will reinitialize`);
                // Service worker will unregister itself, next initialization will get new version
                reject(new Error('Version mismatch'));
                return;
              }
              resolve();
            };
            this.registration?.active?.postMessage({
              type: 'INIT_FCM',
              version: manifest.version,
              deviceInfo: platform.getDeviceInfo()
            }, [channel.port2]);
          });
          
          console.log(`${DEBUG_PREFIX} FCM initialization completed successfully`);
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Service Worker registration failed:`, error);
      this.isInitializing = false;
      return notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }

    this.isInitializing = false;
  }

  async subscribeToPushNotifications(
    userId: string,
    forceResubscribe = false,
    enableNotifications = true
  ): Promise<void> {
    console.log(`${DEBUG_PREFIX} Starting push notification subscription...`, {
      forceResubscribe,
      enableNotifications
    });
    
    try {
      const deviceInfo = platform.getDeviceInfo();
      
      // Check device limit first before any initialization
      const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'))
        || platform.generateDeviceId();

      if (!forceResubscribe) {
        const { data: devices } = await supabase
          .from('push_subscriptions')
          .select('device_id')
          .eq('user_id', userId);

        if (devices && devices.length >= 10 && !devices.find(d => d.device_id === deviceId)) {
          throw new Error('Maximum number of devices (10) reached');
        }
      }

      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        console.log(`${DEBUG_PREFIX} Delegating to mobile subscription...`);
        await mobileFCMService.subscribeToPushNotifications(userId);
        return;
      }

      // Request notification permission for desktop
      console.log(`${DEBUG_PREFIX} Requesting notification permission...`);
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Desktop initialization and token refresh
      await this.initialize();
      await initializeTokenRefresh(userId);

      console.log(`${DEBUG_PREFIX} Push notification subscription completed successfully`);
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Failed to subscribe to push notifications:`, error);
      return notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }

  async unsubscribeFromPushNotifications(userId: string, deviceId?: string, forceCleanup = false): Promise<void> {
    console.log(`${DEBUG_PREFIX} Starting push notification unsubscribe...`, {
      deviceId,
      forceCleanup
    });
    
    try {
      const targetDeviceId = deviceId || localStorage.getItem(platform.getDeviceStorageKey('device_id'));
      if (!targetDeviceId) return;

      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        console.log(`${DEBUG_PREFIX} Delegating to mobile device unsubscribe...`);
        await mobileFCMService.unsubscribeDevice(userId, targetDeviceId);
        return;
      }
      if (!targetDeviceId) return;

      if (targetDeviceId === localStorage.getItem(platform.getDeviceStorageKey('device_id'))) {
        console.log(`${DEBUG_PREFIX} Cleaning up messaging...`);
        await cleanupMessaging();
      }

      console.log(`${DEBUG_PREFIX} Deleting subscription from database...`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .match({
          user_id: userId,
          device_id: targetDeviceId,
          browser_instance: platform.browserInstanceId
        });

      if (targetDeviceId === localStorage.getItem(platform.getDeviceStorageKey('device_id'))) {
        localStorage.removeItem(platform.getDeviceStorageKey('device_id'));
      }

      console.log(`${DEBUG_PREFIX} Push notification unsubscribe completed successfully`);
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Failed to unsubscribe:`, error);
      throw error;
    }
  }

  async checkPermission(forGlobalSetting?: boolean): Promise<boolean> {
    console.log(`${DEBUG_PREFIX} Checking notification permission...`, {
      forGlobalSetting
    });
    
    if (!('Notification' in window)) {
      console.log(`${DEBUG_PREFIX} Notifications not supported`);
      return false;
    }

    if (Notification.permission === 'denied') {
      console.log(`${DEBUG_PREFIX} Notifications denied by browser`);
      return false;
    }

    // For global settings, only check browser permission
    if (forGlobalSetting) {
      const permitted = Notification.permission === 'granted';
      console.log(`${DEBUG_PREFIX} Global permission check:`, permitted);
      return permitted;
    }

    // For device-specific checks, also check device state
    const deviceInfo = platform.getDeviceInfo();
    const isMobile = deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios';
    const deviceId = isMobile
      ? sessionStorage.getItem('mobile_fcm_device_id')
      : localStorage.getItem(platform.getDeviceStorageKey('device_id'));
    if (deviceId) {
      console.log(`${DEBUG_PREFIX} Checking device-specific state...`);
      const { data: subscription } = await supabase
        .rpc('get_device_notification_state', {
          p_user_id: (await supabase.auth.getSession()).data.session?.user.id!,
          p_device_id: deviceId
        });
      
      if (subscription?.enabled === false) {
        console.log(`${DEBUG_PREFIX} Notifications disabled for device`);
        return false;
      }
    }

    const permitted = Notification.permission === 'granted';
    console.log(`${DEBUG_PREFIX} Permission check result:`, permitted);
    return permitted;
  }

  async sendTestNotification(userId: string, message?: string): Promise<void> {
    console.log(`${DEBUG_PREFIX} Sending test notification...`);
    
    try {
      // Initialize and explicitly wait for service worker activation
      await this.initialize();
      
      const maxWaitTime = 10000; // 10 seconds
      const startTime = Date.now();
      
      while (!this.registration?.active && Date.now() - startTime < maxWaitTime) {
        console.log(`${DEBUG_PREFIX} Waiting for service worker activation...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!this.registration?.active) {
        throw new Error('Firebase service worker failed to activate');
      }

      // Double check service worker state
      if (this.registration.active.state !== 'activated') {
        console.log(`${DEBUG_PREFIX} Service worker not in activated state, waiting...`);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Service worker activation timeout')), 5000);
          this.registration!.active!.addEventListener('statechange', (e: Event) => {
            const target = e.target as ServiceWorker;
            if (target.state === 'activated') {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }

      // Ensure subscription is active
      console.log(`${DEBUG_PREFIX} Ensuring active subscription...`);
      await this.subscribeToPushNotifications(userId, true);
      
      console.log(`${DEBUG_PREFIX} Making test notification request...`);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          message: message || 'This is a test notification'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send test notification');
      }

      console.log(`${DEBUG_PREFIX} Test notification sent successfully`);
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Failed to send test notification:`, error);
      return notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }
}

export const notificationService = new NotificationService();

if (import.meta.env.DEV) {
  (window as any).notificationService = notificationService;
}