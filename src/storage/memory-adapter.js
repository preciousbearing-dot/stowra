import { STORES } from './migrations.js';

/** In-memory adapter for tests and for browsers where IndexedDB is unavailable. */
export function createMemoryAdapter() {
  /** @type {Record<string, Map<string, any>>} */
  const data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  const clone = (v) => (v === undefined ? v : structuredClone(v));
  return {
    kind: 'memory',
    async open() {},
    async close() {},
    async get(store, id) { return clone(data[store].get(id)); },
    async put(store, obj) { data[store].set(obj.id, clone(obj)); return obj.id; },
    async delete(store, id) { data[store].delete(id); },
    async all(store) { return [...data[store].values()].map(clone); },
    async clear(store) { data[store].clear(); },
  };
}
