// Firebase messaging service worker for background notifications
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize debug logging with timestamped backtrace
const debug = (...args) => {
  const timestamp = new Date().toISOString();
  const trace = new Error().stack?.split('\n')[2]?.trim() || '';
  console.log(`[FCM-SW ${timestamp}]${trace ? ` (${trace})` : ''}`, ...args);
};

// Firebase configuration
const firebaseConfig = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
  measurementId: "VITE_FIREBASE_MEASUREMENT_ID",
  gcm_sender_id: "VITE_FIREBASE_MESSAGING_SENDER_ID"
};

// Initialize Firebase messaging instance
let messaging = null;

// Simple, reliable messaging initialization
async function getMessaging() {
  try {
    if (messaging) {
      return messaging;
    }

    // Initialize Firebase if not already initialized
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // Create messaging instance
    messaging = firebase.messaging();
    return messaging;
  } catch (error) {
    debug('Error in getMessaging:', error);
    messaging = null;
    throw error;
  }
}

// Register service worker event handlers
self.addEventListener('install', (event) => {
  debug('Installing Firebase messaging service worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  debug('Activating Firebase messaging service worker...');
  event.waitUntil(self.clients.claim());
});

// Handle push notification events
self.addEventListener('push', (event) => {
  debug('Push event received');
  if (event.data) {
    const payload = event.data.json();
    event.waitUntil(handlePushEvent(payload));
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  debug('Notification clicked:', event);
  event.notification.close();

  const baseUrl = self.registration.scope;
  const targetPath = event.action === 'view' && event.notification.data?.url
    ? event.notification.data.url
    : '/';
  
  const targetUrl = baseUrl + targetPath.replace(/^\//, '');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

// Process push events
async function handlePushEvent(payload) {
  try {
    const notificationData = payload.notification || payload.data || {};
    const deviceId = self.deviceId || `device-${Date.now()}`;
    const startTime = Date.now();

    await self.registration.showNotification(notificationData.title || 'New Message', {
      body: notificationData.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'touchbase-notification',
      data: {
        ...payload.data,
        deviceId,
        url: notificationData.url || '/',
        timestamp: new Date().toISOString()
      },
      actions: [{ action: 'view', title: 'View' }]
    });

    debug('Notification displayed successfully', {
      deviceId,
      processedIn: Date.now() - startTime
    });
  } catch (error) {
    debug('Push event processing error:', error);
    throw error;
  }
}

// Handle FCM initialization messages
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FCM') {
    debug('FCM initialization message received');
    event.waitUntil((async () => {
      try {
        // Initialize Firebase if needed
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        
        // Create messaging instance
        messaging = firebase.messaging();
        
        event.ports[0].postMessage({ success: true });
      } catch (error) {
        debug('FCM initialization error:', error);
        event.ports[0].postMessage({
          success: false,
          error: error.message
        });
      }
    })());
  }
});