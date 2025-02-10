const CACHE_NAME = 'hebrew-cache-v1';
const FILES_TO_CACHE = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  // Include icons and any other assets you want to cache:
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline page');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Activate');
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  // Serve cached content when offline.
  evt.respondWith(
    caches.match(evt.request).then((response) => {
      return response || fetch(evt.request);
    })
  );
});
