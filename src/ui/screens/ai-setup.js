import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { rich } from '../kit/rich.js';
import { native } from '../../platform/native.js';
import { PROVIDERS, TOP, MORE } from '../../ai/providers.js';

/**
 * Guided key setup, used in onboarding and in Settings. Explains each step, links straight to the key page,
 * tests the key with a real request, and keeps it in secure storage.
 * @param {any} ctx @param {{onChange?: () => void}} [o]
 */
export function aiSetup(ctx, o = {}) {
  const { ai } = ctx;
  const el = h('div', {});
  let sel = ai.config.active || 'gemini'; let more = MORE.includes(sel); let msg = null; let busy = false; const draft = { key: '', base: '', model: '' };

  function draw() {
    const on = new Set(ai.connected());
    const card = (id) => h('button', { class: 'pcard' + (sel === id ? ' on' : '') + (on.has(id) ? ' ok' : ''), 'aria-pressed': sel === id, onClick: () => { sel = id; msg = null; draft.key = ''; draw(); } },
      h('span', { class: 'pdot' }, on.has(id) ? icon('check', 14) : null), h('div', { class: 'grow' }, h('div', { class: 'nm', text: PROVIDERS[id].name }), h('div', { class: 'tg', text: PROVIDERS[id].tag })));
    fill(el,
      h('div', { class: 'notice', text: 'Kiko, your AI companion, needs an AI key to summarise and answer. Stowra has no server and no account, so you bring your own key. It stays on this phone, and Stowra works without one for saving and searching.' }),
      on.size ? h('div', { class: 'notice' }, h('b', { text: `${on.size} connected. ` }), `Kiko uses ${PROVIDERS[ai.config.active]?.name || 'your provider'} first and moves to the next by itself if it is busy.`) : null,
      h('div', { class: 'prov' }, TOP.map(card), more ? MORE.map(card) : h('button', { class: 'chip', style: { alignSelf: 'flex-start' }, text: 'More providers', onClick: () => { more = true; draw(); } })),
      panel(on));
  }

  function panel(on) {
    const p = PROVIDERS[sel]; const cfg = ai.config.providers[sel];
    const key = h('input', { class: 'field', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': `${p.name} key`, placeholder: p.keyHint ? `Key, starts with ${p.keyHint}` : 'Key', value: draft.key });
    key.addEventListener('input', () => { draft.key = key.value; });
    const paste = h('button', { class: 'chip', style: { height: '52px' }, onClick: async () => { try { const t = (await navigator.clipboard.readText()).trim(); key.value = t; draft.key = t; } catch (e) { msg = { bad: true, text: 'Press and hold in the box and choose Paste.' }; draw(); } } }, icon('copy', 16), 'Paste');
    const custom = sel === 'custom' ? [h('input', { class: 'field', style: { marginTop: '8px' }, placeholder: 'Address, like https://api.example.com/v1', value: draft.base || cfg?.base || '', onInput: (e) => { draft.base = e.target.value; }, 'aria-label': 'Provider address' }),
      h('input', { class: 'field', style: { marginTop: '8px' }, placeholder: 'Model name', value: draft.model || cfg?.model || '', onInput: (e) => { draft.model = e.target.value; }, 'aria-label': 'Model name' })] : [];
    const connect = h('button', { class: 'btn', style: { width: '100%', marginTop: '16px' }, disabled: busy, text: busy ? 'Checking your key' : on.has(sel) ? 'Replace key' : 'Connect', onClick: async () => {
      busy = true; msg = null; draw();
      const r = await ai.connect(sel, { key: draft.key, base: draft.base || cfg?.base, model: draft.model });
      busy = false; msg = { bad: !r.ok, text: r.message }; if (r.ok) { draft.key = ''; o.onChange && o.onChange(); } draw();
    } });
    return h('div', { class: 'sect' },
      h('h2', { class: 'h2', text: p.name }), h('p', { class: 'sub', text: p.blurb }),
      p.keyUrl ? h('button', { class: 'btn', style: { width: '100%', marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }, onClick: () => native.openExternal(p.keyUrl) }, icon('external', 20), `Open the ${p.name} key page`) : null,
      p.steps.length ? h('ol', { class: 'steps' }, p.steps.map((s) => h('li', {}, h('span', {}, ...rich(s))))) : null,
      h('div', { class: 'keyrow' }, key, paste), ...custom, connect,
      msg ? h('div', { class: 'status ' + (msg.bad ? 'bad' : 'good'), role: 'status', text: msg.text }) : null,
      on.has(sel) && cfg.models.length ? h('div', { style: { marginTop: '16px' } }, h('div', { class: 'lbl', text: 'Model' }), modelSelect(cfg)) : null,
      on.has(sel) ? h('div', { class: 'row-btns' }, ai.config.active !== sel ? h('button', { class: 'btn ghost small', text: 'Use this first', onClick: async () => { await ai.setActive(sel); draw(); } }) : null, h('button', { class: 'btn ghost small', text: 'Remove key', onClick: async () => { await ai.disconnect(sel); o.onChange && o.onChange(); draw(); } })) : null,
      p.fine ? h('p', { class: 'hint', text: p.fine }) : null);
  }
  function modelSelect(cfg) {
    const s = h('select', { class: 'field', 'aria-label': 'Model', style: { marginTop: '4px' } }, cfg.models.map((m) => h('option', { value: m, text: m, selected: m === cfg.model })));
    s.addEventListener('change', () => ai.setModel(sel, s.value));
    return s;
  }
  draw();
  return el;
}
