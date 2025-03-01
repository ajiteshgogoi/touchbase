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

// Handle installation with mobile-optimized initialization
self.addEventListener('install', (event) => {
debug('Installing Firebase messaging service worker...');
// Force activation but allow time for push service initialization on mobile
event.waitUntil(
  (async () => {
    await self.skipWaiting();
    // Add delay only on mobile devices
    const isMobile = /Mobile|Android|iPhone/i.test(self.registration.scope);
    if (isMobile) {
      debug('Mobile device detected, adding extended initialization delay...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  })()
);
});

// Handle activation requests and FCM cleanup
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FCM') {
    debug('FCM initialization message received');
    try {
      // Re-initialize Firebase if needed
      if (!firebase.messaging) {
        debug('Reinitializing Firebase...');
        const app = firebase.initializeApp({
          apiKey: "VITE_FIREBASE_API_KEY",
          authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
          projectId: "VITE_FIREBASE_PROJECT_ID",
          storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
          messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
          appId: "VITE_FIREBASE_APP_ID",
          measurementId: "VITE_FIREBASE_MEASUREMENT_ID"
        });
        firebase.messaging(app);
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

// Initialize messaging with enhanced mobile support
let messaging;

const initializeMessaging = async (attempt = 1) => {
  const maxAttempts = 5;
  const isMobile = /Mobile|Android|iPhone/i.test(self.registration.scope);
  const baseDelay = isMobile ? 3000 : 1000; // Longer base delay for mobile

  try {
    messaging = initializeFirebase();
    debug('Firebase messaging initialized successfully');
    return messaging;
  } catch (error) {
    debug(`Error initializing Firebase (attempt ${attempt}/${maxAttempts}):`, error);

    if (attempt < maxAttempts) {
      // Exponential backoff with jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 10000) +
                   Math.random() * 1000;
      debug(`Retrying in ${Math.round(delay)}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return initializeMessaging(attempt + 1);
    }
    
    throw new Error(`Failed to initialize Firebase after ${maxAttempts} attempts`);
  }
};

// Start initialization
initializeMessaging().catch(error => {
  debug('Fatal error during Firebase initialization:', error);
});

// Handle background messages with advanced mobile support and smart retries
messaging.onBackgroundMessage(async (payload) => {
  debug('Received background message:', payload);

  const isMobile = /Mobile|Android|iPhone/i.test(self.registration.scope);
  const maxAttempts = isMobile ? 5 : 3;
  let attempt = 0;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const getRetryDelay = (attempt) => {
    const baseDelay = isMobile ? 2000 : 1000;
    return Math.min(baseDelay * Math.pow(2, attempt), 10000) + Math.random() * 1000;
  };

  const verifyMessagingHealth = async () => {
    if (!messaging || !firebase.messaging) {
      debug('Messaging instance needs reinitialization...');
      try {
        messaging = await initializeMessaging();
        return true;
      } catch (error) {
        debug('Failed to reinitialize messaging:', error);
        return false;
      }
    }
    return true;
  };

  const processNotification = async () => {
    try {
      debug(`Processing notification attempt ${attempt + 1}/${maxAttempts}`);
      
      if (!(await verifyMessagingHealth())) {
        throw new Error('Messaging health check failed');
      }

      // Enhanced data extraction for different message formats
      const notificationData = payload.notification || payload.data || {};
      debug('Processing notification data:', notificationData);

      const deviceId = self.CLEANED_DEVICE_ID || `device-${Date.now()}`;
      
      const notificationTitle = notificationData.title || 'New Message';
      const notificationOptions = {
        body: notificationData.body,
        icon: self.location.origin + '/icon-192.png',
        badge: self.location.origin + '/icon-192.png',
        data: {
          ...(payload.data || {}),
          deviceId,
          timestamp: new Date().toISOString(),
          attempt: attempt + 1,
          isMobile
        },
        tag: `touchbase-notification-${deviceId}`,
        renotify: true,
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View'
          }
        ],
        // Mobile-specific options
        ...(isMobile && {
          vibrate: [200, 100, 200],
          silent: false
        })
      };

      debug('Attempting to show notification:', {
        title: notificationTitle,
        options: notificationOptions,
        attempt: attempt + 1
      });

      await self.registration.showNotification(notificationTitle, notificationOptions);
      debug('Notification displayed successfully');
      
      return true;
    } catch (error) {
      const isTemporaryError = error.name === 'NotAllowedError' ||
                              error.message.includes('permission') ||
                              error.message.includes('push service');
      
      debug('Notification error:', {
        attempt: attempt + 1,
        error: error.toString(),
        name: error.name,
        temporary: isTemporaryError,
        mobile: isMobile
      });
      
      if (attempt < maxAttempts - 1) {
        attempt++;
        const delay = getRetryDelay(attempt);
        debug(`Scheduling retry in ${delay}ms...`);
        await sleep(delay);
        return processNotification();
      }
      
      throw error;
    }
  };

  try {
    await processNotification();
    debug('Notification chain completed successfully');
  } catch (error) {
    debug('Background message processing failed:', {
      error: error.toString(),
      name: error.name,
      message: error.message,
      attempts: attempt + 1,
      isMobile
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