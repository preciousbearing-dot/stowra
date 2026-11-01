import { openRepository } from './storage/repository.js';
import { DEFAULT_PREFS, applyPrefs } from './ui/theme/theme.js';
import { showSplash } from './ui/screens/splash.js';
import { showPlaceholder } from './ui/screens/placeholder.js';

/** Boot order: open storage, apply the saved look, show the splash for that look, then route. */
async function boot() {
  const root = document.getElementById('app');
  const { repo, persistent } = await openRepository();
  const prefs = { ...DEFAULT_PREFS, ...(await repo.prefs.read('prefs', {})) };
  applyPrefs(document, window, prefs);
  await showSplash(root, { quick: prefs.onboarded });
  if (!prefs.onboarded) {
    showPlaceholder(root, {
      title: 'Welcome to Stowra',
      body: 'The welcome tour, AI key setup and look picker arrive in the next stage. This is the foundation build.',
      button: 'Continue',
      onButton: async () => { await repo.prefs.write('prefs', { ...prefs, onboarded: true }); location.reload(); },
    });
  } else {
    showPlaceholder(root, { title: 'Trove', body: persistent ? 'Your library will live here.' : 'Storage is not available in this browser, so nothing will be saved.' });
  }
}

boot();
