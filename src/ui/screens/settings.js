import { h } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { aiSetup } from './ai-setup.js';
import { lookPicker } from './look.js';
import { PROVIDERS } from '../../ai/providers.js';

/** Settings home. */
export function settingsScreen(ctx) {
  const row = (ic, label, sub, to) => h('button', { class: 'row', onClick: () => ctx.router.go(to) }, icon(ic, 22), h('div', { class: 'grow' }, h('div', { text: label }), sub ? h('div', { class: 'rs', text: sub }) : null), icon('chevron', 18));
  const a = ctx.ai.config.active;
  return h('div', {}, h('div', { class: 'top' }, h('h1', { class: 'title', text: 'You' })),
    h('div', { style: { marginTop: '8px' } },
      row('key', 'AI connection', ctx.ai.ready() ? `${PROVIDERS[a]?.name || 'Connected'}, ${ctx.ai.config.providers[a]?.model || ''}` : 'Not connected', '/settings/ai'),
      row('sun', 'Appearance', 'Style, theme and mode', '/settings/look'),
      row('lock', 'Privacy lock', ctx.lock.enabled ? 'PIN is on' : 'Off', '/settings/privacy'),
      row('download', 'Backup and restore', 'Save your Trove as a file', '/settings/data'),
      row('refresh', 'About and updates', 'Version, update check', '/settings/about')));
}

export function aiSettingsScreen(ctx) {
  return h('div', {}, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: 'AI connection' }), h('span', { style: { width: '44px' } })), aiSetup(ctx));
}

export async function lookSettingsScreen(ctx) {
  const prefs = { style: 'advanced', theme: 'bright', mode: 'light', ...(await ctx.repo.prefs.read('prefs', {})) };
  return h('div', {}, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: 'Appearance' }), h('span', { style: { width: '44px' } })), h('div', { class: 'pad' }, lookPicker({ repo: ctx.repo, prefs })));
}
