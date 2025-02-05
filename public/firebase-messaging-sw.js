// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here.
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Store for Firebase config
let firebaseConfig = null;
let messaging = null;

// Handle standard fetch events for PWA functionality
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Global error handler
self.addEventListener('error', (event) => {
  console.error('[FCM-SW-Error] Global error:', event.error);
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  console.log('[FCM-SW] Received message:', event.data);
  
  if (event.data?.type === 'FIREBASE_CONFIG') {
    try {
      if (!firebaseConfig) {
        firebaseConfig = event.data.config;
        
        // Initialize Firebase only once
        try {
          firebase.initializeApp(firebaseConfig);
        } catch (error) {
          if (error.code !== 'app/duplicate-app') {
            throw error;
          }
        }
        
        // Get messaging instance
        messaging = firebase.messaging();
      }

      // Set up background message handler if not already set
      if (!messaging.onBackgroundMessage) {
        messaging.onBackgroundMessage((payload) => {
          console.log('[FCM-SW] Received background message:', payload);
          
          const notificationTitle = payload.notification.title;
          const notificationOptions = {
            body: payload.notification.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            data: {
              url: payload.data?.url || '/reminders'
            }
          };

          return self.registration.showNotification(notificationTitle, notificationOptions);
        });
      }

      // Send immediate acknowledgment to the specific client
      event.source.postMessage({
        type: 'FIREBASE_CONFIG_ACK'
      });
    } catch (error) {
      console.error('[FCM-SW] Failed to initialize:', error);
      // Broadcast error to all clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'FIREBASE_CONFIG_ERROR',
            error: error.message
          });
        });
      });
    }
  } else if (event.data?.type === 'SHOW_NOTIFICATION') {
    // Handle foreground notifications
    const payload = event.data.payload;
    self.registration.showNotification(payload.title, {
      ...payload,
      badge: payload.badge || '/icon-192.png',
      icon: payload.icon || '/icon-192.png'
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification click:', event);
  
  // Close the notification
  event.notification.close();

  // Get the notification data
  const url = event.notification.data?.url || '/reminders';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no tab is open, open a new one
      return clients.openWindow(url);
    })
  );
});