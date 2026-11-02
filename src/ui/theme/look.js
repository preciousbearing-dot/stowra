import { applyPrefs } from './theme.js';
import { syncNative } from './native-sync.js';

/** Save the look, apply it everywhere, and tell Android so the bars and share sheet match. @param {any} repo @param {any} prefs */
export async function applyLook(repo, prefs) {
  await repo.prefs.write('prefs', prefs);
  const a = applyPrefs(document, window, prefs);
  syncNative(a.tokens);
  return a;
}
