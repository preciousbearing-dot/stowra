import { h } from './dom.js';
import { icon } from './icons.js';

const TABS = [['trove', 'Trove', 'trove'], ['collections', 'Collections', 'collections'], null, ['kiko', 'Kiko', 'kiko'], ['settings', 'You', 'you']];
/** Bottom navigation with a centre Keep button. @returns {{el: HTMLElement, set(tab: string|null): void}} */
export function createNav({ go, onAdd }) {
  const el = h('nav', { class: 'nav', 'aria-label': 'Main' });
  const btns = {};
  for (const t of TABS) {
    if (!t) { el.append(h('button', { class: 'fab', 'aria-label': 'Keep something', onClick: onAdd }, icon('plus', 26))); continue; }
    const b = h('button', { class: 'tab', onClick: () => go(`/${t[0]}`) }, icon(t[2], 22), h('span', { text: t[1] }));
    btns[t[0]] = b; el.append(b);
  }
  return { el, set(tab) { for (const [k, b] of Object.entries(btns)) { if (k === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); } } };
}
