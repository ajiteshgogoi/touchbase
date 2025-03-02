// Firebase messaging service worker for background notifications
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize debug logging
const debug = (...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[FCM-SW ${timestamp}]`, ...args);
};

// Firebase configuration
const firebaseConfig = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
  measurementId: "VITE_FIREBASE_MEASUREMENT_ID"
};

// Initialize Firebase lazily
let messaging;
function getMessaging() {
  if (!messaging) {
    debug('Initializing Firebase...');
    if (firebase.apps.length) {
      firebase.apps.forEach(app => app.delete());
    }
    const app = firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging(app);
  }
  return messaging;
}

// Register event handlers before any initialization
self.addEventListener('push', (event) => {
  debug('Push event received');
  if (event.data) {
    const payload = event.data.json();
    event.waitUntil(handlePushEvent(payload));
  }
});

self.addEventListener('pushsubscriptionchange', (event) => {
  debug('Push subscription change event received');
  // Reset messaging instance for reinitialization
  messaging = null;
  getMessaging();
});

self.addEventListener('notificationclick', (event) => {
  debug('Notification clicked:', event);
  event.notification.close();

  const targetUrl = event.action === 'view' && event.notification.data?.url 
    ? event.notification.data.url 
    : '/';

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

// Handle installation with immediate activation
self.addEventListener('install', (event) => {
  debug('Installing Firebase messaging service worker...');
  self.skipWaiting();
});

// Handle activation with client claim
self.addEventListener('activate', (event) => {
  debug('Activating Firebase messaging service worker...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear any old caches
      caches.keys().then(keys => Promise.all(
        keys.map(key => {
          if (key.startsWith('firebase-messaging')) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      ))
    ])
  );
});

// Handle messages
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FCM') {
    debug('FCM initialization message received');
    
    try {
      const messaging = getMessaging();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    } catch (error) {
      debug('FCM initialization error:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ 
          success: false, 
          error: error.message
        });
      }
    }
  } else if (event.data?.type === 'SKIP_WAITING') {
    debug('Skip waiting message received');
    self.skipWaiting();
  } else if (event.data?.type === 'CLEAR_FCM_LISTENERS') {
    const deviceId = event.data.deviceId;
    debug('Clearing FCM listeners for device:', deviceId);
    
    // Store device ID for push event handling
    self.CLEANED_DEVICE_ID = deviceId;

    // Get current push subscription
    self.registration.pushManager.getSubscription().then(async subscription => {
      if (subscription) {
        try {
          // Get subscription info including endpoint
          const subscriptionInfo = subscription.toJSON();
          
          // Only unsubscribe if this subscription belongs to the device being cleaned
          const subscriptionDeviceId = await self.registration.pushManager.permissionState(subscriptionInfo);
          
          if (subscriptionDeviceId === deviceId) {
            debug('Unsubscribing push subscription for device:', deviceId);
            await subscription.unsubscribe();
          } else {
            debug('Skipping unsubscribe - subscription belongs to different device');
          }
        } catch (error) {
          debug('Error handling subscription cleanup:', error);
        }
      }
    });

    // Reset Firebase messaging instance
    messaging = null;

    // Notify client
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, deviceId });
    }
  }
});

// Handle push events
async function handlePushEvent(payload) {
  debug('Handling push event:', payload);
  const isMobile = /Mobile|Android|iPhone/i.test(self.registration.scope);

  try {
    const notificationData = payload.notification || payload.data || {};
    const deviceId = self.CLEANED_DEVICE_ID || `device-${Date.now()}`;
    
    await self.registration.showNotification(notificationData.title || 'New Message', {
      body: notificationData.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'touchbase-notification',
      renotify: true,
      requireInteraction: true,
      data: {
        ...(payload.data || {}),
        deviceId,
        timestamp: new Date().toISOString()
      },
      actions: [{ action: 'view', title: 'View' }],
      ...(isMobile && {
        vibrate: [200, 100, 200],
        silent: false
      })
    });
    
    debug('Notification displayed successfully');
  } catch (error) {
    debug('Push event processing error:', error);
    throw error;
  }
}