// Service Worker for TouchBase PWA
console.log('Service Worker script starting', { timestamp: new Date().toISOString() });

let initialized = false;
const debug = (...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[SW ${timestamp}]`, ...args);
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
  debug('Push event received', {
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
        if (!initialized) {
          debug('WARNING: Push event before service worker initialization');
        }

        if (!event.data) {
          debug('Warning: Push event has no data');
          return;
        }

        const rawData = event.data.text();
        debug('Raw push data:', rawData);
        
        const data = JSON.parse(rawData);
        const { title, body, url } = data;

        debug('Parsed push notification data:', { title, body, url });

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

        debug('Checking notification permission:', Notification.permission);
        
        if (Notification.permission !== 'granted') {
          throw new Error(`Notification permission not granted: ${Notification.permission}`);
        }

        debug('About to display notification:', {
          title,
          options,
          registration: {
            active: !!self.registration.active,
            installing: !!self.registration.installing,
            waiting: !!self.registration.waiting,
            scope: self.registration.scope
          }
        });

        // Display the notification
        await self.registration.showNotification(title, options);
        debug('showNotification call completed');

        // Verify the notification was created
        const activeNotifications = await self.registration.getNotifications();
        debug('Active notifications after display:', {
          count: activeNotifications.length,
          titles: activeNotifications.map(n => n.title)
        });
      } catch (error) {
        debug('Error handling push notification:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          registration: {
            active: !!self.registration.active,
            installing: !!self.registration.installing,
            waiting: !!self.registration.waiting,
            scope: self.registration.scope
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