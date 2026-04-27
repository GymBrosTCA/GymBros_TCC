const CACHE_NAME = 'gymbros-v3';
const STATIC_ASSETS = [
  '/offline.html',
  '/',
  '/login',
  '/planos',
  '/about',
  '/css/header.css',
  '/css/footer.css',
  '/css/area-aluno.css',
  '/css/style.css',
  '/css/planos.css',
  '/css/pwa.css',
  '/js/area-aluno.js',
  '/js/header.js',
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
  if (event.request.url.includes('/api/') || event.request.url.includes('/ai/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        })
      )
  );
});
