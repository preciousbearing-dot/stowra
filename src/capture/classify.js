/** Turn shared text into a link, a kind and a readable source name. No network. */
const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;
const TRACKING = /^(utm_|fbclid|gclid|igshid|si$|feature$|ref$|ref_src$|s$|t$)/i;

const SOURCES = [
  { kind: 'youtube', label: 'YouTube', re: /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/ },
  { kind: 'pinterest', label: 'Pinterest', re: /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/ },
  { kind: 'tiktok', label: 'TikTok', re: /(^|\.)tiktok\.com$/ },
  { kind: 'instagram', label: 'Instagram', re: /(^|\.)instagram\.com$/ },
  { kind: 'x', label: 'X', re: /(^|\.)(x\.com|twitter\.com)$/ },
  { kind: 'github', label: 'GitHub', re: /(^|\.)github\.com$/ },
  { kind: 'reddit', label: 'Reddit', re: /(^|\.)reddit\.com$/ },
  { kind: 'facebook', label: 'Facebook', re: /(^|\.)(facebook\.com|fb\.watch)$/ },
  { kind: 'linkedin', label: 'LinkedIn', re: /(^|\.)linkedin\.com$/ },
];

/** @param {string} text @returns {string} first web link in the text, or "" */
export function firstUrl(text) {
  const m = String(text || '').match(URL_RE);
  return m ? m[0].replace(/[.,;:!?]+$/, '') : '';
}

/** Split shared text into its link and the words around it. @param {string} text */
export function splitShare(text) {
  const t = String(text || '').trim();
  const url = firstUrl(t);
  const note = url ? t.replace(url, '').replace(/\s+/g, ' ').trim() : t;
  return { url, note };
}

/** One canonical form so the same page is not kept twice. @param {string} raw @returns {string} */
export function normalizeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { return String(raw || '').trim(); }
  let host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  let path = u.pathname;
  if (host === 'youtu.be') { const id = path.slice(1); host = 'youtube.com'; path = '/watch'; u.search = `?v=${id}`; }
  const keep = [];
  for (const [k, v] of u.searchParams) if (!TRACKING.test(k)) keep.push([k, v]);
  keep.sort((a, b) => a[0].localeCompare(b[0]));
  const q = keep.length ? '?' + keep.map(([k, v]) => `${k}=${v}`).join('&') : '';
  path = path.replace(/\/+$/, '');
  return `${host}${path}${q}`;
}

/** @param {string} url @returns {{kind: string, label: string, host: string}} */
export function classify(url) {
  let host = '';
  let path = '';
  try { const u = new URL(url); host = u.hostname.toLowerCase().replace(/^www\./, ''); path = u.pathname.toLowerCase(); } catch (e) { return { kind: 'note', label: 'Note', host: '' }; }
  for (const s of SOURCES) if (s.re.test(host)) return { kind: s.kind, label: s.label, host };
  if (/\.pdf$/.test(path)) return { kind: 'pdf', label: 'PDF', host };
  if (/\.(png|jpe?g|webp|gif)$/.test(path)) return { kind: 'image', label: 'Image', host };
  return { kind: 'article', label: host || 'Link', host };
}

/** @param {string} kind @returns {string} plain noun for copy */
export function nounFor(kind) {
  return { youtube: 'video', tiktok: 'video', instagram: 'post', x: 'post', github: 'repository', reddit: 'post', pdf: 'PDF', image: 'image', pinterest: 'pin', note: 'note' }[kind] || 'link';
}

/** Filter chips on the Trove. */
export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Videos', kinds: ['youtube', 'tiktok', 'instagram', 'facebook', 'video'] },
  { id: 'article', label: 'Articles', kinds: ['article', 'reddit', 'x', 'linkedin', 'link'] },
  { id: 'repo', label: 'Repos', kinds: ['github'] },
  { id: 'file', label: 'Files', kinds: ['pdf', 'image', 'pinterest'] },
  { id: 'voice', label: 'Voice', kinds: ['voice'] },
  { id: 'note', label: 'Notes', kinds: ['note'] },
];
