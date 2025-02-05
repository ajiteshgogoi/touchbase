import { supabase } from '../lib/supabase/client';
import { getFcmToken, onTokenRefresh } from '../lib/firebase';

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return;
    }

    try {
      // Set up message listener first
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_RECEIVED') {
          console.log('[Notifications] Push event received by service worker:', event.data);
        }
      });

      // Register Firebase messaging service worker
      console.log('Registering Firebase messaging service worker...');
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        
        this.swRegistration = registration;

        // Wait for service worker to become active
        if (registration.installing || registration.waiting) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Service worker activation timeout'));
            }, 5000);

            registration.addEventListener('activate', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
          });
        }
      } catch (error) {
        console.error('Service worker registration failed:', error);
        throw error;
      }

      // Wait for our service worker to be activated
      if (!this.swRegistration) {
        throw new Error('Failed to register service worker');
      }

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
      if (!this.swRegistration?.active) {
        throw new Error('Service worker failed to activate');
      }

      console.log('Service worker successfully registered and activated');

      // Extra verification of push capability
      const subscription = await this.swRegistration.pushManager.getSubscription();
      console.log('Initial push subscription state:', subscription ? 'exists' : 'none');

      // Set up FCM token refresh handler
      onTokenRefresh(async (newToken: string) => {
        console.log('FCM token refreshed, updating subscription...');
        // Find all subscriptions in Supabase that point to the old token endpoint
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('user_id, subscription');

        // Update each subscription with the new token
        if (subs) {
          for (const sub of subs) {
            if (sub.subscription.endpoint.includes('fcm')) {
              const updatedSubscription = {
                endpoint: `https://fcm.googleapis.com/fcm/send/${newToken}`,
                keys: {
                  p256dh: 'FCM',
                  auth: 'FCM'
                }
              };

              await supabase
                .from('push_subscriptions')
                .upsert({
                  user_id: sub.user_id,
                  subscription: updatedSubscription,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'user_id'
                });
            }
          }
        }
      });
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
      console.log('Starting push notification subscription process...');

      // Always check current subscription first
      const currentSubscription = await this.swRegistration.pushManager.getSubscription();
      console.log('Current subscription status:', currentSubscription ? 'exists' : 'none');

      if (currentSubscription && forceResubscribe) {
        console.log('Force resubscribe requested, unsubscribing from current subscription...');
        await currentSubscription.unsubscribe();
        console.log('Successfully unsubscribed from current subscription');
      }

      // Get FCM token
      console.log('Getting FCM token...');
      const fcmToken = await getFcmToken();

      // Create subscription object that matches our database schema
      const subscription = {
        endpoint: `https://fcm.googleapis.com/fcm/send/${fcmToken}`,
        keys: {
          p256dh: 'FCM',
          auth: 'FCM'
        }
      };

      console.log('Storing subscription in Supabase...');
      // Store subscription in Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Failed to store subscription in Supabase:', error);
        throw error;
      }

      console.log('Successfully completed push notification subscription process');
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  async resubscribeIfNeeded(userId: string): Promise<void> {
    if (!this.swRegistration) {
      console.warn('Service Worker not registered, initializing...');
      await this.initialize();
      if (!this.swRegistration) {
        throw new Error('Failed to initialize Service Worker');
      }
    }

    try {
      // First check local subscription status
      const currentSubscription = await this.swRegistration.pushManager.getSubscription();
      console.log('Current local subscription:', currentSubscription ? 'exists' : 'none');

      // If no local subscription exists, create one
      if (!currentSubscription) {
        console.log('No local subscription found, creating new one...');
        await this.subscribeToPushNotifications(userId, true);
        return;
      }

      // Verify with the server
      console.log('Verifying subscription with server...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (response.status === 500 && data.error?.includes('resubscription required')) {
        console.log('Server indicates subscription expired, creating new subscription...');
        // Unsubscribe from current subscription
        await currentSubscription.unsubscribe();
        // Create new subscription
        await this.subscribeToPushNotifications(userId, true);
        return;
      }

      console.log('Subscription verified successfully');
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
    if (!this.swRegistration) {
      return;
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove subscription from Supabase
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

      // Test service worker communication
      console.log('Testing service worker communication...');
      let messageReceived = false;
      const messagePromise = new Promise<void>((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'SW_PING_RESPONSE') {
            messageReceived = true;
            navigator.serviceWorker.removeEventListener('message', handler);
            resolve();
          }
        };
        navigator.serviceWorker.addEventListener('message', handler);

        // Send ping to service worker if it's active
        if (this.swRegistration?.active) {
          this.swRegistration.active.postMessage({ type: 'SW_PING' });
        } else {
          console.warn('Service worker is not active, cannot send ping');
          resolve(); // Resolve and continue with notification attempt
        }

        // Timeout after 3 seconds
        setTimeout(() => {
          if (!messageReceived) {
            navigator.serviceWorker.removeEventListener('message', handler);
            console.warn('Service worker did not respond to ping');
            resolve(); // Resolve anyway to continue with notification
          }
        }, 3000);
      });

      await messagePromise;

      // Create fresh subscription
      console.log('Creating fresh push subscription...');
      await this.subscribeToPushNotifications(userId, true);

      // Verify FCM token
      const fcmToken = await getFcmToken();
      if (!fcmToken) {
        throw new Error('Failed to get FCM token');
      }

      console.log('Subscription verified, sending test notification...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          message: message || 'Test notification message'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test notification');
      }

      console.log('Test notification sent successfully. If you do not see the notification, check:');
      console.log('1. Browser notification permissions');
      console.log('2. Service worker logs in DevTools > Application > Service Workers');
      console.log('3. Network tab for the push notification request');
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