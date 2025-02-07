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

// Set up foreground message handler
onMessage(messaging, async (payload) => {
  console.log('Received foreground message:', payload);
  try {
    const { notification, data } = payload;
    const notificationTitle = notification?.title || 'New Message';
    const notificationOptions = {
      body: notification?.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data,
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View'
        }
      ]
    };

    // Show notification in foreground
    new Notification(notificationTitle, notificationOptions);
  } catch (error) {
    console.error('Error showing foreground notification:', error);
  }
});

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

// Handle token refresh
export const initializeTokenRefresh = async (userId: string) => {
  try {
    // Get current token with existing registration
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
    });

    if (currentToken) {
      // Update token in Supabase
      await updateTokenInDatabase(userId, currentToken);
    }

    // Set up message handler to catch token changes
    onMessage(messaging, async (message) => {
      if (message.data?.type === 'token_change') {
        try {
          const newToken = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
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