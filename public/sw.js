// Service Worker for TouchBase PWA
const VERSION = '2.5.2'; // This will be replaced by the update script
const CACHE_NAME = `touchbase-v${VERSION}`;
let initialized = false;

// Global error handler for service worker
self.addEventListener('error', (event) => {
  console.error('[SW-Error] Global error:', event.error);
});

// Global unhandled rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW-Error] Unhandled rejection:', event.reason);
});

const debug = (...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[SW ${timestamp}]`, ...args);
  // Also log to browser console without formatting to ensure visibility
  console.log('[SW-Raw]', ...args);
};

// Listen for message events (useful for debugging)
self.addEventListener('message', (event) => {
  debug('Received message:', event.data);
  
  if (event.data?.type === 'SW_PING') {
    debug('Received ping, sending response');
    // Ensure we have a client to respond to
    event.source?.postMessage({
      type: 'SW_PING_RESPONSE',
      timestamp: new Date().toISOString(),
      state: {
        initialized,
        version: VERSION,
        active: self.registration.active?.state,
        scope: self.registration.scope
      }
    });
  }
});

// Installation event
self.addEventListener('install', (event) => {
  debug(`Installing version ${VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      debug('Caching app shell...');
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/icon-192.png',
        '/icon-512.png'
      ]).then(() => {
        debug('App shell cached successfully');
      });
    })
  );
});

// Activate event - claim clients and cleanup old caches
// Platform detection helper
const getPlatformInfo = (request) => {
  const ua = request?.headers.get('User-Agent') || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) || ua.includes('Mac');
  const isMobile = isAndroid || isIOS;
  const isInstagram = ua.includes('Instagram') || request?.referrer?.includes('instagram.com');
  return { isAndroid, isIOS, isMobile, isInstagram };
};

self.addEventListener('activate', event => {
  debug(`Activating service worker version ${VERSION}...`);
  event.waitUntil(
    (async () => {
      try {
        // Enable navigation preload if supported
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }

        // Delete old caches
        const keys = await caches.keys();
        await Promise.all(
          keys.filter(key => key.startsWith('touchbase-') && key !== CACHE_NAME)
            .map(key => {
              debug(`Deleting old cache ${key}`);
              return caches.delete(key);
            })
        );

        // Get platform info from any available client
        const clients = await self.clients.matchAll();
        const firstClient = clients[0];
        const platform = getPlatformInfo(firstClient?.url ? new Request(firstClient.url) : null);

        // On desktop, delay claiming clients to prevent refresh loops
        if (!platform.isMobile) {
          debug('Desktop detected, delaying client claim...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Claim clients after cleanup and potential delay
        await self.clients.claim();
        initialized = true;
        debug('Service worker activated and clients claimed');
      } catch (error) {
        debug('Activation error:', error);
        throw error;
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Handle navigation requests with platform-specific strategies
  if (event.request.mode === 'navigate') {
    const platform = getPlatformInfo(event.request);
    
    event.respondWith(
      (async () => {
        try {
          // Try navigation preload response first
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          // For Instagram browser, maintain special handling
          if (platform.isInstagram) {
            try {
              const networkResponse = await fetch(event.request);
              if (networkResponse.ok) {
                return networkResponse;
              }
            } catch (error) {
              debug('Network fetch failed for Instagram browser:', error);
            }
            // Fall back to cache
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match('/index.html');
            return cachedResponse || await fetch('/index.html');
          }

          // For mobile devices, use network-first with timeout
          if (platform.isMobile) {
            try {
              const networkResponse = await Promise.race([
                fetch(event.request),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Network timeout')), 3000)
                )
              ]);
              
              if (networkResponse.ok) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              }
            } catch (error) {
              debug('Mobile network fetch failed:', error);
            }

            // Fall back to cache
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match('/index.html');
            return cachedResponse || await fetch('/index.html');
          }

          // For desktop browsers, use cache-first to prevent refresh loops
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            // Update cache in the background
            fetch(event.request)
              .then(networkResponse => {
                if (networkResponse.ok) {
                  cache.put(event.request, networkResponse);
                }
              })
              .catch(error => debug('Background fetch failed:', error));
            
            return cachedResponse;
          }

          // If no cache, try network with shorter timeout
          try {
            const networkResponse = await Promise.race([
              fetch(event.request),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Network timeout')), 2000)
              )
            ]);
            
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            }
          } catch (error) {
            debug('Desktop network fetch failed:', error);
          }

          // Last resort - return cached index.html
          return cache.match('/index.html') || await fetch('/index.html');
        } catch (error) {
          debug('Navigation fetch handler error:', error);
          return new Response('Navigation error', { status: 500 });
        }
      })()
    );
  }

  // For non-navigation requests, use stale-while-revalidate strategy
  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);

        // Start fetching fresh data in the background
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(error => {
          debug('Network fetch failed for asset:', error);
          throw error;
        });

        // Return cached response immediately if available
        return cachedResponse || fetchPromise;
      } catch (error) {
        debug('Non-navigation fetch handler error:', error);
        throw error;
      }
    })()
  );
});

