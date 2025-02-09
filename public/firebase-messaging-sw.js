// Firebase messaging service worker for background notifications
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize debug logging
const debug = (...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[FCM-SW ${timestamp}]`, ...args);
};

// Handle activation
self.addEventListener('activate', (event) => {
  debug('Activating Firebase messaging service worker...');
  event.waitUntil(self.clients.claim());
});

// Handle installation
self.addEventListener('install', (event) => {
  debug('Installing Firebase messaging service worker...');
  self.skipWaiting();
});

// Handle activation requests
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    debug('Skip waiting message received');
    self.skipWaiting();
  }
});

firebase.initializeApp({
  apiKey: 'AIzaSyBseFvFMYyf7JXnqb3HzGp64Hm3BXwqYlw',
  authDomain: 'touchbase-8308f.firebaseapp.com',
  projectId: 'touchbase-8308f',
  storageBucket: 'touchbase-8308f.firebasestorage.app',
  messagingSenderId: '456167551143',
  appId: '1:456167551143:web:5950277a9eece90eac2b82',
  measurementId: 'G-51J28BCVHT'
});

const messaging = firebase.messaging();

// Handle background messages - this is now the only handler for background notifications
messaging.onBackgroundMessage(async (payload) => {
  debug('Received background message:', payload);

  try {
    // Don't show a notification if the payload doesn't have one
    if (!payload.notification) {
      debug('No notification in payload, skipping display');
      return true;
    }

    const { notification } = payload;
    
    // Use notification from webpush config if available
    const webPushNotification = payload.webpush?.notification;
    if (webPushNotification) {
      debug('Using webpush notification configuration');
      await self.registration.showNotification(webPushNotification.title, {
        ...webPushNotification,
        icon: self.location.origin + webPushNotification.icon,
        badge: self.location.origin + webPushNotification.badge,
        data: payload.data
      });
    } else {
      debug('Using default notification configuration');
      const notificationTitle = notification?.title || 'New Message';
      const notificationOptions = {
        body: notification?.body,
        icon: self.location.origin + '/icon-192.png',
        badge: self.location.origin + '/icon-192.png',
        data: payload.data,
        tag: 'touchbase-notification',
        renotify: true,
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View'
          }
        ]
      };

      await self.registration.showNotification(notificationTitle, notificationOptions);
    }
    debug('Custom notification displayed successfully');
    
    // Return true to signal that we'll handle the notification
    // This prevents Firebase from showing its default notification
    return true;
  } catch (error) {
    debug('Error showing notification:', {
      error: error.toString(),
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  debug('Notification clicked:', event);

  event.notification.close();

  let targetUrl = '/';
  if (event.action === 'view' && event.notification.data?.url) {
    targetUrl = event.notification.data.url;
  }

  // Focus existing window or open new one
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