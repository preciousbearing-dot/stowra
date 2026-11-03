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

const PLAYER = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const CLIENTS = [
  { name: 'ANDROID', context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' } }, ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip' },
  { name: 'WEB', context: { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en' } }, ua: '' },
];

/** Pick the best caption track: written English first, then automatic English, then the first one. @param {any[]} tracks */
export function pickTrack(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return null;
  const en = (t) => /^en/i.test(t.languageCode || '');
  return tracks.find((t) => en(t) && t.kind !== 'asr') || tracks.find(en) || tracks[0];
}

/** Older XML captions (<text start="1.2" dur="3">...</text>) into the same json3 shape. @param {string} xml */
export function xmlToJson3(xml) {
  const dec = (x) => x.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  const events = [];
  for (const m of xml.matchAll(/<text[^>]*start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)) events.push({ tStartMs: Math.round(parseFloat(m[1]) * 1000), segs: [{ utf8: dec(m[2].replace(/<[^>]+>/g, '')) }] });
  return { events };
}

async function fromPlayer(id) {
  for (const c of CLIENTS) {
    try {
      const j = await getJson(PLAYER, { body: { context: c.context, videoId: id, contentCheckOk: true, racyCheckOk: true }, headers: c.ua ? { 'User-Agent': c.ua } : {}, timeout: 15000 });
      const tracks = j && j.captions && j.captions.playerCaptionsTracklistRenderer && j.captions.playerCaptionsTracklistRenderer.captionTracks;
      const d = j && j.videoDetails || {};
      if (tracks && tracks.length) return { tracks, desc: d.shortDescription || '', title: d.title || '', author: d.author || '', secs: Number(d.lengthSeconds) || 0 };
      if (d.title) return { tracks: [], desc: d.shortDescription || '', title: d.title, author: d.author || '', secs: Number(d.lengthSeconds) || 0 };
    } catch (e) { /* try the next client */ }
  }
  return null;
}

async function trackText(t) {
  const base = String(t.baseUrl || ''); if (!base) return '';
  try { const text = captionsToText(await getJson(`${base}${base.includes('?') ? '&' : '?'}fmt=json3`)); if (text) return text; } catch (e) { /* try xml */ }
  try { return captionsToText(xmlToJson3(await getText(base))); } catch (e) { return ''; }
}

async function fromPage(id) {
  const html = await getText(`https://www.youtube.com/watch?v=${id}`, { headers: { 'Accept-Language': 'en' } });
  const out = { tracks: [], desc: '', title: '' };
  const d = html.match(/"shortDescription":("(?:[^"\\]|\\.)*")/); if (d) { try { out.desc = JSON.parse(d[1]); } catch (e) { /* skip */ } }
  const t = html.match(/<title>([^<]*)<\/title>/); if (t) out.title = t[1].replace(/ - YouTube$/, '');
  const m = html.match(/"captionTracks":(\[.*?\])/); if (m) { try { out.tracks = JSON.parse(m[1]); } catch (e) { /* skip */ } }
  return out;
}

/** YouTube: title, channel, picture, description and captions where the video has them. @param {any} k */
export async function youtubeExtractor(k) {
  const id = videoId(k.url);
  if (!id) throw new ExtractionError('No video id.', { code: 'no_id' });
  let title = ''; let author = ''; let desc = ''; let tr = ''; let ok = false; let lang = ''; let auto = false; let secs = 0; let thumbUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  try { const o = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`); title = o.title || ''; author = o.author_name || ''; thumbUrl = o.thumbnail_url || thumbUrl; ok = true; } catch (e) { /* the player may still work */ }
  let info = await fromPlayer(id);
  if (!info || !info.tracks.length) { try { const pg = await fromPage(id); info = { ...(info || {}), tracks: pg.tracks.length ? pg.tracks : (info && info.tracks) || [], desc: (info && info.desc) || pg.desc, title: (info && info.title) || pg.title }; } catch (e) { /* keep what we have */ } }
  if (info) {
    ok = true; title = title || info.title || ''; author = author || info.author || ''; desc = info.desc || ''; secs = info.secs || 0;
    const t = pickTrack(info.tracks);
    if (t) { tr = await trackText(t); lang = t.languageCode || ''; auto = t.kind === 'asr'; }
  }
  if (!ok) { const e = new ExtractionError('Could not read YouTube.', { code: 'unreachable' }); throw e; }
  const thumb = await pictureAsThumb(thumbUrl);
  const text = [title, author && `Channel: ${author}`, desc && `Description:\n${desc}`, tr && `Transcript:\n${tr}`].filter(Boolean).join('\n\n');
  return { title, thumb, text, status: tr ? 'ready' : 'partial', how: tr ? (auto ? 'Full transcript from automatic captions' : 'Full transcript from captions') : 'Title, picture and description. This video has no captions Stowra could read', meta: { author, hasTranscript: Boolean(tr), transcriptLang: lang, autoCaptions: auto, durationSecs: secs } };
}
