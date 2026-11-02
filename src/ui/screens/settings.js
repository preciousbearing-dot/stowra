import { h } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { aiSetup } from './ai-setup.js';
import { PROVIDERS } from '../../ai/providers.js';

/** Settings home. */
export function settingsScreen(ctx) {
  const row = (ic, label, sub, to) => h('button', { class: 'row', onClick: () => ctx.router.go(to) }, icon(ic, 22), h('div', { class: 'grow' }, h('div', { text: label }), sub ? h('div', { class: 'rs', text: sub }) : null), icon('chevron', 18));
  const a = ctx.ai.config.active;
  return h('div', {}, h('div', { class: 'top' }, h('h1', { class: 'title', text: 'You' })),
    h('div', { style: { marginTop: '8px' } },
      row('key', 'AI connection', ctx.ai.ready() ? `${PROVIDERS[a]?.name || 'Connected'}, ${ctx.ai.config.providers[a]?.model || ''}` : 'Not connected', '/settings/ai'),
      ...(ctx.settingsRows ? ctx.settingsRows(row) : [])));
}

export function aiSettingsScreen(ctx) {
  return h('div', {}, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: 'AI connection' }), h('span', { style: { width: '44px' } })), aiSetup(ctx));
}
