/* 「一句箴言」Service Worker — 离线缓存 + 即时更新（v21） */
const CACHE = 'yjzy-v21';
const ASSETS = [
  'index.html',
  'css/styles.css?v=21',
  'js/store.js?v=21',
  'js/export-docx.js?v=21',
  'js/backup.js?v=21',
  'js/sync-gist.js?v=21',
  'js/app.js?v=21',
  'manifest.json',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
];

/* 代码类资源（html/css/js）：网络优先 + 强制跳过浏览器 HTTP 缓存，保证更新即时生效 */
const FRESH = /\.(html|css|js)(\?|$)|\/$/;

function putCache(req, res) {
  if (!res || res.status !== 200 || res.type !== 'basic') return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
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
      ? fetch(e.request, { cache: 'no-cache' }).then((res) => {
          putCache(e.request, res);
          return res;
        }).catch(() => caches.match(e.request))
      : caches.match(e.request).then((hit) =>
          hit || fetch(e.request).then((res) => {
            putCache(e.request, res);
            return res;
          }).catch(() => hit)
        )
    ).then((res) => res || caches.match('index.html'))
  );
});
