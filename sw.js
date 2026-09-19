const CACHE_NAME = 'kizen-app-v7';
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
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First with Cache Fallback strategy:
// Ensures phones and browsers ALWAYS load the latest updates instantly when connected to internet,
// while gracefully falling back to cached assets when completely offline.
self.addEventListener('fetch', (event) => {
  // CouchDB sync endpoint requests pass through directly
  if (event.request.url.includes(':5984') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback: load from Cache Storage
        return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
          return cachedResponse || caches.match('./index.html');
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
