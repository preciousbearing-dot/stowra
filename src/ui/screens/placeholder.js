/**
 * Temporary screens for the foundation build. Real Trove, tour, key setup and theme picker arrive in later stages.
 * @param {HTMLElement} root
 * @param {{title: string, body: string, button?: string, onButton?: () => void}} o
 */
export function showPlaceholder(root, o) {
  const el = document.createElement('main');
  el.className = 'screen';
  el.dataset.screen = o.title;
  const h = document.createElement('h1');
  h.textContent = o.title;
  const p = document.createElement('p');
  p.textContent = o.body;
  el.append(h, p);
  if (o.button) {
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = o.button;
    b.addEventListener('click', () => o.onButton && o.onButton());
    el.append(spacer, b);
  }
  root.appendChild(el);
  return el;
}
