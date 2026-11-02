import { h, fill, ago } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { emptyState } from '../kit/cards.js';
import { menu, confirmBox, toast } from '../kit/overlay.js';

export function creationsScreen(ctx) {
  const el = h('div', {});
  async function draw() {
    const list = await ctx.creations.list();
    fill(el, h('div', { class: 'top' }, h('h1', { class: 'title', text: 'Collections' }), h('span', {})),
      h('div', { class: 'seg' }, h('button', { text: 'Collections', onClick: () => ctx.router.go('/collections') }), h('button', { class: 'on', text: 'Creations' })),
      list.length ? h('div', { style: { marginTop: '8px' } }, list.map((c) => h('button', { class: 'row', onClick: () => ctx.router.go(`/creation/${c.id}`) }, icon('note', 22), h('div', { class: 'grow' }, h('div', { text: c.title }), h('div', { class: 'rs', text: `${c.label}, ${ago(c.updatedAt)}, ${c.sources.length} ${c.sources.length === 1 ? 'source' : 'sources'}` })), icon('chevron', 18)))) : emptyState('No Creations yet', 'Ask Kiko something, then tap Save as Creation to keep the answer as a note, checklist, plan or reference sheet.'));
  }
  const off = ctx.creations.bus.on('changed', () => { if (el.isConnected) draw(); }); ctx.onLeave(off);
  draw(); return el;
}

export async function creationScreen(ctx, { id }) {
  const c = await ctx.creations.get(id);
  if (!c) return h('div', { class: 'empty' }, h('div', { class: 'h2', text: 'This Creation is gone' }));
  const src = await ctx.creations.sourceStatus(c);
  const title = h('input', { class: 'field', value: c.title, 'aria-label': 'Title', maxlength: 120 });
  const body = h('textarea', { class: 'field', style: { height: '55vh', marginTop: '12px', lineHeight: '24px' }, 'aria-label': 'Body', value: c.body });
  let t; const save = () => { clearTimeout(t); t = setTimeout(() => ctx.creations.update(id, { title: title.value.trim() || c.title, body: body.value }), 500); };
  title.addEventListener('input', save); body.addEventListener('input', save);
  return h('div', {}, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('span', { class: 'lbl', text: c.label }),
    h('button', { class: 'iconbtn plain', 'aria-label': 'More', onClick: () => menu(c.label, [
      { label: 'Copy', icon: 'copy', run: async () => { try { await navigator.clipboard.writeText(body.value); toast('Copied'); } catch (e) { toast('Could not copy'); } } },
      { label: 'Delete Creation', icon: 'trash', danger: true, run: async () => { if (await confirmBox('Delete this Creation?', 'The Keeps it was made from stay in your Trove.')) { await ctx.creations.remove(id); ctx.router.go('/creations'); } } }]) }, icon('more'))),
    h('div', { class: 'pad' }, title, body, h('p', { class: 'hint', text: 'Saved as you type. Edit freely.' }),
      src.length ? h('div', { class: 'sect', style: { padding: '16px 0 0' } }, h('div', { class: 'lbl', text: 'Made from' }), h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' } }, src.map((s) => h('button', { class: 'chip', disabled: s.gone, onClick: () => ctx.router.go(`/keep/${s.id}`) }, s.gone ? 'Source no longer available' : s.title.slice(0, 30))))) : null));
}
