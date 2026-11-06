/**
 * Update check. Never uses github.io (unreachable on some networks). It asks three GitHub endpoints in parallel
 * and uses the best answer that arrived, so one blocked host cannot hide an update.
 * Priority: release API (the APK exists), release file, then raw main (may be ahead of the APK).
 */
const REPO = 'preciousbearing-dot/stowra';
export const SOURCES = [
  { id: 'release-api', url: `https://api.github.com/repos/${REPO}/releases/tags/apk-latest`, apkConfirmed: true },
  { id: 'release-file', url: `https://github.com/${REPO}/releases/download/apk-latest/version.json`, apkConfirmed: true },
  { id: 'raw-main', url: `https://raw.githubusercontent.com/${REPO}/main/version.json`, apkConfirmed: false },
];
export const APK_URL = `https://github.com/${REPO}/releases/download/apk-latest/Stowra.apk`;

/** @param {string} a @param {string} b @returns {-1|0|1} */
export function compareVersions(a, b) {
  const x = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const y = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1;
  }
  return 0;
}

/** Turn one endpoint's JSON into {version, notes, min, apkUrl}, or null if it has no usable version. */
function parse(id, json) {
  if (!json || typeof json !== 'object') return null;
  if (id === 'release-api') {
    const m = String(json.name || json.tag_name || '').match(/(\d+\.\d+\.\d+)/);
    const asset = (json.assets || []).find((a) => /\.apk$/i.test(a.name || ''));
    if (!m || !asset) return null;
    return { version: m[1], notes: [], min: '0.0.0', apkUrl: asset.browser_download_url, size: Number(asset.size) || 0 };
  }
  const v = String(json.version || '');
  if (!/^\d+\.\d+\.\d+$/.test(v)) return null;
  return { version: v, notes: Array.isArray(json.notes) ? json.notes.map(String) : [], min: String(json.min || '0.0.0'), apkUrl: APK_URL };
}

async function ask(source, fetchImpl, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetchImpl(source.url, { cache: 'no-store', signal: ac.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const info = parse(source.id, await r.json());
    if (!info) throw new Error('no version');
    return { ...info, source: source.id, apkConfirmed: source.apkConfirmed };
  } finally { clearTimeout(timer); }
}

/**
 * @param {{current: string, fetchImpl?: typeof fetch, sources?: typeof SOURCES, timeoutMs?: number}} o
 * @returns {Promise<{status: 'available'|'current'|'unreachable', latest?: string, size?: number, notes?: string[], mandatory?: boolean, apkUrl?: string, apkConfirmed?: boolean, source?: string, tried: string[]}>}
 */
export async function checkForUpdate({ current, fetchImpl = fetch, sources = SOURCES, timeoutMs = 6000 }) {
  const results = await Promise.allSettled(sources.map((s) => ask(s, fetchImpl, timeoutMs)));
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const tried = sources.map((s, i) => `${s.id}:${results[i].status === 'fulfilled' ? 'ok' : 'failed'}`);
  if (!ok.length) return { status: 'unreachable', tried };
  const best = ok[0]; // sources are in priority order
  const newest = ok.reduce((a, b) => (compareVersions(b.version, a.version) > 0 ? b : a), best);
  const pick = compareVersions(newest.version, best.version) > 0 && !newest.apkConfirmed ? best : newest;
  if (compareVersions(pick.version, current) <= 0) return { status: 'current', latest: pick.version, tried };
  // Notes and the minimum version live in version.json. The API answer has neither, so use a file answer for the same version.
  const meta = ok.find((r) => r.version === pick.version && r.source !== 'release-api') || pick;
  const sized = ok.find((r) => r.version === pick.version && r.size);
  return {
    status: 'available', latest: pick.version, size: sized ? sized.size : 0, notes: meta.notes, mandatory: compareVersions(meta.min, current) > 0,
    apkUrl: pick.apkUrl, apkConfirmed: pick.apkConfirmed, source: pick.source, tried,
  };
}
