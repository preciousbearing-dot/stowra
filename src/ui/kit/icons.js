const NS = 'http://www.w3.org/2000/svg';
/** Line icons, 24 grid, 1.7 stroke. One family so nothing looks pasted in. */
const P = {
  back: 'M15 5l-7 7 7 7', more: 'M5 12h.01M12 12h.01M19 12h.01', plus: 'M12 5v14M5 12h14', search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4',
  trove: 'M5 8h14M7 8V6h10v2M6 8l1 11h10l1-11', collections: 'M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  kiko: 'M5 12a7 7 0 1 0 14 0a7 7 0 1 0-14 0M14.5 9.5h.01M9.5 9.5h.01M9 14c1 1 5 1 6 0', you: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM5 20c1-4 4-5 7-5s6 1 7 5',
  check: 'M5 12l5 5 9-10', close: 'M6 6l12 12M18 6L6 18', external: 'M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v6h14v-6', play: 'M8 5.5v13l11-6.5z', archive: 'M4 7h16v3H4zM6 10v8h12v-8M10 14h4', trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  tag: 'M4 12V5h7l9 9-7 7zM8 8h.01', file: 'M7 4h7l4 4v12H7zM14 4v4h4', note: 'M6 4h12v16H6zM9 9h6M9 13h6', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  filter: 'M4 6h16M7 12h10M10 18h4', restore: 'M4 12a8 8 0 1 0 3-6M4 5v4h4', key: 'M14 10a4 4 0 1 0-3.5 4l1.5 1.5H14V17h2v-2h1.5l1-1M9.5 10h.01', sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
  copy: 'M9 9h10v11H9zM5 15V4h10', send: 'M5 12l15-7-5 15-3-6z', spark: 'M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z', clock: 'M12 7v5l3 2M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0',
  download: 'M12 4v11M8 11l4 4 4-4M5 19h14', upload: 'M12 16V5M8 9l4-4 4 4M5 19h14', lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z', chevron: 'M9 5l7 7-7 7', edit: 'M5 19l1-4L16 5l3 3L9 18zM14 7l3 3',
  image: 'M5 5h14v14H5zM5 15l4-4 4 4 2-2 4 4M15 9h.01', refresh: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5', warn: 'M12 4l9 16H3zM12 10v4M12 17h.01', laptop: 'M5 6h14v9H5zM3 19h18',
};
/** @param {string} name @param {number} [size] @returns {SVGElement} */
export function icon(name, size = 22) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', P[name] || P.file); s.appendChild(p);
  return s;
}
export const ICON_NAMES = Object.keys(P);
