import { readImageFile } from '../capture/images.js';

/** Images: a small picture for the Trove, and on-device text reading where the phone supports it. Nothing leaves the phone here. @param {any} k @param {any} tools */
export async function imageExtractor(k, tools) {
  const stored = await tools.repo.chunks.get(`file:${k.id}`);
  const blob = stored && stored.blob;
  let thumb = null; if (blob) { try { thumb = await readImageFile(blob, 640); } catch (e) { /* none */ } }
  let text = '';
  if (blob && tools.native.ocr) { try { text = await tools.native.ocr(blob); } catch (e) { /* no text */ } }
  const has = text.trim().length > 0;
  return { thumb, text, status: has ? 'ready' : 'partial', how: has ? 'Text read on your phone' : tools.native.ocr ? 'Picture saved. No text found in it' : 'Picture saved. Reading text from pictures works in the Android app' };
}
