// Stage 0 probes: what can a plain web page learn from a shared link?
// Every probe returns { name, status: 'ok'|'part'|'fail', ms, fields, thumb?, note?, raw? }.

const TIMEOUT_MS = 12000;

/** Find the first http(s) link in any of the given strings (shared text often wraps the link). */
export function extractUrl(...parts) {
  for (const p of parts) {
    const m = String(p || '').match(/https?:\/\/[^\s"'<>]+/i);
    if (m) return m[0].replace(/[).,;]+$/, '');
  }
  return '';
}

/** Work out which platform a link belongs to. */
export function classify(raw) {
  let url;
  try { url = new URL(raw); } catch { return { kind: 'invalid', url: raw }; }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return { kind: 'youtube', url: raw, id: parts[0] || '' };
  if (host.endsWith('youtube.com')) {
    const id = url.searchParams.get('v') || (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : '');
    return { kind: 'youtube', url: raw, id: id || '' };
  }
  if (host.endsWith('tiktok.com')) return { kind: 'tiktok', url: raw };
  if (host.endsWith('instagram.com')) return { kind: 'instagram', url: raw };
  if (host === 'github.com' && parts.length >= 2) return { kind: 'github', url: raw, owner: parts[0], repo: parts[1] };
  return { kind: 'article', url: raw };
}

async function timedFetch(url, opts = {}) {
  const t0 = performance.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    return { res, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return { err, ms: Math.round(performance.now() - t0) };
  } finally {
    clearTimeout(timer);
  }
}

function failure(name, ms, err, extra = '') {
  const note = err && err.name === 'AbortError'
    ? 'Timed out after 12 seconds'
    : 'Blocked or unreachable (browser security or network)';
  return { name, status: 'fail', ms, fields: {}, note: extra || note };
}

async function jsonProbe(name, url, pick, opts) {
  const { res, err, ms } = await timedFetch(url, opts);
  if (err) return failure(name, ms, err);
  if (!res.ok) return failure(name, ms, null, `HTTP ${res.status}`);
  let json;
  try { json = await res.json(); } catch { return failure(name, ms, null, 'Reply was not valid JSON'); }
  const { fields, thumb } = pick(json);
  const filled = Object.values(fields).filter(Boolean).length;
  return { name, status: thumb ? 'ok' : filled ? 'part' : 'fail', ms, fields, thumb, raw: JSON.stringify(json, null, 2).slice(0, 1500) };
}

function imageProbe(name, url) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const img = new Image();
    const timer = setTimeout(() => done('fail', 'Timed out'), TIMEOUT_MS);
    function done(status, note, w = 0, h = 0) {
      clearTimeout(timer);
      resolve({ name, status, ms: Math.round(performance.now() - t0), fields: { size: w ? `${w} x ${h}` : '' }, thumb: status === 'fail' ? '' : url, note });
    }
    img.onload = () => done(img.naturalWidth >= 200 ? 'ok' : 'part', img.naturalWidth >= 200 ? '' : 'Image is very small', img.naturalWidth, img.naturalHeight);
    img.onerror = () => done('fail', 'Image did not load');
    img.src = url;
  });
}

async function articleProbe(url) {
  const { res, err, ms } = await timedFetch(url);
  if (err) return failure('Fetch page directly', ms, err, 'Blocked by browser security (expected for a web page; the Android app can use native HTTP)');
  if (!res.ok) return failure('Fetch page directly', ms, null, `HTTP ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (p) => doc.querySelector(`meta[property="${p}"],meta[name="${p}"]`)?.content || '';
  const fields = { title: meta('og:title') || doc.title, description: meta('og:description'), site: meta('og:site_name'), textLength: String(doc.body?.innerText?.length || '') };
  const thumb = meta('og:image');
  return { name: 'Fetch page directly', status: thumb ? 'ok' : 'part', ms, fields, thumb };
}

/**
 * Run every probe that makes sense for a link. Calls onResult as each one finishes.
 * @returns {Promise<{cls: object, results: object[]}>}
 */
export async function runProbes(raw, onResult = () => {}) {
  const cls = classify(raw);
  const enc = encodeURIComponent(cls.url);
  const jobs = [];
  if (cls.kind === 'youtube') {
    if (cls.id) jobs.push(imageProbe('YouTube thumbnail from video id', `https://i.ytimg.com/vi/${cls.id}/hqdefault.jpg`));
    jobs.push(jsonProbe('YouTube oEmbed lookup', `https://www.youtube.com/oembed?url=${enc}&format=json`,
      (j) => ({ fields: { title: j.title, author: j.author_name }, thumb: j.thumbnail_url })));
  } else if (cls.kind === 'tiktok') {
    jobs.push(jsonProbe('TikTok oEmbed lookup', `https://www.tiktok.com/oembed?url=${enc}`,
      (j) => ({ fields: { title: j.title, author: j.author_name }, thumb: j.thumbnail_url })));
  } else if (cls.kind === 'instagram') {
    jobs.push(jsonProbe('Instagram oEmbed (no token)', `https://graph.facebook.com/v25.0/instagram_oembed?url=${enc}`,
      (j) => ({ fields: { author: j.author_name, title: j.title, provider: j.provider_name, hasEmbedHtml: j.html ? 'yes' : '' }, thumb: j.thumbnail_url })));
  } else if (cls.kind === 'github') {
    const base = `https://api.github.com/repos/${cls.owner}/${cls.repo}`;
    jobs.push(jsonProbe('GitHub repo details', base,
      (j) => ({ fields: { name: j.full_name, description: j.description, language: j.language, stars: String(j.stargazers_count ?? '') }, thumb: j.owner?.avatar_url })));
    jobs.push(jsonProbe('GitHub README', `${base}/readme`,
      (j) => ({ fields: { file: j.name, size: String(j.size || '') } })));
    jobs.push(imageProbe('GitHub social preview card', `https://opengraph.githubassets.com/1/${cls.owner}/${cls.repo}`));
  } else if (cls.kind === 'article') {
    jobs.push(articleProbe(cls.url));
  }
  const results = [];
  await Promise.all(jobs.map((j) => j.then((r) => { results.push(r); onResult(r); })));
  return { cls, results };
}
