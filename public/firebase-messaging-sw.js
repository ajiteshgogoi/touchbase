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
  measurementId: "VITE_FIREBASE_MEASUREMENT_ID"
};

// Initialize Firebase messaging instance
let messagingInstance = null;

// Get or initialize messaging
function getMessaging() {
  if (messagingInstance) {
    return messagingInstance;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  messagingInstance = firebase.messaging();
  return messagingInstance;
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
    const deviceInfo = payload.data?.deviceInfo ? JSON.parse(payload.data.deviceInfo) : {};
    const isMobile = deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios';
    
    // Skip handling on mobile devices to let Firebase handle it natively
    if (isMobile) {
      debug('Skipping notification on mobile device, letting Firebase handle it');
      return;
    }

    // Only process top-level notification to match foreground behavior
    const notificationData = payload.notification || {};
    const deviceId = self.deviceId || `device-${Date.now()}`;
    const startTime = Date.now();

    await self.registration.showNotification(notificationData.title || 'New Message', {
      body: notificationData.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'touchbase-notification',
      requireInteraction: true,
      data: {
        ...payload.data,
        deviceId,
        url: payload.data?.url || '/',
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
        // Add delay before initialization
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Initialize messaging with retries
        let retries = 0;
        const maxRetries = 3;
        while (retries < maxRetries) {
          try {
            const messaging = getMessaging();
            // Add delay after getting messaging instance
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify the instance is working
            if (messaging && firebase.apps.length > 0) {
              event.ports[0].postMessage({
                success: true,
                deviceType: event.data?.deviceInfo?.deviceType || 'web',
                isMobile: event.data?.deviceInfo?.isMobile || false
              });
              return;
            }
          } catch (error) {
            debug(`FCM initialization attempt ${retries + 1} failed:`, error);
          }
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, retries)));
          }
        }
        throw new Error('Failed to initialize messaging after retries');
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