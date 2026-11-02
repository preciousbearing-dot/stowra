const ITER = 120000;
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function derive(pin, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256));
}

/**
 * App lock with a PIN. Only a salted PBKDF2 hash is stored. Repeated wrong tries slow down.
 * This keeps casual eyes out; it does not encrypt the library on the phone.
 * @param {any} repo
 */
export function createLock(repo) {
  let state = { on: false, salt: '', hash: '', fails: 0, until: 0, after: 30 };
  return {
    async load() { state = { ...state, ...(await repo.prefs.read('lock', {})) }; return this; },
    get enabled() { return state.on; },
    get graceSeconds() { return state.after; },
    async enable(pin) {
      if (!/^\d{4,8}$/.test(pin)) throw new Error('Use 4 to 8 digits.');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      state = { ...state, on: true, salt: hex(salt), hash: await derive(pin, salt), fails: 0, until: 0 };
      await repo.prefs.write('lock', state);
    },
    /** @returns {Promise<{ok: boolean, wait?: number}>} */
    async check(pin, now = Date.now()) {
      if (now < state.until) return { ok: false, wait: Math.ceil((state.until - now) / 1000) };
      const salt = new Uint8Array(state.salt.match(/../g).map((h) => parseInt(h, 16)));
      if ((await derive(pin, salt)) === state.hash) { state.fails = 0; state.until = 0; await repo.prefs.write('lock', state); return { ok: true }; }
      state.fails++; state.until = state.fails >= 3 ? now + Math.min(300, 5 * 2 ** (state.fails - 3)) * 1000 : 0;
      await repo.prefs.write('lock', state);
      return { ok: false, wait: state.until ? Math.ceil((state.until - now) / 1000) : 0 };
    },
    async disable() { state = { ...state, on: false, salt: '', hash: '', fails: 0, until: 0 }; await repo.prefs.write('lock', state); },
  };
}
