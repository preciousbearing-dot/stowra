import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { tokensFor } from '../theme/tokens.js';
import { resolveVariant, systemPrefersDark } from '../theme/theme.js';
import { applyLook } from '../theme/look.js';

const THEMES = [['night', 'Night', 'Deep and quiet'], ['paper', 'Paper', 'Warm, like a notebook'], ['bright', 'Bright', 'Clean and crisp']];

/** Style, Theme and Mode pickers with live preview. Used in onboarding and in Settings. @param {{repo: any, prefs: any, onChange?: (p: any) => void}} o */
export function lookPicker({ repo, prefs, onChange }) {
  const el = h('div', {});
  const set = async (patch) => { Object.assign(prefs, patch); await applyLook(repo, prefs); onChange && onChange(prefs); draw(); };
  const swatch = (theme, style) => {
    const v = resolveVariant({ theme, mode: prefs.mode === 'system' ? 'system' : prefs.mode }, systemPrefersDark(window)); const t = tokensFor(v, style);
    const box = h('div', { class: 'swatch' }, h('div', { class: 'sw-hero' }), h('div', { class: 'sw-row' }, h('div', {}), h('div', {})));
    box.style.setProperty('background', t.bg); box.firstChild.style.setProperty('background', t.hero); box.lastChild.childNodes.forEach((n) => n.style.setProperty('background', t.track));
    box.firstChild.style.setProperty('border-bottom', `3px solid ${t.ac}`);
    return box;
  };
  function draw() {
    const card = (on, nameT, sub, prev, fn) => h('button', { class: 'lcard' + (on ? ' on' : ''), 'aria-pressed': on, onClick: fn }, prev, h('div', { class: 'ln', text: nameT }), h('div', { class: 'ls', text: sub }), on ? h('span', { class: 'lck' }, icon('check', 14)) : null);
    fill(el,
      h('h2', { class: 'h2', style: { margin: '8px 0 12px' }, text: 'Style' }),
      h('div', { class: 'lrow' }, card(prefs.style === 'simple', 'Simple', 'Calm and spacious', swatch(prefs.theme, 'simple'), () => set({ style: 'simple' })), card(prefs.style === 'advanced', 'Advanced', 'Dense, with live stats', swatch(prefs.theme, 'advanced'), () => set({ style: 'advanced' }))),
      h('h2', { class: 'h2', style: { margin: '24px 0 12px' }, text: 'Theme' }),
      h('div', { class: 'lrow' }, THEMES.map(([id, n, s]) => card(prefs.theme === id, n, s, swatch(id, prefs.style), () => set({ theme: id, mode: id === 'night' ? 'dark' : prefs.mode === 'dark' && prefs.theme === 'night' ? 'light' : prefs.mode })))),
      prefs.theme !== 'night' ? h('div', {}, h('h2', { class: 'h2', style: { margin: '24px 0 12px' }, text: 'Light or dark' }), h('div', { class: 'seg', style: { padding: 0 } }, [['light', 'Light'], ['dark', 'Dark'], ['system', 'Follow phone']].map(([id, l]) => h('button', { class: prefs.mode === id ? 'on' : '', text: l, onClick: () => set({ mode: id }) })))) : null);
  }
  draw();
  return el;
}
