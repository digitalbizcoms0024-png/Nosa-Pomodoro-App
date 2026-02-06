const CACHE_NAME = 'pomodoro-v34';
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
  const url = new URL(e.request.url);

  // Never cache YouTube/Google Video domains
  if (url.hostname.includes('youtube.com') ||
      url.hostname.includes('youtube-nocookie.com') ||
      url.hostname.includes('googlevideo.com') ||
      url.hostname.includes('ytimg.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
