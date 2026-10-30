const CACHE_NAME = 'weatherdash-v1.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/manifest.json',
  '/favicon.svg',
  '/js/app.js',
  '/js/weather.js',
  '/js/airquality.js',
  '/js/charts.js',
  '/js/lifestyle.js',
  '/js/pollen.js',
  '/js/radar.js',
  '/js/hail.js',
  '/js/canvasEffects.js'
];

// Installazione SW
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Attivazione e pulizia vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia di fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Non memorizzare in cache le chiamate API o websocket
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // Stale-while-revalidate per le risorse statiche
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Ritorna la risorsa in cache in caso di offline
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
