// Service Worker for TouchBase PWA
let initialized = false;

// Global error handler for service worker
self.addEventListener('error', (event) => {
  console.error('[SW-Error] Global error:', event.error);
});

// Global unhandled rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW-Error] Unhandled rejection:', event.reason);
});

const debug = (...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[SW ${timestamp}]`, ...args);
  // Also log to browser console without formatting to ensure visibility
  console.log('[SW-Raw]', ...args);
};

// Listen for message events (useful for debugging)
self.addEventListener('message', (event) => {
  console.log('[SW-Message] Received message:', event.data);
  
  if (event.data?.type === 'SW_PING') {
    console.log('[SW-Message] Received ping, sending response');
    // Ensure we have a client to respond to
    event.source?.postMessage({
      type: 'SW_PING_RESPONSE',
      timestamp: new Date().toISOString(),
      state: {
        initialized,
        active: self.registration.active?.state,
        scope: self.registration.scope
      }
    });
  } else if (event.data?.type === 'FCM_MESSAGE') {
    // Handle forwarded FCM message from firebase-messaging-sw.js
    const { payload } = event.data;
    console.log('[SW-Message] Received FCM message:', payload);
    
    // Extract notification data
    const { notification, webpush } = payload;
    const { title, body } = notification;
    const url = webpush?.fcm_options?.link || '/reminders';
    
    const baseUrl = self.registration.scope.replace(/\/$/, '');
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    // Show notification with proper styling
    self.registration.showNotification(title, {
      body,
      icon: `${baseUrl}/icon.svg`,
      badge: `${baseUrl}/icon.svg`,
      vibrate: [100, 50, 100],
      data: {
        url: fullUrl,
        dateOfArrival: Date.now(),
        primaryKey: 1
      },
      actions: [
        {
          action: 'open',
          title: 'View Reminders'
        }
      ],
      requireInteraction: true
    });
  }
});

// Installation event
self.addEventListener('install', (event) => {
  debug('Installing...');
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
});

// Activate event - claim clients and keep alive
self.addEventListener('activate', event => {
  debug('Activating...');
  // Take control of all pages immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Keep the service worker alive
      self.registration.navigationPreload?.enable()
    ]).then(() => {
      initialized = true;
      debug('Activated and claimed clients');
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Handle navigation requests differently
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try to use the navigation preload response if available
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          // Otherwise, get from network and cache
          const networkResponse = await fetch(event.request);
          const cache = await caches.open('touchbase-v1');
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          // If offline, try to serve the cached index.html
          const cache = await caches.open('touchbase-v1');
          const cachedResponse = await cache.match('/index.html');
          return cachedResponse;
        }
      })()
    );
    return;
  }

  // For non-navigation requests, use cache first, network fallback strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses
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

// Handle push notifications
self.addEventListener('push', (event) => {
  // Check if this is an FCM message by inspecting headers and data patterns
  const isFirebaseMessage = event.data && (() => {
    try {
      const data = event.data.json();
      // FCM messages have a specific structure
      return (
        (data.firebase && data.firebase.messaging) || // Check for FCM v9+ structure
        (data.from && data.from.startsWith('FCM')) || // Check for FCM v8 structure
        data.collapse_key || // FCM specific field
        (data.notification && data.notification.title && data.notification.icon) // Matches our FCM notification structure
      );
    } catch (e) {
      return false;
    }
  })();

  if (isFirebaseMessage) {
    console.log('[SW-Push] FCM message detected, skipping duplicate notification');
    return; // Let firebase-messaging-sw.js handle it
  }

  // For non-FCM pushes, notify clients
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        timestamp: new Date().toISOString()
      });
    });
  });

  // Process only non-FCM push notifications here
  console.log('[SW-Push] Processing non-FCM push notification');

  // Non-FCM push notification logic would go here
  // Currently we don't have any non-FCM push notifications to handle
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data.url || `${self.registration.scope}reminders`;

  // Handle action clicks
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(url)
    );
    return;
  }

  // Default click behavior
  event.waitUntil(
    clients.openWindow(url)
  );
});