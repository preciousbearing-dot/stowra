import { STORES } from './migrations.js';
import { createIdbAdapter } from './idb-adapter.js';
import { createMemoryAdapter } from './memory-adapter.js';

/**
 * @typedef {{open(): Promise<void>, close(): Promise<void>, get(s: string, id: string): Promise<any>, put(s: string, o: any): Promise<string>, delete(s: string, id: string): Promise<void>, all(s: string): Promise<any[]>, clear(s: string): Promise<void>, kind: string}} Adapter
 */

/** One typed view of a store. */
function view(adapter, name) {
  return {
    get: (id) => adapter.get(name, id),
    put: (obj) => adapter.put(name, obj),
    delete: (id) => adapter.delete(name, id),
    all: () => adapter.all(name),
    /** @param {(o: any) => boolean} predicate */
    async query(predicate) { return (await adapter.all(name)).filter(predicate); },
    clear: () => adapter.clear(name),
  };
}

/**
 * The only door to storage. Swap the adapter (IndexedDB now, SQLite later) without touching other layers.
 * @param {Adapter} adapter
 */
export function createRepository(adapter) {
  const repo = { adapter };
  for (const s of STORES) repo[s] = view(adapter, s);
  /** Small key and value settings, stored as {id, value}. */
  repo.prefs = {
    /** @param {string} key @param {any} [fallback] */
    async read(key, fallback) { const r = await adapter.get('settings', key); return r ? r.value : fallback; },
    /** @param {string} key @param {any} value */
    async write(key, value) { await adapter.put('settings', { id: key, value }); },
  };
  return repo;
}

/**
 * Open production storage. Falls back to memory if IndexedDB is unavailable, and says so.
 * @returns {Promise<{repo: ReturnType<typeof createRepository>, persistent: boolean}>}
 */
export async function openRepository() {
  const idb = createIdbAdapter();
  try {
    await idb.open();
    return { repo: createRepository(idb), persistent: true };
  } catch (e) {
    const mem = createMemoryAdapter();
    await mem.open();
    return { repo: createRepository(mem), persistent: false };
  }
}
