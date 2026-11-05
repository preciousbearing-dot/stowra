import { downloadVideo, DEFAULT_DL } from '../extract/download.js';

/**
 * Video downloads that carry on while the app is open, one per Keep, with progress the Keep screen can show.
 * @param {any} ctx
 */
export function createDownloads(ctx) {
  /** @type {Map<string, any>} */ const jobs = new Map();
  const subs = new Set();
  const emit = (id) => subs.forEach((f) => f(id, jobs.get(id)));
  const set = (id, patch) => { jobs.set(id, { ...(jobs.get(id) || {}), ...patch }); emit(id); };
  return {
    get: (id) => jobs.get(id),
    onChange(f) { subs.add(f); return () => subs.delete(f); },
    async settings() { return { ...DEFAULT_DL, ...(await ctx.repo.prefs.read('dl', {})) }; },
    async saveSettings(v) { await ctx.repo.prefs.write('dl', { ...DEFAULT_DL, ...v }); },
    cancel(id) { try { ctx.native.files.cancel(`dl-${id}`); } catch (e) { /* nothing running */ } },
    /** Start (or ignore if already running). Resolves when finished; never rejects, the job holds the outcome. @param {string} id */
    async start(id) {
      const cur = jobs.get(id); if (cur && (cur.state === 'finding' || cur.state === 'downloading')) return cur;
      const k = await ctx.keeps.get(id); if (!k) return null;
      set(id, { state: 'finding', pct: 0, note: 'Finding the video', error: '', via: '', helper: false });
      try {
        const cfg = await this.settings();
        const r = await downloadVideo(k, { native: ctx.native, cfg, id: `dl-${id}`, onStatus: (t) => set(id, { note: t, state: t === 'Downloading' ? 'downloading' : 'finding' }),
          onProgress: (done, total) => set(id, { state: 'downloading', done, total, pct: total ? Math.min(99, Math.round((done / total) * 100)) : 0, note: 'Downloading' }) });
        const fresh = await ctx.keeps.get(id);
        if (fresh.meta.file && fresh.meta.file.store && fresh.meta.file.store !== r.name) { try { await ctx.native.files.remove(fresh.meta.file.store); } catch (e) { /* old copy already gone */ } }
        const safe = String(fresh.title || 'video').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 80) || 'video';
        const ext = (r.name.match(/\.[A-Za-z0-9]{1,5}$/) || ['.mp4'])[0];
        await ctx.keeps.update(id, { meta: { ...fresh.meta, file: { name: `${safe}${ext}`, mime: r.mime, size: r.size, store: r.name }, download: { via: r.via, helper: r.helper, at: Date.now(), size: r.size } } });
        set(id, { state: 'done', pct: 100, via: r.via, helper: r.helper, size: r.size, note: 'Saved on this phone' });
      } catch (e) {
        const stopped = e && (e.code === 'stopped' || /stopped/.test(String(e.message)));
        set(id, { state: stopped ? 'idle' : 'failed', error: stopped ? '' : String((e && e.message) || e), note: stopped ? 'Download stopped' : '' });
      }
      return jobs.get(id);
    },
    /** Delete the video file but keep the Keep. @param {string} id */
    async removeFile(id) {
      const k = await ctx.keeps.get(id); if (!k || !k.meta.file) return;
      await ctx.repo.files.remove(k); const meta = { ...k.meta }; delete meta.file; delete meta.download; delete meta.media;
      await ctx.keeps.update(id, { meta }); jobs.delete(id); emit(id);
    },
  };
}
