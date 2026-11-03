import { parseJsonLoose } from './json.js';

export const KINDS = ['educational', 'entertainment', 'inspirational', 'creative', 'news', 'reference', 'other'];
const SYS = `You look at one saved item and work out what kind it is and what its owner probably wants from it. Use only the text given. Never add facts. Plain, direct language. No dashes as punctuation. No emoji.
Reply as JSON: {"kind": "educational"|"entertainment"|"inspirational"|"creative"|"news"|"reference"|"other", "confidence": number from 0 to 1, "overview": string of 2 to 3 sentences, "actions": [string], "studyable": boolean}
"creative" means an edit, design or technique the owner may want to recreate. "studyable" is true only when it teaches something step by step. "actions" holds up to 3 short suggestions such as "Get the key steps" or "Break down how the edit was made".`;

/** Decide what a Keep is and what to offer. Returns null when there is too little text. @param {any} ai @param {any} k */
export async function analyseKeep(ai, k) {
  const src = [k.title && `Title: ${k.title}`, k.note && `Owner's note: ${k.note}`, k.text && k.text.slice(0, 6000)].filter(Boolean).join('\n\n');
  if (src.length < 200) return null;
  const { text } = await ai.chat({ json: true, max: 500, system: SYS, messages: [{ role: 'user', content: src }] });
  const j = parseJsonLoose(text); if (!j) return null;
  const conf = Math.min(1, Math.max(0, Number(j.confidence) || 0));
  return {
    kind: KINDS.includes(j.kind) ? j.kind : 'other', confidence: conf, overview: String(j.overview || '').trim(),
    actions: (Array.isArray(j.actions) ? j.actions : []).map(String).filter(Boolean).slice(0, 3),
    studyable: Boolean(j.studyable) && Boolean(k.meta && k.meta.hasTranscript), at: Date.now(),
  };
}
