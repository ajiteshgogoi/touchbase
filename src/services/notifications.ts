import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { getFirebaseMessaging, initializeTokenRefresh, cleanupMessaging } from '../lib/firebase';
import { platform } from '../utils/platform';
import { notificationDiagnostics } from './notification-diagnostics';
import { mobileFCMService } from './mobile-fcm';

export class NotificationService {
  private registration: ServiceWorkerRegistration | undefined = undefined;
  private readonly firebaseSWURL: string;

  constructor() {
    this.firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
  }

  async getCurrentDeviceNotificationState(userId: string): Promise<boolean> {
    const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
    if (!deviceId) return false;
    
    const { data } = await supabase
      .rpc('get_device_notification_state', {
        p_user_id: userId,
        p_device_id: deviceId
      });

    return !!data?.enabled;
  }

  async toggleDeviceNotifications(userId: string, deviceId: string, enabled: boolean): Promise<void> {
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

      // If enabling notifications and no FCM token exists, need to resubscribe
      if (enabled && !subscription?.fcm_token) {
        if (deviceId === localStorage.getItem(platform.getDeviceStorageKey('device_id'))) {
          await this.subscribeToPushNotifications(userId, true, enabled);
        } else {
          throw new Error('Cannot enable notifications for inactive device');
        }
      } else {
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({ enabled })
          .match({ user_id: userId, device_id: deviceId });

        if (updateError) {
          throw new Error(`Failed to update device notification state: ${updateError.message}`);
        }
      }

    } catch (error) {
      console.error('Error toggling device notifications:', error);
      throw error;
    }
  }

  async resubscribeIfNeeded(userId: string): Promise<void> {
    try {
      const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
      
      const { data: subscription } = await supabase
        .rpc('get_device_subscription', {
          p_user_id: userId,
          p_device_id: deviceId
        });

      // Don't auto-resubscribe if notifications are disabled
      if (subscription && !subscription.enabled) {
        return;
      }

      // No subscription or missing token
      if (!subscription?.fcm_token || !deviceId) {
        await this.subscribeToPushNotifications(userId, true);
        return;
      }

      // Verify token with server
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
        await this.subscribeToPushNotifications(userId, true);
      }
    } catch (error) {
      console.error('Error in resubscribeIfNeeded:', error);
      throw error;
    }
  }

  async cleanupAllDevices(): Promise<void> {
    try {
      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        await mobileFCMService.cleanup();
      } else {
        await cleanupMessaging();
        
        const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
        if (deviceId) {
          const userId = (await supabase.auth.getSession()).data.session?.user.id;
          if (userId) {
            await this.unsubscribeFromPushNotifications(userId, deviceId, true);
          }
        }
        
        localStorage.removeItem(platform.getDeviceStorageKey('device_id'));
      }
    } catch (error) {
      console.error('Failed to cleanup devices:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not supported');
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
        await mobileFCMService.initialize();
      } else {
        // Handle service worker registration for desktop
        const existingRegistrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of existingRegistrations) {
          if (reg.active?.scriptURL !== this.firebaseSWURL) {
            await reg.unregister();
          }
        }

        // Use existing or register new Firebase service worker
        this.registration = existingRegistrations.find(reg => 
          reg.active?.scriptURL === this.firebaseSWURL
        ) || await navigator.serviceWorker.register(this.firebaseSWURL, {
          scope: '/',
          updateViaCache: 'none'
        });

        // Ensure service worker is active
        if (this.registration.installing || this.registration.waiting) {
          await new Promise<void>((resolve) => {
            const sw = this.registration!.installing || this.registration!.waiting;
            if (!sw) {
              resolve();
              return;
            }
            sw.addEventListener('statechange', function listener(event: Event) {
              if ((event.target as ServiceWorker).state === 'activated') {
                sw.removeEventListener('statechange', listener);
                resolve();
              }
            });
          });
        }
      }

      // Initialize token refresh if user is authenticated
      if (session.user) {
        await initializeTokenRefresh(session.user.id);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }

  async subscribeToPushNotifications(
    userId: string, 
    forceResubscribe = false,
    enableNotifications = true
  ): Promise<void> {
    try {
      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        await mobileFCMService.subscribeToPushNotifications(userId);
        return;
      }

      // Desktop flow
      if (!this.registration?.active) {
        await this.initialize();
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Check existing subscription unless forced
      if (!forceResubscribe) {
        const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
        if (deviceId) {
          const { data: subscription } = await supabase
            .rpc('get_device_subscription', {
              p_user_id: userId,
              p_device_id: deviceId
            });
            
          if (subscription?.fcm_token && subscription.enabled) {
            return;
          }
        }
      }

      // Generate new token
      const currentToken = await getToken(getFirebaseMessaging(), {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.registration
      });

      if (!currentToken) {
        throw new Error('Failed to get FCM token');
      }

      // Get device info and ID
      const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id')) 
        || platform.generateDeviceId();

      // Store token with device info
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

    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }

  async unsubscribeFromPushNotifications(userId: string, deviceId?: string, forceCleanup = false): Promise<void> {
    try {
      const deviceInfo = platform.getDeviceInfo();
      if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
        await mobileFCMService.cleanup();
        return;
      }

      const targetDeviceId = deviceId || localStorage.getItem(platform.getDeviceStorageKey('device_id'));
      if (!targetDeviceId) return;

      if (targetDeviceId === localStorage.getItem(platform.getDeviceStorageKey('device_id'))) {
        await cleanupMessaging();
      }

      const updateData = forceCleanup 
        ? { enabled: false, fcm_token: null }
        : { enabled: false };

      await supabase
        .from('push_subscriptions')
        .update(updateData)
        .match({ 
          user_id: userId, 
          device_id: targetDeviceId 
        });

      if (targetDeviceId === localStorage.getItem(platform.getDeviceStorageKey('device_id'))) {
        localStorage.removeItem(platform.getDeviceStorageKey('device_id'));
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      throw error;
    }
  }

  async checkPermission(forGlobalSetting?: boolean): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    // For global settings, only check browser permission
    if (forGlobalSetting) {
      return Notification.permission === 'granted';
    }

    // For device-specific checks, also check device state
    const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
    if (deviceId) {
      const { data: subscription } = await supabase
        .rpc('get_device_notification_state', {
          p_user_id: (await supabase.auth.getSession()).data.session?.user.id!,
          p_device_id: deviceId
        });
      
      if (subscription?.enabled === false) {
        return false;
      }
    }

    return Notification.permission === 'granted';
  }

  async sendTestNotification(userId: string, message?: string): Promise<void> {
    try {
      await this.initialize();
      
      if (!this.registration?.active) {
        throw new Error('Firebase service worker failed to activate');
      }

      // Ensure subscription is active
      await this.subscribeToPushNotifications(userId, true);
      
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
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }
}

export const notificationService = new NotificationService();

if (import.meta.env.DEV) {
  (window as any).notificationService = notificationService;
}