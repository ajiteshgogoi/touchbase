// Service Worker for TouchBase PWA
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('touchbase-v1').then((cache) => {
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

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  // Ensure the event stays alive until all asynchronous operations complete
  event.waitUntil(
    (async () => {
      try {
        console.log('Push event received in service worker');
        
        if (!event.data) {
          console.warn('Push event has no data');
          return;
        }

        const rawData = event.data.text();
        console.log('Raw push data:', rawData);
        
        const data = JSON.parse(rawData);
        const { title, body, url } = data;

        console.log('Parsed push notification data:', { title, body, url });

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

        await self.registration.showNotification(title, options);
        // Log before displaying notification
        console.log('About to display notification with options:', options);
        // Actually display the notification
        await self.registration.showNotification(title, options);
        console.log('Notification displayed successfully');
        
        // Check if the notification was created
        const notifications = await self.registration.getNotifications();
        console.log('Active notifications:', notifications.length);
      } catch (error) {
        console.error('Error handling push notification:', error);
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