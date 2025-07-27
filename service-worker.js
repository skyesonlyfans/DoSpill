// service-worker.js

// Incrementing the cache name is crucial for updates.
const CACHE_NAME = 'dospill-cache-v5';

// Essential local files that form the "app shell".
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/js/app.js',
  '/manifest.json'
];

/**
 * Install Event
 * This is triggered when the service worker is first registered.
 * We open a cache and add our essential app shell files to it.
 */
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(APP_SHELL_URLS);
      })
      .catch(error => {
        // This log is critical for debugging installation failures.
        console.error('[ServiceWorker] Failed to cache app shell:', error);
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
    })
  );
  // Force the newly activated service worker to take control of the page immediately.
  return self.clients.claim();
});

/**
 * Fetch Event
 * This event intercepts every network request made by the page.
 * We'll use a "cache-first, then network" strategy.
 */
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests (like loading the page), always try the network first
  // to ensure the user gets the latest version, but fall back to the cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // If the response is in the cache, return it.
        if (cachedResponse) {
          return cachedResponse;
        }

        // If it's not in the cache, fetch it from the network.
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response.
            // We don't cache opaque responses (type: 'opaque') which result from 'no-cors' requests.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            console.error('[ServiceWorker] Fetch failed; returning offline page instead.', error);
            // Optionally, you could return a fallback offline page here:
            // return caches.match('/offline.html');
        });
      })
  );
});
