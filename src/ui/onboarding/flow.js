import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { aiSetup } from '../screens/ai-setup.js';
import { lookPicker } from '../screens/look.js';
import { createAi } from '../../ai/engine.js';

const SLIDES = [
  { ic: 'share', t: 'Keep things from anywhere', b: 'Share a video, post or page to Stowra from any app. It is saved in a second, even with no signal.' },
  { ic: 'note', t: 'Understood, not buried', b: 'Stowra reads what you keep, writes a summary, and remembers why you saved it.' },
  { ic: 'search', t: 'Find it again', b: 'Search by words you remember, or ask Kiko in plain language. Kiko tells you what comes from your Keeps.' },
  { ic: 'spark', t: 'Put it to work', b: 'Turn what you kept into checklists, plans and notes, linked back to where each idea came from.' },
];

/** First run: tour, AI key setup, look picker. Everything but the look can be skipped. @param {{root: HTMLElement, repo: any, prefs: any, start: () => void}} o */
export async function runOnboarding({ root, repo, prefs, start }) {
  root.replaceChildren();
  const ai = createAi({ repo, keeps: null }); await ai.init();
  const el = h('main', { class: 'screen ob', 'aria-live': 'polite' }); root.append(el);
  const finish = async () => { await repo.prefs.write('prefs', { ...prefs, onboarded: true }); prefs.onboarded = true; start(); };

  function tour(i) {
    const s = SLIDES[i];
    fill(el,
      h('div', { class: 'ob-top' }, h('span', { class: 'lbl', text: `${i + 1} of ${SLIDES.length}` }), h('button', { class: 'chip', text: 'Skip', onClick: () => aiStep() })),
      h('div', { class: 'ob-art', key: i }, h('div', { class: 'ob-ring' }), h('div', { class: 'ob-ring r2' }), h('div', { class: 'ob-icon' }, icon(s.ic, 44))),
      h('h1', { class: 'ob-title', text: s.t }), h('p', { class: 'ob-body', text: s.b }),
      h('div', { class: 'ob-dots' }, SLIDES.map((_, j) => h('span', { class: j === i ? 'on' : '' }))),
      h('button', { class: 'btn', text: i === SLIDES.length - 1 ? 'Set up' : 'Next', onClick: () => (i === SLIDES.length - 1 ? aiStep() : tour(i + 1)) }));
  }

  function aiStep() {
    const body = h('div', { class: 'ob-scroll' }, h('h1', { class: 'ob-title', text: 'Connect Kiko' }), aiSetup({ ai }, { onChange: () => draw() }));
    const next = h('button', { class: 'btn', onClick: () => lookStep() });
    const draw = () => { next.textContent = ai.ready() ? 'Continue' : 'Skip for now'; next.classList.toggle('ghost', !ai.ready()); };
    draw();
    fill(el, body, h('div', { class: 'ob-foot' }, next, h('p', { class: 'hint', style: { textAlign: 'center' }, text: 'You can add or change this later in You, then AI connection.' })));
  }

  function lookStep() {
    fill(el, h('div', { class: 'ob-scroll' }, h('h1', { class: 'ob-title', text: 'Pick your look' }), h('p', { class: 'ob-body', style: { marginTop: '4px' }, text: 'You can change this any time in You, then Appearance.' }), lookPicker({ repo, prefs })),
      h('div', { class: 'ob-foot' }, h('button', { class: 'btn', text: 'Open my Trove', onClick: finish })));
  }
  tour(0);
}
