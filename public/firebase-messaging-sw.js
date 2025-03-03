// Firebase messaging service worker for background notifications
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize debug logging with timestamped backtrace
const debug = (...args) => {
  const timestamp = new Date().toISOString();
  const trace = new Error().stack?.split('\n')[2]?.trim() || '';
  console.log(`[FCM-SW ${timestamp}]${trace ? ` (${trace})` : ''}`, ...args);
};

// Persistent device info storage
const DB_NAME = 'fcm-device-info';
const STORE_NAME = 'device-info';

async function getDeviceInfo() {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME);
      // Add indices for better querying if needed
      store.createIndex('deviceId', 'deviceId', { unique: false });
      store.createIndex('vapidKey', 'vapidKey', { unique: false });
    }
  });
  return db.get(STORE_NAME, 'device-info');
}

async function saveDeviceInfo(info) {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    }
  });
  await db.put(STORE_NAME, info, 'device-info');
}

// Function to open IndexedDB
function openDB(name, version, { upgrade } = {}) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    if (upgrade) {
      request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion, event.newVersion);
    }
  });
}

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
  // Don't initialize Firebase until we have a VAPID key and device info
  const deviceInfo = await getDeviceInfo();
  if (!deviceInfo?.vapidKey) {
    debug('No VAPID key found in device info, waiting for initialization...');
    return null;
  }

  if (!messaging) {
    debug('Initializing Firebase...', {
      attempt: initializationAttempts + 1,
      deviceType: deviceInfo.deviceType || 'unknown'
    });
    
    try {
      // Ensure any existing Firebase apps are properly cleaned up
      if (firebase.apps.length > 0) {
        debug('Cleaning up existing Firebase apps...');
        await Promise.all(firebase.apps.map(app => app.delete()));
      }

      // Initialize with retry logic and detailed error capture
      let app;
      try {
        app = firebase.initializeApp({
          ...firebaseConfig,
          vapidKey: deviceInfo.vapidKey
        });
      } catch (error) {
        if (error.code === 'app/duplicate-app' && initializationAttempts < MAX_INIT_ATTEMPTS) {
          debug('Duplicate app detected, retrying initialization...');
          initializationAttempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          return getMessaging(); // Recursive retry
        }
        
        debug('Firebase initialization failed:', {
          error: {
            code: error.code,
            message: error.message,
            stack: error.stack,
          },
          attempt: initializationAttempts + 1,
          serviceWorkerState: self.registration.active?.state,
          scope: self.registration.scope,
          deviceType: deviceInfo.deviceType
        });
        throw error;
      }

      try {
        messaging = firebase.messaging(app);
        
        // Additional mobile-specific initialization
        if (deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios') {
          debug('Performing mobile-specific initialization...');
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for stability
        }
      } catch (msgError) {
        debug('Messaging initialization failed:', {
          error: {
            code: msgError.code,
            message: msgError.message,
            stack: msgError.stack
          },
          serviceWorkerState: self.registration.active?.state,
          deviceType: deviceInfo.deviceType
        });
        throw msgError;
      }
      
      debug('Firebase initialized successfully', {
        appName: app.name,
        deviceId: self.deviceId || 'unknown',
        deviceType: deviceInfo.deviceType
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
    try {
      const deviceInfo = await getDeviceInfo();
      const isMobile = deviceInfo?.deviceType === 'android' || deviceInfo?.deviceType === 'ios';
      
      debug('Processing push subscription change:', {
        deviceType: deviceInfo?.deviceType,
        isMobile,
        hasVapidKey: !!deviceInfo?.vapidKey
      });

      // For mobile devices, we need to do a complete reset
      if (isMobile) {
        debug('Mobile device detected, performing full reset...');
        
        // Reset Firebase instance
        messaging = null;
        
        // Clean up any existing subscription
        const existingSub = await self.registration.pushManager.getSubscription();
        if (existingSub) {
          await existingSub.unsubscribe();
        }

        // Get VAPID key from device info
        if (!deviceInfo?.vapidKey) {
          throw new Error('VAPID key not found in device info');
        }

        // Create new subscription with userVisibleOnly and stored VAPID key
        const subscriptionOptions = {
          userVisibleOnly: true,
          applicationServerKey: deviceInfo.vapidKey
        };

        debug('Creating new push subscription with options:', {
          userVisibleOnly: true,
          hasApplicationServerKey: !!deviceInfo.vapidKey
        });

        await self.registration.pushManager.subscribe(subscriptionOptions);
        
        // Small delay for stability
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Only proceed with reinitialization if we have the necessary info
      if (deviceInfo?.vapidKey) {
        debug('Reinitializing messaging with existing VAPID key');
        const newMessaging = await getMessaging();
        if (!newMessaging) {
          throw new Error('Failed to reinitialize messaging after subscription change');
        }
      } else {
        debug('Awaiting new initialization from client...');
      }
    } catch (error) {
      debug('Error handling push subscription change:', error);
      // Reset state on error
      messaging = null;
    }
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
   
   event.respondWith((async () => {
     try {
       // Get device info from storage
       const deviceInfo = await getDeviceInfo() || {};
       const isMobile = deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios';
       
       debug('Handling FCM fetch request:', {
         url: url.toString(),
         method: event.request.method,
         deviceType: deviceInfo.deviceType,
         isMobile
       });

       // Clone request for logging
       const request = event.request.clone();
       const response = await fetch(request);

       debug('FCM fetch succeeded:', {
         status: response.status,
         statusText: response.statusText,
         deviceType: deviceInfo.deviceType
       });

       return response;
     } catch (error) {
       debug('FCM fetch failed:', {
         error: error.message,
         deviceType: (await getDeviceInfo())?.deviceType
       });
       throw error;
     }
   })());
   return;
 }
});

// Handle messages //
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FCM') {
    debug('FCM initialization message received');
    
    event.waitUntil((async () => {
      try {
        // Get device info from initialization message
        const deviceInfo = event.data.deviceInfo || {};
        const deviceType = deviceInfo.deviceType === 'android' || deviceInfo.deviceType === 'ios' ? 'mobile' : 'desktop';
        const deviceId = deviceInfo.deviceId;
        const isMobile = deviceType === 'mobile';
        
        // Save device info and VAPID key to persistent storage
        const vapidKey = event.data.vapidKey;
        if (!vapidKey) {
          throw new Error('VAPID key not provided in initialization message');
        }
        
        // Clear any existing data for clean state
        messaging = null;
        
        // Save new device info
        await saveDeviceInfo({
          deviceType,
          deviceId,
          vapidKey,
          timestamp: Date.now()
        });
        
        self.deviceType = deviceType;
        self.deviceId = deviceId;
        self.vapidKey = vapidKey;
        
        debug('Device info set and persisted:', {
          deviceType,
          deviceId,
          hasVapidKey: !!vapidKey,
          scope: self.registration.scope,
          isMobile
        });

        // Mobile-specific initialization sequence
        if (isMobile) {
          debug('Starting mobile-specific initialization...');
          
          // Ensure clean push manager state
          const existingSub = await self.registration.pushManager.getSubscription();
          if (existingSub) {
            debug('Cleaning up existing push subscription...');
            await existingSub.unsubscribe();
          }
          
          // Small delay for stability on mobile
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Ensure proper push subscription with userVisibleOnly
          const subscriptionOptions = {
            userVisibleOnly: true,
            applicationServerKey: vapidKey
          };
          await self.registration.pushManager.subscribe(subscriptionOptions);
        }
        
        // Initialize Firebase
        const messaging = await getMessaging();
        if (!messaging) {
          throw new Error('Failed to initialize Firebase messaging');
        }
        
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            success: true,
            deviceType,
            deviceId,
            isMobile
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
    })());
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
    startTime,
    userVisibleOnly: true
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