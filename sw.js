const CACHE_NAME = 'kizen-app-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/daily.css',
  './css/goals.css',
  './css/projects.css',
  './css/stats.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/lib/pouchdb.min.js',
  './js/lib/confetti.browser.min.js',
  './js/app.js',
  './js/db.js',
  './js/gamification.js',
  './js/notifications.js',
  './js/store.js',
  './js/views/dailyView.js',
  './js/views/weeklyView.js',
  './js/views/monthlyView.js',
  './js/views/projectsView.js',
  './js/views/journalView.js',
  './js/views/statsView.js'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

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

// Cache-First strategy: Return cached files immediately so phone NEVER hangs when PC is off
self.addEventListener('fetch', (event) => {
  // CouchDB sync endpoint requests pass through directly
  if (event.request.url.includes(':5984') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Return instantly from cache
        // Silently try background update without blocking
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {
          // PC is offline; ignore silently
        });
        return cachedResponse;
      }

      // If not in cache, try network
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to cached index.html
        return caches.match('./index.html');
      });
    })
  );
});

// Notification click handler: focus open window or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          return client.focus();
        }
      }
      return clients.openWindow('./');
    })
  );
});
