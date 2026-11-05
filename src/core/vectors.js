import { cosine, rrf } from '../retrieval/hybrid.js';

/** The text that stands for a Keep when it is turned into a meaning vector. @param {any} k */
export function keepText(k) {
  return [k.title, (k.tags || []).join(', '), k.why, k.note, k.summary, (k.points || []).join('. '), String(k.text || '').slice(0, 2500)].filter(Boolean).join('\n').slice(0, 5000);
}
/** Small stable hash so a changed Keep gets re-indexed. @param {string} s */
export function hashText(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }

/**
 * Smart search: meaning vectors kept on this phone. Off until the person turns it on, because indexing sends Keep text to Gemini.
 * @param {{repo: any, keeps: any, ai: any}} deps
 */
export function createSmart({ repo, keeps, ai }) {
  let on = false; let busy = false; let timer = null; let cache = null; let lastError = '';
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f(status()));
  const eligible = (all) => all.filter((k) => !k.deletedAt && keepText(k).trim().length > 3);
  async function load() { on = Boolean(await repo.prefs.read('smart', false)); if (on) schedule(); return on; }
  function status() { return { on, busy, error: lastError, ready: on && ai.hasKey('gemini') }; }
  async function vectors() { if (!cache) cache = new Map((await repo.vectors.all()).map((r) => [r.id, r])); return cache; }
  async function setOn(v) { on = Boolean(v); await repo.prefs.write('smart', on); lastError = ''; if (on) schedule(0); emit(); }
  async function counts() { const all = eligible(await keeps.list({}).then(async (a) => a.concat(await keeps.list({ view: 'archive' })))); const vs = await vectors(); let done = 0; for (const k of all) { const r = vs.get(k.id); if (r && r.h === hashText(keepText(k))) done++; } return { done, total: all.length }; }
  /** Index every Keep that is new or changed. Safe to call again; stops on the first provider error and says why. @param {(done: number, total: number) => void} [onProgress] */
  async function indexNow(onProgress) {
    if (busy || !on || !ai.hasKey('gemini')) return { done: 0, total: 0, skipped: true };
    busy = true; lastError = ''; emit();
    try {
      const all = eligible((await keeps.list({})).concat(await keeps.list({ view: 'archive' })));
      const vs = await vectors();
      const todo = all.filter((k) => { const r = vs.get(k.id); return !r || r.h !== hashText(keepText(k)); });
      let n = 0;
      for (let i = 0; i < todo.length; i += 20) {
        const part = todo.slice(i, i + 20);
        const out = await ai.embed(part.map(keepText), 'RETRIEVAL_DOCUMENT');
        for (let j = 0; j < part.length; j++) { const rec = { id: part[j].id, h: hashText(keepText(part[j])), v: out[j] }; await repo.vectors.put(rec); vs.set(rec.id, rec); }
        n += part.length; if (onProgress) onProgress(n, todo.length);
      }
      const ids = new Set(all.map((k) => k.id)); for (const id of [...vs.keys()]) if (!ids.has(id)) { await repo.vectors.delete(id); vs.delete(id); }
      return { done: n, total: todo.length };
    } catch (e) { lastError = (e && e.message) || 'Smart search could not finish.'; return { done: 0, total: 0, error: lastError }; } finally { busy = false; emit(); }
  }
  function schedule(ms = 4000) { clearTimeout(timer); if (!on) return; timer = setTimeout(() => { indexNow(); }, ms); }
  async function clear() { await repo.vectors.clear(); cache = null; emit(); }
  /** Keeps closest in meaning to a question. @param {string} q @param {any[]} pool @returns {Promise<{keep: any, sim: number}[]>} */
  async function find(q, pool, n = 30) {
    if (!status().ready) return [];
    const vs = await vectors(); if (!vs.size) return [];
    const [qv] = await ai.embed([q], 'RETRIEVAL_QUERY', undefined, 1);
    return pool.map((k) => ({ keep: k, sim: vs.get(k.id) ? cosine(qv, vs.get(k.id).v) : -1 })).filter((r) => r.sim >= 0.45).sort((a, b) => b.sim - a.sim).slice(0, n);
  }
  /** Keeps closest in meaning to this Keep, using vectors already stored (no network). @param {any} keep @param {any[]} pool */
  async function similar(keep, pool, n = 3, min = 0.6) {
    if (!on) return [];
    const vs = await vectors(); const me = vs.get(keep.id); if (!me) return [];
    return pool.filter((k) => k.id !== keep.id && vs.get(k.id)).map((k) => ({ keep: k, sim: cosine(me.v, vs.get(k.id).v) })).filter((r) => r.sim >= min).sort((a, b) => b.sim - a.sim).slice(0, n);
  }
  async function vectorOf(id) { return (await vectors()).get(id)?.v || null; }
  /** Fuse keyword hits and meaning hits. @param {{keep: any}[]} kw @param {{keep: any, sim: number}[]} sem */
  function fuse(kw, sem) {
    const byId = new Map(); [...kw, ...sem].forEach((r) => byId.set(r.keep.id, r.keep));
    const inKw = new Set(kw.map((r) => r.keep.id));
    return rrf([kw.map((r) => ({ id: r.keep.id })), sem.map((r) => ({ id: r.keep.id }))]).map((e) => ({ keep: byId.get(e.id), byMeaning: !inKw.has(e.id) }));
  }
  keeps.bus.on('changed', () => schedule());
  return { load, status, setOn, indexNow, clear, find, similar, vectorOf, fuse, counts, onChange: (f) => { listeners.add(f); return () => listeners.delete(f); }, get on() { return on; } };
}
