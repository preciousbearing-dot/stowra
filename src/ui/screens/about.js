import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { toast } from '../kit/overlay.js';
import { native } from '../../platform/native.js';
import { checkForUpdate, APK_URL } from '../../platform/updater.js';
import { VERSION } from '../../../version.js';

const head = (ctx, title) => h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: title }), h('span', { style: { width: '44px' } }));

/** Run the check and remember the answer so the Trove can mention it once. */
export async function runUpdateCheck(ctx) {
  const r = await checkForUpdate({ current: VERSION });
  await ctx.repo.prefs.write('lastUpdateCheck', { at: Date.now(), status: r.status, latest: r.latest || '' });
  return r;
}

/** Version, update check and plain facts about what Stowra can and cannot do yet. */
export async function aboutScreen(ctx) {
  const el = h('div', {}); let res = null; let busy = false; let dl = null; let poll;
  const stop = () => clearInterval(poll); ctx.onLeave(stop);

  function card() {
    if (busy) return h('div', { class: 'notice', text: 'Checking for updates' });
    if (!res) return null;
    if (res.status === 'unreachable') return h('div', { class: 'notice', text: 'Could not reach GitHub to check. Your network may be blocking it. Try again on another connection.' });
    if (res.status === 'current') return h('div', { class: 'notice', text: `You have the latest version, ${VERSION}.` });
    const notes = h('ul', { style: { margin: '8px 0 0', paddingLeft: '18px' } }, (res.notes || []).map((n) => h('li', { text: n })));
    const prog = dl && dl.state !== 'idle' ? h('div', {}, h('div', { class: 'prog' }, h('div', { style: { width: `${dl.pct || 0}%` } })), h('p', { class: 'hint', text: dl.state === 'waiting' ? 'Waiting for a connection' : dl.state === 'error' ? dl.error || 'The download stopped.' : dl.state === 'ready' ? 'Downloaded.' : `Downloading, ${dl.pct || 0}%` })) : null;
    return h('div', { class: 'notice' }, h('b', { text: `Version ${res.latest} is ready` }), res.mandatory ? h('p', { class: 'hint', text: 'This update is required for Stowra to keep working.' }) : null, notes, prog,
      h('button', { class: 'btn', style: { width: '100%', marginTop: '14px' }, text: dl && dl.state === 'ready' ? 'Install now' : 'Download and install', onClick: install }));
  }

  async function install() {
    if (!native.update.available) { native.openExternal(res.apkUrl || APK_URL); return; }
    try {
      if (dl && dl.state === 'ready') { const s = await native.update.status(); if (!s.allowed) { toast('Allow Stowra to install updates, then come back'); await native.update.openSettings(); return; } await native.update.install(); return; }
      await native.update.download(res.apkUrl || APK_URL, 0);
      stop(); poll = setInterval(async () => { dl = await native.update.status(); if (dl.state === 'ready' || dl.state === 'error') stop(); draw(); }, 600);
    } catch (e) { toast('Could not start the download'); }
  }

  function draw() {
    fill(el, head(ctx, 'About and updates'),
      h('div', { class: 'sect', style: { paddingTop: '8px' } }, h('div', { class: 'h2', text: 'Stowra' }), h('p', { class: 'sub', text: `Version ${VERSION}` }),
        h('button', { class: 'btn ghost small', style: { marginTop: '12px' }, text: 'Check for updates', onClick: async () => { busy = true; draw(); res = await runUpdateCheck(ctx); busy = false; draw(); } })),
      card() ? h('div', { style: { marginTop: '4px' } }, card()) : null,
      h('div', { class: 'sect' }, h('h2', { class: 'h2', text: 'What to expect' }),
        ...[['Private by design', 'Your Keeps stay on this phone. There is no account and no server.'], ['AI is optional', 'Saving, searching and your library work with no AI and no internet. Summaries and Kiko need your own key.'], ['Instagram and TikTok', 'These apps share only a link. Stowra keeps the link and source. For the content, paste the caption or add a screen recording.'], ['Pictures', 'A picture goes to an AI provider only when you tap to send it.']].map(([t, b]) => h('div', { style: { padding: '12px 0', borderBottom: '1px solid var(--ln)' } }, h('div', { style: { fontWeight: '600' }, text: t }), h('div', { class: 'sub', text: b })))));
  }
  draw();
  return el;
}
