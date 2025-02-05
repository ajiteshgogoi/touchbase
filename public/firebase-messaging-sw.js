// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here.
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyBseFvFMYyf7JXnqb3HzGp64Hm3BXwqYlw",
  authDomain: "touchbase-8308f.firebaseapp.com",
  projectId: "touchbase-8308f",
  storageBucket: "touchbase-8308f.firebasestorage.app",
  messagingSenderId: "456167551143",
  appId: "1:456167551143:web:5950277a9eece90eac2b82",
  measurementId: "G-51J28BCVHT"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  // Customize notification here
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