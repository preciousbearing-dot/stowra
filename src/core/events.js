/** A tiny event bus. Each bus is owned by the module that creates it. */
export function createBus() {
  /** @type {Map<string, Set<Function>>} */
  const map = new Map();
  return {
    /** @param {string} type @param {(payload: any) => void} fn @returns {() => void} unsubscribe */
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type).delete(fn);
    },
    /** @param {string} type @param {any} [payload] */
    emit(type, payload) {
      for (const fn of [...(map.get(type) || [])]) {
        try { fn(payload); } catch (e) { /* one bad listener must not break the others */ }
      }
    },
  };
}
