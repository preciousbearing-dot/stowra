/**
 * The only door to Android. Everything here has a safe web fallback so the app still runs in a browser (and in tests).
 * JS names match the Java plugins: StowraNative (share queue, bars, secrets) and StowraUpdate (app updater).
 */
const cap = globalThis.Capacitor;
export const isNative = Boolean(cap && cap.isNativePlatform && cap.isNativePlatform());

function plugin(name) {
  if (!isNative) return null;
  try { return cap.registerPlugin ? cap.registerPlugin(name) : (cap.Plugins || {})[name] || null; } catch (e) { return null; }
}
const N = plugin('StowraNative');
const U = plugin('StowraUpdate');

const SEC_PREFIX = 'stowra.sec.';

/** Secret storage. Android Keystore on the phone. In a browser it falls back to local storage and says so. */
export const secure = {
  /** @returns {'keystore'|'browser'} */
  get level() { return N ? 'keystore' : 'browser'; },
  /** @param {string} key @param {string} value */
  async set(key, value) {
    if (N) { await N.secureSet({ key, value }); return; }
    try { localStorage.setItem(SEC_PREFIX + key, btoa(unescape(encodeURIComponent(value)))); } catch (e) { /* storage blocked */ }
  },
  /** @param {string} key @returns {Promise<string|null>} */
  async get(key) {
    if (N) { try { const r = await N.secureGet({ key }); return r.value == null ? null : String(r.value); } catch (e) { return null; } }
    try { const v = localStorage.getItem(SEC_PREFIX + key); return v == null ? null : decodeURIComponent(escape(atob(v))); } catch (e) { return null; }
  },
  /** @param {string} key */
  async delete(key) {
    if (N) { try { await N.secureDelete({ key }); } catch (e) { /* already gone */ } return; }
    try { localStorage.removeItem(SEC_PREFIX + key); } catch (e) { /* storage blocked */ }
  },
};

export const native = {
  isNative,
  /** Shares that arrived through the Android share sheet since the last call. @returns {Promise<any[]>} */
  async drainShares() {
    if (!N) return [];
    try { return (await N.drainShares()).shares || []; } catch (e) { return []; }
  },
  /** @param {string} path @returns {Promise<string|null>} base64 */
  async readShareFile(path) {
    if (!N) return null;
    try { return (await N.readShareFile({ path })).base64; } catch (e) { return null; }
  },
  /** @param {string} path */
  async deleteShareFile(path) { if (N) { try { await N.deleteShareFile({ path }); } catch (e) { /* ignore */ } } },
  /** Match the status and navigation bars to the look. */
  async setBars(color, darkIcons) { if (N) { try { await N.setBars({ color, darkIcons }); } catch (e) { /* ignore */ } } },
  /** Give the share sheet the current look. */
  async setOverlayTheme(tokens) { if (N) { try { await N.setOverlayTheme({ tokens }); } catch (e) { /* ignore */ } } },
  /** Open a link in the phone's browser. */
  async openExternal(url) {
    if (N) { try { await N.openExternal({ url }); return; } catch (e) { /* fall back */ } }
    window.open(url, '_blank', 'noopener');
  },
  update: {
    available: Boolean(U),
    status: () => (U ? U.status() : Promise.resolve({ state: 'idle', pct: 0, allowed: true })),
    download: (url, bytes) => (U ? U.download({ url, bytes: bytes || 0 }) : Promise.reject(new Error('Not on Android'))),
    install: () => (U ? U.install() : Promise.reject(new Error('Not on Android'))),
    openSettings: () => (U ? U.openSettings() : Promise.resolve()),
    cancel: () => (U ? U.cancel() : Promise.resolve()),
    cleanup: () => (U ? U.cleanup() : Promise.resolve()),
  },
};
