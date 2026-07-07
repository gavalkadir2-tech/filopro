// FiloPro Service Worker
// index.html ile AYNI KLASÖRE konulmalıdır. https:// (veya localhost) üzerinden
// sunulmayan (file:// ile doğrudan açılan) kopyalarda tarayıcılar service worker'a
// izin vermez; bu normaldir, uygulama yine de localStorage ile çalışmaya devam eder.

const CACHE_NAME = 'filopro-cache-v1';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Sayfa navigasyonları: önce ağı dene (güncel sürüm), çevrimdışıysa önbelleğe düş.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Diğer her şey (CDN script/stil dosyaları vb.): önbellekten hızlı yanıt ver,
  // arka planda güncel sürümü indirip önbelleği tazele (stale-while-revalidate).
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
