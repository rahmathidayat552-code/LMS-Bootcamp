const CACHE_NAME = 'lms-smkn9-v2'; // Updated cache version
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Delete old caches
          }
        })
      );
    }).then(() => self.clients.claim()) // Claim clients immediately
  );
});

self.addEventListener('fetch', (event) => {
  // Network First strategy for navigation requests (like index.html)
  if (event.request.mode === 'navigate' || event.request.url.includes('/index.html')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Network First strategy for other assets to prevent stale cache issues
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // Only cache GET requests and avoid caching Firebase Storage or Firestore requests
      if (
        event.request.method !== 'GET' || 
        event.request.url.includes('firebasestorage.googleapis.com') ||
        event.request.url.includes('firestore.googleapis.com')
      ) {
        return networkResponse;
      }
      
      // Cache the new response for future offline use
      // Only cache valid responses
      if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache).catch(err => console.warn('Cache put error:', err));
        });
      }
      return networkResponse;
    }).catch((error) => {
      console.warn('Fetch failed, falling back to cache:', error);
      // Fallback to cache if network fails
      return caches.match(event.request);
    })
  );
});
