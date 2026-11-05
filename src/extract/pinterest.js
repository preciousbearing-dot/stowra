import { getJson, getText, getBytes, htmlToDoc, meta, resolveUrl } from './http.js';
import { readImageFile } from '../capture/images.js';

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const clean = (s) => String(s || '').replace(/\s+\n/g, '\n').trim();

/** Best picture size first. Pinterest serves the same file under /originals/ when it has it. @param {string} url @returns {string[]} */
export function sizeLadder(url) {
  if (!url) return [];
  const orig = url.replace(/\/(?:\d+x(?:\d+)?|\d+x\d+_RS)\//, '/originals/');
  return [...new Set([orig, url])];
}

/** The best mp4 among a pin's video files. Streams that need a player (m3u8) are skipped. @param {any} videos @returns {string} */
export function bestMp4(videos) {
  const list = (videos && videos.video_list) || {}; const order = ['V_EXP7', 'V_720P', 'V_EXP6', 'V_EXP5', 'V_480P', 'V_EXP4', 'V_360P'];
  for (const key of order) if (list[key] && /\.mp4(\?|$)/.test(list[key].url || '')) return list[key].url;
  for (const v of Object.values(list)) if (v && /\.mp4(\?|$)/.test(v.url || '')) return v.url;
  return '';
}

/** Pull a pin's details from Pinterest's public widget answer. @param {any} pin */
export function fromPin(pin) {
  const imgs = pin.images || {}; const best = imgs.orig || imgs['736x'] || imgs['474x'] || imgs['236x'] || {};
  const rich = pin.rich_metadata || {};
  return {
    title: clean(pin.title || pin.grid_title || rich.title || ''), description: clean(pin.description || rich.description || ''),
    author: clean((pin.pinner && (pin.pinner.full_name || pin.pinner.username)) || ''), link: clean(pin.link || ''), image: best.url || '',
    video: bestMp4(pin.videos), board: clean((pin.board && pin.board.name) || ''),
  };
}

/** Pinterest: the real picture saved in full size on the phone, plus the title, description, author and the link the pin points to. Video pins keep their picture and the video address. */
export async function pinterestExtractor(k) {
  const url = await resolveUrl(k.url);
  const id = (url.match(/\/pin\/(?:[^/]*--)?(\d+)/) || [])[1];
  let p = null;
  if (id) { try { const j = await getJson(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${id}`); const pin = j && j.data && j.data[0]; if (pin) p = fromPin(pin); } catch (e) { /* use the page */ } }
  if (!p || !p.image) {
    try {
      const doc = htmlToDoc(await getText(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36', 'Accept-Language': 'en' } }));
      p = { ...(p || {}), title: (p && p.title) || meta(doc, 'og:title'), description: (p && p.description) || meta(doc, 'og:description'), author: (p && p.author) || '', link: (p && p.link) || '', board: (p && p.board) || '', video: (p && p.video) || meta(doc, 'og:video', 'og:video:url'), image: (p && p.image) || meta(doc, 'og:image') };
    } catch (e) { /* nothing more to try */ }
  }
  if (!p || (!p.image && !p.title)) return { status: 'attention', how: 'Pinterest did not share this pin. Open it in Pinterest, save the picture to your phone and add it from Photo or PDF' };
  let blob = null; let mime = 'image/jpeg';
  for (const u of sizeLadder(p.image)) {
    try { const buf = await getBytes(u, { timeout: 30000 }); if (buf.byteLength > 2000) { const ext = (u.split('?')[0].split('.').pop() || 'jpg').toLowerCase(); mime = MIME[ext] || 'image/jpeg'; blob = new Blob([buf], { type: mime }); break; } } catch (e) { /* try the next size */ }
  }
  let thumb = null; if (blob) { try { thumb = await readImageFile(blob, 640); } catch (e) { /* keep going */ } }
  const text = [p.title, p.description, p.author && `Pinned by ${p.author}`, p.board && `Board: ${p.board}`, p.link && `Link: ${p.link}`].filter(Boolean).join('\n\n');
  const title = (p.title || p.description || 'Pinterest pin').split('\n')[0].slice(0, 120);
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';
  return {
    title, text: text || title, thumb, status: blob ? 'ready' : 'partial',
    file: blob ? { blob, name: `pin-${id || Date.now()}.${ext}`, mime, size: blob.size } : undefined,
    how: blob ? (p.video ? 'Picture saved in full size. This is a video pin, and the video itself is not downloaded yet' : 'Picture saved in full size. Tap it to view, or save it to your gallery') : 'Details saved, but the picture could not be downloaded. Try Read again',
    meta: { pin: { id: id || '', video: p.video || '', link: p.link || '' } },
  };
}
