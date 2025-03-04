export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Configure FCM settings separately to avoid initialization issues
export const fcmSettings = {
  vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
  android: {
    gcm_sender_id: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    // Direct control to native Android notification handling
    direct_boot_ok: true,
    notification_priority: 'high',
    notification_foreground: false // Let system handle notifications on Android
  },
  ios: {
    // Use native iOS notification handling
    critical: false,
    foreground_presentation: false // Let system handle notifications on iOS
  },
  web: {
    // Custom handling for web platform
    foreground_notification: true
  }
};