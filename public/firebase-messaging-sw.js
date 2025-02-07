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

// Handle background messages
messaging.onBackgroundMessage(async (payload) => {
  debug('Received background message:', payload);

  try {
    const { notification } = payload;
    const notificationTitle = notification?.title || 'New Message';
    const notificationOptions = {
      body: notification?.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data,
      tag: 'touchbase-notification', // Prevent duplicate notifications
      renotify: true, // Allow new notifications to override old ones with same tag
      requireInteraction: true, // Keep notification visible until user interacts
      vibrate: [100, 50, 100], // Vibration pattern
      actions: [
        {
          action: 'view',
          title: 'View'
        }
      ]
    };

    debug('Showing notification with options:', {
      title: notificationTitle,
      options: notificationOptions
    });

    // Verify we have notification permission
    if (Notification.permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    // Show the notification
    await self.registration.showNotification(notificationTitle, notificationOptions);
    debug('Notification displayed successfully');

    // Verify notification was created
    const activeNotifications = await self.registration.getNotifications();
    if (activeNotifications.length === 0) {
      throw new Error('Notification was not created');
    }

    debug('Notification verified active:', {
      count: activeNotifications.length,
      titles: activeNotifications.map(n => n.title)
    });
  } catch (error) {
    debug('Error showing notification:', {
      error: error.toString(),
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error; // Re-throw to ensure Firebase knows of the failure
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