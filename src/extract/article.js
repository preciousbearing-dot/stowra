import { getText, htmlToDoc, meta, pictureAsThumb } from './http.js';
import { ExtractionError } from '../core/errors.js';

const DROP = 'script,style,noscript,nav,footer,aside,header,form,iframe,svg,button,[role=navigation],[aria-hidden=true],.nav,.menu,.footer,.sidebar,.comments,.advert,.ad,.cookie';

/** Readable text from a page: the article or main block if there is one, else the densest run of paragraphs. @param {Document} doc */
export function mainText(doc) {
  doc.querySelectorAll(DROP).forEach((n) => n.remove());
  const root = doc.querySelector('article') || doc.querySelector('main,[role=main]') || doc.body;
  if (!root) return '';
  const parts = [];
  for (const n of root.querySelectorAll('h1,h2,h3,p,li,blockquote,pre')) {
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (/^H[1-3]$/.test(n.tagName)) parts.push(`\n${t}`); else if (t.length >= 40 || n.tagName === 'PRE') parts.push(t);
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 80000);
}

/** Articles and ordinary websites. @param {any} k */
export async function articleExtractor(k) {
  const html = await getText(k.url, { headers: { Accept: 'text/html,application/xhtml+xml' } });
  if (!/<html|<body|<p[ >]/i.test(html)) throw new ExtractionError('Not a web page.', { code: 'not_html' });
  const doc = htmlToDoc(html);
  const title = meta(doc, 'og:title', 'twitter:title') || (doc.querySelector('title') && doc.querySelector('title').textContent.trim()) || '';
  const desc = meta(doc, 'og:description', 'description');
  const img = meta(doc, 'og:image', 'twitter:image');
  const base = (u) => { try { return new URL(u, k.url).href; } catch (e) { return ''; } };
  const text = mainText(doc);
  const body = text.length > 200 ? text : [desc, text].filter(Boolean).join('\n\n');
  const thumb = await pictureAsThumb(base(img));
  const full = text.length >= 400;
  return { title, text: body, thumb, status: full ? 'ready' : 'partial', how: full ? 'Page text read' : 'Only a short part of the page could be read. It may need you to log in, or it may load its text with scripts' };
}
