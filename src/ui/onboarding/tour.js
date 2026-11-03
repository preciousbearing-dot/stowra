import { h } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { ART, COPY, BRAND } from './tour-art.js';

/**
 * The welcome tour: four animated slides from the design canvas, with Back and Skip.
 * @param {HTMLElement} el container (becomes the tour screen)
 * @param {{start?: number, replay?: boolean, onFinish: () => void, onSkip: () => void}} o
 * @returns {{back: () => boolean, step: () => number, destroy: () => void}} back() returns true when it moved to the previous slide
 */
export function mountTour(el, o) {
  let i = Math.min(Math.max(o.start || 0, 0), COPY.length - 1);
  let ro = null;
  el.className = 'tr' + (o.replay ? ' replay' : '');

  function fit(wrap, stage) {
    const k = Math.min(1, Math.max(0.5, (wrap.clientHeight - 4) / 400));
    stage.style.setProperty('--k', String(k));
  }

  function show() {
    const c = COPY[i];
    const last = i === COPY.length - 1;
    const stage = h('div', { class: 'tr-stage fade', 'aria-hidden': 'true' });
    stage.innerHTML = ART[i]; // fixed artwork, no user data (see tour-art.js)
    const wrap = h('div', { class: 'tr-artwrap' }, stage);
    const brand = h('div', { class: 'tr-brand' }); brand.innerHTML = BRAND; // fixed markup
    el.replaceChildren(
      h('div', { class: 'tr-top' }, brand, h('button', { class: 'tr-skip' + (last ? ' off' : ''), text: 'Skip', tabindex: last ? '-1' : '0', onClick: () => o.onSkip() })),
      wrap,
      h('div', { class: 'tr-copy', 'aria-live': 'polite' }, h('h1', { class: 'tr-title', text: c.title }), h('p', { class: 'tr-body', text: c.body })),
      h('div', { class: 'tr-foot' },
        h('div', { class: 'tr-dots', 'aria-label': `Step ${i + 1} of ${COPY.length}` }, COPY.map((_, j) => h('span', { class: j === i ? 'on' : '' }))),
        h('div', { class: 'tr-actions' },
          i > 0 ? h('button', { class: 'btn tr-back', 'aria-label': 'Previous', onClick: () => back() }, icon('back', 24)) : null,
          h('button', { class: 'btn', text: last && o.replay ? 'Done' : c.cta, onClick: () => (last ? o.onFinish() : (i++, show())) }))));
    fit(wrap, stage);
    if (ro) ro.disconnect();
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => fit(wrap, stage)); ro.observe(wrap); }
  }

  function back() { if (i === 0) return false; i--; show(); return true; }
  show();
  return { back, step: () => i, destroy() { if (ro) ro.disconnect(); } };
}
