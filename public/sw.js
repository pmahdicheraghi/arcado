const CACHE_PREFIX = 'side-quest-';
const workerVersion = new URL(self.location.href).searchParams.get('v') || 'legacy';
const CACHE_NAME = `${CACHE_PREFIX}${workerVersion}`;
const APP_SHELL = [
  './',
  './manifest.webmanifest',
  './192x192.png',
  './512x512.png',
  './icon.svg',
  './fonts/Vazirmatn.ttf',
  './fonts/Pinar.ttf',
  './audio/side-quest.mp3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const shellResponse = await fetch('./', { cache: 'no-store' });
      await cache.put('./', shellResponse.clone());

      // Vite emits hashed JS and CSS filenames, so discover those URLs from
      // the production HTML instead of hard-coding names that change per build.
      const html = await shellResponse.text();
      const htmlAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((url) => !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//'));
      const urls = [...new Set([...APP_SHELL, ...htmlAssets])];
      await cache.addAll(urls);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
