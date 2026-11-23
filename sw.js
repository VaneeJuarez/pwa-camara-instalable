/* Service Worker - Estrategia Cache First */
const NOMBRE_CACHE = 'inspeccion-pwa-v2';

const RECURSOS_PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación: precachear el App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(NOMBRE_CACHE)
      .then((cache) => cache.addAll(RECURSOS_PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activación: eliminar cachés de versiones anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Cache First, con respaldo a red
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((respuestaCache) => {
        if (respuestaCache) {
          return respuestaCache;
        }
        return fetch(event.request)
          .then((respuestaRed) => {
            if (respuestaRed && respuestaRed.ok && event.request.url.startsWith(self.location.origin)) {
              const copia = respuestaRed.clone();
              caches.open(NOMBRE_CACHE).then((cache) => cache.put(event.request, copia));
            }
            return respuestaRed;
          });
      })
      .catch(() => caches.match('./index.html'))
  );
});
