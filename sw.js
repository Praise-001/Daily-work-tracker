// Bump version to force clients to pull the latest bundle.
var CACHE = 'wj-v10-20260319';
var FILES = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(FILES); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Allow page to trigger an immediate activate of the updated worker.
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    fetch(e.request).then(function(res) {
      return caches.open(CACHE).then(function(c) {
        c.put(e.request, res.clone());
        return res;
      });
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
