/* 「一句箴言」Service Worker — 离线缓存 + 自动更新 */
const CACHE = 'yjzy-v18';
const ASSETS = [
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/export-docx.js',
  'js/backup.js',
  'js/sync-gist.js',
  'manifest.json',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
];

/* 代码类资源（页面/样式/脚本）：网络优先，保证更新即时生效；离线回退缓存 */
const FRESH = /\.(html|css|js)(\?|$)|\/$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const fresh = FRESH.test(url.pathname);

  e.respondWith(
    (fresh
      ? fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        }).catch(() => caches.match(e.request))
      : caches.match(e.request).then((hit) =>
          hit || fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
            return res;
          }).catch(() => hit)
        )
    ).then((res) => res || caches.match('index.html'))
  );
});
