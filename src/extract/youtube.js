import { getText, getJson, pictureAsThumb } from './http.js';
import { ExtractionError } from '../core/errors.js';

/** @param {string} url @returns {string} */
export function videoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') === 'youtu.be') return u.pathname.slice(1).split('/')[0];
    const v = u.searchParams.get('v'); if (v) return v;
    const m = u.pathname.match(/\/(shorts|embed|live|v)\/([\w-]{6,})/); return m ? m[2] : '';
  } catch (e) { return ''; }
}
const stamp = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/** Turn caption events into paragraphs that start with a time, about every 30 seconds. @param {any} j json3 captions */
export function captionsToText(j) {
  const out = []; let cur = ''; let start = 0; let first = true;
  for (const ev of j.events || []) {
    const t = (ev.segs || []).map((s) => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (first || ev.tStartMs - start > 30000) { if (cur) out.push(cur.trim()); start = ev.tStartMs || 0; cur = `[${stamp(start)}] `; first = false; }
    cur += t + ' ';
  }
  if (cur.trim()) out.push(cur.trim());
  return out.join('\n');
}

async function captions(html) {
  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) return '';
  let tracks; try { tracks = JSON.parse(m[1]); } catch (e) { return ''; }
  const t = tracks.find((x) => /^en/.test(x.languageCode) && x.kind !== 'asr') || tracks.find((x) => /^en/.test(x.languageCode)) || tracks[0];
  if (!t || !t.baseUrl) return '';
  try { return captionsToText(await getJson(`${t.baseUrl}&fmt=json3`)); } catch (e) { return ''; }
}

/** YouTube: title, channel, picture, description and captions where the video has them. @param {any} k */
export async function youtubeExtractor(k) {
  const id = videoId(k.url);
  if (!id) throw new ExtractionError('No video id.', { code: 'no_id' });
  let title = ''; let author = ''; let desc = ''; let tr = ''; let ok = false; let thumbUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  try { const o = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`); title = o.title || ''; author = o.author_name || ''; thumbUrl = o.thumbnail_url || thumbUrl; ok = true; } catch (e) { /* page may still work */ }
  try {
    const html = await getText(`https://www.youtube.com/watch?v=${id}`, { headers: { 'Accept-Language': 'en' } });
    ok = true;
    const d = html.match(/"shortDescription":("(?:[^"\\]|\\.)*")/); if (d) { try { desc = JSON.parse(d[1]); } catch (e) { /* skip */ } }
    if (!title) { const t = html.match(/<title>([^<]*)<\/title>/); if (t) title = t[1].replace(/ - YouTube$/, ''); }
    tr = await captions(html);
  } catch (e) { /* keep what oEmbed gave */ }
  if (!ok) { const e = new ExtractionError('Could not read YouTube.', { code: 'unreachable' }); throw e; }
  const thumb = await pictureAsThumb(thumbUrl);
  const text = [title, author && `Channel: ${author}`, desc && `Description:\n${desc}`, tr && `Transcript:\n${tr}`].filter(Boolean).join('\n\n');
  return { title, thumb, text, status: tr ? 'ready' : 'partial', how: tr ? 'Transcript from captions' : 'Title, picture and description. This video has no captions Stowra could read', meta: { author, hasTranscript: Boolean(tr) } };
}
