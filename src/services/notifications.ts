import { supabase } from '../lib/supabase/client';
import { getToken } from "firebase/messaging";
import { messaging, initializeTokenRefresh } from '../lib/firebase';

class NotificationService {
  private fcmRegistration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not supported');
      return;
    }

    try {
      // Register Firebase messaging service worker
      console.log('Registering Firebase messaging service worker...');
      const firebaseSWURL = new URL('/firebase-messaging-sw.js', window.location.origin).href;
      
      // Register with explicit options for better control
      this.fcmRegistration = await navigator.serviceWorker.register(firebaseSWURL, {
        scope: '/',
        updateViaCache: 'none'
      });

      // Force activation of the service worker
      if (this.fcmRegistration.waiting) {
        this.fcmRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Wait for explicit activation
      if (this.fcmRegistration.installing || this.fcmRegistration.waiting) {
        await new Promise<void>((resolve) => {
          const sw = this.fcmRegistration!.installing || this.fcmRegistration!.waiting;
          if (!sw) {
            resolve();
            return;
          }

          sw.addEventListener('statechange', function listener(event) {
            if ((event.target as ServiceWorker).state === 'activated') {
              sw.removeEventListener('statechange', listener);
              resolve();
            }
          });
        });
      }

      // Double check registration is active
      if (!this.fcmRegistration.active) {
        throw new Error('Firebase service worker failed to activate');
      }

      console.log('Firebase service worker successfully registered and activated');

      // Initialize token refresh mechanism if user is authenticated
      const session = await supabase.auth.getSession();
      if (session.data.session?.user) {
        await initializeTokenRefresh(session.data.session.user.id);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async subscribeToPushNotifications(userId: string, forceResubscribe = false): Promise<void> {
    if (!this.fcmRegistration) {
      console.warn('Firebase service worker not registered, initializing...');
      await this.initialize();
      if (!this.fcmRegistration) {
        throw new Error('Failed to initialize Firebase service worker');
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

      // Check IndexedDB access before proceeding
      try {
        console.log('Verifying IndexedDB access...');
        const request = indexedDB.open('fcm-test-db');
        await new Promise<void>((resolve, reject) => {
          request.onerror = () => reject(new Error('IndexedDB access denied - check browser settings'));
          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
        });
        console.log('IndexedDB access confirmed');
      } catch (error) {
        console.error('IndexedDB access error:', error);
        throw new Error('Browser storage access denied - check privacy settings and third-party cookie settings');
      }

      // Ensure Firebase service worker is ready
      if (!this.fcmRegistration?.active) {
        console.log('Firebase service worker not active, reinitializing...');
        await this.initialize();
        if (!this.fcmRegistration?.active) {
          throw new Error('Firebase service worker failed to activate');
        }
      }

      // Get FCM token using existing VAPID key
      console.log('Getting FCM token...');
      const currentToken = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: this.fcmRegistration
      }).catch(error => {
        console.error('FCM token error:', error);
        throw new Error(`FCM registration failed: ${error.message}`);
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
      // First check if we even have a subscription
      const { data: existingSubscription } = await supabase
        .from('push_subscriptions')
        .select('fcm_token')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingSubscription?.fcm_token) {
        console.log('No existing subscription found, creating new one...');
        await this.subscribeToPushNotifications(userId, true);
        return;
      }

      // If we have a token, verify it with the server
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
        data.error?.includes('FCM token invalid') ||
        data.error?.includes('No FCM token found')
      )) {
        console.log('Server indicates token invalid or missing, creating new subscription...');
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

  private async ensureValidToken(userId: string): Promise<string> {
    console.log('Ensuring valid FCM token...');
    
    // Get current token directly from Firebase
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: this.fcmRegistration || undefined
    });

    if (!currentToken) {
      throw new Error('Failed to get FCM token from Firebase');
    }

    // Update token in database
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        fcm_token: currentToken,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      throw new Error(`Failed to update FCM token in database: ${error.message}`);
    }

    return currentToken;
  }

  async sendTestNotification(userId: string, message?: string): Promise<void> {
    try {
      console.log('Starting test notification sequence...');
      
      // First ensure fresh service worker registration
      await this.initialize();
      
      if (!this.fcmRegistration?.active) {
        throw new Error('Firebase service worker failed to activate after initialization');
      }

      const session = await supabase.auth.getSession();
      const isAdmin = session.data.session?.user.id === import.meta.env.VITE_ADMIN_USER_ID;
      const targetingOtherUser = session.data.session?.user.id !== userId;

      // Get and verify token for the target user
      let fcmToken;
      if (isAdmin && targetingOtherUser) {
        console.log('Admin sending test notification to other user...');
        // First ensure admin's token is valid
        await this.ensureValidToken(session.data.session!.user.id);
        // Then get target user's token
        fcmToken = await this.ensureValidToken(userId);
      } else {
        console.log('Creating fresh FCM token...');
        fcmToken = await this.ensureValidToken(userId);
      }

      // Add delay to ensure token propagation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Sending test notification using token:', fcmToken);
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          message: message || 'This is a test notification',
          fcmToken // Pass the verified token directly
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