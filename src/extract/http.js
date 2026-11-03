import { NetworkError, ExtractionError } from '../core/errors.js';
import { readImageFile } from '../capture/images.js';

const CH = () => globalThis.Capacitor && globalThis.Capacitor.isNativePlatform && globalThis.Capacitor.isNativePlatform() && globalThis.Capacitor.Plugins && globalThis.Capacitor.Plugins.CapacitorHttp;
/** On the phone, text requests go through the native HTTP plugin directly. Unlike fetch, it can send the User-Agent and other headers sites check. Returns a fetch-like object. */
async function nativeReq(url, o) {
  const body = o.body === undefined ? undefined : (typeof o.body === 'string' ? o.body : JSON.stringify(o.body));
  const headers = { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
  try {
    const r = await CH().request({ url, method: o.method || (body !== undefined ? 'POST' : 'GET'), headers, data: body, responseType: 'text', connectTimeout: 20000, readTimeout: o.timeout || 30000 });
    const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, url: r.url || url, text: async () => text, json: async () => JSON.parse(text) };
  } catch (e) { throw new NetworkError('Could not reach the site.', { code: 'network', cause: e }); }
}

async function req(url, o = {}) {
  if (o.native !== false && CH() && !o.blob) return nativeReq(url, o);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), o.timeout || 20000);
  try { const init = { headers: o.headers || {}, signal: ctl.signal, redirect: 'follow' }; if (o.body !== undefined) { init.method = o.method || 'POST'; init.body = typeof o.body === 'string' ? o.body : JSON.stringify(o.body); init.headers = { 'Content-Type': 'application/json', ...init.headers }; } return await fetch(url, init); }
  catch (e) { throw new NetworkError('Could not reach the site.', { code: e && e.name === 'AbortError' ? 'timeout' : 'network', cause: e }); }
  finally { clearTimeout(t); }
}
/** Follow redirects (short links) and return the final address. Never throws. @param {string} url */
export async function resolveUrl(url) { try { const r = await req(url, { timeout: 10000 }); return r.url || url; } catch (e) { return url; } }
/** @returns {Promise<string>} */
export async function getText(url, o) { const r = await req(url, o); if (!r.ok) throw new ExtractionError(`HTTP ${r.status}`, { code: `http_${r.status}` }); return r.text(); }
export async function getJson(url, o) { const r = await req(url, o); if (!r.ok) throw new ExtractionError(`HTTP ${r.status}`, { code: `http_${r.status}` }); return r.json(); }
/** @returns {Promise<ArrayBuffer>} */
export async function getBytes(url, o) { const r = await req(url, { ...o, blob: true }); if (!r.ok) throw new ExtractionError(`HTTP ${r.status}`, { code: `http_${r.status}` }); return r.arrayBuffer(); }
/**
 * Copy a remote picture onto the phone as a small JPEG, because platform links expire. Never throws: no picture falls back to a generated cover.
 * @returns {Promise<string|null>}
 */
export async function pictureAsThumb(url) {
  if (!url) return null;
  try { const r = await req(url, { timeout: 12000, blob: true }); if (!r.ok) return null; const b = await r.blob(); if (!b.size || b.size > 8e6) return null; return await readImageFile(b, 640); } catch (e) { return null; }
}
/** Plain text from an HTML string using the browser parser. Scripts and styles never run. @param {string} html */
export function htmlToDoc(html) { return new DOMParser().parseFromString(html, 'text/html'); }
export const meta = (doc, ...names) => { for (const n of names) { const e = doc.querySelector(`meta[property="${n}"],meta[name="${n}"]`); const v = e && e.getAttribute('content'); if (v && v.trim()) return v.trim(); } return ''; };
