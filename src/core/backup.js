/** Export and restore. A backup holds Keeps, Collections and Creations. API keys are never included. */
export const BACKUP_VERSION = 1;
/** Files bigger than this stay out of the backup file (one JSON file cannot carry a long video). */
export const MAX_FILE_IN_BACKUP = 25 * 1024 * 1024;

const b64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const fromB64 = (s, mime) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); };

/** @param {any} repo @param {{files?: boolean}} [o] @returns {Promise<{name: string, text: string, counts: object}>} */
export async function buildBackup(repo, o = {}) {
  const keeps = await repo.keeps.all(); const collections = await repo.collections.all(); const creations = await repo.creations.all();
  const files = {};
  let skipped = 0;
  if (o.files) for (const k of keeps) { const bl = await repo.files.blob(k); if (!bl) continue; if (bl.size > MAX_FILE_IN_BACKUP) { skipped++; continue; } files[k.id] = { mime: bl.type, data: await b64(bl) }; }
  const data = { app: 'stowra', backupVersion: BACKUP_VERSION, exportedAt: Date.now(), keeps, collections, creations, files };
  const d = new Date().toISOString().slice(0, 10);
  return { name: `stowra-backup-${d}.json`, text: JSON.stringify(data), counts: { keeps: keeps.length, collections: collections.length, creations: creations.length, files: Object.keys(files).length, skipped } };
}

/** Check a backup file before touching anything. @param {string} text @returns {{ok: boolean, error?: string, data?: any}} */
export function readBackup(text) {
  let d; try { d = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not a Stowra backup.' }; }
  if (!d || d.app !== 'stowra' || !Array.isArray(d.keeps)) return { ok: false, error: 'That file is not a Stowra backup.' };
  if (d.backupVersion > BACKUP_VERSION) return { ok: false, error: 'This backup is from a newer Stowra. Update the app first.' };
  const bad = d.keeps.find((k) => !k || typeof k.id !== 'string' || typeof k.title !== 'string');
  if (bad) return { ok: false, error: 'The backup has damaged entries, so nothing was restored.' };
  return { ok: true, data: d };
}

/** Merge a backup in. Existing items are kept as they are; only missing ones are added. @returns {Promise<{keeps: number, collections: number, creations: number}>} */
export async function restoreBackup(repo, d) {
  const out = { keeps: 0, collections: 0, creations: 0 };
  for (const k of d.keeps) if (!(await repo.keeps.get(k.id))) { await repo.keeps.put(k); out.keeps++; const f = (d.files || {})[k.id]; if (f) { const blob = fromB64(f.data, f.mime); const r = await repo.files.save(k.id, blob, (k.meta && k.meta.file) || {}); const meta = { ...k.meta }; if (meta.file) { meta.file = { ...meta.file }; delete meta.file.store; if (r.store) meta.file.store = r.store; } await repo.keeps.put({ ...k, meta }); } else if (k.meta && k.meta.file && k.meta.file.store) { await repo.keeps.put({ ...k, meta: { ...k.meta, file: { ...k.meta.file, missing: true, store: undefined } } }); } }
  for (const c of d.collections || []) { const have = await repo.collections.get(c.id); if (!have) { await repo.collections.put(c); out.collections++; } else await repo.collections.put({ ...have, keepIds: [...new Set([...have.keepIds, ...c.keepIds])] }); }
  for (const r of d.creations || []) if (!(await repo.creations.get(r.id))) { await repo.creations.put(r); out.creations++; }
  return out;
}
