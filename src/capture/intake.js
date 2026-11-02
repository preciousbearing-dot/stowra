import { readImageFile } from './images.js';

function b64ToBlob(b64, mime) {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime || 'application/octet-stream' });
}

/**
 * Turn what the Android share sheet queued into Keeps. Each share is saved on its own, so one bad item never blocks the rest.
 * @returns {Promise<{id: string, duplicate: boolean}[]>}
 */
export async function drainIntoKeeps({ native, keeps, pipeline }) {
  const shares = await native.drainShares();
  const out = [];
  for (const s of shares) {
    try {
      const f = (s.files || [])[0];
      let file = null; let thumb = null;
      if (f) {
        const b64 = await native.readShareFile(f.path);
        if (b64) { const blob = b64ToBlob(b64, f.mime); file = { name: f.name, mime: f.mime, size: blob.size, blob }; if ((f.mime || '').startsWith('image/')) { try { thumb = await readImageFile(blob, 640); } catch (e) { /* keep without a picture */ } } }
      }
      const { keep, duplicate } = await keeps.add({ text: s.text || s.subject || '', why: s.reason || '', file, title: !s.text && f ? f.name : '' });
      if (thumb && !keep.thumb) await keeps.update(keep.id, { thumb });
      for (const x of s.files || []) await native.deleteShareFile(x.path);
      out.push({ id: keep.id, duplicate });
      if (!duplicate) pipeline.run(keep.id).catch(() => {});
    } catch (e) { /* the share stays in the queue file only if Java failed; nothing to retry here */ }
  }
  return out;
}
