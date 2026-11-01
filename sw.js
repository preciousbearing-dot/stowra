/* Offline shell. Every app file must be listed in SHELL (tests check this). Bump CACHE when the list changes. */
const CACHE = 'stowra-shell-1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/fonts/Manrope-Variable.ttf', 'assets/fonts/Newsreader-Variable.ttf',
  'src/main.js', 'version.js', 'src/platform/updater.js',
  'src/core/errors.js', 'src/core/events.js', 'src/core/ids.js', 'src/core/models.js', 'src/core/processing.js',
  'src/storage/idb-adapter.js', 'src/storage/memory-adapter.js', 'src/storage/migrations.js', 'src/storage/repository.js',
  'src/ui/theme/base.css', 'src/ui/theme/splash.css', 'src/ui/theme/theme.js', 'src/ui/theme/tokens.js',
  'src/ui/screens/placeholder.js', 'src/ui/screens/splash.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
