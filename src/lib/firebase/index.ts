import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import { getAuth, signInAnonymously } from "firebase/auth";

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
export const auth = getAuth(app);
export const messaging = getMessaging(app);

// Initialize Firebase auth before FCM
export const initializeFirebaseAuth = async () => {
  try {
    console.log('Initializing Firebase auth...');
    // Use anonymous auth for simplicity since we just need a Firebase auth token
    const { user } = await signInAnonymously(auth);
    if (!user) {
      throw new Error('Failed to initialize Firebase auth');
    }
    console.log('Firebase auth initialized successfully:', {
      uid: user.uid,
      isAnonymous: user.isAnonymous,
      state: auth.currentUser ? 'authenticated' : 'not authenticated'
    });
  } catch (error) {
    console.error('Firebase auth error:', error);
    throw error;
  }
};