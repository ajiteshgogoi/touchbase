import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Handle incoming messages while the app is in the foreground
onMessage(messaging, (payload) => {
  console.log('[Firebase] Received foreground message:', payload);
  // Forward to service worker to maintain consistent notification appearance
  if (payload.notification) {
    const notificationPayload = {
      title: payload.notification.title,
      body: payload.notification.body,
      data: payload.data,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      requireInteraction: true
    };
    
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: notificationPayload
      });
    }
  }
});

let tokenRefreshCallback: ((token: string) => void) | null = null;

export function onTokenRefresh(callback: (token: string) => void) {
  tokenRefreshCallback = callback;
}

export async function getFcmToken(): Promise<string> {
  try {
    // Get registration token using VAPID key from environment
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
    });

    if (currentToken) {
      console.log('FCM registration token available');
      return currentToken;
    } else {
      console.log('No registration token available.');
      throw new Error('No registration token available');
    }
  } catch (err) {
    console.log('An error occurred while retrieving token:', err);
    throw err;
  }
}

export { app, messaging };