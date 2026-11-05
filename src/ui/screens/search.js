import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { keepCard, emptyState } from '../kit/cards.js';
import { buildIndex, search, snippet } from '../../retrieval/search.js';

/** Keyword search over every Keep, archived ones included. Works with no AI and no internet; Smart search adds meaning when it is on. */
export function searchScreen(ctx) {
  const { keeps, router } = ctx;
  const input = h('input', { type: 'search', placeholder: 'Search your Trove', 'aria-label': 'Search your Trove', autocomplete: 'off', enterkeyhint: 'search' });
  const out = h('div', {});
  let index = null; let seq = 0;
  async function run() {
    const q = input.value.trim();
    if (!q) return fill(out, emptyState('Find anything you kept', 'Search titles, notes, tags and the text Stowra read.'));
    if (!index) index = buildIndex((await keeps.list({})).concat(await keeps.list({ view: 'archive' })));
    const res = search(index, q);
    const mine = ++seq;
    const show = (rows) => {
      if (!rows.length) return fill(out, emptyState('No matches', 'Try fewer or different words. Turn on Smart search in Settings to find Keeps by meaning.'));
      fill(out, h('div', { class: 'grid' }, rows.slice(0, 60).map((r) => {
        const c = keepCard(r.keep, { onOpen: () => router.go(`/keep/${r.keep.id}`), onHold: () => {} });
        const sn = snippet(r.keep, q);
        if (sn) c.querySelector('.meta').append(h('div', { class: 'cs', text: sn }));
        if (r.byMeaning) c.querySelector('.meta').append(h('div', { class: 'cs', text: 'Matched by meaning' }));
        return c;
      })));
    };
    const st = ctx.smart && ctx.smart.status();
    if (!res.length && st && st.ready && q.length >= 3) fill(out, emptyState('Searching by meaning', 'Looking for Keeps that match what you asked.'));
    else show(res.map((r) => ({ keep: r.keep, byMeaning: false })));
    if (st && st.ready && q.length >= 3) {
      try {
        const sem = await ctx.smart.find(q, index.map((e) => e.k));
        if (mine === seq) show(sem.length ? ctx.smart.fuse(res, sem) : res.map((r) => ({ keep: r.keep, byMeaning: false })));
      } catch (e) { if (mine === seq) show(res.map((r) => ({ keep: r.keep, byMeaning: false }))); }
    }
  }
  let t; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 120); });
  const el = h('div', {}, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => router.back() }, icon('back')), h('h1', { class: 'title', text: 'Search' }), h('span', { style: { width: '44px' } })),
    h('label', { class: 'search' }, icon('search', 20), input), out);
  const off = keeps.bus.on('changed', () => { index = null; });
  ctx.onLeave(off);
  run(); setTimeout(() => input.focus(), 300);
  return el;
}
