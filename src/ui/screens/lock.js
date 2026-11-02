import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';

/** Full-screen PIN pad. Resolves when the right PIN is entered, or (setup mode) when a PIN is set. @param {HTMLElement} root @param {any} lock @param {{mode?: 'unlock'|'set'}} [o] */
export function showLock(root, lock, o = {}) {
  return new Promise((resolve) => {
    let pin = ''; let first = ''; let msg = ''; const set = o.mode === 'set'; let busy = false;
    const el = h('div', { class: 'lockscreen', role: 'dialog', 'aria-modal': 'true', 'aria-label': set ? 'Set a PIN' : 'Locked' }); root.append(el);
    const ttl = h('h1', { class: 'title' }); const dots = h('div', { class: 'pin-dots' }); const m = h('p', { class: 'sub', role: 'status', style: { textAlign: 'center', minHeight: '20px' } });
    const draw = () => { ttl.textContent = set ? (first ? 'Confirm your PIN' : 'Choose a PIN') : 'Stowra is locked'; fill(dots, Array.from({ length: Math.max(4, pin.length) }, (_, i) => h('span', { class: i < pin.length ? 'on' : '' }))); m.textContent = msg; };
    async function submit() {
      if (busy || pin.length < 4) return; busy = true;
      if (set) { if (!first) { first = pin; pin = ''; msg = 'Enter it again to confirm'; } else if (pin === first) { await lock.enable(pin); el.remove(); resolve(true); return; } else { first = ''; pin = ''; msg = 'The PINs did not match. Start again'; } }
      else { const r = await lock.check(pin); if (r.ok) { el.remove(); resolve(true); return; } pin = ''; msg = r.wait ? `Too many tries. Wait ${r.wait} seconds` : 'Wrong PIN'; }
      busy = false; draw();
    }
    const key = (d) => h('button', { class: 'key', text: d, 'aria-label': d, onClick: () => { if (pin.length < 8) { pin += d; msg = ''; draw(); } } });
    fill(el, h('div', { style: { textAlign: 'center', marginTop: '12vh' } }, h('div', { class: 'ob-icon', style: { margin: '0 auto 20px', width: '72px', height: '72px', borderRadius: '24px' } }, icon('lock', 30)), ttl, h('p', { class: 'sub', text: set ? '4 to 8 digits' : 'Enter your PIN' })), dots, m,
      h('div', { class: 'keys' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key), set ? h('button', { class: 'key ghost', text: 'Cancel', onClick: () => { el.remove(); resolve(false); } }) : h('span', {}), key('0'), h('button', { class: 'key ghost', 'aria-label': 'Delete', onClick: () => { pin = pin.slice(0, -1); draw(); } }, icon('back', 22))),
      h('button', { class: 'btn', style: { margin: '8px 24px 0', width: 'calc(100% - 48px)' }, text: set ? (first ? 'Confirm' : 'Next') : 'Unlock', onClick: submit }));
    draw();
  });
}
