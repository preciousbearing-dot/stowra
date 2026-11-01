const WORD = 'Stowra';

/** The amber drop, same artwork as the app icon. */
const DROP = `<svg viewBox="0 0 72 88" aria-hidden="true">
<defs><linearGradient id="spA" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#FFC85A"/><stop offset="0.55" stop-color="#E8821A"/><stop offset="1" stop-color="#9A4308"/></linearGradient></defs>
<g class="rings"><ellipse class="sp-ring" cx="36" cy="86" rx="30" ry="7" stroke-width="1.4"/><ellipse class="sp-ring" cx="36" cy="86" rx="30" ry="7" stroke-width="1"/><ellipse class="sp-ring" cx="36" cy="86" rx="30" ry="7" stroke-width="0.8"/></g>
<g class="dp"><path d="M36 4C36 4 6 38 6 58a30 30 0 0 0 60 0C66 38 36 4 36 4Z" fill="url(#spA)"/><path d="M20 52C19 62 22 70 28 74" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.55"/><rect x="27" y="44" width="22" height="26" rx="6" transform="rotate(-10 38 57)" fill="#FBF1D9"/></g>
</svg>`;

const LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/**
 * Show the splash for the current look. It reads only theme tokens, so it matches every theme and mode.
 * @param {HTMLElement} root
 * @param {{quick?: boolean, reducedMotion?: boolean}} [opts] quick = shorter timings for reopens
 * @returns {Promise<void>} resolves when the splash is gone
 */
export function showSplash(root, opts = {}) {
  const t = opts.quick ? 0.7 : 1;
  const el = document.createElement('div');
  el.className = 'splash';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Stowra');
  el.style.setProperty('--t', String(t));
  el.innerHTML = `<div class="sp-glow"></div><div class="sp-drop">${DROP}</div><div class="sp-word" aria-hidden="true"></div>
<p class="sp-tag">Don't just save what you discover.<br><b>Put it to work.</b></p><div class="sp-priv">${LOCK}Private on your phone</div>`;
  const word = el.querySelector('.sp-word');
  [...WORD].forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.setProperty('--i', String(i));
    word.appendChild(s);
  });
  root.appendChild(el);
  const reduced = opts.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hold = reduced ? 700 : Math.round(2700 * t);
  return new Promise((resolve) => {
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); resolve(); }, reduced ? 0 : Math.round(300 * t));
    }, hold);
  });
}
