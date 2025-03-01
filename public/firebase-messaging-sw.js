// Firebase messaging service worker for background notifications
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize debug logging
const debug = (...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[FCM-SW ${timestamp}]`, ...args);
};

// Handle activation
self.addEventListener('activate', (event) => {
  debug('Activating Firebase messaging service worker...');
  event.waitUntil(self.clients.claim());
});

// Handle installation
self.addEventListener('install', (event) => {
  debug('Installing Firebase messaging service worker...');
  self.skipWaiting();
});

// Handle activation requests and FCM cleanup
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FCM') {
    debug('FCM initialization message received');
    try {
      // Re-initialize Firebase if needed
      if (!firebase.messaging) {
        debug('Reinitializing Firebase...');
        firebase.initializeApp({
          apiKey: "VITE_FIREBASE_API_KEY",
          authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
          projectId: "VITE_FIREBASE_PROJECT_ID",
          storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
          messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
          appId: "VITE_FIREBASE_APP_ID",
          measurementId: "VITE_FIREBASE_MEASUREMENT_ID"
        });
        firebase.messaging();
      }
      // Send acknowledgment back to client
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, message: 'FCM initialized' });
      }
    } catch (error) {
      debug('FCM initialization error:', error);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: error.message });
      }
    }
  } else if (event.data?.type === 'SKIP_WAITING') {
    debug('Skip waiting message received');
    self.skipWaiting();
  } else if (event.data?.type === 'CLEAR_FCM_LISTENERS') {
    const deviceId = event.data.deviceId;
    debug('Clearing FCM listeners for device:', deviceId);

    // Store the device ID being cleaned up
    self.CLEANED_DEVICE_ID = deviceId;

    // Remove all message event listeners
    self.removeEventListener('push', () => {});
    self.removeEventListener('pushsubscriptionchange', () => {});

    // Reset Firebase messaging state by removing the property
    delete firebase.messaging;

    // Clear any stored subscriptions for this device
    self.registration.pushManager.getSubscription().then(subscription => {
      if (subscription) {
        debug('Unsubscribing push subscription for device:', deviceId);
        subscription.unsubscribe();
      }
    });

    // Notify the client that cleanup is complete
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, deviceId });
    }
  }
});

// Handle subscription changes (critical for mobile)
self.addEventListener('pushsubscriptionchange', (event) => {
  debug('Push subscription change event received');
  event.waitUntil((async () => {
    try {
      // Force a fresh messaging instance
      if (firebase.messaging) {
        delete firebase.messaging;
      }
      initializeFirebase();
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

// Controlled Firebase initialization with enhanced mobile support
function initializeFirebase() {
  if (firebase.apps.length) {
    debug('Firebase already initialized, cleaning up...');
    firebase.apps.forEach(app => app.delete());
  }

  debug('Initializing Firebase with enhanced mobile support...');
  firebase.initializeApp({
    apiKey: "VITE_FIREBASE_API_KEY",
    authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
    projectId: "VITE_FIREBASE_PROJECT_ID",
    storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
    appId: "VITE_FIREBASE_APP_ID",
    measurementId: "VITE_FIREBASE_MEASUREMENT_ID"
  });
  
  return firebase.messaging();
}

// Initialize messaging with error handling
let messaging;
try {
  messaging = initializeFirebase();
  debug('Firebase messaging initialized successfully');
} catch (error) {
  debug('Error initializing Firebase:', error);
  // Attempt recovery after a short delay (helps on mobile)
  setTimeout(() => {
    try {
      messaging = initializeFirebase();
      debug('Firebase messaging initialized successfully on retry');
    } catch (retryError) {
      debug('Fatal error initializing Firebase:', retryError);
    }
  }, 1000);
}

// Handle background messages with enhanced mobile support and retries
messaging.onBackgroundMessage(async (payload) => {
  debug('Received background message:', payload);

  const maxAttempts = 3;
  let attempt = 0;

  const processNotification = async () => {
    try {
      debug(`Processing notification attempt ${attempt + 1}/${maxAttempts}`);
      
      // Verify messaging instance is healthy
      if (!messaging || !firebase.messaging) {
        debug('Messaging instance lost, reinitializing...');
        messaging = initializeFirebase();
      }

      // For background messages, FCM puts the data in a different structure
      const notificationData = payload.notification || payload.data || {};
      debug('Extracted notification data:', notificationData);

      // Get stored device ID from the cleanup process or fallback
      const deviceId = self.CLEANED_DEVICE_ID || 'unknown-device';
      
      const notificationTitle = notificationData.title || 'New Message';
      const notificationOptions = {
        body: notificationData.body,
        icon: self.location.origin + '/icon-192.png',
        badge: self.location.origin + '/icon-192.png',
        data: {
          ...(payload.data || {}),
          deviceId: deviceId,
          timestamp: new Date().toISOString()
        },
        tag: `touchbase-notification-${deviceId}`,
        renotify: true,
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View'
          }
        ]
      };

      debug('Showing notification with:', { title: notificationTitle, options: notificationOptions });
      await self.registration.showNotification(notificationTitle, notificationOptions);
      debug('Notification shown successfully');
      
      return true;
    } catch (error) {
      debug('Error in attempt ' + (attempt + 1), error);
      
      if (attempt < maxAttempts - 1) {
        attempt++;
        debug('Retrying notification display...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return processNotification();
      }
      
      throw error;
    }
  };

  try {
    await processNotification();
    debug('Notification processing completed successfully');
  } catch (error) {
    debug('All notification attempts failed:', {
      error: error.toString(),
      name: error.name,
      message: error.message,
      stack: error.stack
    });
   }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  debug('Notification clicked:', event);

  event.notification.close();

  let targetUrl = '/';
  if (event.action === 'view' && event.notification.data?.url) {
    targetUrl = event.notification.data.url;
  }

  // Focus existing window or open new one
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