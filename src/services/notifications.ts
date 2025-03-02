import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { getFirebaseMessaging, initializeTokenRefresh, cleanupMessaging } from '../lib/firebase';
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
          p_device_id: deviceId
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
          .match({ user_id: userId, device_id: deviceId });

        if (updateError) {
          throw new Error(`Failed to update device notification state: ${updateError.message}`);
        }
      }

    } catch (error) {
      console.error(`${DEBUG_PREFIX} Error toggling device notifications:`, error);
      throw error;
    }
  }
  
  async resubscribeIfNeeded(userId: string): Promise<void> {
    console.log(`${DEBUG_PREFIX} Checking if resubscription needed...`);
    
    try {
      const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
      
      const { data: subscription } = await supabase
        .rpc('get_device_subscription', {
          p_user_id: userId,
          p_device_id: deviceId
        });

      console.log(`${DEBUG_PREFIX} Current subscription:`, subscription);

      // Don't auto-resubscribe if notifications are disabled
      if (subscription && !subscription.enabled) {
        console.log(`${DEBUG_PREFIX} Notifications disabled, skipping resubscription`);
        return;
      }

      // No subscription or missing token
      if (!subscription?.fcm_token || !deviceId) {
        console.log(`${DEBUG_PREFIX} No valid subscription found, resubscribing...`);
        await this.subscribeToPushNotifications(userId, true);
        return;
      }

      // Verify token with server
      console.log(`${DEBUG_PREFIX} Verifying FCM token...`);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();
      
      if (response.status === 500 && data.error?.includes('FCM token invalid')) {
        console.log(`${DEBUG_PREFIX} Invalid FCM token detected, resubscribing...`);
        await this.subscribeToPushNotifications(userId, true);
      } else {
        console.log(`${DEBUG_PREFIX} FCM token verification successful`);
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Error in resubscribeIfNeeded:`, error);
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
        
        localStorage.removeItem(platform.getDeviceStorageKey('device_id'));
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
          scope: '/desktop-fcm/',
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
        console.log(`${DEBUG_PREFIX} Initializing token refresh for device:`, {
          deviceType: deviceInfo.deviceType,
          registrationActive: !!this.registration?.active,
          registrationScope: this.registration?.scope
        });
        await initializeTokenRefresh(session.user.id);
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
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        console.log(`${DEBUG_PREFIX} Delegating to mobile subscription...`);
        await mobileFCMService.subscribeToPushNotifications(userId);
        return;
      }

      // Desktop flow
      if (!this.registration?.active) {
        console.log(`${DEBUG_PREFIX} Initializing before subscription...`);
        await this.initialize();
      }

      console.log(`${DEBUG_PREFIX} Requesting notification permission...`);
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Check existing subscription unless forced
      if (!forceResubscribe) {
        const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
        if (deviceId) {
          console.log(`${DEBUG_PREFIX} Checking existing subscription...`);
          const { data: subscription } = await supabase
            .rpc('get_device_subscription', {
              p_user_id: userId,
              p_device_id: deviceId
            });
            
          if (subscription?.fcm_token && subscription.enabled) {
            console.log(`${DEBUG_PREFIX} Valid subscription exists, skipping`);
            return;
          }
        }
      }

      // Generate new token
      console.log(`${DEBUG_PREFIX} Generating new FCM token...`);
      const currentToken = await getToken(getFirebaseMessaging(), {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.registration
      });

      if (!currentToken) {
        throw new Error('Failed to get FCM token');
      }

      console.log(`${DEBUG_PREFIX} FCM token generated successfully`);

      // Get device info and ID
      const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id')) 
        || platform.generateDeviceId();

      // Store token with device info
      console.log(`${DEBUG_PREFIX} Storing subscription in database...`);
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          fcm_token: currentToken,
          device_id: deviceId,
          device_name: `${deviceInfo.deviceBrand} ${deviceInfo.browserInfo}`,
          device_type: deviceInfo.deviceType,
          enabled: enableNotifications,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'user_id,device_id'
        });

      if (error) {
        if (error.message?.includes('check_device_limit')) {
          throw new Error('Maximum number of devices (10) reached');
        }
        throw error;
      }

      // Store device ID in local storage
      localStorage.setItem(platform.getDeviceStorageKey('device_id'), deviceId);
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
      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        console.log(`${DEBUG_PREFIX} Delegating to mobile cleanup...`);
        await mobileFCMService.cleanup();
        return;
      }

      const targetDeviceId = deviceId || localStorage.getItem(platform.getDeviceStorageKey('device_id'));
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
          device_id: targetDeviceId
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
      await this.initialize();
      
      if (!this.registration?.active) {
        throw new Error('Firebase service worker failed to activate');
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