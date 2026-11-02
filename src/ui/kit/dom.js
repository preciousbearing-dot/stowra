/** Tiny element builder. Text always goes in as text, never as HTML, so saved page content cannot inject markup. */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') for (const [a, b] of Object.entries(v)) el.style.setProperty(a.startsWith('--') ? a : a.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), b);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  return el;
}
export function add(el, kids) {
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
/** Replace all children. @param {HTMLElement} el @param {...any} kids */
export function fill(el, ...kids) { el.replaceChildren(); return add(el, kids); }

/** "2 days ago" style time. @param {number} t @param {number} [now] */
export function ago(t, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const hr = Math.floor(m / 60); if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  const d = Math.floor(hr / 24); if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  const mo = Math.floor(d / 30); return mo < 12 ? `${mo} month${mo > 1 ? 's' : ''} ago` : `${Math.floor(mo / 12)} year${mo >= 24 ? 's' : ''} ago`;
}
