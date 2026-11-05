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
const M = plugin('StowraMedia');
const U = plugin('StowraUpdate');
// The official Capacitor App plugin: it gives us the Android back button and a clean exit. Without a listener Android closes the app.
const A = plugin('App');

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
  /** Save text as a file the person can find: Downloads on the phone, a normal download in a browser. @returns {Promise<boolean>} */
  async saveFile(name, text, mime = 'application/json') {
    if (N) { try { const b64 = btoa(unescape(encodeURIComponent(text))); await N.saveToDownloads({ name, mime, base64: b64 }); return true; } catch (e) { return false; } }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); return true; } catch (e) { return false; }
  },
  /** Match the status and navigation bars to the look. */
  async setBars(color, darkIcons) { if (N) { try { await N.setBars({ color, darkIcons }); } catch (e) { /* ignore */ } } },
  /** Give the share sheet the current look. */
  async setOverlayTheme(tokens) { if (N) { try { await N.setOverlayTheme({ tokens }); } catch (e) { /* ignore */ } } },
  /** Read the text in a picture on the phone with ML Kit. Nothing leaves the phone. Null when this build cannot do it. @param {Blob} blob @returns {Promise<string>} */
  ocr: M ? async (blob) => {
    const { readImageFile } = await import('../capture/images.js');
    const url = await readImageFile(blob, 2400);
    return String((await M.recognizeText({ data: url.split(',')[1] || '' })).text || '');
  } : null,
  /** True when the phone can choose a long video and cut its sound into small pieces. */
  canPickVideo: Boolean(M),
  /** Choose a video and cut out its sound. @returns {Promise<{cancelled?: boolean, name?: string, durationMs?: number, thumb?: string, dir?: string, segments?: {path: string, startMs: number, durationMs: number, bytes: number}[]}>} */
  async pickVideo() { if (!M) return { cancelled: true }; return M.pickVideo(); },
  /** A web address the page can fetch for a file the phone made. @param {string} path */
  mediaFileUrl(path) { return cap.convertFileSrc ? cap.convertFileSrc('file://' + path) : path; },
  /** Delete the sound pieces made for a video. @param {string} dir */
  async cleanupMedia(dir) { if (M) { try { await M.cleanup({ dir }); } catch (e) { /* ignore */ } } },
  /** Files kept inside the app folder, so big videos never sit in the app database. Null in a browser and in builds without the media plugin. */
  files: M ? (() => {
    let dir = '';
    const need = async () => { if (!dir) dir = String((await M.storeInfo({})).dir || ''); return dir; };
    const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
    return {
      /** Address the page can play or show. Call ready() once first. @param {string} name */
      url(name) { return cap.convertFileSrc ? cap.convertFileSrc('file://' + dir + '/' + name) : dir + '/' + name; },
      ready: need,
      /** Write a blob in pieces so a large file never has to sit in memory as one string. @param {string} name @param {Blob} blob */
      async write(name, blob) {
        await need(); const STEP = 786432; let i = 0;
        if (!blob.size) { await M.storeChunk({ name, base64: '', append: false }); return 0; }
        for (; i < blob.size; i += STEP) await M.storeChunk({ name, base64: await toB64(blob.slice(i, i + STEP)), append: i > 0 });
        const info = await M.storeInfo({ name }); if (!info.exists || info.size !== blob.size) throw new Error('The file did not save in full.');
        return info.size;
      },
      async info(name) { return M.storeInfo({ name }); },
      async remove(name) { try { await M.deleteStored({ name }); } catch (e) { /* already gone */ } },
      /**
       * Download an address straight into the app folder. Returns the stored name, size and type.
       * @param {{url: string, headers?: Record<string, string>, id: string, chunk?: boolean, onProgress?: (done: number, total: number) => void}} o
       */
      async download(o) {
        await need(); let sub = null;
        if (o.onProgress && M.addListener) { try { sub = await M.addListener('dlprogress', (e) => { if (e && e.id === o.id) o.onProgress(Number(e.done) || 0, Number(e.total) || 0); }); } catch (e) { /* no progress bar */ } }
        try { return await M.downloadFile({ url: o.url, headers: o.headers || {}, id: o.id, chunkBytes: o.chunk ? 9 * 1024 * 1024 : 0 }); } finally { if (sub && sub.remove) sub.remove(); }
      },
      cancel: (id) => M.cancelDownload({ id }),
      /** Cut the sound out of a stored video (for transcribing). */
      prepare: (name) => M.prepareStored({ name }),
      /** Read text on pictures taken through a stored video. @returns {Promise<{frames: {atMs: number, text: string}[], durationMs: number}>} */
      scan: (name, count) => M.scanFrames({ name, count }),
      /** Copy into the phone gallery. @returns {Promise<{where: string}>} */
      exportToGallery: (name, displayName, mime) => M.exportToGallery({ name, displayName, mime }),
    };
  })() : null,
  /** Open a link in the phone's browser. */
  async openExternal(url) {
    if (N) { try { await N.openExternal({ url }); return; } catch (e) { /* fall back */ } }
    window.open(url, '_blank', 'noopener');
  },
  /** Listen for the Android back button or swipe. The callback runs every time; with no listener Android would close the app. */
  async onBack(cb) {
    if (!A) return false;
    try { await A.addListener('backButton', () => cb()); return true; } catch (e) { return false; }
  },
  /** Close the app. In a browser there is nothing to close, so tests can see the request. */
  async exitApp() {
    globalThis.__stowraExits = (globalThis.__stowraExits || 0) + 1;
    if (A) { try { await A.exitApp(); return true; } catch (e) { /* fall through */ } }
    return false;
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
