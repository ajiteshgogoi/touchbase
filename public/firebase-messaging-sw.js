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

// Global messaging instance
let messagingInstance = null;

// Initialize Firebase and get messaging instance
async function initializeMessaging() {
  try {
    if (firebase.apps.length) {
      debug('Cleaning up existing Firebase instances...');
      await Promise.all(firebase.apps.map(app => app.delete()));
    }

    debug('Initializing fresh Firebase instance...');
    const app = firebase.initializeApp(firebaseConfig);
    messagingInstance = firebase.messaging(app);
    debug('Firebase messaging initialized');
    return messagingInstance;
  } catch (error) {
    debug('Error initializing Firebase messaging:', error);
    throw error;
  }
}

// Handle activation
self.addEventListener('activate', (event) => {
  debug('Activating Firebase messaging service worker...');
  event.waitUntil(self.clients.claim());
});

// Handle installation
self.addEventListener('install', (event) => {
  debug('Installing Firebase messaging service worker...');
  event.waitUntil(self.skipWaiting());
});

// Handle messages
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'INIT_FCM') {
    debug('FCM initialization message received');
    
    try {
      await initializeMessaging();
      
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: true,
          message: 'FCM initialized'
        });
      }
    } catch (error) {
      debug('FCM initialization error:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ 
          success: false, 
          error: `FCM initialization failed: ${error.message}`,
          code: error.code || 'unknown'
        });
      }
    }
  } else if (event.data?.type === 'SKIP_WAITING') {
    debug('Skip waiting message received');
    self.skipWaiting();
  } else if (event.data?.type === 'CLEAR_FCM_LISTENERS') {
    const deviceId = event.data.deviceId;
    debug('Clearing FCM listeners for device:', deviceId);
    self.CLEANED_DEVICE_ID = deviceId;

    // Remove push subscription
    const subscription = await self.registration.pushManager.getSubscription();
    if (subscription) {
      debug('Unsubscribing push subscription for device:', deviceId);
      await subscription.unsubscribe();
    }

    // Reset Firebase messaging
    messagingInstance = null;
    if (firebase.apps.length) {
      await Promise.all(firebase.apps.map(app => app.delete()));
    }

    // Notify client
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, deviceId });
    }
  }
});

// Handle subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  debug('Push subscription change event received');
  event.waitUntil((async () => {
    try {
      await initializeMessaging();
      debug('Firebase reinitialized after subscription change');
      
      // Notify clients of change
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({
          type: 'PUSH_SUBSCRIPTION_CHANGE',
          timestamp: new Date().toISOString()
        });
      });
    } catch (error) {
      debug('Error handling subscription change:', error);
    }
  })());
});

// Set up initial messaging instance
initializeMessaging().then(() => {
  // Handle background messages
  messagingInstance.onBackgroundMessage(async (payload) => {
    debug('Received background message:', payload);
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
      debug('Background message processing error:', error);
      throw error;
    }
  });
}).catch(error => {
  debug('Error during initial Firebase setup:', error);
});

// Handle notification clicks
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