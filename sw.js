// MDS Maintenance — Service Worker v34 : fonctionnement 100 % hors ligne
// Toutes les ressources sont hébergées avec l'application (plus aucun CDN externe).
const CACHE = 'mds-v34';

// Tout ce qu'il faut pour démarrer l'application sans réseau
const PRECACHE = [
  './',
  './index.html',
  './tailwind.css',
  './cropper.min.css',
  './cropper.min.js',
  './zxing.min.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './basepn-partagee.json'
];

// Fichiers qui changent rarement : on sert le cache d'abord (renouvelé à chaque changement de version CACHE)
const STATIQUES = ['cropper.min.js', 'cropper.min.css', 'zxing.min.js', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];

// Délai d'attente réseau avant de se rabattre sur le cache (réseau mobile faible)
const DELAI_RESEAU_MS = 3000;

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // Chaque fichier est ajouté séparément : l'absence d'un fichier optionnel ne bloque pas l'installation
      return Promise.all(PRECACHE.map(function(u) {
        return c.add(new Request(u, {cache: 'reload'})).catch(function(){});
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
      .then(function() { return self.clients.matchAll(); })
      .then(function(clients) {
        clients.forEach(function(cl){ cl.postMessage({type: 'mds-offline-ready', version: CACHE}); });
      })
  );
});

// Réseau d'abord (contenu à jour), avec délai court puis repli sur le cache
function reseauPuisCache(req) {
  return new Promise(function(resolve) {
    var fini = false;
    function repli() {
      return caches.match(req, {ignoreSearch: true}).then(function(r) { return r || caches.match('./index.html'); });
    }
    var timer = setTimeout(function() {
      if (fini) return;
      repli().then(function(r) { if (r && !fini) { fini = true; resolve(r); } });
    }, DELAI_RESEAU_MS);
    fetch(req, {cache: 'no-cache'}).then(function(r) {
      if (fini) {
        // Le cache a déjà répondu : on met simplement à jour pour la prochaine fois
        if (r && r.status === 200) { var c0 = r.clone(); caches.open(CACHE).then(function(c){ c.put(req, c0); }); }
        return;
      }
      clearTimeout(timer); fini = true;
      if (r && r.status === 200) {
        var clone = r.clone();
        caches.open(CACHE).then(function(c){ c.put(req, clone); });
      }
      resolve(r);
    }).catch(function() {
      clearTimeout(timer);
      if (fini) return;
      repli().then(function(r) { fini = true; resolve(r || new Response('Hors ligne', {status: 503})); });
    });
  });
}

function cacheDabord(req) {
  return caches.match(req, {ignoreSearch: true}).then(function(cached) {
    if (cached) return cached;
    return fetch(req).then(function(r) {
      if (r && r.status === 200) { var clone = r.clone(); caches.open(CACHE).then(function(c){ c.put(req, clone); }); }
      return r;
    }).catch(function() { return new Response('Hors ligne', {status: 503}); });
  });
}

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Uniquement les fichiers de l'application ; GitHub API et autres sites passent directement par le réseau
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  var nom = url.pathname.split('/').pop();
  if (STATIQUES.indexOf(nom) !== -1) { e.respondWith(cacheDabord(req)); return; }
  e.respondWith(reseauPuisCache(req));
});
