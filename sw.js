// ════════════════════════════════════════════════════════
//  SERVICE WORKER — MDS Maintenance Préventive
//  Cache offline : ressources CDN + page principale
// ════════════════════════════════════════════════════════
const CACHE_NAME = 'mds-maintenance-v1';

const URLS_TO_CACHE = [
    './',
    './index.html',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js',
];

// Installation : mise en cache des ressources essentielles
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // On tente de cacher chaque URL individuellement pour éviter l'échec global
            return Promise.allSettled(
                URLS_TO_CACHE.map(url => cache.add(url).catch(() => null))
            );
        })
    );
    self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Interception des requêtes : Cache First, puis réseau
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // On met en cache uniquement les réponses valides
                if (response && response.status === 200 && response.type !== 'opaque') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Fallback silencieux si hors ligne et non mis en cache
                return new Response('Hors ligne — ressource non disponible', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            });
        })
    );
});