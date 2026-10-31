import { extractUrl, runProbes } from './probes.js';
import { grabFrame, speechApi, listenOnce } from './media.js';

const $ = (s) => document.querySelector(s);
const reportLines = [];

function el(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  for (const k of kids) node.append(k);
  return node;
}

function chip(status) {
  const label = { ok: 'Works', part: 'Partial', fail: 'Failed' }[status];
  return el('span', { className: `chip ${status}`, textContent: label });
}

function renderProbe(r) {
  const card = el('div', { className: 'card probe' });
  card.append(el('h3', {}, el('span', { textContent: r.name }), chip(r.status)));
  card.append(el('div', { className: 'kv', textContent: `${r.ms} ms` }));
  for (const [k, v] of Object.entries(r.fields || {})) {
    if (!v) continue;
    const row = el('div', { className: 'kv' });
    row.append(el('b', { textContent: `${k}: ` }), document.createTextNode(String(v).slice(0, 200)));
    card.append(row);
  }
  if (r.note) card.append(el('div', { className: 'kv', textContent: r.note }));
  if (r.thumb) card.append(el('img', { className: 'thumb', src: r.thumb, alt: 'Thumbnail found', referrerPolicy: 'no-referrer' }));
  if (r.raw) {
    const d = el('details');
    d.append(el('summary', { textContent: 'Raw reply' }), el('pre', { textContent: r.raw }));
    card.append(d);
  }
  return card;
}

function addReport(line) {
  reportLines.push(line);
  $('#report').value = reportLines.join('\n');
}

function resultLine(r) {
  const fields = Object.entries(r.fields || {}).filter(([, v]) => v).map(([k, v]) => `${k}=${String(v).slice(0, 60)}`).join('; ');
  return `- ${r.name}: ${r.status.toUpperCase()} (${r.ms} ms)${r.thumb ? ' thumbnail=yes' : ' thumbnail=no'}${fields ? ' | ' + fields : ''}${r.note ? ' | ' + r.note : ''}`;
}

async function run(rawUrl) {
  const url = extractUrl(rawUrl);
  const out = $('#results');
  out.replaceChildren();
  if (!url) {
    out.append(el('div', { className: 'card', textContent: 'No link found. Paste a full link starting with https://' }));
    return;
  }
  $('#url').value = url;
  out.append(el('p', { textContent: 'Testing this link...' }));
  const { cls, results } = await runProbes(url, (r) => {
    if (out.firstChild?.tagName === 'P') out.firstChild.remove();
    out.append(renderProbe(r));
  });
  if (!results.length) out.replaceChildren(el('div', { className: 'card', textContent: `Recognised as: ${cls.kind}. Nothing to test for this type.` }));
  addReport(`LINK: ${url}\nPLATFORM: ${cls.kind}`);
  results.forEach((r) => addReport(resultLine(r)));
  addReport('');
}

function environment() {
  const standalone = matchMedia('(display-mode: standalone)').matches;
  const info = {
    installed: standalone ? 'yes (opened as an app)' : 'no (opened in a browser tab)',
    online: navigator.onLine ? 'yes' : 'no',
    shareApi: navigator.share ? 'yes' : 'no',
    speech: speechApi() ? 'yes' : 'no',
    userAgent: navigator.userAgent.slice(0, 110),
  };
  const box = $('#env');
  for (const [k, v] of Object.entries(info)) {
    const row = el('div', { className: 'kv' });
    row.append(el('b', { textContent: `${k}: ` }), document.createTextNode(v));
    box.append(row);
  }
  addReport(`ENVIRONMENT: ${Object.entries(info).map(([k, v]) => `${k}=${v}`).join('; ')}\n`);
}

function wire() {
  $('#run').onclick = () => run($('#url').value);
  $('#paste').onclick = async () => {
    try { $('#url').value = await navigator.clipboard.readText(); run($('#url').value); }
    catch { $('#url').focus(); }
  };
  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('#report').value); $('#copy').textContent = 'Copied'; }
    catch { $('#report').select(); }
  };
  $('#video').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const out = $('#frame-out');
    out.replaceChildren(el('p', { textContent: 'Reading the video...' }));
    const r = await grabFrame(file);
    out.replaceChildren();
    if (r.ok) out.append(el('div', { className: 'kv', textContent: `Frame grabbed in ${r.ms} ms from a ${r.w} x ${r.h} video.` }), r.canvas);
    else out.append(el('div', { className: 'kv', textContent: `Failed: ${r.note}` }));
    addReport(`SCREEN RECORDING FRAME: ${r.ok ? `OK (${r.ms} ms, ${r.w}x${r.h})` : `FAIL ${r.note}`}\n`);
  };
  $('#voice').onclick = async () => {
    const out = $('#voice-out');
    out.textContent = 'Listening... say a short sentence.';
    const r = await listenOnce();
    out.textContent = r.ok ? `Heard: "${r.text}"` : `Failed: ${r.note}`;
    addReport(`VOICE NOTE: ${r.ok ? `OK heard="${r.text}" confidence=${r.confidence}` : `FAIL ${r.note}`}\n`);
  };
}

async function start() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  environment();
  wire();
  const q = new URLSearchParams(location.search);
  const shared = extractUrl(q.get('url'), q.get('text'), q.get('title'));
  if (shared) {
    $('#shared').hidden = false;
    $('#shared-text').textContent = `Shared into the app: ${[q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join(' | ').slice(0, 300)}`;
    addReport(`SHARE TARGET: RECEIVED title=${q.get('title') || ''} text=${(q.get('text') || '').slice(0, 80)} url=${q.get('url') || ''}\n`);
    run(shared);
  }
}

start();
