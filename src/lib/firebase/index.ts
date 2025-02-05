import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, MessagePayload } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBseFvFMYyf7JXnqb3HzGp64Hm3BXwqYlw",
  authDomain: "touchbase-8308f.firebaseapp.com",
  projectId: "touchbase-8308f",
  storageBucket: "touchbase-8308f.firebasestorage.app",
  messagingSenderId: "456167551143",
  appId: "1:456167551143:web:5950277a9eece90eac2b82",
  measurementId: "G-51J28BCVHT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const messaging = getMessaging(app);

export async function getFcmToken(): Promise<string> {
  try {
    // Get registration token. Initially this makes a network call
    const currentToken = await getToken(messaging, {
      vapidKey: "BJ_RuAoGZtplFl8ZoQ-6A3fj2k8DY1MMbzeTlnGcyUNq-5CNS8koFjkQErGKWh-Kmtb67HLJNmBBkH5aoDPCgjE"
    });

    if (currentToken) {
      console.log('FCM registration token:', currentToken);
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