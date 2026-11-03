/**
 * Hash router with its own back stack, so the Android back action always means "the screen I came from".
 * Routes: '/trove', '/keep/:id'. A route is {tab?: string, render(params) => HTMLElement|Promise<HTMLElement>}.
 * The stack holds the paths in order. Tapping a bottom tab that is already in the stack goes back to it instead of growing the stack.
 */
const TAB_ROOTS = ['/trove', '/collections', '/kiko', '/settings'];
const ROOT = '/trove';

export function createRouter(view, routes, onChange, onBefore) {
  let token = 0;
  let current = '';
  let ours = false;
  const stack = [];
  const match = (path) => {
    for (const [pat, r] of Object.entries(routes)) {
      const a = pat.split('/'); const b = path.split('/');
      if (a.length !== b.length) continue;
      const params = {};
      if (a.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(b[i])), true) : seg === b[i]))) return { r, params };
    }
    return null;
  };
  const hashPath = () => (location.hash || `#${ROOT}`).slice(1) || ROOT;

  async function render() {
    const path = hashPath();
    const m = match(path) || match(ROOT);
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

  function setHash(p) { ours = true; if (location.hash === '#' + p) { ours = false; return render(); } location.hash = p; }

  /** A change of the address that did not come from us: the browser back button, or a link. */
  window.addEventListener('hashchange', () => {
    if (ours) { ours = false; render(); return; }
    const p = hashPath();
    if (stack.length > 1 && stack[stack.length - 2] === p) stack.pop();
    else if (stack[stack.length - 1] !== p) stack.push(p);
    render();
  });

  function go(p) {
    if (p === current) return render();
    const i = stack.lastIndexOf(p);
    if (TAB_ROOTS.includes(p) && i >= 0) stack.length = i + 1; else stack.push(p);
    if (stack.length > 60) stack.shift();
    return setHash(p);
  }

  /** One step back. Returns false only when there is nowhere left to go: the Trove itself. */
  function back() {
    if (stack.length > 1) { stack.pop(); setHash(stack[stack.length - 1]); return true; }
    if (current && current !== ROOT) { stack.length = 0; stack.push(ROOT); setHash(ROOT); return true; }
    return false;
  }

  return {
    start() { const p = hashPath(); stack.length = 0; stack.push(p); return render(); },
    refresh: render, go, back,
    get path() { return current; }, get depth() { return stack.length; }, get stack() { return [...stack]; },
  };
}
