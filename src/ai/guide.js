import { parseJsonLoose } from './json.js';
import { UserError } from '../core/errors.js';
import { transcriptOf, splitChunks, once } from './study.js';
import { linksOf } from './links.js';

const CHUNK = 9000;
const MAX_CHUNKS = 8;

const RULES = `Follow only what the video says or shows. The video description and the text read off the screen are part of the video. If an exact command, setting, name or link was not said or shown, write "not stated in the video" instead of guessing it. Copy commands exactly as shown, never rewrite them. Plain, direct language. No dashes as punctuation and no emoji.`;
const SYS_PART = `You pull the do-it-yourself steps out of one part of a video transcript, so the owner can follow along later. ${RULES}
Reply as JSON: {"steps": [{"title": string, "detail": string, "command": string, "at": "MM:SS" or ""}]}
Only include real actions the viewer would do (install, run, click, type, paste, create, set). Skip talk that is not an action. "command" is only for text to type or paste, else "". "detail" is one or two sentences.`;
const SYS_FINAL = `You turn rough steps from a video into one clean guide the owner can follow while doing the work. ${RULES}
Merge repeated steps, put them in the order the video does them, and keep each step short and concrete.
Reply as JSON: {"goal": string, "requirements": [string], "steps": [{"title": string, "detail": string, "command": string, "at": "MM:SS" or ""}], "tips": [string]}
"goal" is one sentence on what you will have at the end. "requirements" are things needed first (accounts, tools, keys), only if the video says so.`;

const clean = (v) => String(v || '').replace(/[\u2013\u2014]/g, '-').trim();
const stepOf = (s) => ({ title: clean(s.title).slice(0, 140), detail: clean(s.detail).slice(0, 500), command: String(s.command || '').trim().slice(0, 600), at: /^\d\d:\d\d$/.test(s.at || '') ? s.at : '' });

/**
 * Write a follow-along guide from a video's words, its description and any text read off its screen.
 * Sends the text to the connected AI, so callers only run it from a clear tap.
 * @param {any} ai @param {any} k @param {{signal?: AbortSignal, onProgress?: (done: number, total: number) => void}} [o]
 */
export async function guideKeep(ai, k, o = {}) {
  const t = transcriptOf(k.text); const head = String(k.text || '').split('\n\nTranscript:')[0];
  const screen = ((k.meta && k.meta.screen) || []).map((f) => `[${String(Math.floor(f.atMs / 60000)).padStart(2, '0')}:${String(Math.floor(f.atMs / 1000) % 60).padStart(2, '0')}] ${f.text.replace(/\n+/g, ' | ')}`).join('\n').slice(0, 6000);
  if (t.length < 300 && head.length < 300) throw new UserError('There is not enough in this video yet to write a guide from. Get the transcript first.');
  let chunks = splitChunks(t.length >= 300 ? t : head, CHUNK);
  if (chunks.length > MAX_CHUNKS) { const step = chunks.length / MAX_CHUNKS; chunks = Array.from({ length: MAX_CHUNKS }, (_, i) => chunks[Math.floor(i * step)]); }
  const context = `Video: ${k.title}\n${head ? `Description:\n${head.slice(0, 2500)}\n` : ''}${screen ? `\nText read off the screen:\n${screen}\n` : ''}`;
  const rough = [];
  for (let i = 0; i < chunks.length; i++) {
    o.onProgress && o.onProgress(i, chunks.length + 1);
    const { text } = await once(ai, { json: true, max: 1600, signal: o.signal, system: SYS_PART, messages: [{ role: 'user', content: `${context}\nPart ${i + 1} of ${chunks.length} of what is said:\n\n${chunks[i]}` }] });
    const j = parseJsonLoose(text);
    for (const s of (j && Array.isArray(j.steps) ? j.steps : [])) if (s && clean(s.title)) rough.push(stepOf(s));
  }
  if (!rough.length) throw new UserError('Kiko did not find steps to follow in this video. It may be explaining ideas more than showing how to do something. Try Study instead.');
  o.onProgress && o.onProgress(chunks.length, chunks.length + 1);
  let out = { goal: '', requirements: [], steps: rough.slice(0, 40), tips: [] };
  try {
    const { text } = await once(ai, { json: true, max: 2600, signal: o.signal, system: SYS_FINAL, messages: [{ role: 'user', content: `Video: ${k.title}\n\nRough steps in the order found:\n${rough.map((s, i) => `${i + 1}. ${s.title}${s.at ? ` [${s.at}]` : ''}: ${s.detail}${s.command ? `\n   command: ${s.command}` : ''}`).join('\n')}` }] });
    const j = parseJsonLoose(text);
    if (j && Array.isArray(j.steps) && j.steps.length) out = { goal: clean(j.goal), requirements: (Array.isArray(j.requirements) ? j.requirements : []).map(clean).filter(Boolean).slice(0, 10), steps: j.steps.filter((s) => s && clean(s.title)).map(stepOf).slice(0, 40), tips: (Array.isArray(j.tips) ? j.tips : []).map(clean).filter(Boolean).slice(0, 6) };
  } catch (e) { if (e && e.name === 'AbortError') throw e; }
  o.onProgress && o.onProgress(chunks.length + 1, chunks.length + 1);
  return { ...out, links: linksOf(k).repos.map((r) => ({ label: `${r.owner}/${r.repo}`, url: r.url })), done: [], at: Date.now() };
}
