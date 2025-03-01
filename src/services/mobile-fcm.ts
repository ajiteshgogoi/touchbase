import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { getFirebaseMessaging, cleanupMessaging } from '../lib/firebase';
import { platform } from '../utils/platform';

const MOBILE_SW_SESSION_KEY = 'mobile_fcm_session';

interface MobileFCMSession {
  instanceId: string;
  deviceId: string;
  timestamp: number;
}

export class MobileFCMService {
  private registration: ServiceWorkerRegistration | undefined = undefined;

  private getMobileSWURL(instanceId: string): string {
    // Create a unique service worker URL for this mobile session
    return new URL(
      `/firebase-messaging-sw.js?mobile=true&instance=${instanceId}&t=${Date.now()}`,
      window.location.origin
    ).href;
  }

  private async getOrCreateSession(): Promise<MobileFCMSession> {
    // Try to get existing session
    const storedSession = sessionStorage.getItem(MOBILE_SW_SESSION_KEY);
    if (storedSession) {
      const session = JSON.parse(storedSession) as MobileFCMSession;
      // Verify session is still valid (less than 24 hours old)
      if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
        return session;
      }
    }

    // Create new session
    const deviceInfo = platform.getDeviceInfo();
    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deviceId = `mobile-${deviceInfo.deviceType}-${instanceId}`;
    
    const session: MobileFCMSession = {
      instanceId,
      deviceId,
      timestamp: Date.now()
    };

    // Store in sessionStorage to prevent Chrome sync
    sessionStorage.setItem(MOBILE_SW_SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers not supported');
    }

    try {
      // Get session-specific identifiers
      const session = await this.getOrCreateSession();
      const swUrl = this.getMobileSWURL(session.instanceId);

      // Clean up any existing service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }

      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Register new service worker with unique scope
      this.registration = await navigator.serviceWorker.register(swUrl, {
        scope: `/fcm-mobile-${session.instanceId}/`,
        updateViaCache: 'none'
      });

      // Ensure it's activated
      if (!this.registration) {
        throw new Error('Service worker registration failed');
      }

      const sw = this.registration.installing;
      if (sw) {
        await new Promise<void>((resolve) => {
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
      // Initialize if needed
      if (!this.registration?.active) {
        await this.initialize();
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get session
      const session = await this.getOrCreateSession();

      // Generate token
      const token = await getToken(getFirebaseMessaging(), {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.registration
      });

      if (!token) {
        throw new Error('Failed to generate FCM token');
      }

      // Store token with session-specific device info
      const deviceInfo = platform.getDeviceInfo();
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          fcm_token: token,
          device_id: session.deviceId,
          device_name: `${deviceInfo.deviceBrand} ${deviceInfo.browserInfo} (Mobile)`,
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
      console.error('Mobile push subscription failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const session = await this.getOrCreateSession();

      // Clean up Firebase
      await cleanupMessaging();

      // Unregister service worker
      if (this.registration) {
        await this.registration.unregister();
      }

      // Clear session storage
      sessionStorage.removeItem(MOBILE_SW_SESSION_KEY);

      // Update database
      await supabase
        .from('push_subscriptions')
        .update({ 
          enabled: false,
          fcm_token: null 
        })
        .match({ device_id: session.deviceId });

    } catch (error) {
      console.error('Mobile FCM cleanup failed:', error);
      throw error;
    }
  }
}

export const mobileFCMService = new MobileFCMService();