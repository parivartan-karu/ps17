// Parivartan PWA Service Worker v3
const CACHE_NAME = 'parivartan-v3';
const STATIC_ASSETS = [
  '/',
  '/citizen/dashboard',
  '/citizen/my-complaints',
  '/citizen/notifications',
  '/smc/dashboard',
  '/worker/dashboard',
  '/worker/task',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('firestore.googleapis.com') || url.includes('firebase') ||
      url.includes('googleapis.com') || url.includes('identitytoolkit') ||
      url.includes('securetoken') || url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) =>
          cached ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        )
      )
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'Parivartan', body: event.data ? event.data.text() : 'New update.' }; }
  const title = data.title || 'Parivartan';
  const body  = data.body  || 'You have a new update.';
  const url   = data.url   || '/citizen/notifications';
  const tag   = data.tag   || 'parivartan';
  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-96x96.png',
      tag, data: { url }, vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/citizen/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
