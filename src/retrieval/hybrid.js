/** Reciprocal Rank Fusion: merge ranked lists without needing their scores to be comparable. @param {any[][]} lists ranked best first, items need .id @param {number} [k] */
export function rrf(lists, k = 60) {
  const m = new Map();
  lists.forEach((list, li) => list.forEach((it, rank) => {
    const e = m.get(it.id) || { id: it.id, score: 0, from: new Set() };
    e.score += 1 / (k + rank + 1); e.from.add(li); m.set(it.id, e);
  }));
  return [...m.values()].sort((a, b) => b.score - a.score);
}

/** @param {number[]} a @param {number[]} b unit vectors */
export function cosine(a, b) { let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; }

/** Greedy grouping of unit vectors. Returns arrays of ids, biggest first. @param {{id: string, v: number[]}[]} items @param {number} [min] similarity to join a group */
export function clusterVectors(items, min = 0.72) {
  const groups = [];
  for (const it of items) {
    let best = null; let bs = 0;
    for (const g of groups) { const s = cosine(it.v, g.c); if (s > bs) { bs = s; best = g; } }
    if (best && bs >= min) { best.ids.push(it.id); const n = best.ids.length; best.c = best.c.map((x, i) => (x * (n - 1) + it.v[i]) / n); }
    else groups.push({ ids: [it.id], c: it.v.slice() });
  }
  return groups.map((g) => g.ids).sort((a, b) => b.length - a.length);
}
