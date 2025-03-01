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

// Handle activation requests and FCM cleanup
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    debug('Skip waiting message received');
    self.skipWaiting();
  } else if (event.data?.type === 'CLEAR_FCM_LISTENERS') {
    const deviceId = event.data.deviceId;
    debug('Clearing FCM listeners for device:', deviceId);

    // Store the device ID being cleaned up
    self.CLEANED_DEVICE_ID = deviceId;

    // Remove all message event listeners
    self.removeEventListener('push', () => {});
    self.removeEventListener('pushsubscriptionchange', () => {});

    // Reset Firebase messaging state by removing the property
    delete firebase.messaging;

    // Clear any stored subscriptions for this device
    self.registration.pushManager.getSubscription().then(subscription => {
      if (subscription) {
        debug('Unsubscribing push subscription for device:', deviceId);
        subscription.unsubscribe();
      }
    });

    // Notify the client that cleanup is complete
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, deviceId });
    }
  }
});

// Initialize Firebase with placeholder config values that will be replaced during build
firebase.initializeApp({
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID", 
  appId: "VITE_FIREBASE_APP_ID",
  measurementId: "VITE_FIREBASE_MEASUREMENT_ID"
});

const messaging = firebase.messaging();

// Handle background messages - this is now the only handler for background notifications
messaging.onBackgroundMessage(async (payload) => {
  debug('Received background message:', payload);

  try {
    debug('Received payload:', payload);
    
    // For background messages, FCM puts the data in a different structure
    const notificationData = payload.notification || payload.data || {};
    debug('Extracted notification data:', notificationData);

    // Get stored device ID from the cleanup process or fallback
    const deviceId = self.CLEANED_DEVICE_ID || 'unknown-device';
    
    const notificationTitle = notificationData.title || 'New Message';
    const notificationOptions = {
      body: notificationData.body,
      icon: self.location.origin + '/icon-192.png',
      badge: self.location.origin + '/icon-192.png',
      data: {
        ...(payload.data || {}),
        deviceId: deviceId,
        timestamp: new Date().toISOString()
      },
      tag: `touchbase-notification-${deviceId}`, // Make tag device-specific
      renotify: true,
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View'
        }
      ]
    };

    debug('Showing notification with:', { title: notificationTitle, options: notificationOptions });
    await self.registration.showNotification(notificationTitle, notificationOptions);
    debug('Notification shown successfully');
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