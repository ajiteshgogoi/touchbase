import { initializeApp } from "firebase/app";
import { getMessaging, onMessage, getToken } from "firebase/messaging";
import { supabase } from "../supabase/client";
import { firebaseConfig } from "./config";

export const app = initializeApp(firebaseConfig);
export let messaging = getMessaging(app);

// Function to cleanup Firebase messaging instance
export const cleanupMessaging = async () => {
  // Clean up FCM instance from window
  // @ts-ignore
  if (window.firebase?.messaging) {
    // @ts-ignore
    delete window.firebase.messaging;
  }

  // Force clear service worker message listeners
  const registration = await navigator.serviceWorker.ready;
  const messageChannel = new MessageChannel();
  if (registration.active) {
    registration.active.postMessage({ type: 'CLEAR_FCM_LISTENERS' }, [messageChannel.port2]);
  }
  
  // Re-initialize messaging instance
  messaging = getMessaging(app);
};

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
      requireInteraction: true
      // Remove vibrate pattern since we're using silent notifications
    };
    await registration.showNotification(title, notificationOptions as NotificationOptions);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

// Helper function to update token in database
const updateTokenInDatabase = async (userId: string, token: string) => {
  // Get current device ID or create new one
  const deviceId = localStorage.getItem('device_id') || `${Math.random().toString(36).substring(2)}-${Date.now()}`;
  localStorage.setItem('device_id', deviceId);

  // Get device info
  const deviceName = navigator.userAgent;
  const deviceType = /Android/i.test(navigator.userAgent) ? 'android' :
                    /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'web';

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      fcm_token: token,
      device_id: deviceId,
      device_name: deviceName,
      device_type: deviceType,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    }, {
      onConflict: 'user_id,device_id'
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