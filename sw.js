// MDS Maintenance SW v5 — Network First pour index.html
const CACHE = 'mds-v33';

// Liste blanche des fichiers à mettre en cache
const CDN_CACHE = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  var method = e.request.method;

  // Ne cacher que les GET
  if (method !== 'GET') return;

  // ── Ignorer complètement les requêtes non-HTTP (chrome-extension, etc.)
  if (!url.startsWith('http')) return;

  // ── index.html et racine du site : Network First
  //    On essaie toujours le réseau, cache en fallback uniquement
  if (url.endsWith('/index.html') || url.endsWith('/') || url.endsWith('/preventive') || url.endsWith('/preventive/')) {
    e.respondWith(
      fetch(e.request, {cache: 'no-cache'})
        .then(function(r) {
          // Ne mettre en cache QUE si la réponse est bien du HTML
          var ct = r.headers.get('content-type') || '';
          if (r.status === 200 && ct.indexOf('html') !== -1) {
            var clone = r.clone();
            caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
          }
          return r;
        })
        .catch(function() {
          return caches.match(e.request);
        })
    );
    return;
  }

  // ── sw.js lui-même : toujours réseau, jamais en cache
  if (url.endsWith('sw.js')) {
    return; // Laisser le navigateur gérer normalement
  }

  // ── CDN (Tailwind, Cropper) : Cache First
  var isCDN = CDN_CACHE.some(function(cdn){ return url.startsWith(cdn); });
  if (isCDN) {
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
          return new Response('Hors ligne', {status: 503});
        });
      })
    );
    return;
  }

  // ── Tout le reste : réseau simple, pas de cache
});