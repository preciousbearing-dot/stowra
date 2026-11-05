/**
 * Where a Keep's file lives (a video, a recording, a picture, a PDF).
 * On the phone the file is a real file in the app folder, so big videos never slow the app database and can be played straight from disk.
 * In a browser, in tests, and for Keeps saved by earlier versions, the file is a blob in the database. Both are read through here.
 * A Keep's meta.file.store names the app-folder file; without it the blob in the database is used.
 * @param {any} repo
 */
export function createFileStore(repo) {
  /** @type {any} */ let backend = null;
  const ext = (name, mime) => { const m = /\.[A-Za-z0-9]{1,5}$/.exec(name || ''); if (m) return m[0].toLowerCase(); return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'audio/webm': '.webm', 'audio/mp4': '.m4a', 'audio/wav': '.wav', 'application/pdf': '.pdf' })[String(mime || '').split(';')[0]] || ''; };
  const api = {
    /** Give the store the phone's file tools. Pass null to use the database only. */
    useNative(b) { backend = b; },
    get native() { return Boolean(backend); },
    /**
     * Save a file for a Keep. @returns {Promise<{store?: string}>} store is the app-folder name, absent when the blob went to the database
     * @param {string} id @param {Blob} blob @param {{name?: string, mime?: string}} [info]
     */
    async save(id, blob, info = {}) {
      if (backend) {
        try { const store = `${id}${ext(info.name, info.mime || blob.type)}`; await backend.write(store, blob); return { store }; } catch (e) { /* fall back to the database so nothing is lost */ }
      }
      await repo.chunks.put({ id: `file:${id}`, blob });
      return {};
    },
    /** The file as a blob, or null when it is missing. @param {any} k */
    async blob(k) {
      const c = await repo.chunks.get(`file:${k.id}`); if (c && c.blob) return c.blob;
      const store = k.meta && k.meta.file && k.meta.file.store;
      if (!store || !backend) return null;
      try { await backend.ready(); if (backend.read) { const rb = await backend.read(store); return rb ? new Blob([rb], { type: (k.meta.file.mime || rb.type || '').split(';')[0] }) : null; } const r = await fetch(backend.url(store)); if (!r.ok) return null; const b = await r.blob(); return new Blob([b], { type: (k.meta.file.mime || b.type || '').split(';')[0] }); } catch (e) { return null; }
    },
    /** An address to show or play the file. Streams from disk when stored in the app folder. @param {any} k @returns {Promise<{url: string, release: () => void}|null>} */
    async open(k) {
      const store = k.meta && k.meta.file && k.meta.file.store;
      if (store && backend) { await backend.ready(); return { url: backend.url(store), release() {} }; }
      const c = await repo.chunks.get(`file:${k.id}`); if (!c || !c.blob) return null;
      const url = URL.createObjectURL(c.blob); return { url, release() { URL.revokeObjectURL(url); } };
    },
    /** True when a file is kept for this Keep. @param {any} k */
    async has(k) { const c = await repo.chunks.get(`file:${k.id}`); return Boolean((c && c.blob) || (k.meta && k.meta.file && k.meta.file.store)); },
    /** Delete the file wherever it is. @param {any} k */
    async remove(k) {
      await repo.chunks.delete(`file:${k.id}`);
      const store = k.meta && k.meta.file && k.meta.file.store; if (store && backend) await backend.remove(store);
    },
    /** Copy the file into the phone gallery. Only on the phone. @param {any} k @returns {Promise<{where: string}>} */
    async exportToGallery(k) {
      const store = k.meta && k.meta.file && k.meta.file.store;
      if (!backend) throw new Error('Saving to the gallery works on the phone.');
      let name = store;
      if (!name) { const b = await api.blob(k); if (!b) throw new Error('The file is missing.'); const tmp = `export-${k.id}${ext(k.meta.file && k.meta.file.name, b.type)}`; await backend.write(tmp, b); name = tmp; }
      const mime = (k.meta.file && k.meta.file.mime) || 'application/octet-stream';
      const base = String((k.meta.file && k.meta.file.name) || k.title || 'stowra').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 80) || 'stowra';
      const display = /\.[A-Za-z0-9]{1,5}$/.test(base) ? base : base + ext('', mime);
      try { return await backend.exportToGallery(name, display, mime); } finally { if (!store) await backend.remove(name); }
    },
    /** Move files that older versions kept in the database into the app folder. Safe to stop and run again. @param {any[]} keeps @returns {Promise<number>} how many moved */
    async migrate(keeps) {
      if (!backend) return 0; let moved = 0;
      for (const k of keeps) {
        if (!k.meta || !k.meta.file || k.meta.file.store) continue;
        try {
          const c = await repo.chunks.get(`file:${k.id}`); if (!c || !c.blob) continue;
          const r = await api.save(k.id, c.blob, k.meta.file); if (!r.store) continue;
          const fresh = await repo.keeps.get(k.id); if (!fresh) { await backend.remove(r.store); continue; }
          await repo.keeps.put({ ...fresh, meta: { ...fresh.meta, file: { ...fresh.meta.file, store: r.store } } });
          await repo.chunks.delete(`file:${k.id}`); moved++;
        } catch (e) { /* leave it where it is */ }
      }
      return moved;
    },
  };
  return api;
}
