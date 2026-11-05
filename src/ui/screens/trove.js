import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { keepCard, emptyState } from '../kit/cards.js';
import { FILTERS } from '../../capture/classify.js';
import { menu, confirmBox, promptBox, toast } from '../kit/overlay.js';
import { scrollRow } from '../kit/scrollrow.js';
import { weekly } from '../../core/discover.js';
import { advancedPanel } from './trove-charts.js';

/** The library. Long press selects; selected Keeps get bulk actions. */
export function troveScreen(ctx) {
  const { keeps, router } = ctx;
  const state = { filter: 'all', sort: 'new', sel: new Set(), view: 'active' };
  const page = h('div', { class: 'page-inner' });
  const el = h('div', { class: 'trove' }, page);

  async function draw() {
    const items = await keeps.list({ view: state.view, filter: state.filter, sort: state.sort });
    const all = await keeps.list({});
    const last = await ctx.repo.prefs.read('lastReview', 0);
    const wk = weekly(all);
    const showReview = state.view === 'active' && wk.count >= 3 && Date.now() - last > 7 * 86400000;
    const waiting = all.filter((k) => k.status === 'saved' || k.status === 'processing').length;
    const grid = h('div', { class: 'grid masonry' + (state.sel.size ? ' selecting' : '') }, items.map((k) => keepCard(k, {
      selected: state.sel.has(k.id),
      onOpen: () => { if (state.sel.size) toggle(k.id); else router.go(`/keep/${k.id}`); },
      onHold: () => toggle(k.id),
    })));
    fill(page,
      h('div', { class: 'top' }, h('div', {}, h('h1', { class: 'title', text: 'Trove' })),
        h('div', { style: { display: 'flex', gap: '8px' } }, h('button', { class: 'iconbtn', 'aria-label': 'Sort and view', onClick: sortMenu }, icon('filter', 20)))),
      h('button', { class: 'search', 'aria-label': 'Search your Trove', onClick: () => router.go('/search') }, icon('search', 20), h('span', { text: 'Search your Trove' })),
      all.length && state.view === 'active' ? advancedPanel(all, ctx) : null,
      all.length && state.view === 'active' ? h('button', { class: 'hero sreview', onClick: () => router.go('/rediscover') }, h('span', { class: 'lbl', text: waiting ? `${waiting} waiting to be read` : 'Your Trove' }), h('span', { class: 'big', text: `${all.length} ${all.length === 1 ? 'Keep' : 'Keeps'}` }), h('span', { class: 'lbl', text: 'Tap to rediscover something' })) : null,
      showReview ? h('button', { class: 'notice', style: { width: 'calc(100% - 48px)', textAlign: 'left' }, onClick: () => router.go('/review') }, h('b', { text: `You kept ${wk.count} things this week. ` }), 'See your week') : null,
      state.view !== 'active' ? h('div', { class: 'notice', text: state.view === 'bin' ? 'Items here are deleted for good after 30 days.' : 'Archived Keeps are hidden from your Trove and still searchable.' }) : null,
      scrollRow(h('div', { class: 'chips', role: 'tablist' }, FILTERS.map((f) => h('button', { class: 'chip' + (state.filter === f.id ? ' on' : ''), text: f.label, onClick: () => { state.filter = f.id; draw(); } })))),
      items.length ? grid : (all.length || state.view !== 'active' ? emptyState('Nothing here', state.view === 'bin' ? 'The bin is empty.' : state.view === 'archive' ? 'No archived Keeps.' : 'No Keeps match this filter.') : emptyState('Your Trove is empty', 'Share a video, post or page to Stowra from any app, or tap the plus to paste a link.')));
    bar();
  }

  function toggle(id) { state.sel.has(id) ? state.sel.delete(id) : state.sel.add(id); draw(); }

  function sortMenu() {
    menu('View', [
      { label: 'Newest first', icon: 'clock', run: () => { state.sort = 'new'; state.view = 'active'; draw(); } },
      { label: 'Oldest first', icon: 'clock', run: () => { state.sort = 'old'; draw(); } },
      { label: 'By title', icon: 'filter', run: () => { state.sort = 'title'; draw(); } },
      { label: state.view === 'archive' ? 'Back to Trove' : 'Archive', icon: 'archive', run: () => { state.view = state.view === 'archive' ? 'active' : 'archive'; draw(); } },
      { label: state.view === 'bin' ? 'Back to Trove' : 'Recycle bin', icon: 'trash', run: () => { state.view = state.view === 'bin' ? 'active' : 'bin'; draw(); } },
    ]);
  }

  function bar() {
    el.querySelector('.bar-sel')?.remove();
    if (!state.sel.size) return;
    const ids = [...state.sel];
    const done = (m) => { state.sel.clear(); draw(); toast(m); };
    const btn = (name, label, fn) => h('button', { 'aria-label': label, onClick: fn }, icon(name, 22));
    el.append(h('div', { class: 'bar-sel' }, h('span', { class: 'n', text: `${ids.length} selected` }),
      state.view === 'bin' ? [btn('restore', 'Restore', async () => { await keeps.bulk(ids, 'restore'); done('Restored'); }), btn('trash', 'Delete for good', async () => { if (await confirmBox('Delete for good?', 'This cannot be undone.')) { await keeps.bulk(ids, 'purge'); done('Deleted'); } })] :
        [btn('kiko', 'Ask Kiko about these', () => router.go(`/kiko/keeps/${ids.join(',')}`)), btn('collections', 'Add to a Collection', () => pickCollection(ids, done)), btn('tag', 'Add a tag', async () => { const t = await promptBox('Add a tag', 'Tag'); if (t) { await keeps.bulk(ids, 'tag', t); done('Tag added'); } }),
          btn('archive', state.view === 'archive' ? 'Restore' : 'Archive', async () => { await keeps.bulk(ids, state.view === 'archive' ? 'restore' : 'archive'); done(state.view === 'archive' ? 'Restored' : 'Archived'); }),
          btn('trash', 'Move to bin', async () => { await keeps.bulk(ids, 'trash'); done('Moved to the bin'); })],
      btn('close', 'Clear selection', () => { state.sel.clear(); draw(); })));
  }

  async function pickCollection(ids, done) {
    const cs = await keeps.collections();
    menu('Add to a Collection', [...cs.map((c) => ({ label: c.name, icon: 'collections', run: async () => { await keeps.addToCollection(c.id, ids); done(`Added to ${c.name}`); } })),
      { label: 'New Collection', icon: 'plus', run: async () => { const n = await promptBox('New Collection', 'Name', '', 'Create'); if (n) { const c = await keeps.addCollection(n); await keeps.addToCollection(c.id, ids); done(`Added to ${n}`); } } }]);
  }

  const off = keeps.bus.on('changed', () => { if (el.isConnected) draw(); });
  ctx.onLeave(off);
  draw();
  return el;
}
