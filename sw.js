// FiloPro Service Worker
// İki görevi var:
//   1) Basit offline destek — uygulama kabuğunu (index.html) önbelleğe alır, ağ yoksa
//      önbellekten sunar. Bu bir "offline-first" tam senkron çözümü DEĞİLDİR; sadece
//      internet kesildiğinde uygulamanın beyaz ekran vermeden açılmasını sağlar. Veri
//      okuma/yazma zaten tarayıcının kendi localStorage'ında olduğu için bu ayrıca çalışır.
//   2) Push bildirimleri — sunucudan gelen bir push mesajını, sekme kapalı olsa bile
//      işletim sisteminin bildirim merkezinde gösterir.

const CACHE_ADI = 'filopro-v2'; // v1 -> v2: app.js artık ayrı derlenmiş bir dosya (bkz. README)
const ONBELLEGE_ALINACAKLAR = ['./', './index.html', './app.js'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_ADI).then((cache) => cache.addAll(ONBELLEGE_ALINACAKLAR).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((isimler) =>
      Promise.all(isimler.filter((n) => n !== CACHE_ADI).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Ağ önce (network-first): bağlantı varsa her zaman güncel index.html'i getirir;
// bağlantı yoksa (offline) önbellekteki son bilinen sürümü gösterir.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const kopya = res.clone();
        caches.open(CACHE_ADI).then((cache) => cache.put(event.request, kopya)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('./index.html')))
  );
});

// ── Push Bildirimleri ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let veri = { title: 'FiloPro', body: 'Yeni bir bildiriminiz var.' };
  try {
    if (event.data) veri = { ...veri, ...event.data.json() };
  } catch {
    if (event.data) veri.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(veri.title || 'FiloPro', {
      body: veri.body || '',
      icon: veri.icon || undefined,
      badge: veri.badge || undefined,
      data: { url: veri.url || './' },
      tag: veri.tag || 'filopro-bildirim',
    })
  );
});

// Bildirime tıklanınca uygulamayı (açık bir sekme varsa onu) öne getirir, yoksa yeni açar.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hedefUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(hedefUrl);
    })
  );
});
