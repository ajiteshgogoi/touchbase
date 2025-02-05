import { supabase } from '../lib/supabase/client';

// Convert VAPID key to Uint8Array then to urlBase64
function urlBase64ToUint8Array(base64String: string) {
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

const VAPID_PUBLIC_KEY = urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY);

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported');
      return;
    }

    try {
      // Unregister any existing service worker first
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
      }

      // Register fresh service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');
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
          subscription = await this.swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY
          });
          console.log('Successfully created new push subscription');
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
      // First, force a fresh subscription
      console.log('Forcing fresh subscription for test notification...');
      await this.subscribeToPushNotifications(userId, true);
      console.log('Fresh subscription created');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ userId, message })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send test notification');
      }

      console.log('Test notification sent successfully');
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