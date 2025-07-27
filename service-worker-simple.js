// service-worker-simple.js - Simplified and more reliable service worker
console.log('[ServiceWorker] Simple service worker loaded');

const CACHE_NAME = 'dospill-simple-v1';
const ESSENTIAL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching essential files');
        return cache.addAll(ESSENTIAL_FILES);
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activation complete');
        return self.clients.claim();
      })
      .catch(error => {
        console.error('[ServiceWorker] Activation failed:', error);
      })
  );
});

// Fetch event - simple cache-first strategy for navigation, network-first for everything else
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API requests
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  // For navigation requests, try cache first, then network, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            console.log('[ServiceWorker] Serving from cache:', event.request.url);
            return response;
          }
          
          return fetch(event.request)
            .then(networkResponse => {
              // Cache successful responses
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseClone);
                });
              }
              return networkResponse;
            })
            .catch(() => {
              console.log('[ServiceWorker] Network failed, serving offline page');
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }
  
  // For other requests, try network first, then cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});

// Message event
self.addEventListener('message', event => {
  console.log('[ServiceWorker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[ServiceWorker] Simple service worker setup complete');