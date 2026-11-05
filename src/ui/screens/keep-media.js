import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { toast } from '../kit/overlay.js';
import { canDownload, videoSite } from '../../extract/download.js';
import { linksOf, dedupeFrames } from '../../ai/links.js';
import { guideKeep } from '../../ai/guide.js';
import { transcriptOf } from '../../ai/study.js';
import { mediaKind, openViewer } from './viewer.js';

const mb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(n >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const SITE = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', pinterest: 'Pinterest', direct: 'the link' };

/** Whether this Keep offers a video download or already has its video. @param {any} k */
export const hasVideoPanel = (k) => mediaKind(k) === 'video' || canDownload(k);

/**
 * Download the video, watch it here, save it to the gallery, or remove the file.
 * @param {any} k @param {any} ctx @param {() => void} redraw
 */
export function downloadCard(k, ctx, redraw) {
  const has = mediaKind(k) === 'video' && k.meta.file && !k.meta.file.missing;
  const canGet = canDownload(k);
  if (!has && !canGet) return null;
  const box = h('div', { class: 'notice dl-card' });
  const job = () => ctx.downloads.get(k.id);
  const draw = () => {
    const j = job();
    if (j && (j.state === 'finding' || j.state === 'downloading')) {
      const pct = j.state === 'downloading' && j.total ? j.pct : 0;
      const bar = h('div', { class: 'dl-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': 'Download progress' }, h('div', { class: 'dl-fill' }));
      bar.firstChild.style.setProperty('width', `${j.total ? pct : 8}%`);
      if (!j.total) bar.classList.add('busy');
      fill(box, h('div', { style: { fontWeight: '600' }, text: j.state === 'downloading' ? `Downloading${j.total ? `, ${pct}%` : ''}` : 'Finding the video' }),
        bar, h('div', { class: 'hint', style: { marginTop: '8px' }, text: j.state === 'downloading' && j.done ? `${mb(j.done)}${j.total ? ` of ${mb(j.total)}` : ''}. You can leave this screen. It keeps going while Stowra is open.` : (j.note || 'One moment') }),
        h('button', { class: 'chip', style: { marginTop: '10px' }, text: 'Stop', onClick: () => ctx.downloads.cancel(k.id) }));
      return;
    }
    if (has) {
      const d = k.meta.download; const size = k.meta.file.size;
      fill(box, h('div', { style: { fontWeight: '600' }, text: 'Video saved on this phone' }),
        h('p', { class: 'hint', style: { margin: '4px 0 12px' }, text: `${size ? mb(size) : 'Saved'}${d && d.helper ? '. Got through a helper service.' : ''}${k.meta.hasTranscript ? '' : '. Open the Transcript tab to read what it says.'}` }),
        h('div', { class: 'vrow' },
          h('button', { class: 'chip', onClick: () => openViewer(ctx, k) }, icon('play', 16), 'Watch'),
          ctx.native.files ? h('button', { class: 'chip', onClick: async () => { try { const r = await ctx.repo.files.exportToGallery(k); toast(`Saved in ${r.where || 'your gallery'}`); } catch (e) { toast(ctx.errorText(e)); } } }, icon('download', 16), 'Save to gallery') : null,
          h('button', { class: 'chip', text: 'Remove the file', onClick: async () => { await ctx.downloads.removeFile(k.id); toast('Video file removed. The Keep stays'); redraw(); } })));
      return;
    }
    const failed = j && j.state === 'failed';
    fill(box, h('div', { style: { fontWeight: '600' }, text: failed ? 'Could not download this video' : 'Download this video' }),
      h('p', { class: 'hint', style: { margin: '4px 0 12px' }, text: failed ? j.error : `Saves the video from ${SITE[videoSite(k)] || 'the link'} on this phone so you can watch it here, read what it teaches, and find the links shown in it.` }),
      h('button', { class: 'btn', text: failed ? 'Try again' : 'Download video', onClick: () => ctx.downloads.start(k.id) }),
      failed ? h('button', { class: 'chip', style: { marginLeft: '8px' }, text: 'Helper settings', onClick: () => ctx.router.go('/settings/downloads') }) : null);
  };
  draw();
  const off = ctx.downloads.onChange((id, j) => { if (id !== k.id) return; if (j && j.state === 'done') { redraw(); return; } if (box.isConnected) draw(); });
  ctx.onLeave && ctx.onLeave(off);
  return box;
}

/**
 * Repository links and other links found in the description, the transcript, text read off the screen, and notes.
 * A scan of the video's pictures can find links that are only ever shown, never said.
 * @param {any} k @param {any} ctx @param {() => void} redraw
 */
export function linksCard(k, ctx, redraw) {
  const { repos, urls } = linksOf(k);
  const canScan = Boolean(ctx.native.files && ctx.native.files.scan && mediaKind(k) === 'video' && k.meta.file && k.meta.file.store);
  if (!repos.length && !urls.length && !canScan) return null;
  const box = h('div', { class: 'notice', style: { marginTop: '12px' } });
  const status = h('div', { class: 'hint', style: { marginTop: '8px' }, 'aria-live': 'polite' });
  const open = (u) => import('../../platform/native.js').then((n) => n.native.openExternal(u));
  const rows = repos.map((r) => h('div', { class: 'lnk' },
    h('div', { class: 'lnk-main' }, h('div', { class: 'lnk-name', text: `${r.owner}/${r.repo}` }), h('div', { class: 'hint', text: `Found in ${r.where.join(', ')}` })),
    h('div', { class: 'vrow', style: { margin: '8px 0 0' } },
      h('button', { class: 'chip', onClick: () => open(r.url) }, icon('link', 16), 'Open'),
      h('button', { class: 'chip', text: 'Keep this repo', onClick: async (e) => { e.target.disabled = true; try { const a = await ctx.keeps.add({ text: r.url, why: `From ${k.title}` }); ctx.pipeline.run(a.keep.id).catch(() => {}); toast('Repo kept'); } catch (err) { toast(ctx.errorText(err)); e.target.disabled = false; } } }))));
  const scan = canScan ? h('button', { class: 'chip', style: { marginTop: '10px' }, text: k.meta.screen ? 'Scan the video again' : 'Scan the video for links', onClick: async (e) => {
    e.target.disabled = true; status.textContent = 'Looking through the video. Nothing leaves your phone.';
    try { const r = await ctx.native.files.scan(k.meta.file.store, 30); const frames = dedupeFrames(r.frames); await ctx.keeps.update(k.id, { meta: { ...k.meta, screen: frames } }); toast(frames.length ? 'Scan finished' : 'No readable text found on screen'); redraw(); }
    catch (err) { status.textContent = ctx.errorText(err); e.target.disabled = false; }
  } }) : null;
  fill(box, h('div', { style: { fontWeight: '600' }, text: repos.length ? (repos.length === 1 ? 'Repository found' : `${repos.length} repositories found`) : 'Links' }),
    ...(rows.length ? rows : [h('p', { class: 'hint', style: { margin: '4px 0 0' }, text: 'No repository links found in the text yet.' + (canScan ? ' Links shown only on screen can be read from the video.' : '') })]),
    ...urls.slice(0, 5).map((u) => h('div', { style: { marginTop: '10px' } }, h('a', { class: 'ext', href: u, text: u.replace(/^https?:\/\//, '').slice(0, 60), onClick: (e) => { e.preventDefault(); open(u); } }))), scan, status);
  return box;
}

/** Follow along: the video turned into steps to do, with commands you can copy and boxes to tick. @param {any} k @param {any} ctx @param {() => void} redraw */
export function guideView(k, ctx, redraw) {
  const g = k.meta.guide; const box = h('div', { style: { marginTop: '20px' } });
  if (!g) {
    const noAI = !ctx.ai.ready(); const have = transcriptOf(k.text).length >= 300 || String(k.text || '').length >= 600;
    const status = h('div', { class: 'hint', style: { marginTop: '10px' }, 'aria-live': 'polite' }); let ctl = null;
    const go = h('button', { class: 'btn', text: noAI ? 'Connect AI' : 'Write the guide', disabled: !noAI && !have, onClick: async () => {
      if (noAI) return ctx.router.go('/settings/ai');
      go.disabled = true; stop.hidden = false; ctl = new AbortController();
      try { const out = await guideKeep(ctx.ai, k, { signal: ctl.signal, onProgress: (d, t) => { status.textContent = `Working through the video, step ${Math.min(d + 1, t)} of ${t}`; } }); await ctx.keeps.update(k.id, { meta: { ...k.meta, guide: out } }); toast('Guide ready'); redraw(); }
      catch (e) { if (!(e && e.name === 'AbortError')) status.textContent = ctx.errorText(e); go.disabled = false; stop.hidden = true; }
    } });
    const stop = h('button', { class: 'chip', hidden: true, style: { marginLeft: '8px' }, text: 'Stop', onClick: () => ctl && ctl.abort() });
    return h('div', { style: { marginTop: '20px' } }, h('div', { class: 'notice', style: { margin: 0 } }, h('div', { style: { fontWeight: '600' }, text: 'Follow along' }),
      h('p', { style: { margin: '6px 0 12px' }, text: have ? 'Kiko reads the video and writes the steps in order, with the exact commands, so you can do it yourself without rewatching. This sends the text to your connected AI.' : 'Get the transcript first, in the Transcript tab. The guide is written from what is said and shown.' }), go, stop, status));
  }
  const done = new Set(g.done || []);
  const save = () => ctx.keeps.update(k.id, { meta: { ...k.meta, guide: { ...g, done: [...done] } } });
  const total = g.steps.length;
  const prog = h('div', { class: 'hint', style: { margin: '0 0 12px' } });
  const upd = () => { prog.textContent = `${done.size} of ${total} done`; };
  const list = h('ol', { class: 'gd-steps' }, g.steps.map((s, i) => {
    const cb = h('input', { type: 'checkbox', checked: done.has(i), 'aria-label': `Mark step ${i + 1} done`, onChange: async (e) => { if (e.target.checked) done.add(i); else done.delete(i); li.classList.toggle('on', done.has(i)); upd(); await save(); } });
    const li = h('li', { class: 'gd-step' + (done.has(i) ? ' on' : '') },
      h('label', { class: 'gd-head' }, cb, h('span', { class: 'gd-title', text: s.title })),
      s.detail ? h('p', { class: 'gd-detail', text: s.detail }) : null,
      s.command ? h('div', { class: 'gd-cmd' }, h('code', { text: s.command }), h('button', { class: 'chip', text: 'Copy', onClick: async () => { try { await navigator.clipboard.writeText(s.command); toast('Copied'); } catch (e) { toast('Could not copy'); } } })) : null,
      s.at ? h('div', { class: 'hint', text: `In the video at ${s.at}` }) : null);
    return li;
  }));
  upd();
  fill(box, g.goal ? h('div', { class: 'notice', style: { margin: '0 0 16px' } }, h('div', { style: { fontWeight: '600' }, text: 'You will end up with' }), h('p', { style: { margin: '6px 0 0' }, text: g.goal })) : null,
    g.requirements && g.requirements.length ? h('div', { style: { marginBottom: '16px' } }, h('div', { class: 'lbl-strong', text: 'Before you start' }), h('ul', { class: 'gd-req' }, g.requirements.map((r) => h('li', { text: r })))) : null,
    prog, list,
    g.links && g.links.length ? h('div', { style: { marginTop: '16px' } }, h('div', { class: 'lbl-strong', text: 'Links from the video' }), ...g.links.map((l) => h('div', { style: { marginTop: '6px' } }, h('a', { class: 'ext', href: l.url, text: l.label, onClick: (e) => { e.preventDefault(); import('../../platform/native.js').then((n) => n.native.openExternal(l.url)); } })))) : null,
    g.tips && g.tips.length ? h('div', { style: { marginTop: '16px' } }, h('div', { class: 'lbl-strong', text: 'Good to know' }), h('ul', { class: 'gd-req' }, g.tips.map((r) => h('li', { text: r })))) : null,
    h('button', { class: 'chip', style: { marginTop: '20px' }, text: 'Write it again', onClick: async () => { const m = { ...k.meta }; delete m.guide; await ctx.keeps.update(k.id, { meta: m }); redraw(); } }));
  return box;
}
