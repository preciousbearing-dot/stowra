import { h } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { homeStats } from '../../core/stats.js';

const SVG = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

/** The Advanced home: hero with a 7 day bar chart, Sources, Processed ring, and two small tiles. @param {any[]} all @param {{router: any}} ctx */
export function advancedPanel(all, ctx) {
  const s = homeStats(all);
  const bars = h('div', { class: 'bars', role: 'img', 'aria-label': `Keeps added in the last 7 days: ${s.days.map((d) => `${d.day} ${d.n}`).join(', ')}` },
    s.days.map((d) => h('div', { class: 'bcol' }, h('i', { class: 'bar' + (d.today ? ' now' : ''), style: { height: d.pct + '%' } }), h('span', { text: d.label }))));
  const delta = s.delta === 0 ? 'Same as last week' : `${s.delta > 0 ? '+' : ''}${s.delta} vs last week`;
  const hero = h('div', { class: 'ahero' },
    h('span', { class: 'lbl', text: 'In your Trove' }),
    h('div', { class: 'arow' }, h('span', { class: 'big', text: String(s.total) }), h('span', { class: 'delta', text: delta })),
    bars);
  const segs = h('div', { class: 'stack', role: 'img', 'aria-label': 'Where your Keeps come from' }, s.sources.map((x, i) => h('i', { class: 'seg s' + i, style: { 'flex-grow': String(Math.max(x.n, 1)) } })));
  const legend = h('div', { class: 'legend' }, s.sources.map((x, i) => h('span', {}, h('i', { class: 'sw s' + i }), `${x.name} ${x.pct}%`)));
  const R = 26; const C = 2 * Math.PI * R;
  const ring = sv('svg', { viewBox: '0 0 64 64', width: 64, height: 64, 'aria-hidden': 'true' });
  ring.append(sv('circle', { cx: 32, cy: 32, r: R, fill: 'none', 'stroke-width': 7, class: 'rtrack' }));
  ring.append(sv('circle', { cx: 32, cy: 32, r: R, fill: 'none', 'stroke-width': 7, 'stroke-linecap': 'round', class: 'rval', 'stroke-dasharray': `${(C * s.processedPct) / 100} ${C}`, transform: 'rotate(-90 32 32)' }));
  const card = (cls, ...kids) => h('div', { class: 'acard ' + cls }, kids);
  return h('div', { class: 'apanel' }, hero,
    h('div', { class: 'arow2' },
      card('src', h('div', { class: 'ct2', text: 'Sources' }), segs, legend),
      card('ring', h('div', { class: 'ct2', text: 'Processed' }), h('div', { class: 'ringw' }, ring, h('b', { text: s.processedPct + '%' })))),
    h('div', { class: 'arow2' },
      h('button', { class: 'acard tile', onClick: () => ctx.router.go('/rediscover') }, h('span', { class: 'lbl2' }, h('i', { class: 'pip' }), 'Rediscover'), h('span', { class: 'tv', text: 'Bring one back' }), icon('chevron', 18)),
      h('button', { class: 'acard tile', onClick: () => ctx.router.go('/search') }, h('span', { class: 'lbl2', text: 'Needs attention' }), h('span', { class: 'tv', text: s.attention ? `${s.attention} to check` : 'All clear' }), icon('chevron', 18))));
}
