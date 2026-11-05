import { STATUS, canTransition } from '../core/processing.js';
import { NetworkError, userMessage } from '../core/errors.js';

/**
 * Background reading. A Keep is saved before any extractor runs, so a failure here never loses it.
 * An extractor is async (keep, tools) => {title?, text?, thumb?, how?, status?, meta?}; it throws on failure.
 * @param {{keeps: ReturnType<typeof import('../core/keeps.js').createKeepService>, extractors: Record<string, Function>, tools: object}} o
 */
export function createPipeline({ keeps, extractors, tools }) {
  const queue = []; let active = 0; const LIMIT = 2;

  async function process(id) {
    const k = await keeps.get(id);
    if (!k || k.deletedAt) return;
    if (canTransition(k.status, STATUS.PROCESSING)) await keeps.update(id, { status: STATUS.PROCESSING, error: '' });
    const ex = extractors[k.kind] || extractors.default;
    try {
      const r = ex ? await ex(k, tools) : { how: '' };
      const cur = await keeps.get(id);
      if (!cur) return;
      const patch = { status: r.status || STATUS.READY, error: '', meta: { ...cur.meta, ...(r.meta || {}), how: r.how || '' } };
      if (r.text) patch.text = r.text;
      if (r.thumb && !cur.thumb) patch.thumb = r.thumb;
      if (r.file && r.file.blob) { const saved = await tools.repo.files.save(id, r.file.blob, r.file); patch.meta.file = { name: r.file.name, mime: r.file.mime, size: r.file.size || r.file.blob.size, ...(saved.store ? { store: saved.store } : {}) }; }
      // A title the user set stays; a generated one (the link itself) is replaced.
      if (r.title && (!cur.title || cur.title === cur.url || cur.title === (cur.meta.host || '') || /^https?:\/\//.test(cur.title) || cur.title.length < 4 || cur.meta.autoTitle !== false)) { patch.title = r.title; patch.meta.autoTitle = true; }
      await keeps.update(id, patch);
    } catch (e) {
      const offline = e instanceof NetworkError;
      await keeps.update(id, { status: offline ? STATUS.ATTENTION : STATUS.FAILED, error: userMessage(e) });
    }
  }

  const waiters = new Map();
  async function pump() {
    while (active < LIMIT && queue.length) {
      const id = queue.shift(); active++;
      process(id).catch(() => {}).finally(() => { active--; (waiters.get(id) || []).forEach((r) => r()); waiters.delete(id); pump(); });
    }
  }

  return {
    /** Read one Keep. Resolves when it has been read (or has failed). */
    run(id) { return new Promise((res) => { waiters.set(id, [...(waiters.get(id) || []), res]); if (!queue.includes(id)) queue.push(id); pump(); }); },
    /** Pick up Keeps that were saved but never read (app closed mid-way, or no connection). */
    async resume() {
      for (const k of await keeps.list({})) if ((k.status === STATUS.SAVED || k.status === STATUS.PROCESSING || k.status === STATUS.ATTENTION) && !queue.includes(k.id)) queue.push(k.id);
      pump();
    },
    get busy() { return active + queue.length; },
  };
}
