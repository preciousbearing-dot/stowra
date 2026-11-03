import { getJson, getText, htmlToDoc, pictureAsThumb, resolveUrl } from './http.js';
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

export const instagramExtractor = async () => ({ status: 'attention', how: NEEDS('Instagram') });
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
