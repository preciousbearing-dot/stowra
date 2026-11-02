import { h } from './dom.js';
import { native } from '../../platform/native.js';

/** Render "[label](https://...)" and "**bold**" as real elements. Anything else stays plain text. @param {string} s @returns {Node[]} */
export function rich(s) {
  const out = []; const re = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*/g; let last = 0; let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(document.createTextNode(s.slice(last, m.index)));
    if (m[1]) out.push(h('a', { href: m[2], class: 'ext', onClick: (e) => { e.preventDefault(); native.openExternal(m[2]); } }, m[1]));
    else out.push(h('b', { text: m[3] }));
    last = re.lastIndex;
  }
  if (last < s.length) out.push(document.createTextNode(s.slice(last)));
  return out;
}
