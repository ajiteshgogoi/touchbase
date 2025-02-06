import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { messaging } from '../lib/firebase';

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not supported');
      return;
    }

    try {
      // Set up message listener first
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_RECEIVED') {
          console.log('[Notifications] Push event received by service worker:', event.data);
        }
      });

      // Force update of service worker
      console.log('Ensuring clean service worker state...');
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
      }
      
      console.log('Registering fresh service worker...');
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      // Wait for the service worker to be activated
      if (this.swRegistration.installing || this.swRegistration.waiting) {
        await new Promise<void>((resolve) => {
          const sw = this.swRegistration!.installing || this.swRegistration!.waiting;
          if (!sw) {
            resolve();
            return;
          }

          sw.addEventListener('statechange', function listener(e) {
            if ((e.target as ServiceWorker).state === 'activated') {
              sw.removeEventListener('statechange', listener);
              resolve();
            }
          });
        });
      }

      // Double check registration is active
      if (!this.swRegistration.active) {
        throw new Error('Service worker failed to activate');
      }

      console.log('Service worker successfully registered and activated');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async subscribeToPushNotifications(userId: string, forceResubscribe = false): Promise<void> {
    if (!this.swRegistration) {
      console.warn('Service Worker not registered, initializing...');
      await this.initialize();
      if (!this.swRegistration) {
        throw new Error('Failed to initialize Service Worker');
      }
    }

    try {
      // Check for existing subscription if not forcing resubscribe
      if (!forceResubscribe) {
        const { data: existingSubscription } = await supabase
          .from('push_subscriptions')
          .select('fcm_token')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (existingSubscription?.fcm_token) {
          console.log('Using existing FCM token');
          return;
        }
      }

      console.log('Starting FCM token registration process...');
      
      // Request permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get FCM token using existing VAPID key
      const currentToken = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.swRegistration
      });

      if (!currentToken) {
        throw new Error('Failed to get FCM token');
      }

      console.log('Successfully obtained FCM token');

      // Store token in Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          fcm_token: currentToken,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Failed to store FCM token in Supabase:', error);
        throw error;
      }

      console.log('Successfully completed FCM token registration process');
    } catch (error) {
      console.error('Failed to register for FCM:', error);
      throw error;
    }
  }

  async resubscribeIfNeeded(userId: string): Promise<void> {
    try {
      // Verify with the server
      console.log('Verifying FCM token with server...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();
      
      if (response.status === 500 && (
        data.error?.includes('resubscription required') || 
        data.error?.includes('FCM token invalid')
      )) {
        console.log('Server indicates token invalid, creating new subscription...');
        await this.subscribeToPushNotifications(userId, true);
        return;
      }

      console.log('FCM token verified successfully');
    } catch (error) {
      console.error('Error in resubscribeIfNeeded:', error);
      // If any error occurs during verification, try a fresh subscription
      console.log('Error during verification, attempting fresh subscription...');
      try {
        await this.subscribeToPushNotifications(userId, true);
      } catch (subError) {
        console.error('Failed to create fresh subscription:', subError);
        throw subError;
      }
    }
  }

  async unsubscribeFromPushNotifications(userId: string): Promise<void> {
    try {
      // Remove FCM token from Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  async checkPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async sendTestNotification(userId: string, message?: string): Promise<void> {
    try {
      console.log('Starting test notification sequence...');
      
      // First ensure fresh service worker registration
      await this.initialize();
      
      if (!this.swRegistration?.active) {
        throw new Error('Service worker failed to activate after initialization');
      }

      // Create fresh subscription
      console.log('Creating fresh FCM token...');
      await this.subscribeToPushNotifications(userId, true);
      
      console.log('FCM token created, sending test notification...');
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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test notification');
      }

      console.log('Test notification sent successfully. If you do not see the notification, check:');
      console.log('1. Browser notification permissions');
      console.log('2. Service worker logs in DevTools > Application > Service Workers');
      console.log('3. Network tab for the FCM response');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();

// Make service available globally for testing
if (import.meta.env.DEV) {
  (window as any).notificationService = notificationService;
}