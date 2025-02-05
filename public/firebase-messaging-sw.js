// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here.
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Store for Firebase config
let firebaseConfig = null;
let messaging = null;

// Listen for config message from main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    try {
      firebaseConfig = event.data.config;
      
      // Initialize Firebase once we have the config
      firebase.initializeApp(firebaseConfig);
      messaging = firebase.messaging();

      // Set up background message handler
      messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message:', payload);
        
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

      // Acknowledge successful initialization
      event.source?.postMessage({
        type: 'FIREBASE_CONFIG_ACK'
      });
    } catch (error) {
      console.error('[firebase-messaging-sw.js] Failed to initialize:', error);
      // Send error back to main app
      event.source?.postMessage({
        type: 'FIREBASE_CONFIG_ERROR',
        error: error.message
      });
    }
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  
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