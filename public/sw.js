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
  }
});

// Installation event
self.addEventListener('install', (event) => {
  debug('Installing...');
  event.waitUntil(
    caches.open('touchbase-v2.4').then((cache) => {
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
  debug('Activating service worker version 2.4...');
  // Take control of all pages immediately and log version
  debug('PWA Version:', self.registration.scope.includes('manifest.json') ? '2.4' : 'unknown');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Keep the service worker alive
      self.registration.navigationPreload?.enable(),
      // Delete old caches
      caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith('touchbase-') && key !== 'touchbase-v2.4')
          .map(key => caches.delete(key))
      ))
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
  // Check if running in Instagram browser using request headers
  const isInstagram = event.request.headers.get('Sec-Fetch-Dest') === 'document' &&
                     event.request.headers.get('Sec-Fetch-Mode') === 'navigate' &&
                     (event.request.referrer.includes('instagram.com') ||
                      event.request.headers.get('User-Agent')?.includes('Instagram'));

  event.respondWith(
    (async () => {
      if (isInstagram) {
        // For Instagram browser, always use network-first strategy
        // This ensures consistent behavior across iOS and Android
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            return networkResponse;
          }
          throw new Error('Network response was not ok');
        } catch (error) {
          // If network fails, try to serve cached content
          const cache = await caches.open('touchbase-v2.4');
          const cachedResponse = await cache.match('/index.html');
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cache, make one last attempt at network
          return fetch('/index.html');
        }
      } else {
          try {
            // For all other browsers, use the normal strategy
            const preloadResponse = await event.preloadResponse;
            if (preloadResponse) {
              return preloadResponse;
            }

            // Otherwise, get from network and cache
            const networkResponse = await fetch(event.request);
            const cache = await caches.open('touchbase-v2.4');
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          } catch (error) {
            // If offline, try to serve the cached index.html
            const cache = await caches.open('touchbase-v2.4');
            const cachedResponse = await cache.match('/index.html');
            return cachedResponse;
          }
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
          caches.open('touchbase-v2.4').then((cache) => {
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
  // Notify all clients about the push event
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        timestamp: new Date().toISOString(),
        state: {
          initialized,
          active: self.registration.active?.state,
          scope: self.registration.scope
        }
      });
    });
  });

  console.log('[SW-Push] Push event received at:', new Date().toISOString());
  console.log('[SW-Push] Service worker state:', {
    initialized,
    active: self.registration.active?.state,
    scope: self.registration.scope
  });

  // Detailed push event inspection
  const pushInfo = {
    timestamp: new Date().toISOString(),
    eventType: event.type,
    hasData: !!event.data,
    dataFormats: event.data ? {
      text: typeof event.data.text === 'function',
      json: typeof event.data.json === 'function',
      arrayBuffer: typeof event.data.arrayBuffer === 'function'
    } : null,
    registration: {
      active: !!self.registration.active,
      activateState: self.registration.active?.state,
      installing: !!self.registration.installing,
      waiting: !!self.registration.waiting,
      scope: self.registration.scope
    }
  };
  console.log('[SW-Push] Detailed push event info:', pushInfo);

  // Ensure the event stays alive until all asynchronous operations complete
  event.waitUntil(
    (async () => {
      try {
        if (!event.data) {
          console.log('[SW-Push] No data in push event');
          return;
        }

        // Try different data formats
        let rawData;
        try {
          rawData = event.data.text();
          console.log('[SW-Push] Raw text data:', rawData);
        } catch (textError) {
          console.log('[SW-Push] Error getting text data:', textError);
          try {
            rawData = event.data.json();
            console.log('[SW-Push] Raw JSON data:', rawData);
          } catch (jsonError) {
            console.log('[SW-Push] Error getting JSON data:', jsonError);
            try {
              const arrayBuffer = event.data.arrayBuffer();
              rawData = new TextDecoder('utf-8').decode(arrayBuffer);
              console.log('[SW-Push] ArrayBuffer data:', rawData);
            } catch (bufferError) {
              console.error('[SW-Push] All data extraction methods failed');
              throw bufferError;
            }
          }
        }

        // Parse FCM message format
        let data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        // FCM wraps notification data
        const { notification, webpush } = data;
        const { title, body } = notification;
        const url = webpush?.fcm_options?.link || '/reminders';
        
        console.log('[SW-Push] Parsed notification data:', { title, body, url });

        const baseUrl = self.registration.scope.replace(/\/$/, '');
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        const options = {
          body,
          icon: `${baseUrl}/icon-192.png`, // Use absolute URL
          badge: `${baseUrl}/icon-192.png`, // Use absolute URL
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
          requireInteraction: true // Keep notification visible until user interacts
        };

        console.log('[SW-Push] Verifying prerequisites...');
        console.log('[SW-Push] Notification permission:', Notification.permission);
        console.log('[SW-Push] Service worker state:', {
          active: !!self.registration.active,
          installing: !!self.registration.installing,
          waiting: !!self.registration.waiting
        });

        // Check notification permission
        if (Notification.permission !== 'granted') {
          throw new Error(`Notification permission not granted: ${Notification.permission}`);
        }

        // Verify service worker is fully active
        if (!self.registration.active) {
          throw new Error('Service worker not active');
        }

        console.log('[SW-Push] Prerequisites verified, preparing to show notification');
        console.log('[SW-Push] Notification details:', {
          title,
          body: options.body,
          icon: options.icon,
          actions: options.actions
        });

        try {
          // Attempt to show the notification
          await self.registration.showNotification(title, options);
          console.log('[SW-Push] showNotification call successful');
          
          // Verify the notification was created
          const activeNotifications = await self.registration.getNotifications();
          console.log('[SW-Push] Active notifications after display:', {
            count: activeNotifications.length,
            titles: activeNotifications.map(n => n.title)
          });

          if (activeNotifications.length === 0) {
            console.warn('[SW-Push] Warning: No active notifications found after display');
          } else {
            console.log('[SW-Push] Notification successfully verified');
          }
        } catch (notificationError) {
          console.error('[SW-Push] Failed to show notification:', {
            error: notificationError.toString(),
            name: notificationError.name,
            message: notificationError.message,
            stack: notificationError.stack
          });
          throw notificationError;
        }
      } catch (error) {
        // Log detailed error information
        console.error('[SW-Push] Fatal error in push handler:', {
          errorType: error.constructor.name,
          error: error.toString(),
          name: error.name,
          message: error.message,
          stack: error.stack,
          state: {
            initialized,
            permission: Notification.permission,
            registration: {
              active: !!self.registration.active,
              installing: !!self.registration.installing,
              waiting: !!self.registration.waiting,
              scope: self.registration.scope
            }
          }
        });
        throw error; // Re-throw to ensure event.waitUntil knows the operation failed
      }
    })()
  );
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