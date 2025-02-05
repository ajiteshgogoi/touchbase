import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Firebase configuration from environment variables
export const firebaseConfig = {
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
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      throw new Error('VAPID key is not configured');
    }

    // Ensure service worker is initialized with config first
    if (!navigator.serviceWorker?.controller) {
      throw new Error('Service worker not controlling the page');
    }

    // First ensure Firebase is initialized in the service worker
    let serviceWorkerReady = false;
    const configAckPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service worker config timeout'));
      }, 10000);

      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'FIREBASE_CONFIG_ACK') {
          serviceWorkerReady = true;
          navigator.serviceWorker.removeEventListener('message', handler);
          clearTimeout(timeout);
          resolve();
        }
      };

      navigator.serviceWorker.addEventListener('message', handler);
    });

    // Send config to service worker
    navigator.serviceWorker.controller.postMessage({
      type: 'FIREBASE_CONFIG',
      config: firebaseConfig
    });

    // Wait for acknowledgment
    await configAckPromise;

    if (!serviceWorkerReady) {
      throw new Error('Service worker failed to initialize');
    }

    // Get the token only after service worker is ready
    const currentToken = await getToken(messaging, { vapidKey });

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