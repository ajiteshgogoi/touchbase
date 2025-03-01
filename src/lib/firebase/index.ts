import { initializeApp } from "firebase/app";
import { getMessaging, onMessage, getToken, Messaging } from "firebase/messaging";
import { supabase } from "../supabase/client";
import { firebaseConfig } from "./config";
import { platform } from "../../utils/platform";

// Initialize Firebase app once
export const app = initializeApp(firebaseConfig);

// Manage messaging instance
let messagingInstance: Messaging | null = null;
export const getFirebaseMessaging = (): Messaging => {
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
};

// Function to cleanup Firebase messaging instance
export const cleanupMessaging = async () => {
  const storageKey = platform.getDeviceStorageKey('device_id');
  const deviceId = localStorage.getItem(storageKey);
  if (!deviceId) {
    console.warn('No device ID found during cleanup');
    return;
  }

  // Clean up FCM instance from window
  // @ts-ignore
  if (window.firebase?.messaging) {
    // @ts-ignore
    delete window.firebase.messaging;
  }

  // Force clear service worker message listeners
  try {
    const registration = await navigator.serviceWorker.ready;
    const messageChannel = new MessageChannel();
    if (registration.active) {
      registration.active.postMessage({
        type: 'CLEAR_FCM_LISTENERS',
        deviceId: deviceId
      }, [messageChannel.port2]);
    }
  } catch (error) {
    console.warn('Error clearing FCM listeners:', error);
  }
  
  // Reset messaging instance
  messagingInstance = null;

  // Remove all service workers except Firebase messaging worker
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active?.scriptURL.includes('firebase-messaging-sw.js')) {
        continue;
      }
      await reg.unregister();
    }
  } catch (error) {
    console.warn('Error unregistering service workers:', error);
  }

  console.log('Cleaned up messaging for device:', deviceId);
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
      requireInteraction: platform.getDeviceInfo().deviceType === 'web'
    };
    await registration.showNotification(title, notificationOptions as NotificationOptions);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

// Helper function to update token in database
const updateTokenInDatabase = async (userId: string, token: string) => {
  const deviceId = localStorage.getItem(platform.getDeviceStorageKey('device_id'));
  if (!deviceId) {
    console.warn('No device ID found for background refresh, skipping update');
    return;
  }

  // Get current device subscription state
  const { data: subscription } = await supabase
    .from('push_subscriptions')
    .select('enabled')
    .match({ user_id: userId, device_id: deviceId })
    .single();

  // Only update if notifications are enabled
  if (subscription?.enabled) {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({
        fcm_token: token,
        updated_at: new Date().toISOString()
      })
      .match({ user_id: userId, device_id: deviceId });

    if (error) {
      console.error('Error updating FCM token:', error);
    } else {
      console.log('FCM token updated in database');
    }
  }
};

// Handle token refresh and message handling
export const initializeTokenRefresh = async (userId: string) => {
  try {
    // Get device info
    const deviceInfo = platform.getDeviceInfo();
    const isMobileDevice = deviceInfo.deviceType !== 'web';

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    const messaging = getFirebaseMessaging();
    
    // Configuration for token generation
    const tokenConfig = {
      vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    };

    // Get current token
    let currentToken: string | null = null;
    try {
      currentToken = await getToken(messaging, tokenConfig);
      if (!currentToken) {
        throw new Error('Failed to generate FCM token');
      }
    } catch (error) {
      // Don't ignore token generation errors, regardless of platform
      console.error('Token generation failed:', error);
      throw error;
    }

    await updateTokenInDatabase(userId, currentToken);

    // Set up periodic token refresh only for web
    if (!isMobileDevice) {
      const refreshToken = async () => {
        try {
          const registration = await navigator.serviceWorker.ready;
          const newToken = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: registration
          });

          if (newToken && newToken !== currentToken) {
            await updateTokenInDatabase(userId, newToken);
            currentToken = newToken;
            console.log('FCM token refreshed successfully');
          }
        } catch (error) {
          console.error('Error in token refresh:', error);
        }
      };

      // Check token every 6 hours
      setInterval(refreshToken, 6 * 60 * 60 * 1000);
    }

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
            silent: isMobileDevice, // Silent on mobile to prevent duplicate notifications
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
          const newToken = await getToken(messaging, tokenConfig);

          if (newToken && newToken !== currentToken) {
            await updateTokenInDatabase(userId, newToken);
            currentToken = newToken;
          }
        } catch (error) {
          console.error('Error in token change handler:', error);
        }
      }
    });
  } catch (error) {
    console.error('Error setting up token refresh:', error);
    throw error;
  }
};