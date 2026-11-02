import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { keepCard, emptyState } from '../kit/cards.js';
import { menu, confirmBox, promptBox, toast } from '../kit/overlay.js';

/** Collections, with Creations beside them. Deleting a Collection never deletes Keeps. */
export function collectionsScreen(ctx) {
  const { keeps, router } = ctx;
  const el = h('div', {});
  async function draw() {
    const cs = await keeps.collections();
    const all = await keeps.list({});
    const counts = cs.map((c) => c.keepIds.filter((id) => all.some((k) => k.id === id)).length);
    fill(el,
      h('div', { class: 'top' }, h('h1', { class: 'title', text: 'Collections' }), h('button', { class: 'iconbtn', 'aria-label': 'New Collection', onClick: async () => { const n = await promptBox('New Collection', 'Name', '', 'Create'); if (n) { await keeps.addCollection(n); draw(); } } }, icon('plus'))),
      h('div', { class: 'seg' }, h('button', { class: 'on', text: 'Collections' }), h('button', { text: 'Creations', onClick: () => router.go('/creations') })),
      cs.length ? h('div', { style: { marginTop: '8px' } }, cs.map((c, i) => h('button', { class: 'row', onClick: () => router.go(`/collection/${c.id}`) }, icon('collections', 22), h('div', { class: 'grow' }, h('div', { text: c.name }), h('div', { class: 'rs', text: `${counts[i]} ${counts[i] === 1 ? 'Keep' : 'Keeps'}` })), icon('chevron', 18)))) : emptyState('No Collections yet', 'A Collection groups Keeps your way. One Keep can sit in many.'));
  }
  const off = keeps.bus.on('changed', () => { if (el.isConnected) draw(); }); ctx.onLeave(off);
  draw(); return el;
}

export async function collectionScreen(ctx, { id }) {
  const { keeps, router } = ctx;
  const el = h('div', {});
  async function draw() {
    const c = await keeps.repo.collections.get(id);
    if (!c) return router.go('/collections');
    const items = await keeps.list({ collection: id });
    fill(el, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px', flex: 1, textAlign: 'center' }, text: c.name }),
      h('button', { class: 'iconbtn plain', 'aria-label': 'More', onClick: () => menu(c.name, [
        { label: 'Ask Kiko about this Collection', icon: 'kiko', run: () => router.go(`/kiko/collection/${id}`) },
        { label: 'Rename', icon: 'edit', run: async () => { const n = await promptBox('Rename', 'Name', c.name); if (n) { await keeps.renameCollection(id, n); draw(); } } },
        { label: 'Delete Collection', icon: 'trash', danger: true, run: async () => { if (await confirmBox('Delete this Collection?', 'Your Keeps stay in your Trove.')) { await keeps.deleteCollection(id); toast('Collection deleted'); router.go('/collections'); } } }]) }, icon('more'))),
      items.length ? h('div', { class: 'grid' }, items.map((k) => keepCard(k, { onOpen: () => router.go(`/keep/${k.id}`), onHold: () => menu(k.title, [{ label: 'Remove from this Collection', icon: 'close', run: async () => { await keeps.removeFromCollection(id, [k.id]); draw(); } }]) }))) : emptyState('Empty Collection', 'Open a Keep and tap Add to Collection, or select Keeps in your Trove.'));
  }
  await draw();
  const off = keeps.bus.on('changed', () => { if (el.isConnected) draw(); }); ctx.onLeave(off);
  return el;
}
