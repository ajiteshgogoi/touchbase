// Service Worker for TouchBase PWA
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', { timestamp: new Date().toISOString() });
  self.skipWaiting(); // Ensure the service worker becomes active right away
});

// Global error handler for service worker
self.addEventListener('error', (event) => {
  console.error('[SW-Error] Global error:', event.error);
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  console.log('[SW-Message] Received message:', event.data);
  
  if (event.data?.type === 'SW_PING') {
    console.log('[SW-Message] Received ping, sending response');
    // Ensure we have a client to respond to
    event.source?.postMessage({
      type: 'SW_PING_RESPONSE',
      timestamp: new Date().toISOString(),
      state: {
        active: self.registration.active?.state,
        scope: self.registration.scope
      }
    });
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

// Activate event - claim clients and keep alive
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  // Take control of all pages immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Keep the service worker alive
      self.registration.navigationPreload?.enable()
    ])
  );
});

// Handle standard fetch events for PWA functionality
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  
  // Close the notification
  event.notification.close();

  // Get the notification data
  const clickAction = event.notification?.data?.clickAction || '/reminders';
  
  // This handles both FCM and regular notifications
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(clickAction) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no tab is open, open a new one
      return clients.openWindow(clickAction);
    })
  );
});