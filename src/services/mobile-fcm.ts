import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { getFirebaseMessaging } from '../lib/firebase';
import { platform } from '../utils/platform';
import { notificationDiagnostics } from './notification-diagnostics';

// Key for storing device ID in sessionStorage to prevent Chrome sync issues
const MOBILE_DEVICE_ID_KEY = 'mobile_fcm_device_id';

export class MobileFCMService {
  private registration: ServiceWorkerRegistration | undefined = undefined;

  private generateDeviceId(): string {
    const deviceInfo = platform.getDeviceInfo();
    const browserInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      vendor: navigator.vendor
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
    const stableId = `${deviceInfo.deviceType}-${btoa(deviceSignature).slice(0, 8)}`;
    const uniqueId = `${stableId}-${Date.now()}`;

    return uniqueId;
  }

  private getDeviceId(): string {
    // Try to get existing device ID from session storage
    let deviceId = sessionStorage.getItem(MOBILE_DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate and store new device ID
      deviceId = this.generateDeviceId();
      sessionStorage.setItem(MOBILE_DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  }

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers not supported');
    }

    const firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;

    try {
      // Handle existing service workers
      const existingRegistrations = await navigator.serviceWorker.getRegistrations();
      
      // Only unregister non-Firebase service workers
      await Promise.all(
        existingRegistrations
          .filter(reg => reg.active?.scriptURL !== firebaseSWURL)
          .map(reg => reg.unregister())
      );

      // Use existing Firebase service worker or register new one
      this.registration = existingRegistrations.find(reg =>
        reg.active?.scriptURL === firebaseSWURL
      ) || await navigator.serviceWorker.register(firebaseSWURL, {
        scope: '/',
        updateViaCache: 'none'
      });

      // Wait for activation
      if (this.registration.installing) {
        await new Promise<void>((resolve) => {
          const sw = this.registration!.installing;
          if (!sw) {
            resolve();
            return;
          }
          const listener = function() {
            if (sw.state === 'activated') {
              sw.removeEventListener('statechange', listener);
              resolve();
            }
          };
          sw.addEventListener('statechange', listener);
        });
      }
    } catch (error) {
      console.error('Mobile FCM initialization failed:', error);
      throw error;
    }
  }

  async subscribeToPushNotifications(userId: string): Promise<void> {
    try {
      await this.initialize();

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get device identification
      const deviceId = this.getDeviceId();
      const deviceInfo = platform.getDeviceInfo();

      // Generate FCM token
      const token = await getToken(getFirebaseMessaging(), {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.registration
      });

      if (!token) {
        throw new Error('Failed to generate FCM token');
      }

      // Store subscription
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          fcm_token: token,
          device_id: deviceId,
          device_name: `${deviceInfo.deviceBrand} ${deviceInfo.browserInfo}`,
          device_type: deviceInfo.deviceType,
          enabled: true,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'user_id,device_id'
        });

      if (error) {
        throw error;
      }

    } catch (error) {
      await notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }

  async cleanup(): Promise<void> {
    const deviceId = sessionStorage.getItem(MOBILE_DEVICE_ID_KEY);
    if (!deviceId) return;

    try {
      // Update database first
      await supabase
        .from('push_subscriptions')
        .update({ 
          enabled: false,
          fcm_token: null 
        })
        .match({ device_id: deviceId });

      // Only unregister Firebase service worker
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter(reg => reg.active?.scriptURL.includes('firebase-messaging-sw.js'))
          .map(reg => reg.unregister())
      );

      // Clear session storage
      sessionStorage.removeItem(MOBILE_DEVICE_ID_KEY);
      
    } catch (error) {
      console.error('Mobile FCM cleanup failed:', error);
      throw error;
    }
  }
}

export const mobileFCMService = new MobileFCMService();