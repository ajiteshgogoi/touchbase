// Firebase messaging service worker for background notifications
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Handle activation requests
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
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
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const { notification } = payload;
  const notificationTitle = notification?.title || 'New Message';
  const notificationOptions = {
    body: notification?.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});