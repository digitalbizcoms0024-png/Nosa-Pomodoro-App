const CACHE_NAME = 'pomodoro-v48';
const ASSETS = ['./', 'index.html', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Don't cache streaming audio URLs — they are continuous/infinite
  const streamingDomains = ['somafm.com'];

  if (streamingDomains.some(domain => url.includes(domain))) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
