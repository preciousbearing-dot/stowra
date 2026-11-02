import { openRepository } from './storage/repository.js';
import { DEFAULT_PREFS, applyPrefs } from './ui/theme/theme.js';
import { syncNative } from './ui/theme/native-sync.js';
import { showSplash } from './ui/screens/splash.js';
import { showPlaceholder } from './ui/screens/placeholder.js';
import { createKeepService } from './core/keeps.js';
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

/** Boot order: open storage, apply the saved look, show the splash for that look, then route. */
async function boot() {
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
  const keeps = createKeepService(repo);
  const ai = createAi({ repo });
  const tools = { ai, native, repo };
  const pipeline = createPipeline({ keeps, extractors: EXTRACTORS, tools });
  const view = h('div', { id: 'view' });
  const leave = [];
  const ctx = { repo, keeps, pipeline, ai, native, persistent, router: null, errorText: userMessage, onLeave: (f) => leave.push(f) };
  const nav = createNav({ go: (p) => ctx.router.go(p), onAdd: () => openCapture(ctx) });
  root.append(view, nav.el);
  ctx.router = createRouter(view, buildRoutes(ctx), ({ tab, bare }) => {
    nav.el.style.display = bare ? 'none' : '';
    view.style.bottom = bare ? '0' : '68px';
    nav.set(tab);
  }, () => { while (leave.length) leave.pop()(); });
  window.__stowra = ctx;
  await ctx.router.start();
  await keeps.sweepBin();
  const intake = async () => {
    const got = await drainIntoKeeps({ native, keeps, pipeline });
    const fresh = got.filter((g) => !g.duplicate);
    if (got.length) toast(fresh.length ? `Stowed ${fresh.length} ${fresh.length === 1 ? 'Keep' : 'Keeps'}` : 'Already in your Trove', { action: 'Open', onAction: () => ctx.router.go(fresh.length === 1 ? `/keep/${fresh[0].id}` : '/trove') });
  };
  await intake();
  pipeline.resume();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { intake(); pipeline.resume(); } });
  window.addEventListener('online', () => pipeline.resume());
  if (!persistent) toast('Storage is unavailable here, so nothing will be saved.');
}

boot();
