/* Offline shell. Every app file must be listed in SHELL (tests check this). Bump CACHE when the list changes. */
const CACHE = 'stowra-shell-3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/fonts/Manrope-Variable.ttf', 'assets/fonts/Newsreader-Variable.ttf',
  'src/main.js', 'version.js', 'src/platform/updater.js',
  'src/core/errors.js', 'src/core/events.js', 'src/core/ids.js', 'src/core/models.js', 'src/core/processing.js',
  'src/storage/idb-adapter.js', 'src/storage/memory-adapter.js', 'src/storage/migrations.js', 'src/storage/repository.js',
  'src/ui/theme/base.css', 'src/ui/theme/splash.css', 'src/ui/theme/theme.js', 'src/ui/theme/tokens.js',
  'src/ui/screens/placeholder.js', 'src/ui/screens/splash.js',
  'src/platform/native.js', 'src/ui/theme/native-sync.js', 'src/ui/theme/shell.css', 'src/capture/classify.js', 'src/capture/why.js', 'src/capture/images.js', 'src/capture/intake.js', 'src/core/keeps.js', 'src/retrieval/search.js', 'src/extract/pipeline.js', 'src/extract/registry.js', 'src/extract/note.js', 'src/ai/engine.js', 'src/ai/providers.js', 'src/ai/json.js', 'src/ui/kit/rich.js', 'src/ui/screens/ai-setup.js', 'src/ui/routes.js', 'src/ui/kit/dom.js', 'src/ui/kit/icons.js', 'src/ui/kit/overlay.js', 'src/ui/kit/router.js', 'src/ui/kit/cards.js', 'src/ui/kit/nav.js', 'src/ui/screens/trove.js', 'src/ui/screens/search.js', 'src/ui/screens/keep.js', 'src/ui/screens/capture.js', 'src/ui/screens/collections.js', 'src/ui/screens/settings.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
