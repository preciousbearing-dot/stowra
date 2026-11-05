import { createSmart } from './core/vectors.js';
import { openRepository } from './storage/repository.js';
import { DEFAULT_PREFS, applyPrefs } from './ui/theme/theme.js';
import { syncNative } from './ui/theme/native-sync.js';
import { showSplash } from './ui/screens/splash.js';
import { showPlaceholder } from './ui/screens/placeholder.js';
import { createKeepService } from './core/keeps.js';
import { createCreationService } from './core/creations.js';
import { createPipeline } from './extract/pipeline.js';
import { EXTRACTORS } from './extract/registry.js';
import { drainIntoKeeps } from './capture/intake.js';
import { createAi } from './ai/engine.js';
import { createRouter } from './ui/kit/router.js';
import { createNav } from './ui/kit/nav.js';
import { h } from './ui/kit/dom.js';
import { toast } from './ui/kit/overlay.js';
import { userMessage } from './core/errors.js';
import { native } from './platform/native.js';
import { openCapture } from './ui/screens/capture.js';
import { buildRoutes } from './ui/routes.js';
import { createLock } from './core/lock.js';
import { showLock } from './ui/screens/lock.js';
import { runUpdateCheck } from './ui/screens/about.js';
import { initBack, setRouter } from './platform/back.js';

/** Boot order: open storage, apply the saved look, show the splash for that look, then route. */
async function boot() {
  initBack();
  const root = document.getElementById('app');
  const { repo, persistent } = await openRepository();
  const prefs = { ...DEFAULT_PREFS, ...(await repo.prefs.read('prefs', {})) };
  const applied = applyPrefs(document, window, prefs);
  syncNative(applied.tokens);
  await showSplash(root, { quick: prefs.onboarded });
  if (!prefs.onboarded) {
    const { runOnboarding } = await import('./ui/onboarding/flow.js').catch(() => ({ runOnboarding: null }));
    if (runOnboarding) return runOnboarding({ root, repo, prefs, start: () => startApp(root, repo, persistent) });
    showPlaceholder(root, { title: 'Welcome to Stowra', body: 'Your private vault for everything you find online.', button: 'Continue', onButton: async () => { await repo.prefs.write('prefs', { ...prefs, onboarded: true }); location.reload(); } });
    return;
  }
  startApp(root, repo, persistent);
}

export async function startApp(root, repo, persistent) {
  root.replaceChildren();
  if (native.files) repo.files.useNative(native.files);
  const keeps = createKeepService(repo);
  const ai = createAi({ repo, keeps });
  await ai.init();
  const tools = { ai, native, repo };
  const pipeline = createPipeline({ keeps, extractors: EXTRACTORS, tools });
  const view = h('div', { id: 'view' });
  const leave = [];
  const lock = await createLock(repo).load();
  const creations = createCreationService(repo);
  const smart = createSmart({ repo, keeps, ai }); await smart.load();
  const ctx = { repo, keeps, creations, lock, pipeline, ai, smart, native, persistent, router: null, errorText: userMessage, onLeave: (f) => leave.push(f) };
  window.__stowra = ctx;
  const nav = createNav({ go: (p) => ctx.router.go(p), onAdd: () => openCapture(ctx) });
  root.append(view, nav.el);
  if (lock.enabled) await showLock(root, lock);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hiddenAt = Date.now(); else if (lock.enabled && hiddenAt && Date.now() - hiddenAt > lock.graceSeconds * 1000 && !root.querySelector('.lockscreen')) showLock(root, lock); });
  ctx.router = createRouter(view, buildRoutes(ctx), ({ tab, bare }) => {
    nav.el.style.display = bare ? 'none' : '';
    view.style.setProperty('bottom', bare ? '0' : 'var(--navh)');
    nav.set(tab);
  }, () => { while (leave.length) leave.pop()(); });
  setRouter(ctx.router);
  await ctx.router.start();
  await keeps.sweepBin();
  const intake = async () => {
    const got = await drainIntoKeeps({ native, keeps, pipeline });
    const fresh = got.filter((g) => !g.duplicate);
    if (got.length) toast(fresh.length ? `Stowed ${fresh.length} ${fresh.length === 1 ? 'Keep' : 'Keeps'}` : 'Already in your Trove', { action: 'Open', onAction: () => ctx.router.go(fresh.length === 1 ? `/keep/${fresh[0].id}` : '/trove') });
  };
  await intake();
  pipeline.resume();
  // Older versions kept files in the database. Move them into the app folder quietly, a few at a time, once the app has settled.
  if (native.files) setTimeout(async () => { try { const moved = await repo.files.migrate(await repo.keeps.all()); if (moved) keeps.bus.emit('changed', { type: 'files-moved' }); } catch (e) { /* try again next start */ } }, 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { intake(); pipeline.resume(); } });
  window.addEventListener('online', () => pipeline.resume());
  // Once a day, quietly look for an update and mention it once.
  repo.prefs.read('lastUpdateCheck', { at: 0 }).then(async (c) => {
    if (Date.now() - c.at < 86400000 || !navigator.onLine) return;
    const r = await runUpdateCheck(ctx).catch(() => null);
    if (r && r.status === 'available') toast(`Stowra ${r.latest} is ready`, { action: 'See', onAction: () => ctx.router.go('/settings/about') });
  });
  if (!persistent) toast('Storage is unavailable here, so nothing will be saved.');
}

boot();
