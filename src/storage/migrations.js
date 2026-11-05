/** Ordered schema steps. Never edit a shipped step: add a new one. */
export const STORES = ['keeps', 'collections', 'creations', 'chunks', 'settings', 'vectors'];

export const MIGRATIONS = [
  /** v1: all stores keyed by id, with the indexes the Trove needs. */
  (db) => {
    for (const name of STORES.filter((n) => n !== 'vectors')) {
      const s = db.createObjectStore(name, { keyPath: 'id' });
      if (name === 'keeps') {
        s.createIndex('status', 'status');
        s.createIndex('createdAt', 'createdAt');
      }
    }
  },
  /** v2: meaning vectors for Smart search. Rebuildable, so never part of a backup. */
  (db) => { db.createObjectStore('vectors', { keyPath: 'id' }); },
];

export const SCHEMA_VERSION = MIGRATIONS.length;
