import { h, fill } from '../kit/dom.js';
import { aiSetup } from '../screens/ai-setup.js';
import { lookPicker } from '../screens/look.js';
import { createAi } from '../../ai/engine.js';
import { icon } from '../kit/icons.js';
import { mountTour } from './tour.js';
import { pushBack, requestExit } from '../../platform/back.js';

/** First run: tour, AI key setup, look picker. Everything but the look can be skipped. Back goes to the step before. @param {{root: HTMLElement, repo: any, prefs: any, start: () => void}} o */
export async function runOnboarding({ root, repo, prefs, start }) {
  root.replaceChildren();
  const ai = createAi({ repo, keeps: null }); await ai.init();
  const el = h('main', { 'aria-live': 'polite' }); root.append(el);
  const finish = async () => { off(); await repo.prefs.write('prefs', { ...prefs, onboarded: true }); prefs.onboarded = true; start(); };
  let step = 'tour'; let tour = null;
  // One back layer for the whole first run: the tour moves between slides, setup steps move to the step before, the first slide offers to leave.
  const layer = () => {
    if (!el.isConnected) return false;
    if (step === 'tour') { if (tour && tour.back()) return true; requestExit(); return true; }
    if (step === 'look') { aiStep(); return true; }
    if (step === 'ai') { tourStep(3); return true; }
    return false;
  };
  layer.keepHint = true;
  const off = pushBack(layer);
  const backBtn = (to) => h('button', { class: 'btn ghost', 'aria-label': 'Previous step', style: { width: '56px', padding: '0', display: 'grid', placeItems: 'center', flex: 'none' }, onClick: to }, icon('back', 24));

  function tourStep(at = 0) { step = 'tour'; tour = mountTour(el, { start: at, onFinish: () => aiStep(), onSkip: () => aiStep() }); }

  function aiStep() {
    step = 'ai'; el.className = 'screen ob';
    const body = h('div', { class: 'ob-scroll' }, h('h1', { class: 'ob-title', text: 'Connect Kiko' }), aiSetup({ ai }, { onChange: () => draw() }));
    const next = h('button', { class: 'btn', style: { flex: '1' }, onClick: () => lookStep() });
    const draw = () => { next.textContent = ai.ready() ? 'Continue' : 'Skip for now'; next.classList.toggle('ghost', !ai.ready()); };
    draw();
    fill(el, body, h('div', { class: 'ob-foot' }, h('div', { style: { display: 'flex', gap: '12px' } }, backBtn(() => tourStep(3)), next), h('p', { class: 'hint', style: { textAlign: 'center' }, text: 'You can add or change this later in You, then AI connection.' })));
  }

  function lookStep() {
    step = 'look'; el.className = 'screen ob';
    fill(el, h('div', { class: 'ob-scroll' }, h('h1', { class: 'ob-title', text: 'Pick your look' }), h('p', { class: 'ob-body', style: { marginTop: '4px' }, text: 'You can change this any time in You, then Appearance.' }), lookPicker({ repo, prefs })),
      h('div', { class: 'ob-foot' }, h('div', { style: { display: 'flex', gap: '12px' } }, backBtn(() => aiStep()), h('button', { class: 'btn', style: { flex: '1' }, text: 'Open my Trove', onClick: finish }))));
  }
  tourStep(0);
}

/** Show the four tour slides again over the running app (Settings, Replay the welcome tour). @param {HTMLElement} root */
export function replayTour(root) {
  const el = h('div', {}); root.append(el);
  let off = () => {};
  const close = () => { off(); if (t) t.destroy(); el.remove(); };
  const t = mountTour(el, { replay: true, onFinish: close, onSkip: close });
  const layer = () => { if (!el.isConnected) return false; if (t.back()) return true; close(); return true; };
  off = pushBack(layer);
  return { close };
}
