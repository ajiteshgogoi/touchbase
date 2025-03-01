import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { getFirebaseMessaging, cleanupMessaging } from '../lib/firebase';
import { platform } from '../utils/platform';
import { notificationDiagnostics } from './notification-diagnostics';

const MOBILE_SW_SESSION_KEY = 'mobile_fcm_session';
const DEBUG_PREFIX = '📱 [Mobile FCM]';

interface MobileFCMSession {
  instanceId: string;
  deviceId: string;
  timestamp: number;
}

export class MobileFCMService {
  private registration: ServiceWorkerRegistration | undefined = undefined;

  private getMobileSWURL(instanceId: string): string {
    const swUrl = new URL(
      `/firebase-messaging-sw.js?mobile=true&instance=${instanceId}&t=${Date.now()}`,
      window.location.origin
    ).href;
    console.log(`${DEBUG_PREFIX} Created SW URL:`, swUrl);
    return swUrl;
  }

  private async logServiceWorkerState() {
    const swState = await notificationDiagnostics.getDiagnosticInfo();
    console.log(`${DEBUG_PREFIX} Service Worker State:`, swState);
  }

  private async getOrCreateSession(): Promise<MobileFCMSession> {
    console.log(`${DEBUG_PREFIX} Getting or creating session...`);
    
    // Try to get existing session
    const storedSession = sessionStorage.getItem(MOBILE_SW_SESSION_KEY);
    if (storedSession) {
      const session = JSON.parse(storedSession) as MobileFCMSession;
      // Verify session is still valid (less than 24 hours old)
      if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
        console.log(`${DEBUG_PREFIX} Using existing session:`, {
          deviceId: session.deviceId,
          instanceId: session.instanceId,
          age: Math.round((Date.now() - session.timestamp) / 1000 / 60) + ' minutes'
        });
        return session;
      }
      console.log(`${DEBUG_PREFIX} Existing session expired, creating new one`);
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

    console.log(`${DEBUG_PREFIX} Created new session:`, {
      deviceId: session.deviceId,
      instanceId: session.instanceId,
      deviceInfo
    });

    // Store in sessionStorage to prevent Chrome sync
    sessionStorage.setItem(MOBILE_SW_SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async initialize(): Promise<void> {
    console.log(`${DEBUG_PREFIX} Initializing...`);
    
    if (!('serviceWorker' in navigator)) {
      const error = new Error('Service workers not supported');
      console.error(`${DEBUG_PREFIX} Initialization failed:`, error);
      throw error;
    }

    try {
      // Get session-specific identifiers
      const session = await this.getOrCreateSession();
      const swUrl = this.getMobileSWURL(session.instanceId);

      console.log(`${DEBUG_PREFIX} Cleaning up existing service workers...`);
      // Clean up any existing service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
      console.log(`${DEBUG_PREFIX} Unregistered ${registrations.length} service workers`);

      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(`${DEBUG_PREFIX} Registering new service worker...`);
      // Register new service worker with unique scope
      this.registration = await navigator.serviceWorker.register(swUrl, {
        scope: `/fcm-mobile-${session.instanceId}/`,
        updateViaCache: 'none'
      });

      // Ensure registration is valid
      if (!this.registration) {
        throw new Error('Service worker registration failed');
      }

      // Ensure it's activated
      const sw = this.registration.installing;
      if (sw) {
        console.log(`${DEBUG_PREFIX} Waiting for service worker activation...`);
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

      console.log(`${DEBUG_PREFIX} Service worker activated successfully`);
      await this.logServiceWorkerState();

    } catch (error) {
      console.error(`${DEBUG_PREFIX} Initialization failed:`, error);
      await notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }

  async subscribeToPushNotifications(userId: string): Promise<void> {
    console.log(`${DEBUG_PREFIX} Starting push notification subscription...`);
    
    try {
      // Initialize if needed
      if (!this.registration?.active) {
        await this.initialize();
      }

      // Request permission
      console.log(`${DEBUG_PREFIX} Requesting notification permission...`);
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get session
      const session = await this.getOrCreateSession();

      console.log(`${DEBUG_PREFIX} Generating FCM token...`);
      // Generate token
      const token = await getToken(getFirebaseMessaging(), {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.registration
      });

      if (!token) {
        throw new Error('Failed to generate FCM token');
      }

      console.log(`${DEBUG_PREFIX} FCM token generated successfully`);

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

      console.log(`${DEBUG_PREFIX} Successfully subscribed to push notifications`);
      await this.logServiceWorkerState();

    } catch (error) {
      console.error(`${DEBUG_PREFIX} Push subscription failed:`, error);
      await notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }

  async cleanup(): Promise<void> {
    console.log(`${DEBUG_PREFIX} Starting cleanup...`);
    
    try {
      const session = await this.getOrCreateSession();

      console.log(`${DEBUG_PREFIX} Cleaning up Firebase messaging...`);
      await cleanupMessaging();

      if (this.registration) {
        console.log(`${DEBUG_PREFIX} Unregistering service worker...`);
        await this.registration.unregister();
      }

      console.log(`${DEBUG_PREFIX} Clearing session storage...`);
      sessionStorage.removeItem(MOBILE_SW_SESSION_KEY);

      console.log(`${DEBUG_PREFIX} Updating database...`);
      await supabase
        .from('push_subscriptions')
        .update({ 
          enabled: false,
          fcm_token: null 
        })
        .match({ device_id: session.deviceId });

      console.log(`${DEBUG_PREFIX} Cleanup completed successfully`);
      await this.logServiceWorkerState();

    } catch (error) {
      console.error(`${DEBUG_PREFIX} Cleanup failed:`, error);
      await notificationDiagnostics.handleFCMError(error, platform.getDeviceInfo());
    }
  }
}

export const mobileFCMService = new MobileFCMService();