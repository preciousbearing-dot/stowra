import { h, fill } from '../kit/dom.js';
import { toast } from '../kit/overlay.js';
import { icon } from '../kit/icons.js';
import { aiSetup } from './ai-setup.js';
import { lookPicker } from './look.js';
import { PROVIDERS } from '../../ai/providers.js';
import { replayTour } from '../onboarding/flow.js';

/** Settings home. */
export function settingsScreen(ctx) {
  const row = (ic, label, sub, to) => h('button', { class: 'row', onClick: () => ctx.router.go(to) }, icon(ic, 22), h('div', { class: 'grow' }, h('div', { text: label }), sub ? h('div', { class: 'rs', text: sub }) : null), icon('chevron', 18));
  const a = ctx.ai.config.active;
  return h('div', {}, h('div', { class: 'top' }, h('h1', { class: 'title', text: 'You' })),
    h('div', { style: { marginTop: '8px' } },
      row('key', 'AI connection', ctx.ai.ready() ? `${PROVIDERS[a]?.name || 'Connected'}, ${ctx.ai.config.providers[a]?.model || ''}` : 'Not connected', '/settings/ai'),
      row('search', 'Smart search', ctx.smart && ctx.smart.on ? 'On, finds Keeps by meaning' : 'Off', '/settings/smart'),
      row('sun', 'Appearance', 'Style, theme and mode', '/settings/look'),
      row('lock', 'Privacy lock', ctx.lock.enabled ? 'PIN is on' : 'Off', '/settings/privacy'),
      row('download', 'Backup and restore', 'Save your Trove as a file', '/settings/data'),
      row('refresh', 'About and updates', 'Version, update check', '/settings/about'),
      h('button', { class: 'row', onClick: () => replayTour(document.getElementById('app')) }, icon('play', 22), h('div', { class: 'grow' }, h('div', { text: 'Replay the welcome tour' }), h('div', { class: 'rs', text: 'See the four intro slides again' })), icon('chevron', 18))));
}

export function aiSettingsScreen(ctx) {
  return h('div', {}, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: 'AI connection' }), h('span', { style: { width: '44px' } })), aiSetup(ctx));
}

export async function lookSettingsScreen(ctx) {
  const prefs = { style: 'advanced', theme: 'bright', mode: 'light', ...(await ctx.repo.prefs.read('prefs', {})) };
  return h('div', {}, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: 'Appearance' }), h('span', { style: { width: '44px' } })), h('div', { class: 'pad' }, lookPicker({ repo: ctx.repo, prefs })));
}

/** Smart search settings: opt in, watch indexing, switch off and delete the index. */
export async function smartSettingsScreen(ctx) {
  const el = h('div', {});
  const sm = ctx.smart;
  const bar = h('div', { class: 'status', role: 'status' });
  const draw = async () => {
    const st = sm.status(); const hasKey = ctx.ai.hasKey('gemini'); const c = await sm.counts();
    const state = !sm.on ? 'Off' : !hasKey ? 'On, but there is no Gemini key' : st.busy ? 'Indexing now' : st.error ? st.error : `${c.done} of ${c.total} Keeps indexed`;
    bar.textContent = state; bar.className = 'status' + (st.error || (sm.on && !hasKey) ? ' bad' : '');
    fill(el, h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: 'Smart search' })),
      h('div', { class: 'pad' },
        h('div', { class: 'notice', text: 'Find a Keep by what it means, not only the words in it. Search for "ways to stay focused" and find the Keep titled "Deep work habits". Your normal search keeps working either way.' }),
        h('div', { class: 'notice', style: { marginTop: '12px' }, text: 'To work this out, the title, tags, note, summary and the first part of the text of each Keep are sent to Google Gemini once, using your own free key. Pictures and files are never sent. The results stay on this phone. Nothing is sent while this is off.' }),
        h('div', { style: { marginTop: '16px' } },
          h('label', { class: 'row', style: { cursor: 'pointer' } }, icon('search', 22), h('div', { class: 'grow' }, h('div', { text: 'Use Smart search' }), h('div', { class: 'rs', text: hasKey ? 'Uses your Gemini key' : 'Needs a Gemini key first' })),
            h('input', { type: 'checkbox', checked: sm.on, 'aria-label': 'Use Smart search', onChange: async (e) => { await sm.setOn(e.target.checked); draw(); } }))),
        bar,
        !hasKey ? h('button', { class: 'btn', style: { width: '100%', marginTop: '12px' }, text: 'Add a Gemini key', onClick: () => ctx.router.go('/settings/ai') }) : null,
        sm.on && hasKey ? h('button', { class: 'btn', style: { width: '100%', marginTop: '12px' }, disabled: st.busy, text: st.busy ? 'Indexing...' : 'Index my Keeps now', onClick: async () => { const r = await sm.indexNow(); if (r.error) toast(r.error); draw(); } }) : null,
        c.done ? h('button', { class: 'btn ghost', style: { width: '100%', marginTop: '12px' }, text: 'Delete the index from this phone', onClick: async () => { await sm.clear(); toast('Index deleted'); draw(); } }) : null));
  };
  const off = sm.onChange(() => draw()); ctx.onLeave(off);
  await draw();
  return el;
}
