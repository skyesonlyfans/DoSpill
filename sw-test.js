// sw-test.js - Minimal service worker for testing
console.log('[TestSW] Script loaded');

const CACHE_NAME = 'dospill-test-v1';

self.addEventListener('install', event => {
  console.log('[TestSW] Install event');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[TestSW] Activate event');
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  console.log('[TestSW] Fetch event for:', event.request.url);
  // Just pass through all requests for now
});

console.log('[TestSW] All event listeners registered');