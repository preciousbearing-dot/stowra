import { h } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { toast } from '../kit/overlay.js';
import { pushBack } from '../../platform/back.js';

/** What a Keep's own file is, for deciding how to show it. @param {any} k @returns {'image'|'video'|'audio'|null} */
export function mediaKind(k) {
  const f = k && k.meta && k.meta.file; if (!f || f.missing) return null;
  const m = String(f.mime || '');
  if (m.startsWith('image/')) return 'image'; if (m.startsWith('video/')) return 'video'; if (m.startsWith('audio/')) return 'audio';
  return null;
}

/**
 * Full-screen viewer. Pictures zoom with two fingers or a double tap; videos play with the phone's own controls.
 * Closes with the close button or the back gesture.
 * @param {any} ctx @param {any} k the Keep
 */
export async function openViewer(ctx, k) {
  const kind = mediaKind(k); if (!kind || kind === 'audio') return null;
  const opened = await ctx.repo.files.open(k);
  if (!opened) { toast('The file for this Keep is not on this phone'); return null; }
  const stage = h('div', { class: 'vw-stage' });
  const canSave = Boolean(ctx.native.files);
  const save = canSave ? h('button', { class: 'iconbtn vw-btn', 'aria-label': 'Save to the phone gallery', onClick: async () => {
    save.disabled = true;
    try { const r = await ctx.repo.files.exportToGallery(k); toast(`Saved in ${r.where || 'your gallery'}`); } catch (e) { toast(ctx.errorText ? ctx.errorText(e) : String(e.message || e)); }
    save.disabled = false;
  } }, icon('download', 20)) : null;
  const closeBtn = h('button', { class: 'iconbtn vw-btn', 'aria-label': 'Close', onClick: () => close() }, icon('close', 20));
  const el = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': k.title },
    h('div', { class: 'vw-top' }, closeBtn, h('div', { class: 'vw-title', text: k.title }), save), stage);
  document.getElementById('app').appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  let closed = false;
  const off = pushBack(() => { if (closed) return false; close(); return true; });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  let video = null;
  function close() {
    if (closed) return; closed = true; off(); document.removeEventListener('keydown', onKey);
    if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) { /* ignore */ } }
    el.classList.remove('on'); setTimeout(() => { el.remove(); opened.release(); }, 200);
  }
  if (kind === 'video') {
    video = h('video', { class: 'vw-video', controls: true, playsinline: true, preload: 'metadata', src: opened.url, poster: k.thumb || '' });
    video.addEventListener('error', () => { toast('This video could not be played here. Save it to the gallery and open it in another player'); });
    stage.append(video); video.play().catch(() => { /* the person can tap play */ });
  } else {
    const img = h('img', { class: 'vw-img', src: opened.url, alt: k.title, draggable: false });
    stage.append(img); zoomable(stage, img);
  }
  return { close, el };
}

/** Pinch, drag and double tap on a picture. @param {HTMLElement} stage @param {HTMLElement} img */
function zoomable(stage, img) {
  let s = 1; let x = 0; let y = 0; const pts = new Map(); let d0 = 0; let s0 = 1; let last = 0; let sx = 0; let sy = 0; let ox = 0; let oy = 0;
  const apply = () => img.style.setProperty('transform', `translate(${x}px, ${y}px) scale(${s})`);
  const clamp = () => {
    const w = stage.clientWidth; const hgt = stage.clientHeight; const mx = Math.max(0, (img.clientWidth * s - w) / 2); const my = Math.max(0, (img.clientHeight * s - hgt) / 2);
    x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y)); if (s <= 1.01) { x = 0; y = 0; }
  };
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a.x - b.x, a.y - b.y); s0 = s; }
    if (pts.size === 1) {
      sx = e.clientX; sy = e.clientY; ox = x; oy = y;
      const now = Date.now(); if (now - last < 300) { s = s > 1.2 ? 1 : 2.5; clamp(); apply(); last = 0; } else last = now;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; s = Math.max(1, Math.min(6, s0 * (Math.hypot(a.x - b.x, a.y - b.y) / (d0 || 1)))); clamp(); apply(); }
    else if (pts.size === 1 && s > 1) { x = ox + (e.clientX - sx); y = oy + (e.clientY - sy); clamp(); apply(); }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size === 1) { const p = [...pts.values()][0]; sx = p.x; sy = p.y; ox = x; oy = y; } };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
}

/** A big tap target over a Keep's cover when it has its own picture or video. @param {any} ctx @param {any} k */
export function mediaOverlay(ctx, k) {
  const kind = mediaKind(k); if (!kind || kind === 'audio') return null;
  return h('button', { class: 'media-open ' + kind, 'aria-label': kind === 'video' ? 'Play the video' : 'View the picture', onClick: () => openViewer(ctx, k) },
    h('span', { class: 'media-disc' }, icon(kind === 'video' ? 'play' : 'expand', 26)));
}
