import { getJson, getText, getRaw, cookieHeader, htmlToDoc, meta, pictureAsThumb, resolveUrl } from './http.js';
import { articleExtractor } from './article.js';

const NEEDS = (name) => `${name} shares no captions or video content with other apps. Paste the caption into Notes, or add a screen recording`;

/** Pull what a TikTok page offers: caption, cover, author and, when present, spoken-word subtitles. Best effort. @param {string} html */
export function tiktokFromHtml(html) {
  const out = { title: '', author: '', thumb: '', subs: [] };
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const j = JSON.parse(m[1]); const d = j['__DEFAULT_SCOPE__'] && j['__DEFAULT_SCOPE__']['webapp.video-detail'] && j['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo && j['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
      if (d) { out.title = d.desc || ''; out.author = (d.author && (d.author.nickname || d.author.uniqueId)) || ''; out.thumb = (d.video && (d.video.originCover || d.video.cover)) || ''; out.subs = ((d.video && d.video.subtitleInfos) || []).map((x) => ({ lang: x.LanguageCodeName || '', url: x.Url || '' })).filter((x) => x.url); }
    } catch (e) { /* use the meta tags */ }
  }
  const og = (n) => { const x = html.match(new RegExp(`<meta[^>]+property="${n}"[^>]+content="([^"]*)"`, 'i')); return x ? x[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : ''; };
  out.title = out.title || og('og:title') || og('og:description'); out.thumb = out.thumb || og('og:image');
  return out;
}

