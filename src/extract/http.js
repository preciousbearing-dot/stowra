import { NetworkError, ExtractionError } from '../core/errors.js';
import { readImageFile } from '../capture/images.js';

async function req(url, o = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), o.timeout || 20000);
  try { return await fetch(url, { headers: o.headers || {}, signal: ctl.signal, redirect: 'follow' }); }
  catch (e) { throw new NetworkError('Could not reach the site.', { code: e && e.name === 'AbortError' ? 'timeout' : 'network', cause: e }); }
  finally { clearTimeout(t); }
}
/** @returns {Promise<string>} */
export async function getText(url, o) { const r = await req(url, o); if (!r.ok) throw new ExtractionError(`HTTP ${r.status}`, { code: `http_${r.status}` }); return r.text(); }
export async function getJson(url, o) { const r = await req(url, o); if (!r.ok) throw new ExtractionError(`HTTP ${r.status}`, { code: `http_${r.status}` }); return r.json(); }
/** @returns {Promise<ArrayBuffer>} */
export async function getBytes(url, o) { const r = await req(url, o); if (!r.ok) throw new ExtractionError(`HTTP ${r.status}`, { code: `http_${r.status}` }); return r.arrayBuffer(); }
/**
 * Copy a remote picture onto the phone as a small JPEG, because platform links expire. Never throws: no picture falls back to a generated cover.
 * @returns {Promise<string|null>}
 */
export async function pictureAsThumb(url) {
  if (!url) return null;
  try { const r = await req(url, { timeout: 12000 }); if (!r.ok) return null; const b = await r.blob(); if (!b.size || b.size > 8e6) return null; return await readImageFile(b, 640); } catch (e) { return null; }
}
/** Plain text from an HTML string using the browser parser. Scripts and styles never run. @param {string} html */
export function htmlToDoc(html) { return new DOMParser().parseFromString(html, 'text/html'); }
export const meta = (doc, ...names) => { for (const n of names) { const e = doc.querySelector(`meta[property="${n}"],meta[name="${n}"]`); const v = e && e.getAttribute('content'); if (v && v.trim()) return v.trim(); } return ''; };
