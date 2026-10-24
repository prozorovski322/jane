// Service worker of the website. Generated into dist/sw.js by scripts/web-offline.mjs, which
// fills in the version and the file lists.
//
// - The site itself (page, script, database engine, fonts, sounds, icons) is stored on install:
//   after the first visit the site opens without a connection.
// - Course units are stored as they are opened, in a cache of their own that survives site
//   updates (unit files carry a content hash, so an unchanged unit is not downloaded again).
//   The page can ask for the whole course at once ("cache-units" message, from the settings).
const VERSION = '__VERSION__';
const SHELL_CACHE = `jane-${VERSION}`;
const UNITS_CACHE = 'jane-units';
/* global __SHELL__, __UNITS__ */
const SHELL = __SHELL__;
const UNITS = __UNITS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('jane-') && k !== SHELL_CACHE && k !== UNITS_CACHE)
          .map((k) => caches.delete(k)),
      );
      // Units of earlier versions that this version no longer has.
      const current = new Set(UNITS);
      const units = await caches.open(UNITS_CACHE);
      for (const req of await units.keys())
        if (!current.has(new URL(req.url).pathname)) await units.delete(req);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages: the network first, so a new version shows up at once; the stored page offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(
          url.pathname === '/' || url.pathname === '/index.html' ? '/index.html' : '/app.html',
        ),
      ),
    );
    return;
  }

  // Units: the stored copy, or download and keep it.
  if (url.pathname.startsWith('/content/units/')) {
    event.respondWith(
      caches.open(UNITS_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && (res.headers.get('content-type') ?? '').includes('json'))
          await cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Everything else has a content hash in its name and never changes: the stored copy first.
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});

// The page asks to store the whole course for offline use; progress is reported back.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-units' || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil(
    (async () => {
      const cache = await caches.open(UNITS_CACHE);
      let done = 0;
      let failed = 0;
      for (const path of UNITS) {
        try {
          if (!(await cache.match(path))) await cache.add(path);
        } catch {
          failed++;
        }
        done++;
        port.postMessage({ done, total: UNITS.length, failed });
      }
      port.postMessage({ done, total: UNITS.length, failed, finished: true });
    })(),
  );
});
