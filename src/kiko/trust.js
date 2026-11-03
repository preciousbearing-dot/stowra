import { parseJsonLoose } from '../ai/json.js';

export const RULES = `You are Kiko, the companion inside Stowra, a private library of things the user saved.
Rules you must follow:
1. Context passages are numbered [1], [2], and so on. They are the only content from the user's Keeps you may use.
2. Never invent a Keep, a title, a quote, a timestamp or a page. Never claim to have read something that is not in the passages.
3. Write your answer as JSON: {"insufficient": boolean, "parts": [{"source": "keeps" | "general", "text": string, "cites": [{"ref": number, "quote": string}]}]}.
4. A part with source "keeps" must cite at least one passage, and each quote must be copied exactly from that passage, 200 characters or fewer.
5. Anything from your own general knowledge goes in a separate part with source "general" and no cites.
6. If the passages do not contain enough to answer, set "insufficient" to true and say plainly what is missing. Do not guess.
7. A passage marked (uploader description) is text the uploader wrote about a video or page. It is NOT what was said in it. Never present it as the content of the video. When only a description exists for a video, say plainly that no transcript was kept and that the answer comes from the description only.
8. Plain, direct language. No dashes as punctuation. No emoji.`;

const norm = (s) => String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();

/**
 * Check what the model said against what it was given. Quotes that are not in the passage are flagged, citations to passages that do not exist are dropped,
 * and a "from your Keeps" part with nothing behind it is shown as unsupported instead of trusted.
 * @param {string} raw model output @param {{id: number, keepId: string, title: string, loc: string, text: string}[]} passages @param {string[]} titles titles of Keeps in scope
 */
export function verify(raw, passages, titles = []) {
  const j = parseJsonLoose(raw);
  const byId = new Map(passages.map((p) => [p.id, p]));
  if (!j || !Array.isArray(j.parts)) {
    const t = String(raw || '').trim();
    // Cut-off or fenced JSON must never reach the screen as code. Pull out the readable text values instead.
    if (/^```|^\s*[{\[]/.test(t)) {
      const texts = [...t.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/g)].map((m) => { try { return JSON.parse(`"${m[1]}"`); } catch (e) { return m[1]; } }).filter(Boolean);
      return { insufficient: false, formatOk: false, cutOff: true, parts: [{ source: 'unsupported', text: texts.length ? `${texts.join('\n\n')}\n\n(This answer was cut off. Ask again for the full answer.)` : 'Kiko\'s answer was cut off. Ask again.', cites: [] }] };
    }
    return { insufficient: false, formatOk: false, parts: [{ source: 'general', text: t, cites: [] }] };
  }
  const parts = [];
  for (const part of j.parts) {
    if (!part || typeof part.text !== 'string' || !part.text.trim()) continue;
    let source = part.source === 'keeps' ? 'keeps' : 'general';
    const cites = [];
    for (const c of Array.isArray(part.cites) ? part.cites : []) {
      const p = byId.get(Number(c && c.ref)); if (!p) continue;
      const quote = String(c.quote || '').trim();
      cites.push({ keepId: p.keepId, title: p.title, loc: p.loc, quote, verified: quote.length > 0 && norm(p.text).includes(norm(quote)) });
    }
    let flagged = false;
    if (source === 'keeps') {
      if (!cites.length) { source = 'unsupported'; } else if (!cites.some((c) => c.verified)) flagged = true;
      for (const m of part.text.matchAll(/(?:titled|called|named)\s+["']([^"']{4,})["']/gi)) if (!titles.some((t) => norm(t).includes(norm(m[1])))) flagged = true;
    }
    parts.push({ source, text: part.text.trim(), cites, flagged });
  }
  if (!parts.length) parts.push({ source: 'general', text: 'Kiko did not produce an answer. Try asking again.', cites: [] });
  return { insufficient: Boolean(j.insufficient), formatOk: true, parts };
}
