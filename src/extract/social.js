import { getJson, getText, htmlToDoc, pictureAsThumb } from './http.js';
import { articleExtractor } from './article.js';

const NEEDS = (name) => `${name} shares no captions or video content with other apps. Paste the caption into Notes, or add a screen recording`;

/** TikTok: caption and cover through the public lookup. The spoken words need a screen recording. */
export async function tiktokExtractor(k) {
  try {
    const o = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(k.url)}`);
    const thumb = await pictureAsThumb(o.thumbnail_url);
    return { title: (o.title || `TikTok by ${o.author_name || 'unknown'}`).slice(0, 120), thumb, text: [o.title, o.author_name && `By ${o.author_name}`].filter(Boolean).join('\n'), status: 'partial', how: 'Caption and cover. The spoken words need a screen recording or pasted text', meta: { author: o.author_name || '' } };
  } catch (e) { return { status: 'attention', how: NEEDS('TikTok') }; }
}

/** Instagram and Facebook: the link and source are kept. Meta gives no caption or cover without a developer token. */
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
