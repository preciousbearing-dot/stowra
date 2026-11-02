/**
 * Hash router. The Android back gesture is the browser back, so history is the back stack.
 * Routes: '/trove', '/keep/:id'. A route is {tab?: string, render(ctx, params) => HTMLElement|Promise<HTMLElement>}.
 */
export function createRouter(view, routes, onChange, onBefore) {
  let token = 0;
  let current = '';
  const match = (path) => {
    for (const [pat, r] of Object.entries(routes)) {
      const a = pat.split('/'); const b = path.split('/');
      if (a.length !== b.length) continue;
      const params = {};
      if (a.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(b[i])), true) : seg === b[i]))) return { r, params };
    }
    return null;
  };
  async function go() {
    const path = (location.hash || '#/trove').slice(1) || '/trove';
    const m = match(path) || match('/trove');
    const my = ++token;
    const dir = current && path.split('/').length > current.split('/').length ? 'fwd' : 'back';
    current = path;
    onBefore && onBefore();
    const el = await m.r.render(m.params);
    if (my !== token) return;
    el.classList.add('page', dir === 'fwd' ? 'from-right' : 'fade');
    view.replaceChildren(el);
    requestAnimationFrame(() => el.classList.add('in'));
    onChange && onChange({ path, tab: m.r.tab || null, bare: Boolean(m.r.bare) });
  }
  window.addEventListener('hashchange', go);
  return { start: go, refresh: go, go: (p) => { if (location.hash === '#' + p) go(); else location.hash = p; }, back: () => history.back(), get path() { return current; } };
}
