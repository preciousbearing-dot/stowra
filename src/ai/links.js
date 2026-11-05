const RESERVED = new Set(['features', 'topics', 'about', 'pricing', 'login', 'signup', 'settings', 'sponsors', 'orgs', 'marketplace', 'collections', 'trending', 'explore', 'notifications', 'issues', 'pulls', 'search', 'apps', 'enterprise', 'customer-stories', 'readme', 'security', 'contact', 'site', 'new', 'join', 'users', 'organizations']);

/** @param {string} owner @param {string} repo */
function good(owner, repo) { return owner && repo && !RESERVED.has(owner.toLowerCase()) && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) && /^[A-Za-z0-9._-]{1,100}$/.test(repo) && repo !== '.' && repo !== '..'; }

/**
 * Repository links in a piece of text: written links, links with no https, and links spoken out loud ("github dot com slash owner slash repo").
 * @param {string} text @returns {{owner: string, repo: string, url: string}[]}
 */
export function findRepos(text) {
  const t = String(text || ''); const seen = new Map();
  const add = (owner, repo) => {
    repo = String(repo || '').replace(/[.,;:!?)\]}'"]+$/, '').replace(/\.git$/i, '');
    if (!good(owner, repo)) return; const key = `${owner}/${repo}`.toLowerCase();
    if (!seen.has(key)) seen.set(key, { owner, repo, url: `https://github.com/${owner}/${repo}` });
  };
  for (const m of t.matchAll(/(?:https?:\/\/)?(?:www\.)?github\.com[/\s]+([A-Za-z0-9-]+)[/\s]+([A-Za-z0-9._-]+)/gi)) add(m[1], m[2]);
  for (const m of t.matchAll(/github\s*(?:dot|\.)\s*com\s*(?:slash|\/)\s*([A-Za-z0-9-]+)\s*(?:slash|\/)\s*([A-Za-z0-9._-]+)/gi)) add(m[1], m[2]);
  for (const m of t.matchAll(/\bgit\s+clone\s+(?:https?:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)/gi)) add(m[1], m[2]);
  return [...seen.values()];
}

/** Other web links worth keeping (not social tracking redirects). @param {string} text @returns {string[]} */
export function findUrls(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) {
    const u = m[0].replace(/[.,;:!?]+$/, '');
    if (/github\.com\/[^/]+\/[^/]+/i.test(u) || /\/\/l\.instagram\.com|youtube\.com\/(?:watch|shorts)|youtu\.be\//i.test(u)) continue;
    out.add(u);
  }
  return [...out].slice(0, 12);
}

/**
 * Everything linkable in a Keep, with where each was found.
 * @param {any} k @returns {{repos: {owner: string, repo: string, url: string, where: string[]}[], urls: string[]}}
 */
export function linksOf(k) {
  const text = String(k.text || ''); const i = text.indexOf('Transcript:\n');
  const parts = [['description', i >= 0 ? text.slice(0, i) : text], ['transcript', i >= 0 ? text.slice(i) : ''], ['on screen', ((k.meta && k.meta.screen) || []).map((f) => f.text).join('\n')], ['note', k.note || '']];
  const map = new Map();
  for (const [where, src] of parts) for (const r of findRepos(src)) { const key = r.url.toLowerCase(); const e = map.get(key) || { ...r, where: [] }; if (!e.where.includes(where)) e.where.push(where); map.set(key, e); }
  const urls = findUrls(parts.map((p) => p[1]).join('\n'));
  return { repos: [...map.values()], urls };
}

/** Merge frames that show the same text, keep the first time, cap the total. @param {{atMs: number, text: string}[]} frames @returns {{atMs: number, text: string}[]} */
export function dedupeFrames(frames) {
  const out = []; let size = 0; const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const f of frames || []) {
    const t = String(f.text || '').trim(); if (t.length < 3) continue;
    const n = norm(t); if (out.some((o) => norm(o.text) === n || (n.length > 20 && norm(o.text).includes(n)))) continue;
    if (size + t.length > 20000) break; out.push({ atMs: f.atMs, text: t.slice(0, 1500) }); size += t.length;
  }
  return out;
}
