import { h, fill } from './kit/dom.js';
import { sheet } from './kit/overlay.js';
import { sizeText } from './kit/bytes.js';
import { runUpdateCheck } from './screens/about.js';

const SNOOZE_MS = 6 * 3600 * 1000;

/**
 * A few seconds after Stowra opens, look for a new version and, if there is one, say so in a pop-up with the download size.
 * "Not now" stays quiet for that version for a few hours. A required update has no "Not now".
 * @param {any} ctx @param {{delayMs?: number, retries?: number}} [o]
 */
export function scheduleUpdatePrompt(ctx, o = {}) {
  const delay = o.delayMs == null ? 10000 : o.delayMs; let left = o.retries == null ? 3 : o.retries;
  const attempt = async () => {
    if (!navigator.onLine) return;
    // Do not interrupt a lock screen or something the person is in the middle of.
    if (document.querySelector('.lockscreen, .sheet-wrap.on') && left-- > 0) { setTimeout(attempt, delay); return; }
    const r = await runUpdateCheck(ctx).catch(() => null);
    if (!r || r.status !== 'available') return;
    const snooze = await ctx.repo.prefs.read('updateSnooze', {});
    if (!r.mandatory && snooze.v === r.latest && Date.now() < (snooze.until || 0)) return;
    showUpdateSheet(ctx, r);
  };
  setTimeout(() => { attempt().catch(() => {}); }, delay);
}

/** @param {any} ctx @param {any} r the result of checkForUpdate */
export function showUpdateSheet(ctx, r) {
  const s = sheet({ title: `Stowra ${r.latest} is ready` });
  const notes = (r.notes || []).slice(0, 4);
  fill(s.body,
    h('p', { class: 'sheet-text', 'data-update-size': r.size ? String(r.size) : '', text: r.size ? `Download size: ${sizeText(r.size)}. Using mobile data? That is what it will use.` : 'The download size is not shown by GitHub right now. It is usually around 60 MB.' }),
    r.mandatory ? h('p', { class: 'hint', text: 'This update is required for Stowra to keep working.' }) : null,
    notes.length ? h('ul', { style: { margin: '8px 0 4px', paddingLeft: '18px' } }, notes.map((n) => h('li', { class: 'hint', text: n }))) : null,
    h('div', { class: 'row-btns' },
      r.mandatory ? null : h('button', { class: 'btn ghost', text: 'Not now', onClick: async () => { await ctx.repo.prefs.write('updateSnooze', { v: r.latest, until: Date.now() + SNOOZE_MS }); s.close(); } }),
      h('button', { class: 'btn', text: 'Update now', onClick: () => { ctx.pendingUpdate = { res: r, start: true }; s.close(); ctx.router.go('/settings/about'); } })));
  return s;
}
