import { tokenize, buildIndex, search } from '../retrieval/search.js';

const DAY = 86400000;
const WHY_RANK = { 'To make something': 3, 'To try a tool': 3, 'To learn': 2, 'For ideas': 1 };

/** Keeps worth another look: older than a week, not opened lately, ones you meant to act on first. @param {any[]} keeps @param {number} [now] */
export function rediscoverPicks(keeps, now = Date.now(), n = 5) {
  const pool = keeps.filter((k) => !k.deletedAt && !k.archivedAt && now - k.createdAt > 7 * DAY && now - (k.openedAt || 0) > 3 * DAY);
  const score = (k) => (WHY_RANK[k.why] || 0) * 10 + Math.min(30, (now - k.createdAt) / DAY / 3) + (k.status === 'ready' ? 4 : 0) - (k.openedAt ? 6 : 0);
  return pool.sort((a, b) => score(b) - score(a)).slice(0, n);
}

/** Other Keeps that share words with this one's title and tags. No AI. @param {any} keep @param {any[]} all */
export function relatedTo(keep, all, n = 3) {
  const q = [...tokenize(keep.title), ...keep.tags.flatMap(tokenize), ...tokenize(keep.why)].slice(0, 12).join(' ');
  if (!q) return [];
  return search(buildIndex(all.filter((k) => k.id !== keep.id && !k.deletedAt)), q).filter((r) => r.score >= 4).slice(0, n).map((r) => r.keep);
}

/** A plain summary of the last seven days. @param {any[]} keeps */
export function weekly(keeps, now = Date.now()) {
  const week = keeps.filter((k) => !k.deletedAt && now - k.createdAt <= 7 * DAY);
  const by = {}; for (const k of week) if (k.why) by[k.why] = (by[k.why] || 0) + 1;
  return { week, count: week.length, unread: week.filter((k) => k.status === 'saved' || k.status === 'processing' || k.status === 'attention').length, byWhy: by, toTry: week.filter((k) => k.why === 'To try a tool' || k.why === 'To make something') };
}

/** Group suggestions with no AI: three or more Keeps sharing a tag. Metadata only. @param {any[]} keeps @param {Set<string>} [existing] names already used */
export function heuristicSpaces(keeps, existing = new Set()) {
  const m = new Map();
  for (const k of keeps) if (!k.deletedAt && !k.archivedAt) for (const t of k.tags) { if (!m.has(t)) m.set(t, []); m.get(t).push(k.id); }
  return [...m].filter(([t, ids]) => ids.length >= 3 && !existing.has(t.toLowerCase())).map(([t, ids]) => ({ name: t[0].toUpperCase() + t.slice(1), keepIds: ids, reason: `${ids.length} Keeps share the tag "${t}"` }));
}

/** Repos and tools waiting for the laptop. @param {any[]} keeps */
export function laptopItems(keeps) {
  return keeps.filter((k) => !k.deletedAt && !k.archivedAt && (k.kind === 'github' || k.tags.includes('laptop') || k.why === 'To try a tool'));
}

export const SCAN_WARNING = 'Before installing anything from a repo or skill you did not write: read its code and README, check who made it and its licence, and look for scripts that run at install time or reach out to the network. Do not run it with your real accounts or keys signed in.';

/** Markdown checklist to paste into Claude Code. @param {any[]} items */
export function taskList(items) {
  const lines = ['# Review these before installing', '', SCAN_WARNING, ''];
  for (const k of items) {
    lines.push(`- [ ] ${k.title}${k.url ? ` (${k.url})` : ''}`);
    lines.push('  - [ ] Read the README and the install steps');
    lines.push('  - [ ] Check the licence and who maintains it');
    lines.push('  - [ ] Look for install-time scripts and network calls');
    lines.push('  - [ ] Decide: install, try in a sandbox, or skip');
    if (k.why) lines.push(`  - Why it was saved: ${k.why}`);
  }
  return lines.join('\n');
}
