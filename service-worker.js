// service-worker.js

const CACHE_NAME = 'dospill-cache-v3';
// Add all essential files for the app shell to be cached
const urlsToCache = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/js/app.js',
  // Updated to cache the placeholder icon URLs
  'https://placehold.co/192x192/5856d6/FFFFFF?text=DS',
  'https://placehold.co/512x512/5856d6/FFFFFF?text=DS',
  'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap',
  'https://fonts.gstatic.com/s/lexend/v17/wlptgwvFAVcsY-ixp-w.woff2' // Caching the font file itself
];

// Install a service worker
self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll with a new Request object for cross-origin URLs
        const cachePromises = urlsToCache.map(urlToCache => {
            const request = new Request(urlToCache, {mode: 'no-cors'});
            return cache.add(request);
        });
        return Promise.all(cachePromises);
      })
      .catch(err => {
        console.error('Failed to open cache: ', err);
      })
  );
});

// Cache and return requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a one-time use stream.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200) {
              return response;
            }

            // Clone the response because it's also a one-time use stream.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Update a service worker and remove old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
