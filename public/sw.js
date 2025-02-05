// Service Worker for TouchBase PWA
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', { timestamp: new Date().toISOString() });
  self.skipWaiting(); // Ensure the service worker becomes active right away
});

let initialized = false;
const debug = (...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[SW ${timestamp}]`, ...args);
  // Also log to browser console without formatting to ensure visibility
  console.log('[SW-Raw]', ...args);
};

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
  if (!initialized) {
    debug('Fetch event before initialization');
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW-Push] Push event received');
  console.log('[SW-Push] Event data:', event.data ? 'present' : 'missing');
  
  // Log the raw event for debugging
  console.log('[SW-Push] Full event:', {
    hasData: !!event.data,
    timestamp: new Date().toISOString(),
    initialized,
    registration: {
      scope: self.registration.scope,
      active: !!self.registration.active,
      installing: !!self.registration.installing,
      waiting: !!self.registration.waiting
    }
  });

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

        const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        const { title, body, url } = data;

        console.log('[SW-Push] Parsed notification data:', { title, body, url });

        const options = {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [100, 50, 100],
          data: {
            url,
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

  // Handle action clicks
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/reminders')
    );
    return;
  }

  // Default click behavior
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/reminders')
  );
});