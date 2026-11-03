import { parseJsonLoose } from './json.js';
import { UserError } from '../core/errors.js';

const CHUNK = 7000;
const MAX_CHUNKS = 10;
const pause = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal && signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Cancelled', 'AbortError')); }, { once: true }); });

/** The spoken part of a Keep's text (after "Transcript:"), or all of it. @param {string} text */
export function transcriptOf(text) {
  const i = String(text || '').indexOf('Transcript:\n');
  return i >= 0 ? text.slice(i + 12) : String(text || '');
}

/** Cut a transcript into pieces at line ends so each piece starts with a time. @param {string} t @param {number} [size] */
export function splitChunks(t, size = CHUNK) {
  const out = []; let cur = '';
  for (const line of String(t).split('\n')) {
    if (cur && cur.length + line.length > size) { out.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + line;
    while (cur.length > size * 1.5) { out.push(cur.slice(0, size)); cur = cur.slice(size); }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const SYS_PART = `You turn one part of a video transcript into study lessons for its owner. Use only the transcript part given. Never add facts that are not in it. Plain, direct language. No dashes as punctuation. No emoji. No quizzes and no flashcards.
Reply as JSON: {"lessons": [{"title": string, "timestamp": "MM:SS" or "", "explanation": string, "keyPoints": [string], "example": string}]}
Make 1 to 4 lessons. "explanation" is 2 to 4 sentences. "example" may be empty if the speaker gave none.`;
const SYS_WRAP = `You write the frame around a set of study lessons. Reply as JSON: {"title": string, "goal": string, "recap": [string]}. "goal" is one sentence on what the learner will be able to do. "recap" is 3 to 6 short lines. Use only the lesson titles and points given. Plain language, no dashes as punctuation, no emoji.`;

async function once(ai, o, tries = 3) {
  let last;
  for (let n = 0; n < tries; n++) {
    try { return await ai.chat(o); } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      last = e; if (n < tries - 1) await pause([1500, 4000][n] || 4000, o.signal);
    }
  }
  throw last;
}

/**
 * Build structured lessons from a transcript, piece by piece, then a recap. No quizzes and no flashcards.
 * @param {any} ai @param {any} k @param {{signal?: AbortSignal, onProgress?: (done: number, total: number) => void}} [o]
 */
export async function studyKeep(ai, k, o = {}) {
  const t = transcriptOf(k.text);
  if (t.length < 400) throw new UserError('There is not enough spoken text to build lessons from.');
  let chunks = splitChunks(t);
  if (chunks.length > MAX_CHUNKS) { const step = chunks.length / MAX_CHUNKS; chunks = Array.from({ length: MAX_CHUNKS }, (_, i) => chunks[Math.floor(i * step)]); }
  const lessons = [];
  for (let i = 0; i < chunks.length; i++) {
    o.onProgress && o.onProgress(i, chunks.length + 1);
    const { text } = await once(ai, { json: true, max: 1400, signal: o.signal, system: SYS_PART, messages: [{ role: 'user', content: `Video: ${k.title}\nPart ${i + 1} of ${chunks.length}:\n\n${chunks[i]}` }] });
    const j = parseJsonLoose(text);
    for (const l of (j && Array.isArray(j.lessons) ? j.lessons : [])) {
      if (!l || typeof l.title !== 'string' || !l.title.trim()) continue;
      lessons.push({ title: l.title.trim(), timestamp: /^\d\d:\d\d$/.test(l.timestamp || '') ? l.timestamp : '', explanation: String(l.explanation || '').trim(), keyPoints: (Array.isArray(l.keyPoints) ? l.keyPoints : []).map(String).filter(Boolean).slice(0, 6), example: String(l.example || '').trim() });
    }
  }
  if (!lessons.length) throw new UserError('Kiko could not build lessons from this video. Try again, or ask Kiko a question about it instead.');
  o.onProgress && o.onProgress(chunks.length, chunks.length + 1);
  let frame = { title: k.title, goal: '', recap: [] };
  try {
    const { text } = await once(ai, { json: true, max: 600, signal: o.signal, system: SYS_WRAP, messages: [{ role: 'user', content: `Video: ${k.title}\n\nLessons:\n${lessons.map((l, i) => `${i + 1}. ${l.title}: ${l.keyPoints.join('; ')}`).join('\n')}` }] }, 2);
    const j = parseJsonLoose(text);
    if (j) frame = { title: String(j.title || k.title), goal: String(j.goal || ''), recap: (Array.isArray(j.recap) ? j.recap : []).map(String).filter(Boolean).slice(0, 6) };
  } catch (e) { if (e && e.name === 'AbortError') throw e; }
  o.onProgress && o.onProgress(chunks.length + 1, chunks.length + 1);
  return { ...frame, lessons, at: Date.now(), chunks: chunks.length };
}
