import { supabase } from '../lib/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;

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

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return;
    }

    try {
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
      
      // Extra verification of push capability
      const subscription = await this.swRegistration.pushManager.getSubscription();
      console.log('Initial push subscription state:', subscription ? 'exists' : 'none');
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

      let subscription = !forceResubscribe ? currentSubscription : null;
      
      if (!subscription) {
        console.log('Creating new push subscription...');
        try {
          console.log('Converting VAPID key...');
          if (!VAPID_PUBLIC_KEY) {
            throw new Error('VAPID_PUBLIC_KEY is not set');
          }
          const applicationServerKey = this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          
          console.log('Requesting push subscription with converted key...');
          subscription = await this.swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
          console.log('Successfully created new push subscription:', {
            endpoint: subscription.endpoint,
            auth: !!subscription.toJSON().keys?.auth,
            p256dh: !!subscription.toJSON().keys?.p256dh
          });
        } catch (subError) {
          console.error('Failed to create push subscription:', subError);
          // Check if permission was denied
          if (Notification.permission === 'denied') {
            throw new Error('Push notification permission denied');
          }
          throw subError;
        }
      }

      console.log('Storing subscription in Supabase...');
      // Store subscription in Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription: subscription.toJSON(),
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
      
      // Verify push manager access
      const pushManager = this.swRegistration.pushManager;
      if (!pushManager) {
        throw new Error('Push manager not available');
      }
      
      // Create fresh subscription
      console.log('Creating fresh push subscription...');
      await this.subscribeToPushNotifications(userId, true);
      
      // Verify subscription was created
      const subscription = await pushManager.getSubscription();
      if (!subscription) {
        throw new Error('Failed to create push subscription');
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