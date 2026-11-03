import { native } from './native.js';

/**
 * The back button, in layers. The newest layer gets first go: a sheet, a tour step, the lock screen.
 * If no layer wants it, the router goes back. At the Trove (the last screen) a 3 second countdown starts, and a second press inside it leaves the app.
 */
const layers = [];
let router = null;
let exitAt = 0; let hint = null; let timer = 0; let exiting = false;
const WINDOW_MS = 3000;

/** Register a layer. It returns true when it dealt with the press. Returns a function that removes it. @param {() => boolean} fn */
export function pushBack(fn) {
  layers.push(fn);
  return () => { const i = layers.lastIndexOf(fn); if (i >= 0) layers.splice(i, 1); };
}

/** The router joins once the app has started. @param {{back: () => boolean}|null} r */
export function setRouter(r) { router = r; }

function clearHint() { clearTimeout(timer); if (hint) { hint.remove(); hint = null; } exitAt = 0; }

function showHint() {
  clearHint();
  const root = document.getElementById('app'); if (!root) return;
  hint = document.createElement('div');
  hint.className = 'exit-hint'; hint.setAttribute('role', 'status');
  const t = document.createElement('span'); t.textContent = 'Press back again to leave Stowra';
  const bar = document.createElement('i');
  hint.append(t, bar); root.appendChild(hint);
  requestAnimationFrame(() => hint && hint.classList.add('on'));
  exitAt = Date.now();
  timer = setTimeout(clearHint, WINDOW_MS);
}

/** Leave the app. Everything is saved as it happens, and reading that was still running starts again on the next open. */
export async function leaveApp() {
  exiting = true; clearHint();
  await new Promise((r) => setTimeout(r, 60));
  await native.exitApp();
  exiting = false;
}

/** The leave-the-app step on its own: first press shows the countdown, a second one inside it leaves. Screens that sit on top of everything (splash, lock) use this. @returns {'hint'|'exit'} */
export function requestExit() {
  if (exitAt && Date.now() - exitAt < WINDOW_MS) { leaveApp(); return 'exit'; }
  showHint();
  return 'hint';
}

/** Handle one back press. Returns what happened, for tests. @returns {'layer'|'screen'|'hint'|'exit'|'busy'} */
export function handleBack() {
  if (exiting) return 'busy';
  for (let i = layers.length - 1; i >= 0; i--) { const fn = layers[i]; if (fn()) { if (!fn.keepHint) clearHint(); return 'layer'; } }
  if (router && router.back()) { clearHint(); return 'screen'; }
  return requestExit();
}

/** Start listening. Safe to call once at boot. */
export function initBack() {
  native.onBack(() => handleBack());
  window.__stowraBack = handleBack;
}
