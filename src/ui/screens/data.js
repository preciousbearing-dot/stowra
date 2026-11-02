import { h, fill, ago } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { toast, confirmBox } from '../kit/overlay.js';
import { native } from '../../platform/native.js';
import { buildBackup, readBackup, restoreBackup } from '../../core/backup.js';
import { showLock } from './lock.js';

const head = (ctx, title) => h('div', { class: 'top' }, h('button', { class: 'iconbtn plain', 'aria-label': 'Back', onClick: () => ctx.router.back() }, icon('back')), h('h1', { class: 'title', style: { fontSize: '26px' }, text: title }), h('span', { style: { width: '44px' } }));

/** Backup and restore. A backup never contains AI keys. */
export async function dataScreen(ctx) {
  const last = await ctx.repo.prefs.read('lastBackup', 0);
  let withFiles = true;
  const el = h('div', {});
  const status = h('div', { class: 'status', role: 'status', style: { display: 'none' } });
  const say = (t, bad) => { status.style.setProperty('display', 'block'); status.className = 'status' + (bad ? ' bad' : ''); status.textContent = t; };
  const toggle = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Include saved files', onChange: (e) => { withFiles = e.target.checked; } });
  const picker = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  picker.addEventListener('change', async () => {
    const f = picker.files[0]; if (!f) return; const text = await f.text(); picker.value = '';
    const r = readBackup(text);
    if (!r.ok) return say(r.error, true);
    const n = r.data.keeps.length;
    if (!(await confirmBox('Restore this backup?', `It has ${n} ${n === 1 ? 'Keep' : 'Keeps'}. Anything already on this phone stays as it is; only missing items are added.`, 'Restore', false))) return;
    const out = await restoreBackup(ctx.repo, r.data); ctx.keeps.bus.emit('changed', { type: 'restore' });
    say(`Restored ${out.keeps} ${out.keeps === 1 ? 'Keep' : 'Keeps'}, ${out.collections} Collections and ${out.creations} Creations.`); toast('Backup restored');
  });
  fill(el, head(ctx, 'Backup and restore'),
    h('div', { class: 'notice', text: 'Your Trove lives only on this phone. A backup is one file you can keep in Google Drive, email to yourself, or move to a new phone. AI keys are never included.' }),
    h('div', { class: 'sect' }, h('h2', { class: 'h2', text: 'Back up now' }), h('p', { class: 'sub', text: last ? `Last backup ${ago(last)}` : 'You have not backed up yet.' }),
      h('label', { class: 'row', style: { padding: '12px 0', borderBottom: '0' } }, toggle, h('div', { class: 'grow' }, h('div', { text: 'Include saved files' }), h('div', { class: 'rs', text: 'PDFs and pictures you added. Makes the file bigger.' }))),
      h('button', { class: 'btn', style: { width: '100%' }, text: 'Save backup file', onClick: async (e) => {
        e.target.disabled = true; const b = await buildBackup(ctx.repo, { files: withFiles });
        const ok = await native.saveFile(b.name, b.text);
        e.target.disabled = false;
        if (ok) { await ctx.repo.prefs.write('lastBackup', Date.now()); say(`Saved ${b.name} with ${b.counts.keeps} Keeps, ${b.counts.collections} Collections and ${b.counts.creations} Creations.${native.update.available ? ' Find it in your Downloads folder.' : ''}`); } else say('Could not save the file.', true);
      } })),
    h('div', { class: 'sect' }, h('h2', { class: 'h2', text: 'Restore' }), h('p', { class: 'sub', text: 'Choose a Stowra backup file. Nothing on this phone is overwritten.' }), h('button', { class: 'btn ghost', style: { width: '100%', marginTop: '12px' }, text: 'Choose backup file', onClick: () => picker.click() }), picker),
    h('div', { class: 'pad' }, status));
  return el;
}

/** Privacy lock settings. */
export async function privacyScreen(ctx) {
  const el = h('div', {});
  const draw = () => fill(el, head(ctx, 'Privacy lock'),
    h('div', { class: 'notice', text: 'A PIN keeps casual eyes out when someone picks up your phone. It does not encrypt your library, so keep your phone locked too.' }),
    h('div', { style: { marginTop: '8px' } },
      ctx.lock.enabled ? h('div', {}, h('div', { class: 'row' }, icon('lock', 22), h('div', { class: 'grow' }, h('div', { text: 'PIN lock is on' }), h('div', { class: 'rs', text: `Locks ${ctx.lock.graceSeconds} seconds after you leave the app` }))),
        h('button', { class: 'row', onClick: async () => { if (await showLock(document.getElementById('app'), ctx.lock)) { await ctx.lock.disable(); toast('PIN lock turned off'); draw(); } } }, icon('close', 22), h('div', { class: 'grow', text: 'Turn off (needs your PIN)' })))
        : h('button', { class: 'row', onClick: async () => { if (await showLock(document.getElementById('app'), ctx.lock, { mode: 'set' })) { toast('PIN lock is on'); draw(); } } }, icon('lock', 22), h('div', { class: 'grow' }, h('div', { text: 'Set a PIN' }), h('div', { class: 'rs', text: '4 to 8 digits' })), icon('chevron', 18))),
    h('p', { class: 'hint pad', text: 'If you forget the PIN, the only way back in is to clear Stowra\'s data in Android settings, which erases the library. Make a backup first.' }));
  draw(); return el;
}
