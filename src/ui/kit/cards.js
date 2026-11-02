import { h } from './dom.js';
import { icon } from './icons.js';
import { ago } from './dom.js';

const COVERS = ['#3A4553', '#24403F', '#4A3B33', '#33405A', '#3E3446', '#43402F', '#2F4A3D', '#4D3A3A'];
export const STATUS_LABEL = { saved: 'Saved', processing: 'Reading', ready: 'Ready', partial: 'Partly read', attention: 'Needs you', failed: 'Could not read' };

/** Same Keep always gets the same cover colour. @param {string} s */
export function coverColor(s) { let n = 0; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return COVERS[n % COVERS.length]; }

/** Thumbnail, or a generated cover when there is none. @param {any} k */
export function cover(k) {
  const el = h('div', { class: 'cover', style: { background: coverColor(k.source + k.title) } }, h('div', { class: 'ring' }));
  if (k.thumb) el.append(h('img', { src: k.thumb, alt: '', loading: 'lazy' }));
  else el.append(h('span', { text: k.source }));
  return el;
}

export function statusDot(k) { return h('span', { class: 'dot' + (k.status === 'saved' || k.status === 'processing' ? ' idle' : k.status === 'failed' || k.status === 'attention' ? ' warn' : '') }); }

/** @param {any} k @param {{selected?: boolean, onOpen: () => void, onHold: () => void}} o */
export function keepCard(k, o) {
  let timer; let held = false;
  const card = h('button', { class: 'card' + (o.selected ? ' sel' : ''), 'aria-label': k.title, dataset: { id: k.id } },
    cover(k), h('div', { class: 'check' }, icon('check', 16)),
    h('div', { class: 'meta' }, h('div', { class: 'ct', text: k.title }), h('div', { class: 'cs' }, statusDot(k), h('span', { text: `${k.source}, ${ago(k.createdAt)}` }))));
  card.addEventListener('pointerdown', () => { held = false; timer = setTimeout(() => { held = true; o.onHold(); }, 450); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) card.addEventListener(ev, () => clearTimeout(timer));
  card.addEventListener('click', (e) => { if (held) { held = false; e.preventDefault(); return; } o.onOpen(); });
  card.addEventListener('contextmenu', (e) => e.preventDefault());
  return card;
}

export function emptyState(title, body, action) {
  return h('div', { class: 'empty' }, h('div', { class: 'h2', text: title }), h('div', { text: body }), action || null);
}
