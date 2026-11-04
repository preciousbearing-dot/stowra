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

  const stamp = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal && signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Cancelled', 'AbortError')); }, { once: true }); });
  const b64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });

  /** Group timed pieces into paragraphs of about 30 seconds, each starting with [MM:SS]. @param {{start: number, text: string}[]} segs */
  function paragraphs(segs) {
    const out = []; let cur = ''; let start = 0;
    for (const sg of segs) { const t = String(sg.text || '').trim(); if (!t) continue; if (!cur || sg.start - start > 30) { if (cur) out.push(cur.trim()); start = sg.start || 0; cur = `[${stamp(start)}] `; } cur += t + ' '; }
    if (cur.trim()) out.push(cur.trim());
    return out.join('\n');
  }

  /** Whisper sometimes invents words over silence. A piece the model itself marks as very probably silent and unsure is dropped. */
  const keepSeg = (sg) => !(sg.no_speech_prob > 0.6 && sg.avg_logprob < -0.8) && !(sg.compression_ratio > 2.6);

  async function viaGroq(blob, name, o) {
    const fd = new FormData(); fd.append('file', blob, name || 'audio.webm'); fd.append('model', o.accurate ? 'whisper-large-v3' : 'whisper-large-v3-turbo'); fd.append('response_format', 'verbose_json'); fd.append('temperature', '0');
    if (o.language) fd.append('language', o.language);
    if (o.prompt) fd.append('prompt', String(o.prompt).slice(0, 700));
    let r;
    for (let n = 0; n < 3; n++) {
      r = await call('groq', '/audio/transcriptions', { method: 'POST', body: fd, signal: o.signal });
      if (r.status !== 429 && r.status < 500) break;
      if (n < 2) await sleep(2500 * (n + 1), o.signal);
    }
    if (r.status === 401 || r.status === 403) throw new ProviderError('Key refused.', { code: 'key' });
    if (r.status === 413) throw new UserError('This file is too big for Groq. Use a shorter recording.', { code: 'too_big' });
    if (r.status === 429) throw new ProviderError('Groq says you have used the free limit for now. Try again in a few minutes.', { code: '429' });
    if (!r.ok) throw new ProviderError(`Groq could not read the audio (HTTP ${r.status}).`, { code: String(r.status) });
    const j = await r.json(); const segs = (Array.isArray(j.segments) ? j.segments : []).filter(keepSeg);
    const text = segs.length ? paragraphs(segs) : (String(j.text || '').trim() && !(Array.isArray(j.segments) && j.segments.length) ? `[00:00] ${String(j.text).trim()}` : '');
    return { text, provider: 'groq', model: o.accurate ? 'whisper-large-v3' : 'whisper-large-v3-turbo', language: j.language || o.language || '' };
  }

  async function viaGemini(blob, name, o) {
    if (blob.size > 18 * 1024 * 1024) throw new UserError('This audio is too big for Gemini to take in one go (18 MB). Add a free Groq key, or record a shorter note.', { code: 'too_big' });
    const model = prov('gemini').model || 'gemini-2.5-flash';
    const mime = (blob.type || 'audio/webm').split(';')[0];
    const ask = `Transcribe this audio exactly as spoken. Do not summarise, translate or add anything. ${o.language ? `The language is ${o.language}. ` : ''}${o.prompt ? `These names and terms may appear, so spell them this way when you hear them: ${String(o.prompt).slice(0, 600)}. ` : ''}Add proper punctuation and paragraphs. Start a new paragraph about every 30 seconds with its start time in square brackets like [00:00] or [01:30]. If there is no speech, reply with nothing.`;
    const body = { contents: [{ parts: [{ text: ask }, { inline_data: { mime_type: mime, data: await b64(blob) } }] }], generationConfig: { temperature: 0, maxOutputTokens: 16000 } };
    let r;
    for (let n = 0; n < 3; n++) {
      try { r = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keys.gemini }, body: JSON.stringify(body), signal: o.signal }); } catch (e) { if (e && e.name === 'AbortError') throw e; throw new NetworkError('Could not reach Google Gemini.', { code: 'network' }); }
      if (r.status !== 429 && r.status < 500) break;
      if (n < 2) await sleep(3000 * (n + 1), o.signal);
    }
    if (r.status === 401 || r.status === 403) throw new ProviderError('Key refused.', { code: 'key' });
    if (r.status === 429) throw new ProviderError('Gemini says you have used the free limit for now. Try again in a few minutes.', { code: '429' });
    if (!r.ok) throw new ProviderError(`Gemini could not read the audio (HTTP ${r.status}).`, { code: String(r.status) });
    const j = await r.json(); const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
    return { text, provider: 'gemini', model, language: o.language || '' };
  }

  /**
   * Turn speech in an audio or video file into a timestamped transcript. Groq Whisper first (accurate: whisper-large-v3 when asked), Gemini as the fallback.
   * The file goes to the provider only because the person tapped for it.
   * @param {Blob} blob @param {string} name @param {{signal?: AbortSignal, accurate?: boolean, language?: string, prompt?: string}} [o]
   * @returns {Promise<string>} @see transcribeFull for the provider and model used
   */
  async function transcribe(blob, name, o = {}) { return (await transcribeFull(blob, name, o)).text; }
  async function transcribeFull(blob, name, o = {}) {
    const ok = connected();
    if (ok.includes('groq')) {
      if (blob.size > 25 * 1024 * 1024) throw new UserError('This file is over 25 MB, which is the most Groq reads at once. Trim the recording or record a shorter one.', { code: 'too_big' });
      return viaGroq(blob, name, o);
    }
    if (ok.includes('gemini')) return viaGemini(blob, name, o);
    throw new UserError('Reading speech needs a free Groq key (best accuracy) or a Gemini key. Add one in You, then AI connection.', { code: 'no_groq' });
  }

  const SYS_IMG = 'You read one picture for its owner. Describe what it shows in 2 to 4 plain sentences, then copy every piece of readable text in it exactly, keeping line breaks. Never add facts that are not visible. Reply as JSON: {"description": string, "text": string, "kind": "screenshot"|"photo"|"document"|"chart"|"other"}';
  /**
   * Read a picture with a vision-capable model. Sends the picture to the provider, so the screen only calls it from a clear tap.
   * @param {string} dataUrl a JPEG data URL @param {{question?: string, signal?: AbortSignal}} [o]
   */
  async function readImage(dataUrl, o = {}) {
    const ok = connected();
    const id = ['gemini', 'openai', 'openrouter'].find((x) => ok.includes(x));
    if (!id) throw new UserError('Reading a picture with AI needs a Gemini or OpenAI key. Add one in You, then AI connection. The text in a picture is also read on the phone without AI.', { code: 'no_vision' });
    const r = await call(id, '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: o.signal, body: JSON.stringify({ model: prov(id).model, temperature: 0, max_tokens: 2000, messages: [{ role: 'system', content: SYS_IMG }, { role: 'user', content: [{ type: 'text', text: o.question || 'Read this picture.' }, { type: 'image_url', image_url: { url: dataUrl } }] }] }) });
    if (r.status === 401 || r.status === 403) throw new ProviderError('Key refused.', { code: 'key' });
    if (r.status === 429) throw new ProviderError(`${PROVIDERS[id].name} says you have used the free limit for now. Try again in a few minutes.`, { code: '429' });
    if (!r.ok) throw new ProviderError(`${PROVIDERS[id].name} could not read the picture (HTTP ${r.status}).`, { code: String(r.status) });
    const j = await r.json(); const raw = String(j.choices?.[0]?.message?.content || '').trim();
    const p = parseJsonLoose(raw);
    return { description: String((p && p.description) || (p ? '' : raw)), text: String((p && p.text) || ''), kind: String((p && p.kind) || 'other'), provider: id };
  }

  return { init, ready, connected, connect, disconnect, setActive, setModel, transcribe, transcribeFull, readImage, loadModels, chat, summarise, get config() { return cfg; }, providers: PROVIDERS, hasKey: (id) => Boolean(keys[id]) };
}
