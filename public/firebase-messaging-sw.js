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

// Initialize Firebase lazily with retries
let messaging;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

async function getMessaging() {
  if (!messaging) {
    debug('Initializing Firebase...', { attempt: initializationAttempts + 1 });
    
    try {
      // Only clean up duplicate apps if we have more than one
      if (firebase.apps.length > 1) {
        debug('Cleaning up duplicate Firebase apps...');
        const apps = firebase.apps.slice(1); // Keep the first app
        await Promise.all(apps.map(app => app.delete()));
      }

      // Initialize with retry logic and detailed error capture
      let app;
      try {
        app = firebase.initializeApp(firebaseConfig);
      } catch (error) {
        if (error.code === 'app/duplicate-app' && initializationAttempts < MAX_INIT_ATTEMPTS) {
          debug('Duplicate app detected, retrying initialization...');
          initializationAttempts++;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          return getMessaging(); // Recursive retry
        }
        
        // Log detailed error info for debugging
        debug('Firebase initialization failed:', {
          error: {
            code: error.code,
            message: error.message,
            stack: error.stack,
          },
          attempt: initializationAttempts + 1,
          serviceWorkerState: self.registration.active?.state,
          scope: self.registration.scope
        });
        throw error;
      }

      try {
        messaging = firebase.messaging(app);
      } catch (msgError) {
        debug('Messaging initialization failed:', {
          error: {
            code: msgError.code,
            message: msgError.message,
            stack: msgError.stack
          },
          serviceWorkerState: self.registration.active?.state
        });
        throw msgError;
      }
      debug('Firebase initialized successfully', {
        appName: app.name,
        deviceId: self.deviceId || 'unknown'
      });

      // Reset attempt counter on success
      initializationAttempts = 0;
    } catch (error) {
      debug('Firebase initialization error:', error);
      messaging = null; // Reset on error
      throw error;
    }
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
  event.waitUntil((async () => {
    // Reset messaging instance for reinitialization
    messaging = null;
    await getMessaging();
  })());
});

self.addEventListener('notificationclick', (event) => {
  debug('Notification clicked:', event);
  event.notification.close();

  const baseUrl = self.registration.scope;
  const targetPath = event.action === 'view' && event.notification.data?.url
    ? event.notification.data.url
    : '/';
  
  // Ensure we maintain the proper scope when opening URLs
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

// Handle fetch events for FCM
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if this is an FCM endpoint
  if (url.hostname === 'fcm.googleapis.com' ||
      url.hostname.endsWith('.googleapis.com') && url.pathname.includes('/fcm/')) {
    debug('Handling FCM fetch request:', {
      url: url.toString(),
      method: event.request.method,
      deviceType: self.deviceType,
      deviceId: self.deviceId
    });

    // For mobile devices, we need to explicitly handle the FCM request
    if (self.deviceType === 'mobile') {
      event.respondWith(
        fetch(event.request.clone())
          .then(response => {
            debug('FCM fetch succeeded:', {
              status: response.status,
              statusText: response.statusText
            });
            return response;
          })
          .catch(error => {
            debug('FCM fetch failed:', {
              error: error.message,
              deviceType: self.deviceType
            });
            throw error;
          })
      );
    }
    // For desktop, let browser handle directly
    return;
  }
});

// Handle messages //
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FCM') {
    debug('FCM initialization message received');
    
    try {
      // Get device info from initialization message
      const deviceInfo = event.data.deviceInfo || {};
      self.deviceType = deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios' ? 'mobile' : 'desktop';
      self.deviceId = deviceInfo.deviceId;
      
      debug('Device info set:', {
        deviceType: self.deviceType,
        deviceId: self.deviceId,
        scope: self.registration.scope
      });
      
      const messaging = getMessaging();
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: true,
          deviceType: self.deviceType,
          deviceId: self.deviceId
        });
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
      const { deviceId, forceCleanup = false } = event.data;
      debug('Clearing FCM listeners for device:', { deviceId, forceCleanup });
      
      event.waitUntil((async () => {
        try {
          // Store device ID for push event handling
          self.CLEANED_DEVICE_ID = deviceId;
          self.deviceId = deviceId; // Store in service worker scope
  
          // Get current push subscription
          const subscription = await self.registration.pushManager.getSubscription();
          if (subscription) {
            try {
              debug('Found existing push subscription');
              
              // Get subscription details
              const subscriptionInfo = subscription.toJSON();
              const subscriptionState = await self.registration.pushManager.permissionState(subscriptionInfo);
              
              debug('Subscription state:', {
                deviceId,
                currentState: subscriptionState,
                endpoint: subscriptionInfo.endpoint
              });
              
              // Unsubscribe based on criteria
              if (forceCleanup || subscriptionState === 'denied' || subscriptionInfo.expirationTime < Date.now()) {
                debug('Unsubscribing push subscription:', {
                  reason: forceCleanup ? 'forced' : subscriptionState === 'denied' ? 'permission denied' : 'expired'
                });
                await subscription.unsubscribe();
              } else {
                debug('Keeping active subscription');
              }
            } catch (error) {
              debug('Error handling subscription cleanup:', error);
              // Attempt cleanup on error
              try {
                await subscription.unsubscribe();
              } catch (cleanupError) {
                debug('Final cleanup attempt failed:', cleanupError);
              }
            }
          } else {
            debug('No existing push subscription found');
          }
          
          // Reset Firebase messaging instance
          debug('Resetting Firebase messaging instance');
          if (messaging) {
            try {
              await messaging.deleteToken();
            } catch (error) {
              debug('Error deleting Firebase token:', error);
            }
            messaging = null;
          }
  
          // Notify client of completion
          if (event.ports?.[0]) {
            event.ports[0].postMessage({
              success: true,
              deviceId,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          debug('Fatal error in FCM cleanup:', error);
          // Notify client of failure
          if (event.ports?.[0]) {
            event.ports[0].postMessage({
              success: false,
              error: error.message,
              deviceId
            });
          }
        }
      })());
  }
});

// Handle push events
async function handlePushEvent(payload) {
  const startTime = Date.now();
  debug('Handling push event:', { 
    hasNotification: !!payload.notification,
    hasData: !!payload.data,
    startTime 
  });

  try {
    const notificationData = payload.notification || payload.data || {};
    const deviceId = self.CLEANED_DEVICE_ID || self.deviceId || `device-${Date.now()}`;
    const notificationId = `touchbase-${deviceId}-${startTime}`;
    
    debug('Processing notification:', {
      deviceId,
      notificationId,
      title: notificationData.title || 'New Message'
    });
    
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
        notificationId,
        url: notificationData.url || '/',
        timestamp: new Date().toISOString(),
        processedIn: Date.now() - startTime,
        deviceType: self.deviceType
      },
      actions: [{ action: 'view', title: 'View' }],
      ...(self.deviceType === 'mobile' && {
        vibrate: [200, 100, 200],
        silent: false
      })
    });

    debug('Notification displayed successfully', {
      notificationId,
      processedIn: Date.now() - startTime
    });
  } catch (error) {
    debug('Push event processing error:', error);
    throw error;
  }
}