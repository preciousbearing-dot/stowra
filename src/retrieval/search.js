/** Keyword search over Keeps. Works offline with no AI. Natural-language questions are rewritten by Kiko before they get here. */
const W = { title: 6, tags: 5, why: 2, note: 4, summary: 3, points: 2, source: 1, url: 1, text: 1 };
const STOP = new Set('the a an and or of to in on for with is are was were be it this that my me i about what which who how do does did'.split(' '));

/** @param {string} s @returns {string[]} */
export function tokenize(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));
}

/** @param {any} k @returns {Record<string, string[]>} */
function fields(k) {
  return { title: tokenize(k.title), tags: tokenize((k.tags || []).join(' ')), why: tokenize(k.why), note: tokenize(k.note), summary: tokenize(k.summary), points: tokenize((k.points || []).join(' ')), source: tokenize(k.source), url: tokenize(k.url), text: tokenize((k.text || '').slice(0, 60000)) };
}

/** Build an index. Call again when Keeps change. @param {any[]} keeps */
export function buildIndex(keeps) {
  return keeps.map((k) => ({ k, f: fields(k) }));
}

/**
 * @param {ReturnType<typeof buildIndex>} index
 * @param {string} query
 * @returns {{keep: any, score: number}[]} best first. Every query word must match (prefix match allowed); if nothing does, any word may.
 */
export function search(index, query) {
  const q = tokenize(query);
  if (!q.length) return [];
  const score = (e, need) => {
    let total = 0; let hit = 0;
    for (const t of q) {
      let best = 0;
      for (const [f, toks] of Object.entries(e.f)) {
        for (const tok of toks) {
          if (tok === t) best = Math.max(best, W[f] * 2);
          else if (tok.startsWith(t) && t.length >= 2) best = Math.max(best, W[f]);
        }
      }
      if (best) hit++;
      total += best;
    }
    return hit >= need ? total : 0;
  };
  let out = index.map((e) => ({ keep: e.k, score: score(e, q.length) })).filter((r) => r.score > 0);
  if (!out.length && q.length > 1) out = index.map((e) => ({ keep: e.k, score: score(e, 1) })).filter((r) => r.score > 0);
  return out.sort((a, b) => b.score - a.score || b.keep.createdAt - a.keep.createdAt);
}

/** A short passage around the first match, for result rows. @param {any} keep @param {string} query */
export function snippet(keep, query) {
  const q = tokenize(query);
  for (const src of [keep.note, keep.summary, keep.text]) {
    const s = String(src || '');
    const low = s.toLowerCase();
    for (const t of q) {
      const i = low.indexOf(t);
      if (i >= 0) { const a = Math.max(0, i - 40); return (a ? '...' : '') + s.slice(a, i + 90).replace(/\s+/g, ' ').trim() + '...'; }
    }
  }
  return '';
}
