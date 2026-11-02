import { h, fill } from './dom.js';
import { icon } from './icons.js';

let layer;
function root() { if (!layer || !layer.isConnected) { layer = h('div', { class: 'layer' }); document.getElementById('app').appendChild(layer); } return layer; }

/**
 * Bottom sheet. Returns {el, body, close}. Tapping outside or the Android back gesture closes it.
 * @param {{title?: string, onClose?: () => void, tall?: boolean}} o
 */
export function sheet(o = {}) {
  const body = h('div', { class: 'sheet-body' });
  const scrim = h('div', { class: 'scrim', onClick: () => close() });
  const el = h('div', { class: 'sheet' + (o.tall ? ' tall' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Sheet' },
    h('div', { class: 'grab' }), o.title ? h('h2', { class: 'sheet-title', text: o.title }) : null, body);
  const wrap = h('div', { class: 'sheet-wrap' }, scrim, el);
  root().appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('on'));
  let closed = false;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  function close() {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey);
    wrap.classList.remove('on');
    setTimeout(() => wrap.remove(), 220);
    if (o.onClose) o.onClose();
  }
  return { el, body, close };
}

/** A list of actions in a sheet. @param {string} title @param {{label: string, icon?: string, danger?: boolean, run: () => void}[]} items */
export function menu(title, items) {
  const s = sheet({ title });
  fill(s.body, h('div', { class: 'menu' }, items.map((it) => h('button', { class: 'menu-item' + (it.danger ? ' danger' : ''), onClick: () => { s.close(); it.run(); } }, it.icon ? icon(it.icon, 20) : null, h('span', { text: it.label })))));
  return s;
}

/** @returns {Promise<boolean>} */
export function confirmBox(title, body, yes = 'Delete', danger = true) {
  return new Promise((res) => {
    let done = false;
    const s = sheet({ title, onClose: () => { if (!done) res(false); } });
    fill(s.body, h('p', { class: 'sheet-text', text: body }), h('div', { class: 'row-btns' },
      h('button', { class: 'btn ghost', text: 'Cancel', onClick: () => s.close() }),
      h('button', { class: 'btn' + (danger ? ' danger' : ''), text: yes, onClick: () => { done = true; res(true); s.close(); } })));
  });
}

/** Ask for one line of text. @returns {Promise<string|null>} */
export function promptBox(title, label, value = '', action = 'Save') {
  return new Promise((res) => {
    let done = false;
    const s = sheet({ title, onClose: () => { if (!done) res(null); } });
    const input = h('input', { class: 'field', type: 'text', value, 'aria-label': label, placeholder: label, maxlength: 80 });
    const go = () => { done = true; res(input.value.trim()); s.close(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    fill(s.body, input, h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', text: 'Cancel', onClick: () => s.close() }), h('button', { class: 'btn', text: action, onClick: go })));
    setTimeout(() => input.focus(), 260);
  });
}

let toastTimer;
/** @param {string} text @param {{action?: string, onAction?: () => void}} [o] */
export function toast(text, o = {}) {
  root().querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, h('span', { text }), o.action ? h('button', { class: 'toast-act', text: o.action, onClick: () => { t.remove(); o.onAction && o.onAction(); } }) : null);
  root().appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 220); }, o.action ? 5000 : 2800);
}
