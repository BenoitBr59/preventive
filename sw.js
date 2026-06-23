// ════ SERVICE WORKER MDS v3 ════
// Changer CACHE_NAME force le rechargement complet
const CACHE_NAME = 'mds-maintenance-v3';

self.addEventListener('install', event => {
    self.skipWaiting(); // Force l'activation immédiate
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(['./index.html']).catch(() => {});
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim(); // Prend le contrôle immédiatement
});

// Network First pour index.html (toujours la version fraîche)
// Cache First pour les ressources CDN
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Pour index.html : réseau en priorité, cache en fallback
    if (url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }
    
    // Pour le reste (CDN) : cache en priorité
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return response;
            }).catch(() => new Response('Hors ligne', { status: 503 }));
        })
    );
});