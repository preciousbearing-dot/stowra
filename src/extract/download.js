import { getJson, getText, resolveUrl } from './http.js';
import { videoId, youtubeStreams } from './youtube.js';
import { instagramRef, instagramFromEmbed, tiktokVideoFromHtml, tiktokPage } from './social.js';

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

/** Settings for helper services. Helpers see the link you give them, which is why they are a fallback and can be switched off. */
export const DEFAULT_DL = { helpers: true, cobalt: '', cobaltKey: '' };

/** Which sites a Keep's video can be fetched from. @param {any} k @returns {string} */
export function videoSite(k) {
  const u = String(k.url || '');
  if (k.kind === 'youtube' || /youtu\.?be/.test(u)) return 'youtube';
  if (k.kind === 'instagram' || /instagram\.com/.test(u)) return 'instagram';
  if (k.kind === 'tiktok' || /tiktok\.com/.test(u)) return 'tiktok';
  if (k.kind === 'pinterest' || /pinterest\.|pin\.it/.test(u)) return 'pinterest';
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) return 'direct';
  return '';
}

/** Whether a Keep can offer a video download. @param {any} k */
export function canDownload(k) {
  if (!k || !k.url) return false;
  const site = videoSite(k); if (!site) return false;
  if (site === 'pinterest') return Boolean(k.meta && k.meta.pin && k.meta.pin.video);
  return true;
}

/* Each way of finding the file returns { url, headers, chunk } or throws an Error whose message says why in plain words. */

async function onDeviceYouTube(k) {
  const id = videoId(k.url); if (!id) throw new Error('This is not a YouTube video link.');
  const { streams, why } = await youtubeStreams(id);
  if (!streams.length) throw new Error(why || 'YouTube gave no video file.');
  const best = streams.find((s) => s.height <= 720) || streams[0];
  return { url: best.url, headers: { 'User-Agent': best.ua, Referer: 'https://www.youtube.com/' }, chunk: true };
}
async function onDeviceInstagram(k) {
  const ref = instagramRef(await resolveUrl(k.url)) || instagramRef(k.url); if (!ref) throw new Error('This is not an Instagram post or reel link.');
  const p = instagramFromEmbed(await getText(`https://www.instagram.com/${ref.kind}/${ref.code}/embed/captioned/`, { headers: { 'User-Agent': MOBILE_UA, 'Accept-Language': 'en' } }));
  if (!p.video) throw new Error('Instagram did not share a video file for this post. It may be a private account, a picture post, or Instagram changed how it works.');
  return { url: p.video, headers: { 'User-Agent': MOBILE_UA, Referer: 'https://www.instagram.com/' } };
}
async function onDeviceTikTok(k) {
  const url = await resolveUrl(k.url);
  const { html, cookie } = await tiktokPage(url);
  const v = tiktokVideoFromHtml(html); if (!v) throw new Error('TikTok did not share a video file for this one.');
  return { url: v, headers: { 'User-Agent': MOBILE_UA, Referer: 'https://www.tiktok.com/', ...(cookie ? { Cookie: cookie } : {}) } };
}
async function onDevicePinterest(k) {
  const v = k.meta && k.meta.pin && k.meta.pin.video; if (!v) throw new Error('This pin has no video file.');
  return { url: v, headers: { 'User-Agent': MOBILE_UA, Referer: 'https://www.pinterest.com/' } };
}
async function direct(k) { return { url: k.url, headers: { 'User-Agent': MOBILE_UA } }; }

/** A cobalt-compatible helper the person set up or trusts. @param {string} base @param {string} key */
function viaCobalt(base, key) {
  return async (k) => {
    const root = base.replace(/\/+$/, '');
    const j = await getJson(root, { body: { url: k.url, videoQuality: '720', downloadMode: 'auto', filenameStyle: 'basic' }, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(key ? { Authorization: `Api-Key ${key}` } : {}) }, timeout: 40000 });
    if (j && (j.status === 'tunnel' || j.status === 'redirect') && j.url) return { url: j.url, headers: { 'User-Agent': MOBILE_UA } };
    if (j && j.status === 'picker' && Array.isArray(j.picker)) { const v = j.picker.find((x) => x.type === 'video') || j.picker[0]; if (v && v.url) return { url: v.url, headers: { 'User-Agent': MOBILE_UA } }; }
    throw new Error(`The helper said: ${(j && j.error && j.error.code) || (j && j.status) || 'no answer'}.`);
  };
}
/** A public TikTok lookup service. TikTok only. */
async function viaTikwm(k) {
  const j = await getJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(k.url)}&hd=1`, { timeout: 25000 });
  const d = j && j.data; const u = d && (d.hdplay || d.play); if (!u) throw new Error('The helper could not find this video.');
  return { url: /^https?:/.test(u) ? u : `https://www.tikwm.com${u}`, headers: { 'User-Agent': MOBILE_UA } };
}

/**
 * The ways to get this Keep's video, in the order to try them: on this phone first, then helper services if allowed.
 * @param {any} k @param {{helpers: boolean, cobalt: string, cobaltKey: string}} cfg @returns {{label: string, helper: boolean, run: (k: any) => Promise<{url: string, headers: Record<string, string>, chunk?: boolean}>}[]}
 */
export function plan(k, cfg) {
  const site = videoSite(k); const out = [];
  const own = { youtube: onDeviceYouTube, instagram: onDeviceInstagram, tiktok: onDeviceTikTok, pinterest: onDevicePinterest, direct }[site];
  if (own) out.push({ label: site === 'direct' ? 'the link' : 'the site', helper: false, run: own });
  if (cfg.helpers && site && site !== 'direct' && site !== 'pinterest') {
    if (cfg.cobalt) out.push({ label: 'your helper', helper: true, run: viaCobalt(cfg.cobalt, cfg.cobaltKey) });
    if (site === 'tiktok') out.push({ label: 'a helper service', helper: true, run: viaTikwm });
  }
  return out;
}

/**
 * Download a Keep's video into the app folder. Tries each way in turn and says plainly why each failed.
 * @param {any} k @param {{native: any, cfg: any, id: string, onStatus?: (s: string) => void, onProgress?: (done: number, total: number) => void}} o
 * @returns {Promise<{name: string, size: number, mime: string, via: string, helper: boolean}>}
 */
export async function downloadVideo(k, o) {
  const files = o.native && o.native.files;
  if (!files || !files.download) throw new Error('Downloading videos works in the Stowra app on the phone.');
  const steps = plan(k, o.cfg || DEFAULT_DL);
  if (!steps.length) throw new Error('Stowra does not know how to download from this link yet.');
  const reasons = [];
  for (const s of steps) {
    try {
      (o.onStatus || (() => {}))(s.helper ? `Trying ${s.label}` : 'Finding the video');
      const r = await s.run(k);
      (o.onStatus || (() => {}))('Downloading');
      const got = await files.download({ url: r.url, headers: r.headers, id: o.id, chunk: Boolean(r.chunk), onProgress: o.onProgress });
      return { ...got, via: s.label, helper: s.helper };
    } catch (e) {
      if (e && (e.code === 'stopped' || /stopped/.test(String(e.message)))) throw e;
      { const msg = String((e && e.message) || e).replace(/^Error:\s*/, ''); reasons.push(s.helper ? `${s.label[0].toUpperCase() + s.label.slice(1)}: ${msg}` : msg); }
    }
  }
  const e = new Error(reasons.join(' ')); e.reasons = reasons; throw e;
}
