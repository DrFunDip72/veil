/* Veil service worker.
 * Shell is cache-first so the app opens instantly from the home screen.
 * Photos go in a separate, capped cache — they are the bulk of the bytes and
 * should never be able to evict the shell.
 */
const VERSION = 'veil-v1';
const SHELL = VERSION + '-shell';
const PHOTOS = VERSION + '-photos';
const PHOTO_LIMIT = 150;

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './engine.js',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== PHOTOS).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map(k => cache.delete(k)));
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Photos (cross-origin placeholders today, a real CDN later). */
  if (/picsum\.photos|images\.unsplash\.com/.test(url.hostname)) {
    ev.respondWith((async () => {
      const cache = await caches.open(PHOTOS);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) {
          cache.put(req, res.clone());
          trimCache(PHOTOS, PHOTO_LIMIT);
        }
        return res;
      } catch (err) {
        /* Offline with no cached copy — let the <img> fall back to its
         * background colour rather than showing a broken-image icon. */
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  /* Fonts: cache opportunistically, never block on them. */
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    ev.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy));
        return res;
      }).catch(() => new Response('', { status: 504 })))
    );
    return;
  }

  /* Same-origin shell: cache first, refresh in the background. */
  if (url.origin === self.location.origin) {
    ev.respondWith((async () => {
      const hit = await caches.match(req);
      const net = fetch(req).then(res => {
        if (res && res.ok) caches.open(SHELL).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => null);
      return hit || (await net) || caches.match('./index.html');
    })());
  }
});
