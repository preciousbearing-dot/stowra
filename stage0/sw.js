// Minimal service worker so the test page is installable and can receive shared links.
// v2: answers every request from the network (an empty handler can leave Chrome's install in a half state).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
});
