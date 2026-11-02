import { h } from '../kit/dom.js';
import { icon } from '../kit/icons.js';

/** Settings home. Sub-screens (AI, Look, Data) are added as they are built. */
export function settingsScreen(ctx) {
  const row = (ic, label, sub, to) => h('button', { class: 'row', onClick: () => ctx.router.go(to) }, icon(ic, 22), h('div', { class: 'grow' }, h('div', { text: label }), sub ? h('div', { class: 'rs', text: sub }) : null), icon('chevron', 18));
  return h('div', {}, h('div', { class: 'top' }, h('h1', { class: 'title', text: 'You' })),
    h('div', { style: { marginTop: '8px' } }, ...(ctx.settingsRows ? ctx.settingsRows(row) : [])));
}