// Handle push notifications with improved error handling
self.addEventListener('push', (event) => {
  // Notify all clients about the push event
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        timestamp: new Date().toISOString(),
        state: {
          initialized,
          active: self.registration.active?.state,
          scope: self.registration.scope
        }
      });
    });
  });

  console.log('[SW-Push] Push event received at:', new Date().toISOString());
  console.log('[SW-Push] Service worker state:', {
    initialized,
    active: self.registration.active?.state,
    scope: self.registration.scope
  });

  // Detailed push event inspection
  const pushInfo = {
    timestamp: new Date().toISOString(),
    eventType: event.type,
    hasData: !!event.data,
    dataFormats: event.data ? {
      text: typeof event.data.text === 'function',
      json: typeof event.data.json === 'function',
      arrayBuffer: typeof event.data.arrayBuffer === 'function'
    } : null,
    registration: {
      active: !!self.registration.active,
      activateState: self.registration.active?.state,
      installing: !!self.registration.installing,
      waiting: !!self.registration.waiting,
      scope: self.registration.scope
    }
  };
  console.log('[SW-Push] Detailed push event info:', pushInfo);

  // Ensure the event stays alive until all asynchronous operations complete
  event.waitUntil(
    (async () => {
      try {
        if (!event.data) {
          console.log('[SW-Push] No data in push event');
          return;
        }

        // Try different data formats
        let rawData;
        try {
          rawData = event.data.text();
          console.log('[SW-Push] Raw text data:', rawData);
        } catch (textError) {
          console.log('[SW-Push] Error getting text data:', textError);
          try {
            rawData = event.data.json();
            console.log('[SW-Push] Raw JSON data:', rawData);
          } catch (jsonError) {
            console.log('[SW-Push] Error getting JSON data:', jsonError);
            try {
              const arrayBuffer = event.data.arrayBuffer();
              rawData = new TextDecoder('utf-8').decode(arrayBuffer);
              console.log('[SW-Push] ArrayBuffer data:', rawData);
            } catch (bufferError) {
              console.error('[SW-Push] All data extraction methods failed');
              throw bufferError;
            }
          }
        }

        // Parse FCM message format
        let data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        // FCM wraps notification data
        const { notification, webpush } = data;
        const { title, body } = notification;
        const url = webpush?.fcm_options?.link || '/reminders';
        
        console.log('[SW-Push] Parsed notification data:', { title, body, url });

        const baseUrl = self.registration.scope.replace(/\/$/, '');
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

        const options = {
          body,
          icon: `${baseUrl}/icon-192.png`, // Use absolute URL
          badge: `${baseUrl}/icon-192.png`, // Use absolute URL
          vibrate: [100, 50, 100],
          data: {
            url: fullUrl,
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

        console.log('[SW-Push] Verifying prerequisites...');
        console.log('[SW-Push] Notification permission:', Notification.permission);
        console.log('[SW-Push] Service worker state:', {
          active: !!self.registration.active,
          installing: !!self.registration.installing,
          waiting: !!self.registration.waiting
        });

        // Check notification permission
        if (Notification.permission !== 'granted') {
          throw new Error(`Notification permission not granted: ${Notification.permission}`);
        }

        // Verify service worker is fully active
        if (!self.registration.active) {
          throw new Error('Service worker not active');
        }

        console.log('[SW-Push] Prerequisites verified, preparing to show notification');
        console.log('[SW-Push] Notification details:', {
          title,
          body: options.body,
          icon: options.icon,
          actions: options.actions
        });

        try {
          // Attempt to show the notification
          await self.registration.showNotification(title, options);
          console.log('[SW-Push] showNotification call successful');
          
          // Verify the notification was created
          const activeNotifications = await self.registration.getNotifications();
          console.log('[SW-Push] Active notifications after display:', {
            count: activeNotifications.length,
            titles: activeNotifications.map(n => n.title)
          });

          if (activeNotifications.length === 0) {
            console.warn('[SW-Push] Warning: No active notifications found after display');
          } else {
            console.log('[SW-Push] Notification successfully verified');
          }
        } catch (notificationError) {
          console.error('[SW-Push] Failed to show notification:', {
            error: notificationError.toString(),
            name: notificationError.name,
            message: notificationError.message,
            stack: notificationError.stack
          });
          throw notificationError;
        }
      } catch (error) {
        // Log detailed error information
        console.error('[SW-Push] Fatal error in push handler:', {
          errorType: error.constructor.name,
          error: error.toString(),
          name: error.name,
          message: error.message,
          stack: error.stack,
          state: {
            initialized,
            permission: Notification.permission,
            registration: {
              active: !!self.registration.active,
              installing: !!self.registration.installing,
              waiting: !!self.registration.waiting,
              scope: self.registration.scope
            }
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

  const url = event.notification.data.url || `${self.registration.scope}reminders`;

  // Handle action clicks
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(url)
    );
    return;
  }

  // Default click behavior
  event.waitUntil(
    clients.openWindow(url)
  );
});