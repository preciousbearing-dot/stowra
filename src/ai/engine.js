import { PROVIDERS, chatModels, pickModels } from './providers.js';
import { secure } from '../platform/native.js';
import { NetworkError, ProviderError, UserError } from '../core/errors.js';
import { parseJsonLoose } from './json.js';

const MAX_TEXT = 14000;

/**
 * The AI connection. Keys live in secure storage (Android Keystore on the phone), never in the library or a backup.
 * Only the text of the Keep being worked on is ever sent. Images go only on a clear tap, through sendImage.
 * @param {{repo: any, keeps: any, fetchImpl?: typeof fetch}} o
 */
export function createAi({ repo, keeps, fetchImpl }) {
  const doFetch = (...a) => (fetchImpl || fetch)(...a);
  /** @type {{active: string, providers: Record<string, {model: string, base: string, models: string[], ok: boolean}>}} */
  let cfg = { active: '', providers: {} };
  const keys = {};

  const prov = (id) => (cfg.providers[id] ||= { model: PROVIDERS[id]?.model || '', base: '', models: [], ok: false });
  const baseOf = (id) => (prov(id).base || PROVIDERS[id].base || '').replace(/\/$/, '');
  const save = () => repo.prefs.write('ai', cfg);

  async function init() {
    cfg = { active: '', providers: {}, ...(await repo.prefs.read('ai', {})) };
    for (const id of Object.keys(cfg.providers)) keys[id] = (await secure.get(`key:${id}`)) || '';
  }

  const connected = () => Object.keys(cfg.providers).filter((id) => cfg.providers[id].ok && keys[id]);
  const ready = () => connected().length > 0;

  async function call(id, path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (keys[id]) headers.Authorization = `Bearer ${keys[id]}`;
    let r;
    try { r = await doFetch(baseOf(id) + path, { ...opts, headers }); } catch (e) { if (e && e.name === 'AbortError') throw e; throw new NetworkError(`Could not reach ${PROVIDERS[id].name}.`, { code: 'network' }); }
    return r;
  }

  async function loadModels(id) {
    const r = await call(id, '/models');
    if (!r.ok) throw new ProviderError(`HTTP ${r.status}`, { code: String(r.status) });
    const j = await r.json();
    const ids = (j.data || j.models || []).map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean);
    prov(id).models = chatModels(id, ids);
    return prov(id).models;
  }

  /**
   * Check a key with a real tiny request. Resolves {ok, message, model}. Saves the key only if it works (or is merely rate limited).
   * @param {string} id @param {{key: string, model?: string, base?: string}} input
   */
  async function connect(id, input) {
    const key = String(input.key || '').trim();
    if (!key) return { ok: false, message: 'Paste your key first. Tap Paste, or press and hold in the box and choose Paste.' };
    if (/^https?:\/\//i.test(key)) return { ok: false, message: 'That is a web link, not a key. Open the key page, create a key there, and copy the long key it shows.' };
    if (/\s/.test(key)) return { ok: false, message: 'The key has a space or line break in it. Copy only the key itself, then paste again.' };
    if (id === 'custom' && (!input.base || !input.model)) return { ok: false, message: 'A custom provider needs an address, a key and a model name.' };
    const prev = { p: { ...prov(id) }, k: keys[id] };
    keys[id] = key; if (input.base != null) prov(id).base = input.base.trim();
    if (input.model) prov(id).model = input.model.trim();
    try { await loadModels(id); } catch (e) { /* the list is a bonus; the test decides */ }
    const tries = id === 'custom' ? [prov(id).model] : pickModels(id, prov(id).models, prov(id).model);
    let last = 'Could not connect.';
    for (const m of tries) {
      try {
        const r = await call(id, '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_tokens: 24, stream: false }) });
        if (r.ok || r.status === 429) { prov(id).model = m; prov(id).ok = true; if (!cfg.active || !connected().includes(cfg.active)) cfg.active = id; await secure.set(`key:${id}`, key); await save(); return { ok: true, model: m, message: r.ok ? `Connected. Kiko can now use ${m}.` : 'Your key works. This model is busy right now, so pick another model if answers fail.' }; }
        const body = (await r.text().catch(() => '')).slice(0, 200);
        if (r.status === 401 || r.status === 403 || (r.status === 400 && /api key|key not valid|invalid.*key/i.test(body))) { last = 'The provider refused this key. Copy it again from the provider page with nothing before or after it. If it still fails, create a fresh key.'; break; }
        last = `The provider answered with an error (${r.status}).`;
      } catch (e) { last = `Could not reach ${PROVIDERS[id].name}. Check your internet connection and try again.`; if (!navigator.onLine) break; }
    }
    keys[id] = prev.k; cfg.providers[id] = prev.p;
    return { ok: false, message: last };
  }

  async function disconnect(id) { await secure.delete(`key:${id}`); delete keys[id]; delete cfg.providers[id]; if (cfg.active === id) cfg.active = connected()[0] || ''; await save(); }
  async function setActive(id) { if (connected().includes(id)) { cfg.active = id; await save(); } }
  async function setModel(id, model) { prov(id).model = model; await save(); }

  /**
   * One chat request. Falls back to the next connected provider when the first is busy or down.
   * @param {{system?: string, messages: {role: string, content: any}[], json?: boolean, max?: number, signal?: AbortSignal, provider?: string}} o
   * @returns {Promise<{text: string, provider: string, model: string}>}
   */
  async function chat(o) {
    const order = [o.provider || cfg.active, ...connected()].filter((v, i, a) => v && a.indexOf(v) === i && connected().includes(v));
    if (!order.length) throw new UserError('Connect an AI provider in Settings first.', { code: 'no_ai' });
    let err;
    for (const id of order) {
      const model = prov(id).model;
      const messages = (o.system ? [{ role: 'system', content: o.system }] : []).concat(o.messages);
      try {
        const body = { model, messages, stream: false, max_tokens: o.max || 1500 };
        if (o.json && id !== 'gemini') body.response_format = { type: 'json_object' };
        const r = await call(id, '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: o.signal });
        if (r.ok) { const j = await r.json(); const text = j.choices?.[0]?.message?.content; if (typeof text === 'string' && text.trim()) return { text: text.trim(), provider: id, model }; err = new ProviderError('The model sent an empty answer.', { code: 'empty' }); continue; }
        if (r.status === 401 || r.status === 403) { err = new ProviderError('Key refused.', { code: 'key' }); continue; }
        err = new ProviderError(`HTTP ${r.status}`, { code: String(r.status) });
      } catch (e) { if (e && e.name === 'AbortError') throw e; err = e; }
    }
    throw err || new ProviderError('No answer.');
  }

  /** Summary and key ideas for one Keep. Saves them on the Keep. */
  async function summarise(keepId) {
    const k = await keeps.get(keepId);
    if (!k) throw new UserError('That Keep is no longer here.');
    const src = [k.title && `Title: ${k.title}`, k.note && `Notes by the user: ${k.note}`, k.text && `Text:\n${k.text.slice(0, MAX_TEXT)}`].filter(Boolean).join('\n\n');
    if (src.length < 80) throw new UserError('There is not enough text to summarise yet.');
    const { text } = await chat({ json: true, max: 900, system: 'You summarise one saved item for its owner. Use only the text provided. Never add facts. Plain, direct language. No dashes as punctuation and no emoji. Reply as JSON: {"summary": "2 to 4 sentences", "points": ["3 to 6 short key ideas"]}.', messages: [{ role: 'user', content: src }] });
    const j = parseJsonLoose(text);
    if (!j || typeof j.summary !== 'string') throw new ProviderError('The summary came back in a shape Stowra could not read.', { code: 'shape' });
    await keeps.update(keepId, { summary: j.summary.trim(), points: (Array.isArray(j.points) ? j.points : []).map(String).slice(0, 8) });
  }

  return { init, ready, connected, connect, disconnect, setActive, setModel, loadModels, chat, summarise, get config() { return cfg; }, providers: PROVIDERS, hasKey: (id) => Boolean(keys[id]) };
}
