import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { menu, sheet, toast } from '../kit/overlay.js';
import { ask, keepsInScope, scopeLabel, CREATION_TYPES } from '../../kiko/kiko.js';
import { PROVIDERS } from '../../ai/providers.js';

const SUGGEST = {
  keep: ['Summarise this', 'What should I do with this?', 'List the key steps'],
  trove: ['What did I save recently?', 'Which Keeps are about tools I could try?', 'Find the Keeps that mention a deadline'],
  collection: ['What do these Keeps have in common?', 'Make a short plan from these', 'What is missing here?'],
  keeps: ['Compare these', 'What do these agree on?', 'Where do they differ?'],
};
const LABEL = { keeps: 'From your Keeps', general: 'General knowledge', unsupported: 'Not backed by your Keeps' };

/** Kiko. The scope is always shown and only changes when the person changes it. @param {any} ctx @param {import('../../kiko/kiko.js').Scope} initial */
export async function kikoScreen(ctx, initial) {
  const { keeps, ai, router } = ctx;
  let scope = initial;
  const threads = (ctx.kikoThreads ||= new Map());
  const keyOf = (s) => `${s.type}:${s.collectionId || (s.ids || []).join(',')}`;
  const thread = () => (threads.get(keyOf(scope)) || threads.set(keyOf(scope), []).get(keyOf(scope)));
  const el = h('div', { class: 'kiko' });
  let busy = false; let ctl = null;

  async function draw() {
    const n = (await keepsInScope(keeps, scope)).length;
    const msgs = h('div', { class: 'msgs', 'aria-live': 'polite' });
    if (!ai.ready()) fill(msgs, h('div', { class: 'empty' }, h('div', { class: 'h2', text: 'Kiko needs an AI key' }), h('div', { text: 'Connect a provider to ask questions about your Keeps. Saving and searching work without one.' }), h('button', { class: 'btn small', style: { marginTop: '16px' }, text: 'Connect AI', onClick: () => router.go('/settings/ai') })));
    else if (!thread().length) fill(msgs, h('div', { class: 'empty' }, h('div', { class: 'h2', text: scope.type === 'keep' ? 'Ask about this Keep' : 'Ask about your Keeps' }), h('div', { text: n ? 'Kiko answers from what you saved, and says when it is using its own knowledge.' : 'Nothing is in this scope yet.' }),
      n ? h('div', { class: 'sugg' }, SUGGEST[scope.type].map((s) => h('button', { class: 'chip', text: s, onClick: () => send(s) }))) : null));
    else fill(msgs, thread().map(bubble));
    const input = h('textarea', { class: 'field', rows: 1, placeholder: scope.type === 'trove' ? 'Ask your Trove' : 'Ask Kiko', 'aria-label': 'Message', disabled: !ai.ready() });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } });
    const go = () => { const v = input.value.trim(); if (v) { input.value = ''; send(v); } };
    fill(el,
      h('div', { class: 'top' }, h('h1', { class: 'title', text: 'Kiko' }), h('button', { class: 'iconbtn', 'aria-label': 'Model', onClick: modelMenu }, icon('spark', 20))),
      h('button', { class: 'scope', 'aria-label': `Scope: ${scopeLabel(scope, n)}. Change`, onClick: pickScope }, icon(scope.type === 'trove' ? 'trove' : scope.type === 'collection' ? 'collections' : 'file', 16), h('span', { text: scopeLabel(scope, n) }), h('span', { class: 'lbl', text: 'Change' })),
      msgs,
      h('div', { class: 'composer' }, input, h('button', { class: 'iconbtn send', 'aria-label': busy ? 'Stop' : 'Send', disabled: !ai.ready(), onClick: () => (busy ? ctl.abort() : go()) }, icon(busy ? 'close' : 'send', 20))));
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function send(text) {
    if (busy) return;
    const t = thread(); const history = t.flatMap((m) => (m.role === 'user' ? [{ role: 'user', content: m.text }] : [{ role: 'assistant', content: m.parts.map((p) => p.text).join('\n') }]));
    t.push({ role: 'user', text }); busy = true; ctl = new AbortController(); t.push({ role: 'wait' }); await draw();
    try { const r = await ask({ ai, keeps }, { scope, question: text, history, signal: ctl.signal }); t.pop(); t.push({ role: 'assistant', ...r }); }
    catch (e) { t.pop(); if (e && e.name !== 'AbortError') t.push({ role: 'error', text: ctx.errorText(e) }); }
    busy = false; await draw();
  }

  function bubble(m) {
    if (m.role === 'user') return h('div', { class: 'msg me', text: m.text });
    if (m.role === 'wait') return h('div', { class: 'msg kiko-msg wait' }, h('span', { class: 'lbl', text: 'Kiko is reading your Keeps' }));
    if (m.role === 'error') return h('div', { class: 'msg kiko-msg err', text: m.text });
    return h('div', { class: 'msg kiko-msg' },
      m.noEvidence ? h('div', { class: 'notice', style: { margin: '0 0 12px' }, text: 'Nothing in this scope matched the question.' }) : m.insufficient ? h('div', { class: 'notice', style: { margin: '0 0 12px' }, text: 'Your Keeps here do not fully cover this.' }) : null,
      m.parts.map((p) => h('div', { class: 'part' }, h('span', { class: 'tag ' + p.source, text: LABEL[p.source] }), h('p', { text: p.text }),
        p.flagged ? h('div', { class: 'warn', text: 'Check this against the Keep. A quote could not be matched.' }) : null,
        p.cites.length ? h('div', { class: 'cites' }, p.cites.map((c) => h('button', { class: 'chip cite' + (c.verified ? '' : ' un'), onClick: () => router.go(`/keep/${c.keepId}`) }, icon(c.verified ? 'link' : 'warn', 14), `${c.title.slice(0, 28)}${c.loc ? `, ${c.loc}` : ''}`))) : null)),
      h('div', { class: 'lbl', style: { marginTop: '8px' }, text: `Sent ${m.sent} ${m.sent === 1 ? 'passage' : 'passages'} to ${PROVIDERS[m.provider]?.name || m.provider}` }),
      h('div', { class: 'row-btns', style: { marginTop: '8px' } }, h('button', { class: 'chip', onClick: () => saveAs(m) }, icon('download', 16), 'Save as Creation'), h('button', { class: 'chip', onClick: async () => { try { await navigator.clipboard.writeText(m.parts.map((p) => p.text).join('\n\n')); toast('Copied'); } catch (e) { toast('Could not copy'); } } }, icon('copy', 16), 'Copy')));
  }

  function saveAs(m) {
    menu('Save as', CREATION_TYPES.map((t) => ({ label: t.label, icon: 'note', run: async () => {
      const c = await ctx.creations.add({ type: t.id, label: t.label, title: `${t.label}: ${m.parts[0].text.slice(0, 50)}`, body: m.parts.map((p) => p.text).join('\n\n'), sources: [...new Set(m.parts.flatMap((p) => p.cites.map((x) => x.keepId)))] });
      toast('Saved to Creations', { action: 'Open', onAction: () => router.go(`/creation/${c.id}`) });
    } })));
  }

  async function pickScope() {
    const cs = await keeps.collections(); const s = sheet({ title: 'Ask about' });
    const opt = (label, ic, sc) => h('button', { class: 'menu-item', onClick: () => { scope = sc; s.close(); draw(); } }, icon(ic, 20), h('span', { text: label }));
    fill(s.body, h('div', { class: 'menu' }, opt('Whole Trove', 'trove', { type: 'trove', label: 'Trove' }), scope.type === 'keep' || scope.type === 'keeps' ? opt(scopeLabel(scope, 0), 'file', scope) : null, ...cs.map((c) => opt(`Collection: ${c.name}`, 'collections', { type: 'collection', collectionId: c.id, label: c.name }))));
  }

  function modelMenu() {
    const on = ai.connected();
    if (!on.length) return router.go('/settings/ai');
    menu('Model', [...on.map((id) => ({ label: `${PROVIDERS[id].name}, ${ai.config.providers[id].model}${ai.config.active === id ? ' (in use)' : ''}`, icon: ai.config.active === id ? 'check' : 'spark', run: async () => { await ai.setActive(id); toast(`Using ${PROVIDERS[id].name}`); } })), { label: 'Connections and keys', icon: 'key', run: () => router.go('/settings/ai') }]);
  }
  await draw();
  return el;
}
