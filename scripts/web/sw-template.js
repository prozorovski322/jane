// Service worker of the website. Generated into dist/sw.js by scripts/web-offline.mjs, which
// fills in the version and the list of files to keep. It stores the whole site, units included,
// so the course opens and works without a connection once it has been visited.
const VERSION = '__VERSION__';
const CACHE = `jane-${VERSION}`;
/* global __PRECACHE__ */
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('jane-') && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Pages: the network first, so a new version shows up at once; the stored page offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  // Everything else has a content hash in its name and never changes: the stored copy first.
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});
