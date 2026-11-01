import { MIGRATIONS, SCHEMA_VERSION } from './migrations.js';
import { StorageError } from '../core/errors.js';

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(new StorageError('Storage request failed', { code: 'idb_request', cause: req.error }));
});

/**
 * IndexedDB adapter. Production storage.
 * @param {string} [name]
 */
export function createIdbAdapter(name = 'stowra') {
  /** @type {IDBDatabase | null} */
  let db = null;
  const store = (s, mode) => db.transaction(s, mode).objectStore(s);
  return {
    kind: 'idb',
    open() {
      return new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) { reject(new StorageError('IndexedDB is not available', { code: 'idb_missing' })); return; }
        const req = indexedDB.open(name, SCHEMA_VERSION);
        req.onupgradeneeded = (e) => {
          for (let v = e.oldVersion; v < SCHEMA_VERSION; v++) MIGRATIONS[v](req.result, req.transaction);
        };
        req.onsuccess = () => { db = req.result; resolve(); };
        req.onerror = () => reject(new StorageError('Could not open storage', { code: 'idb_open', cause: req.error }));
        req.onblocked = () => reject(new StorageError('Storage is blocked by another tab', { code: 'idb_blocked' }));
      });
    },
    async close() { if (db) { db.close(); db = null; } },
    get: (s, id) => wrap(store(s, 'readonly').get(id)),
    async put(s, obj) { await wrap(store(s, 'readwrite').put(obj)); return obj.id; },
    delete: (s, id) => wrap(store(s, 'readwrite').delete(id)),
    all: (s) => wrap(store(s, 'readonly').getAll()),
    clear: (s) => wrap(store(s, 'readwrite').clear()),
  };
}
