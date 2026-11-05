/* Offline shell. Every app file must be listed in SHELL (tests check this). Bump CACHE when the list changes. */
const CACHE = 'stowra-shell-12';
const SHELL = [
  'src/core/stats.js', 'src/core/vectors.js', 'src/retrieval/hybrid.js', 'src/ai/spaces.js', 'src/platform/back.js', 'src/ui/onboarding/tour.js', 'src/ui/onboarding/tour-art.js', 'src/ui/theme/tour.css', 'src/ui/screens/trove-charts.js', 'src/ui/screens/keep-extras.js', 'src/ai/study.js', 'src/extract/video.js', 'src/extract/voice.js', 'src/capture/voice.js', 'src/capture/voice-flow.js', 'src/ai/voice-clean.js', 'src/ui/screens/voice.js', 'src/ai/analyse.js',
  './', 'index.html', 'manifest.webmanifest',
  'assets/fonts/Manrope-Variable.ttf', 'assets/fonts/Newsreader-Variable.ttf',
  'src/main.js', 'version.js', 'src/platform/updater.js',
  'src/core/errors.js', 'src/core/events.js', 'src/core/ids.js', 'src/core/models.js', 'src/core/processing.js',
  'src/storage/idb-adapter.js', 'src/storage/memory-adapter.js', 'src/storage/migrations.js', 'src/storage/repository.js',
  'src/ui/theme/base.css', 'src/ui/theme/splash.css', 'src/ui/theme/theme.js', 'src/ui/theme/tokens.js',
  'src/ui/screens/placeholder.js', 'src/ui/screens/splash.js',
  'src/platform/native.js', 'src/ui/theme/native-sync.js', 'src/ui/theme/shell.css', 'src/capture/classify.js', 'src/capture/why.js', 'src/capture/images.js', 'src/capture/intake.js', 'src/core/keeps.js', 'src/retrieval/search.js', 'src/extract/pipeline.js', 'src/extract/registry.js', 'src/extract/note.js', 'src/extract/http.js', 'src/extract/article.js', 'src/extract/youtube.js', 'src/extract/github.js', 'src/extract/social.js', 'src/extract/pdf.js', 'src/extract/image.js', 'assets/vendor/pdf.min.js', 'assets/vendor/pdf.worker.min.js', 'src/kiko/chunker.js', 'src/kiko/retrieve.js', 'src/kiko/trust.js', 'src/kiko/kiko.js', 'src/core/creations.js', 'src/ui/screens/kiko.js', 'src/ui/screens/creations.js', 'src/core/discover.js', 'src/ui/screens/discover.js', 'src/ui/theme/look.js', 'src/ui/screens/look.js', 'src/ui/onboarding/flow.js', 'src/core/backup.js', 'src/core/lock.js', 'src/ui/screens/data.js', 'src/ui/screens/lock.js', 'src/ui/screens/about.js', 'src/ai/engine.js', 'src/ai/providers.js', 'src/ai/json.js', 'src/ui/kit/rich.js', 'src/ui/screens/ai-setup.js', 'src/ui/routes.js', 'src/ui/kit/dom.js', 'src/ui/kit/icons.js', 'src/ui/kit/overlay.js', 'src/ui/kit/router.js', 'src/ui/kit/cards.js', 'src/ui/kit/nav.js', 'src/ui/screens/trove.js', 'src/ui/screens/search.js', 'src/ui/screens/keep.js', 'src/ui/screens/capture.js', 'src/ui/screens/collections.js', 'src/ui/screens/settings.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
