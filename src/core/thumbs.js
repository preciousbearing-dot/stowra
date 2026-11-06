import { frameOf } from '../extract/video.js';

const isVideo = (k) => Boolean(k && k.meta && k.meta.file && /^video\//.test(String(k.meta.file.mime || '')) && !k.meta.file.missing);

/**
 * Cover pictures for videos that have none, so every Keep can be recognised at a glance.
 * Uses the phone's own frame reader first (handles every format), then the page's video player.
 * @param {any} ctx
 */
export function createThumbs(ctx) {
  /** @param {any} k @returns {Promise<string|null>} a JPEG data address, or null */
  async function make(k) {
    const store = k.meta.file.store; const files = ctx.native && ctx.native.files;
    if (store && files && files.frame) { try { const r = await files.frame(store); if (r && r.thumb) return `data:image/jpeg;base64,${r.thumb}`; } catch (e) { /* try the page player */ } }
    const o = await ctx.repo.files.open(k).catch(() => null); if (!o) return null;
    try { const r = await frameOf(o.url); return (r && r.thumb) || null; } finally { o.release(); }
  }
  const busy = new Set();
  const api = {
    /** Give one Keep a cover from its video when it has none. @param {string} id @returns {Promise<boolean>} true when a cover was added */
    async ensure(id) {
      if (busy.has(id)) return false; busy.add(id);
      try {
        const k = await ctx.keeps.get(id); if (!k || k.thumb || !isVideo(k)) return false;
        const t = await make(k); if (!t) return false;
        const fresh = await ctx.keeps.get(id); if (!fresh || fresh.thumb) return false;
        await ctx.keeps.update(id, { thumb: t }); return true;
      } catch (e) { return false; } finally { busy.delete(id); }
    },
    /** Cover every video Keep that lacks one, one at a time so the phone stays smooth. @returns {Promise<number>} */
    async backfill() {
      let n = 0;
      for (const k of await ctx.repo.keeps.all()) { if (!k.deletedAt && !k.thumb && isVideo(k) && await api.ensure(k.id)) n++; }
      return n;
    },
  };
  return api;
}
