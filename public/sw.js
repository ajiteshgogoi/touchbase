// Combined Service Worker for TouchBase PWA and Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

let initialized = false;
let firebaseInitialized = false;

// Initialize Firebase with placeholder config values that will be replaced during build
firebase.initializeApp({
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID", 
  appId: "VITE_FIREBASE_APP_ID",
  measurementId: "VITE_FIREBASE_MEASUREMENT_ID"
});

// Shared debug logger
const debug = (...args) => {
  const timestamp = new Date().toISOString();
  const prefix = firebaseInitialized ? '[FCM-SW]' : '[SW]';
  console.log(`${prefix} ${timestamp}`, ...args);
  // Also log without formatting for better visibility
  console.log(`${prefix}-Raw`, ...args);
};

// Global error handlers
self.addEventListener('error', (event) => {
  console.error('[SW-Error] Global error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW-Error] Unhandled rejection:', event.reason);
});

// Installation event - cache app shell
self.addEventListener('install', (event) => {
  debug('Installing service worker...');
  event.waitUntil(
    caches.open('touchbase-v1').then((cache) => {
      debug('Caching app shell...');
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/icon-192.png',
        '/icon-512.png'
      ]);
    })
  );
  self.skipWaiting();
});

// Activation event - clean up and initialize
self.addEventListener('activate', event => {
  debug('Activating service worker...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      self.registration.navigationPreload?.enable()
    ]).then(() => {
      initialized = true;
      debug('Service worker activated and claimed clients');
    })
  );
});

// Combined message handler
self.addEventListener('message', (event) => {
  debug('Received message:', event.data);
  
  if (event.data?.type === 'SW_PING') {
    event.source?.postMessage({
      type: 'SW_PING_RESPONSE',
      timestamp: new Date().toISOString(),
      state: {
        initialized,
        firebaseInitialized,
        active: self.registration.active?.state,
        scope: self.registration.scope
      }
    });
  } else if (event.data?.type === 'CLEAR_FCM_LISTENERS') {
    const deviceId = event.data.deviceId;
    debug('Clearing FCM listeners for device:', deviceId);

    // Store device ID for cleanup context
    self.CLEANED_DEVICE_ID = deviceId;

    // Remove push event listeners
    self.removeEventListener('push', () => {});
    self.removeEventListener('pushsubscriptionchange', () => {});

    // Reset Firebase messaging
    delete firebase.messaging;
    firebaseInitialized = false;

    // Clear push subscription
    self.registration.pushManager.getSubscription().then(subscription => {
      if (subscription) {
        debug('Unsubscribing push subscription for device:', deviceId);
        subscription.unsubscribe();
      }
    });

    // Notify client
    if (event.ports?.[0]) {
      event.ports[0].postMessage({ success: true, deviceId });
    }
  }
});

// Fetch handler for offline support
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    const isInstagram = event.request.headers.get('Sec-Fetch-Dest') === 'document' &&
                       event.request.headers.get('Sec-Fetch-Mode') === 'navigate' &&
                       (event.request.referrer.includes('instagram.com') ||
                        event.request.headers.get('User-Agent')?.includes('Instagram'));

    event.respondWith(
      (async () => {
        if (isInstagram) {
          try {
            const networkResponse = await fetch(event.request);
            if (networkResponse.ok) return networkResponse;
            throw new Error('Network response was not ok');
          } catch (error) {
            const cache = await caches.open('touchbase-v1');
            const cachedResponse = await cache.match('/index.html');
            if (cachedResponse) return cachedResponse;
            return fetch('/index.html');
          }
        } else {
          try {
            const preloadResponse = await event.preloadResponse;
            if (preloadResponse) return preloadResponse;

            const networkResponse = await fetch(event.request);
            const cache = await caches.open('touchbase-v1');
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          } catch (error) {
            const cache = await caches.open('touchbase-v1');
            return cache.match('/index.html');
          }
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open('touchbase-v1').then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});

// Initialize Firebase Messaging
const initializeFirebase = () => {
  if (firebaseInitialized) return firebase.messaging();
  
  debug('Initializing Firebase Messaging...');
  const messaging = firebase.messaging();
  firebaseInitialized = true;
  return messaging;
};

// Handle push notifications
self.addEventListener('push', (event) => {
  debug('Push event received');
  
  // Initialize Firebase if needed
  const messaging = initializeFirebase();
  
  // Notify clients
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        timestamp: new Date().toISOString(),
        state: {
          initialized,
          firebaseInitialized,
          active: self.registration.active?.state,
          scope: self.registration.scope
        }
      });
    });
  });

  event.waitUntil(
    (async () => {
      try {
        if (!event.data) {
          debug('No data in push event');
          return;
        }

        let rawData;
        try {
          rawData = event.data.text();
          debug('Raw text data:', rawData);
        } catch (textError) {
          try {
            rawData = event.data.json();
            debug('Raw JSON data:', rawData);
          } catch (jsonError) {
            try {
              const arrayBuffer = event.data.arrayBuffer();
              rawData = new TextDecoder('utf-8').decode(arrayBuffer);
              debug('ArrayBuffer data:', rawData);
            } catch (bufferError) {
              console.error('All data extraction methods failed');
              throw bufferError;
            }
          }
        }

        // Parse FCM message format
        let data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        const { notification, webpush } = data;
        const { title, body } = notification;
        const url = webpush?.fcm_options?.link || '/reminders';

        debug('Parsed notification data:', { title, body, url });

        const baseUrl = self.registration.scope.replace(/\/$/, '');
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        const deviceId = self.CLEANED_DEVICE_ID || 'unknown-device';
        
        const options = {
          body,
          icon: `${baseUrl}/icon-192.png`,
          badge: `${baseUrl}/icon-192.png`,
          data: {
            url: fullUrl,
            deviceId,
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

        debug('Verifying notification prerequisites...');
        
        if (Notification.permission !== 'granted') {
          throw new Error(`Notification permission not granted: ${Notification.permission}`);
        }

        if (!self.registration.active) {
          throw new Error('Service worker not active');
        }

        await self.registration.showNotification(title, options);
        debug('Notification displayed successfully');

        const activeNotifications = await self.registration.getNotifications();
        debug('Active notifications:', {
          count: activeNotifications.length,
          titles: activeNotifications.map(n => n.title)
        });

        return true;
      } catch (error) {
        console.error('Error in push handler:', {
          error: error.toString(),
          name: error.name,
          message: error.message,
          stack: error.stack,
          state: {
            initialized,
            firebaseInitialized,
            permission: Notification.permission,
            registration: {
              active: !!self.registration.active,
              installing: !!self.registration.installing,
              waiting: !!self.registration.waiting,
              scope: self.registration.scope
            }
          }
        });
        throw error;
      }
    })()
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  debug('Notification clicked:', event);
  
  event.notification.close();

  const targetUrl = event.notification.data?.url || `${self.registration.scope}reminders`;

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