// MDS Maintenance SW v5 — Network First pour index.html
const CACHE = 'mds-v8';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  // Network first pour HTML — toujours la version fraîche
  if (url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(function(r) {
        var clone = r.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return r;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }
  // Cache first pour CDN (Tailwind, Cropper)
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(r) {
        if (r && r.status === 200) {
          var clone = r.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        }
        return r;
      }).catch(function() {
        return new Response('Hors ligne', {status:503});
      });
    })
  );
});