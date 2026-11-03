import { tokenize } from '../retrieval/search.js';
import { passagesOf } from './chunker.js';

/**
 * Pick the passages worth sending. Kiko never receives the whole Trove, only what matches the question inside the scope.
 * @param {any[]} keeps Keeps in scope @param {string} query @param {{budget?: number, max?: number}} [o]
 * @returns {{id: number, keepId: string, title: string, loc: string, text: string}[]}
 */
export function retrieve(keeps, query, o = {}) {
  const budget = o.budget || 7000; const max = o.max || 10;
  const q = tokenize(query);
  const all = keeps.flatMap(passagesOf);
  const single = keeps.length === 1;
  let scored = all.map((p) => {
    const toks = tokenize(p.text); const set = new Set(toks);
    let s = 0; for (const t of q) { if (set.has(t)) s += 2; else if (toks.some((x) => x.startsWith(t) && t.length > 2)) s += 1; }
    if (tokenize(p.title).some((t) => q.includes(t))) s += 1.5;
    return { p, s };
  });
  // Asking about one Keep with no matching words ("summarise this") still gets its opening passages.
  if (single || !q.length) { scored = scored.map((x, i) => ({ p: x.p, s: x.s + (single ? 0.01 * (all.length - i) : 0) })); } else scored = scored.filter((x) => x.s > 0);
  scored.sort((a, b) => b.s - a.s);
  const out = []; let used = 0;
  for (const { p } of scored) { if (out.length >= max || used + p.text.length > budget) continue; used += p.text.length; out.push(p); }
  return out.map((p, i) => ({ id: i + 1, keepId: p.keepId, title: p.title, loc: p.loc, kind: p.kind || '', text: p.text }));
}
