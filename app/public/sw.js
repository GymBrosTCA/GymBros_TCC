const CACHE_NAME = 'gymbros-v2';
const STATIC_ASSETS = [
  '/offline.html',
  '/css/header.css',
  '/css/footer.css',
  '/css/area-aluno.css',
  '/css/pwa.css',
  '/js/area-aluno.js',
  '/js/translate.js',
  '/images/logo.png',
  '/images/favicon.ico',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  if (url.includes('/api/') || url.includes('/ai/')) return;

  // Requisições de navegação (HTML): network-first, fallback para offline.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Assets estáticos: network-first, atualiza cache, fallback para cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
