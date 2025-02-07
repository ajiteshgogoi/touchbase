import { initializeApp } from "firebase/app";
import { getMessaging, onMessage, getToken } from "firebase/messaging";
import { supabase } from "../supabase/client";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// Extended notification options type that includes all web notification properties
interface ExtendedNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  requireInteraction?: boolean;
  tag?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  data?: any;
  vibrate?: number[];
  silent?: boolean;
}

// Helper function to show notification
const showNotification = async (title: string, options: ExtendedNotificationOptions) => {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const notificationOptions: ExtendedNotificationOptions = {
      ...options,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'touchbase-notification',
      renotify: true,
      requireInteraction: true,
      vibrate: [100, 50, 100]
    };
    await registration.showNotification(title, notificationOptions as NotificationOptions);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

// Helper function to update token in database
const updateTokenInDatabase = async (userId: string, token: string) => {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      fcm_token: token,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error updating FCM token:', error);
  } else {
    console.log('FCM token updated in database');
  }
};

// Handle token refresh and message handling
export const initializeTokenRefresh = async (userId: string) => {
  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    
    // Get current token with service worker registration
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });

    if (currentToken) {
      // Update token in Supabase
      await updateTokenInDatabase(userId, currentToken);
    }

    // Set up periodic token refresh
    const refreshToken = async () => {
      try {
        // Get the current service worker registration
        const registration = await navigator.serviceWorker.ready;

        const newToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
          serviceWorkerRegistration: registration
        });

        if (newToken) {
          await updateTokenInDatabase(userId, newToken);
          console.log('FCM token refreshed successfully');
        }
      } catch (error) {
        console.error('Error in token refresh:', error);
      }
    };

    // Check token every 6 hours (good balance between freshness and server load)
    setInterval(refreshToken, 6 * 60 * 60 * 1000);

    // Set up foreground message handler
    onMessage(messaging, async (payload) => {
      console.log('Received foreground message:', payload);

      const { notification } = payload;
      if (notification) {
        await showNotification(
          notification.title || 'New Message',
          {
            body: notification.body,
            data: payload.data,
            silent: true, // Prevent Chrome PWA prompt
            actions: [
              {
                action: 'view',
                title: 'View'
              }
            ]
          }
        );
      }

      // Handle token changes if needed
      if (payload.data?.type === 'token_change') {
        try {
          // Get the current service worker registration
          const registration = await navigator.serviceWorker.ready;

          const newToken = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: registration
          });

          if (newToken && newToken !== currentToken) {
            await updateTokenInDatabase(userId, newToken);
          }
        } catch (error) {
          console.error('Error in token change handler:', error);
        }
      }
    });
  } catch (error) {
    console.error('Error setting up token refresh:', error);
  }
};