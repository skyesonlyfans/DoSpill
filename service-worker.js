// service-worker.js

// Incrementing the cache name is crucial for updates.
const CACHE_NAME = 'dospill-cache-v6';

// Essential local files that form the "app shell".
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/js/app.js',
  '/manifest.json',
  '/admin/index.html',
  '/admin/style.css',
  '/admin/admin.js',
  '/offline.html'
];

// External resources that should be cached
const EXTERNAL_URLS = [
  'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js'
];

/**
 * Install Event
 * This is triggered when the service worker is first registered.
 * We open a cache and add our essential app shell files to it.
 */
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('[ServiceWorker] Caching app shell');
        
        // Cache app shell files
        try {
          await cache.addAll(APP_SHELL_URLS);
          console.log('[ServiceWorker] App shell cached successfully');
        } catch (error) {
          console.error('[ServiceWorker] Failed to cache app shell:', error);
          // Try to cache files individually to identify problematic ones
          for (const url of APP_SHELL_URLS) {
            try {
              await cache.add(url);
              console.log(`[ServiceWorker] Cached: ${url}`);
            } catch (err) {
              console.error(`[ServiceWorker] Failed to cache: ${url}`, err);
            }
          }
        }
        
        // Cache external resources
        try {
          for (const url of EXTERNAL_URLS) {
            try {
              await cache.add(url);
              console.log(`[ServiceWorker] Cached external: ${url}`);
            } catch (err) {
              console.warn(`[ServiceWorker] Failed to cache external: ${url}`, err);
              // Don't fail the entire installation for external resources
            }
          }
        } catch (error) {
          console.warn('[ServiceWorker] Some external resources failed to cache:', error);
        }
      })
      .catch(error => {
        console.error('[ServiceWorker] Failed to open cache:', error);
      })
  );
});

/**
 * Activate Event
 * This event is fired when the service worker becomes active.
 * It's the perfect place to clean up old, unused caches.
 */
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // If a cache's name is not our current CACHE_NAME, delete it.
            if (cacheName !== CACHE_NAME) {
              console.log('[ServiceWorker] Clearing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

/**
 * Fetch Event
 * This event intercepts every network request made by the page.
 * We'll use different strategies based on the request type.
 */
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // Skip API requests - they should always go to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For navigation requests (like loading the page), try network first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If we get a valid response, cache it
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache, or offline page
          return caches.match('/index.html') || 
                 caches.match('/') || 
                 caches.match('/offline.html');
        })
    );
    return;
  }

  // For Firebase SDK and external resources, use cache-first strategy
  if (url.hostname === 'www.gstatic.com' || 
      url.hostname === 'fonts.googleapis.com' || 
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          });
        })
        .catch(error => {
          console.warn('[ServiceWorker] Failed to fetch external resource:', event.request.url, error);
          return new Response('', { status: 404 });
        })
    );
    return;
  }

  // For app resources, use cache-first with network update
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // If we have a cached version, return it immediately
        if (cachedResponse) {
          // But also try to update the cache in the background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseToCache);
                });
              }
            })
            .catch(() => {
              // Ignore network errors for background updates
            });
          
          return cachedResponse;
        }

        // If not in cache, fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response for caching
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(error => {
                console.warn('[ServiceWorker] Failed to cache response:', error);
              });

            return networkResponse;
          })
          .catch(error => {
            console.error('[ServiceWorker] Fetch failed:', event.request.url, error);
            
            // For HTML requests, try to return the main page or offline page as fallback
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/index.html') || 
                     caches.match('/') || 
                     caches.match('/offline.html');
            }
            
            // For other requests, return a generic error response
            return new Response('Offline', { 
              status: 503, 
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

/**
 * Message Event
 * Handle messages from the main thread
 */
self.addEventListener('message', event => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

/**
 * Background Sync (if supported)
 */
self.addEventListener('sync', event => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Perform background sync operations here
      console.log('[ServiceWorker] Performing background sync')
    );
  }
});

/**
 * Push Event (for future push notifications)
 */
self.addEventListener('push', event => {
  console.log('[ServiceWorker] Push received:', event);
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/manifest-icon-192.png',
      badge: '/manifest-icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

/**
 * Notification Click Event
 */
self.addEventListener('notificationclick', event => {
  console.log('[ServiceWorker] Notification click received:', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});
