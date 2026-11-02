import { getBytes } from './http.js';
import { ExtractionError } from '../core/errors.js';

let loading;
/** Load the bundled PDF reader once. @returns {Promise<any>} */
export function loadPdfjs() {
  if (globalThis.pdfjsLib) return Promise.resolve(globalThis.pdfjsLib);
  loading ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = new URL('../../assets/vendor/pdf.min.js', import.meta.url).href;
    s.onload = () => { globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../assets/vendor/pdf.worker.min.js', import.meta.url).href; res(globalThis.pdfjsLib); };
    s.onerror = () => rej(new ExtractionError('The PDF reader did not load.', { code: 'pdfjs' }));
    document.head.appendChild(s);
  });
  return loading;
}

const MAX_PAGES = 300;
/** PDF text with page markers, and the first page as a picture. Works on a file kept on the phone or a link. @param {any} k @param {any} tools */
export async function pdfExtractor(k, tools) {
  const pdfjs = await loadPdfjs();
  let data;
  const stored = await tools.repo.chunks.get(`file:${k.id}`);
  if (stored && stored.blob) data = await stored.blob.arrayBuffer(); else if (k.url) data = await getBytes(k.url); else throw new ExtractionError('No file.', { code: 'nofile' });
  const doc = await pdfjs.getDocument({ data }).promise;
  const n = Math.min(doc.numPages, MAX_PAGES); const parts = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i); const c = await page.getTextContent();
    let line = ''; const lines = [];
    for (const it of c.items) { line += it.str; if (it.hasEOL) { lines.push(line); line = ''; } else line += ' '; }
    if (line.trim()) lines.push(line);
    const t = lines.join('\n').replace(/[ \t]+\n/g, '\n').trim();
    if (t) parts.push(`[Page ${i}]\n${t}`);
  }
  let thumb = null;
  try {
    const p1 = await doc.getPage(1); const vp = p1.getViewport({ scale: 1 }); const sc = 480 / vp.width; const v = p1.getViewport({ scale: sc });
    const cv = document.createElement('canvas'); cv.width = v.width; cv.height = v.height;
    await p1.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise; thumb = cv.toDataURL('image/jpeg', 0.8);
  } catch (e) { /* generated cover */ }
  let title = ''; try { const m = await doc.getMetadata(); title = (m.info && m.info.Title) || ''; } catch (e) { /* none */ }
  const text = parts.join('\n\n');
  const scanned = text.replace(/\[Page \d+\]/g, '').trim().length < 50;
  return { title, thumb, text, status: scanned ? 'partial' : 'ready', how: scanned ? 'This looks like scanned pages with no text. Text reading from images arrives in the Android app' : `${doc.numPages} pages read${doc.numPages > n ? `, first ${n} kept` : ''}`, meta: { pages: doc.numPages } };
}
