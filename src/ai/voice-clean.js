import { parseJsonLoose } from './json.js';

const CHUNK = 5500;
const words = (t) => String(t).toLowerCase().match(/[a-z0-9À-ɏ']+/g) || [];

/**
 * Names and terms that help a speech model spell what it hears: the person's own tags, Collections, recent Keep titles, and the terms they typed.
 * Whisper reads about 220 tokens of this, so the order puts the most useful first.
 * @param {any} repo @param {string} [typed]
 */
export async function vocabularyHint(repo, typed = '') {
  const out = new Set(); const add = (x) => { const v = String(x || '').trim(); if (v && v.length < 60) out.add(v); };
  typed.split(/[,\n;]+/).forEach(add);
  try { String(await repo.prefs.read('voiceTerms', '')).split(/[,\n;]+/).forEach(add); } catch (e) { /* none yet */ }
  try { (await repo.collections.all()).forEach((c) => add(c.name)); } catch (e) { /* none */ }
  let keeps = []; try { keeps = (await repo.keeps.all()).filter((k) => !k.deletedAt); } catch (e) { /* none */ }
  const tagCount = new Map(); keeps.forEach((k) => (k.tags || []).forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  [...tagCount].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t]) => add(t));
  keeps.sort((a, b) => b.createdAt - a.createdAt).slice(0, 25).forEach((k) => add(k.title && k.title.length < 50 ? k.title : ''));
  let s = ''; for (const w of out) { if ((s + w).length > 640) break; s += (s ? ', ' : '') + w; }
  return s;
}

const SYS = `You tidy a speech transcript written by a speech-to-text model. Rules:
1. Keep every idea and almost every word exactly as spoken. Do not summarise, shorten, reorder or add anything.
2. Fix punctuation, capital letters, sentence breaks and obvious mis-hearings of names or terms, using the term list when it helps.
3. Remove only pure filler such as "um", "uh" and stammered repeats.
4. Keep every [MM:SS] marker at the start of its paragraph, unchanged.
5. Keep the speaker's language. Do not translate.
6. Plain language. No emoji.
Reply as JSON: {"clean": string}`;
const SYS_TITLE = `You name and sum up a voice note from its transcript. Reply as JSON: {"title": string of at most 7 words, "summary": string of 1 to 2 plain sentences, "todo": [string]}. "todo" lists tasks or promises the speaker actually stated, at most 5, or an empty list. Use only the transcript. No dashes as punctuation, no emoji.`;

/** Split at paragraph lines so each piece keeps its time markers. @param {string} t */
export function pieces(t) {
  const out = []; let cur = '';
  for (const line of String(t).split('\n')) { if (cur && cur.length + line.length > CHUNK) { out.push(cur); cur = ''; } cur += (cur ? '\n' : '') + line; }
  if (cur.trim()) out.push(cur);
  return out;
}

/** A cleaned piece is only trusted when it still says what the original said. @param {string} raw @param {string} clean @param {string} vocab */
export function faithful(raw, clean, vocab = '') {
  const a = words(raw); const b = words(clean);
  if (!a.length || !b.length) return false;
  const ratio = b.length / a.length; if (ratio < 0.7 || ratio > 1.25) return false;
  const known = new Set([...a, ...words(vocab)]); const kept = b.filter((w) => known.has(w)).length / b.length;
  return kept >= 0.82;
}

/**
 * Tidy a raw transcript with the AI, piece by piece, then add a title, summary and any stated to-dos. A piece that drifts from the original is left as spoken.
 * @param {any} ai @param {string} raw @param {{vocab?: string, signal?: AbortSignal, onProgress?: (d: number, n: number) => void}} [o]
 */
export async function cleanTranscript(ai, raw, o = {}) {
  const ps = pieces(raw); const out = []; let changed = 0;
  for (let i = 0; i < ps.length; i++) {
    o.onProgress && o.onProgress(i, ps.length + 1);
    let clean = ps[i];
    try {
      const { text } = await ai.chat({ json: true, max: 3000, signal: o.signal, system: SYS, messages: [{ role: 'user', content: `${o.vocab ? `Terms that may appear: ${o.vocab}\n\n` : ''}Transcript:\n${ps[i]}` }] });
      const j = parseJsonLoose(text);
      if (j && typeof j.clean === 'string' && faithful(ps[i], j.clean, o.vocab)) { clean = j.clean.trim(); changed++; }
    } catch (e) { if (e && e.name === 'AbortError') throw e; }
    out.push(clean);
  }
  const text = out.join('\n');
  let meta = { title: '', summary: '', todo: [] };
  try {
    o.onProgress && o.onProgress(ps.length, ps.length + 1);
    const { text: t } = await ai.chat({ json: true, max: 500, signal: o.signal, system: SYS_TITLE, messages: [{ role: 'user', content: text.slice(0, 9000) }] });
    const j = parseJsonLoose(t);
    if (j) meta = { title: String(j.title || '').trim().slice(0, 80), summary: String(j.summary || '').trim(), todo: (Array.isArray(j.todo) ? j.todo : []).map(String).filter(Boolean).slice(0, 5) };
  } catch (e) { if (e && e.name === 'AbortError') throw e; }
  return { clean: text, cleaned: changed > 0, ...meta };
}
