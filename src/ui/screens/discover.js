import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { keepCard, emptyState } from '../kit/cards.js';
import { toast, sheet } from '../kit/overlay.js';
import { suggestSpacesAI } from '../../ai/spaces.js';
import { rediscoverPicks, weekly, heuristicSpaces, laptopItems, taskList, SCAN_WARNING } from '../../core/discover.js';

const head = (ctx, title) => h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: title }), h('span', { style: { width: '44px' } }));

export async function rediscoverScreen(ctx) {
  const picks = rediscoverPicks(await ctx.keeps.list({}));
  return h('div', {}, head(ctx, 'Rediscover'), h('p', { class: 'sub pad', text: 'Keeps you saved a while ago and have not opened lately. Nothing here changes your Trove.' }),
    picks.length ? h('div', { class: 'grid' }, picks.map((k) => keepCard(k, { onOpen: () => ctx.router.go(`/keep/${k.id}`), onHold: () => {} }))) : emptyState('Nothing to rediscover yet', 'Keeps appear here once they are a week old and still unopened.'));
}

export async function reviewScreen(ctx) {
  const all = await ctx.keeps.list({}); const w = weekly(all);
  await ctx.repo.prefs.write('lastReview', Date.now());
  const stat = (label, n) => h('div', { class: 'notice', style: { margin: 0, flex: 1 } }, h('div', { class: 'h2', text: String(n) }), h('div', { class: 'lbl', text: label }));
  return h('div', {}, head(ctx, 'This week'),
    w.count ? h('div', {}, h('div', { class: 'pad', style: { display: 'flex', gap: '12px', marginTop: '8px' } }, stat('kept', w.count), stat('still unread', w.unread), stat('to act on', w.toTry.length)),
      Object.keys(w.byWhy).length ? h('div', { class: 'sect' }, h('div', { class: 'lbl', text: 'Why you saved them' }), h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' } }, Object.entries(w.byWhy).map(([k, n]) => h('span', { class: 'chip', text: `${k}, ${n}` })))) : null,
      w.toTry.length ? h('div', {}, h('div', { class: 'sect lbl', text: 'Worth acting on' }), h('div', { class: 'grid' }, w.toTry.slice(0, 4).map((k) => keepCard(k, { onOpen: () => ctx.router.go(`/keep/${k.id}`), onHold: () => {} })))) : null) : emptyState('A quiet week', 'Nothing kept in the last seven days.'));
}

export async function laptopScreen(ctx) {
  const items = laptopItems(await ctx.keeps.list({}));
  return h('div', {}, head(ctx, 'Laptop queue'), h('div', { class: 'notice', text: SCAN_WARNING }),
    items.length ? h('div', {}, h('div', { class: 'pad', style: { marginTop: '16px' } }, h('button', { class: 'btn', style: { width: '100%' }, text: 'Copy as task list for Claude Code', onClick: async () => { try { await navigator.clipboard.writeText(taskList(items)); toast('Task list copied'); } catch (e) { toast('Could not copy'); } } })),
      items.map((k) => h('button', { class: 'row', onClick: () => ctx.router.go(`/keep/${k.id}`) }, icon(k.kind === 'github' ? 'laptop' : 'link', 22), h('div', { class: 'grow' }, h('div', { text: k.title }), h('div', { class: 'rs', text: [k.source, k.meta.language].filter(Boolean).join(', ') })), icon('chevron', 18)))) : emptyState('Nothing queued', 'GitHub repos and Keeps marked "To try a tool" collect here, ready for your laptop.'));
}

/** Suggested Spaces. The person approves each one; nothing is grouped silently. */
export async function suggestSpaces(ctx) {
  const keeps = await ctx.keeps.list({}); const cols = await ctx.keeps.collections();
  const s = sheet({ title: 'Suggested Spaces' });
  const existing = new Set(cols.map((c) => c.name.toLowerCase()));
  let sug = heuristicSpaces(keeps, existing);
  let asking = false;
  const ask = async () => {
    asking = true; draw();
    try { sug = await suggestSpacesAI({ ai: ctx.ai, smart: ctx.smart, keeps, existing }); } catch (e) { toast('Could not ask just now'); }
    asking = false; draw();
  };
  const smartOn = ctx.smart && ctx.smart.on;
  const draw = () => fill(s.body, h('p', { class: 'sheet-text', text: 'Groups Stowra noticed. Approve the ones you want. Approved Spaces become Collections.' }),
    h('button', { class: 'btn ghost small', style: { margin: '0 0 12px' }, disabled: asking, text: asking ? 'Thinking...' : (smartOn ? 'Find groups by meaning and name them' : 'Name these groups with AI'), onClick: ask }),
    sug.length ? sug.map((x, i) => h('div', { class: 'notice', style: { margin: '0 0 8px' } }, h('div', { style: { color: 'var(--tx)', fontWeight: '600' }, text: x.name }), h('div', { class: 'hint', text: x.reason }),
      h('div', { class: 'row-btns', style: { marginTop: '8px' } }, h('button', { class: 'btn ghost small', text: 'Dismiss', onClick: () => { sug.splice(i, 1); draw(); } }), h('button', { class: 'btn small', text: 'Approve', onClick: async () => { const c = await ctx.keeps.addCollection(x.name); await ctx.keeps.addToCollection(c.id, x.keepIds); sug.splice(i, 1); toast(`Created ${x.name}`); draw(); } })))) : h('div', { class: 'empty', style: { padding: '24px 0' }, text: 'No suggestions right now. Save a few more Keeps, or turn on Smart search in Settings so Stowra can group by meaning.' }));
  draw();
}
