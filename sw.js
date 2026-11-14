// Diario de Hierro — service worker
// Sube el número de VERSION cada vez que cambies algún archivo de la app:
// así el móvil detecta la versión nueva y muestra el botón "Actualizar".
const VERSION = 'v5';
const CACHE = 'diario-hierro-' + VERSION;
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './fonts/barlow-latin-400-normal.woff2',
  './fonts/barlow-latin-600-normal.woff2',
  './fonts/barlow-latin-700-normal.woff2',
  './fonts/big-shoulders-display-latin-800-normal.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('diario-hierro-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// Primero la caché (funciona sin internet); si no está, red.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).catch(() =>
      e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()
    ))
  );
});