/** TikTok: caption and cover through the public lookup, then the page itself. The spoken words come from subtitles when the video has them, otherwise from a screen recording. */
export async function tiktokExtractor(k) {
  const url = await resolveUrl(k.url);
  let title = ''; let author = ''; let thumbUrl = ''; let subs = [];
  try { const o = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`); title = o.title || ''; author = o.author_name || ''; thumbUrl = o.thumbnail_url || ''; } catch (e) { /* try the page */ }
  try {
    const p = tiktokFromHtml(await getText(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' } }));
    title = title || p.title; author = author || p.author; thumbUrl = thumbUrl || p.thumb; subs = p.subs;
  } catch (e) { /* keep the lookup result */ }
  if (!title && !thumbUrl) return { status: 'attention', how: NEEDS('TikTok') };
  let spoken = '';
  for (const sub of subs.slice(0, 1)) { try { const t = await getText(sub.url); spoken = t.replace(/WEBVTT/g, '').replace(/^\d+$/gm, '').replace(/^[\d:.,]+ --> .*$/gm, '').replace(/\n{2,}/g, '\n').trim(); } catch (e) { /* skip */ } }
  const thumb = await pictureAsThumb(thumbUrl);
  return { title: (title || `TikTok by ${author || 'unknown'}`).slice(0, 120), thumb, text: [title, author && `By ${author}`, spoken && `Transcript:\n${spoken}`].filter(Boolean).join('\n\n'), status: spoken ? 'ready' : 'partial', how: spoken ? 'Caption, cover and subtitles' : 'Caption and cover. The spoken words need a screen recording or pasted text', meta: { author, hasTranscript: Boolean(spoken) } };
}

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const igFix = (v) => v.replace(/\\+u0026/g, '&').replace(/\\+\//g, '/').replace(/\\+"/g, '"');

/** The shortcode and kind in an Instagram link. @param {string} url @returns {{kind: string, code: string}|null} */
export function instagramRef(url) { const m = String(url).match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/); return m ? { kind: m[1] === 'reels' ? 'reel' : m[1], code: m[2] } : null; }

/** What the public embed page of a post or reel shows: caption, cover, author and, for videos, the direct file. Best effort. @param {string} html */
export function instagramFromEmbed(html) {
  const out = { caption: '', author: '', thumb: '', video: '' };
  const i = html.indexOf('video_url');
  if (i >= 0) { const m = html.slice(i + 9).match(/^\\*"\s*:\s*\\*"(https?:[^"]*?)\\*"/); if (m) out.video = igFix(m[1]); }
  const doc = htmlToDoc(html);
  const cap = doc.querySelector('.Caption'); if (cap) { const user = cap.querySelector('.CaptionUsername'); if (user) { out.author = user.textContent.trim(); user.remove(); } out.caption = cap.textContent.replace(/\s*\n\s*/g, '\n').trim(); }
  const img = doc.querySelector('img.EmbeddedMediaImage'); out.thumb = (img && img.getAttribute('src')) || meta(doc, 'og:image');
  if (!out.video) out.video = meta(doc, 'og:video', 'og:video:secure_url');
  if (!out.caption) out.caption = meta(doc, 'og:description');
  return out;
}

/** Instagram: the caption (where creators put repository links and tool names), the cover and the author, from the public embed page. The video itself is downloaded only when asked. */
export async function instagramExtractor(k) {
  const ref = instagramRef(await resolveUrl(k.url)) || instagramRef(k.url);
  if (!ref) return { status: 'attention', how: NEEDS('Instagram') };
  let p = null;
  try { p = instagramFromEmbed(await getText(`https://www.instagram.com/${ref.kind === 'reel' ? 'reel' : ref.kind}/${ref.code}/embed/captioned/`, { headers: { 'User-Agent': MOBILE_UA, 'Accept-Language': 'en' } })); } catch (e) { /* fall through */ }
  if (!p || (!p.caption && !p.thumb)) return { status: 'attention', how: `${NEEDS('Instagram')}. Or tap Download video on this Keep to try getting the video` };
  const thumb = await pictureAsThumb(p.thumb);
  const first = p.caption.split('\n').find((x) => x.trim()) || '';
  return { title: (first || `Instagram ${ref.kind === 'p' ? 'post' : 'reel'}${p.author ? ` by ${p.author}` : ''}`).slice(0, 120), thumb, text: [p.caption, p.author && `By ${p.author}`].filter(Boolean).join('\n\n'), status: 'partial', how: 'Caption and cover. Tap Download video to save the video and read what it teaches' };
}

/** The video file address in a TikTok page, and the cookie the file server wants. @param {string} html */
export function tiktokVideoFromHtml(html) {
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/); if (!m) return '';
  try {
    const j = JSON.parse(m[1]); const d = j['__DEFAULT_SCOPE__'] && j['__DEFAULT_SCOPE__']['webapp.video-detail'] && j['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo && j['__DEFAULT_SCOPE__']['webapp.video-detail'].itemInfo.itemStruct;
    const v = (d && d.video) || {}; const br = (v.bitrateInfo || [])[0]; const list = br && br.PlayAddr && br.PlayAddr.UrlList;
    return v.downloadAddr || v.playAddr || (list && list[0]) || '';
  } catch (e) { return ''; }
}
export const tiktokPage = async (url) => { const r = await getRaw(url, { headers: { 'Accept-Language': 'en', 'User-Agent': MOBILE_UA } }); return { html: r.text, cookie: cookieHeader(r.headers) }; };
export const facebookExtractor = async () => ({ status: 'attention', how: NEEDS('Facebook') });
export const linkedinExtractor = async (k) => { try { return await articleExtractor(k); } catch (e) { return { status: 'attention', how: 'LinkedIn asks people to log in. Paste the text into Notes and Stowra can read it' }; } };

/** X posts through the public embed lookup. */
export async function xExtractor(k) {
  try {
    const o = await getJson(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(k.url)}`);
    const text = htmlToDoc(o.html || '').body.textContent.replace(/\s+/g, ' ').trim();
    return { title: `${o.author_name || 'Post'}: ${text}`.slice(0, 110), text: `${o.author_name || ''}\n${text}`.trim(), status: text ? 'ready' : 'partial', how: 'Post text from X. Replies and media are not included', meta: { author: o.author_name || '' } };
  } catch (e) { return { status: 'attention', how: 'X would not share this post. Paste the text into Notes and Stowra can read it' }; }
}

/** Reddit through the public JSON view of a thread. */
export async function redditExtractor(k) {
  try {
    const j = JSON.parse(await getText(`${k.url.split('?')[0].replace(/\/$/, '')}.json?limit=15`));
    const post = j[0].data.children[0].data;
    const comments = (j[1]?.data?.children || []).filter((c) => c.kind === 't1').slice(0, 10).map((c) => `- ${c.data.body}`).join('\n');
    const thumb = /^https:/.test(post.thumbnail || '') ? await pictureAsThumb(post.thumbnail) : null;
    return { title: post.title, thumb, text: [post.title, `r/${post.subreddit}`, post.selftext, comments && `Top comments:\n${comments}`].filter(Boolean).join('\n\n'), status: 'ready', how: 'Post and top comments from Reddit' };
  } catch (e) { try { return await articleExtractor(k); } catch (e2) { return { status: 'attention', how: 'Reddit would not share this thread. Paste the text into Notes and Stowra can read it' }; } }
}
