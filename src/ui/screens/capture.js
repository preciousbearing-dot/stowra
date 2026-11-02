import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { sheet, toast } from '../kit/overlay.js';
import { WHY } from '../../capture/why.js';
import { firstUrl } from '../../capture/classify.js';

/** Paste a link, write a note, or pick a file. The Keep is saved the moment Save is tapped. */
export function openCapture(ctx, prefill = '') {
  const s = sheet({ title: 'Keep something', tall: false });
  let why = ''; let file = null;
  const input = h('textarea', { class: 'field', placeholder: 'Paste a link, or write a note', 'aria-label': 'Link or note', value: prefill });
  const fileLbl = h('div', { class: 'hint' });
  const picker = h('input', { type: 'file', accept: 'image/*,application/pdf', style: { display: 'none' } });
  picker.addEventListener('change', () => { file = picker.files[0] ? { name: picker.files[0].name, mime: picker.files[0].type, size: picker.files[0].size, blob: picker.files[0] } : null; fileLbl.textContent = file ? `Attached: ${file.name}` : ''; });
  const chips = h('div', { class: 'why-row' });
  const drawChips = () => fill(chips, WHY.map((w) => h('button', { class: 'chip' + (why === w ? ' on' : ''), text: w, onClick: () => { why = why === w ? '' : w; drawChips(); } })));
  drawChips();
  const save = h('button', { class: 'btn', style: { width: '100%', marginTop: '20px' }, text: 'Keep it', onClick: async () => {
    save.disabled = true;
    try {
      const { keep, duplicate } = await ctx.keeps.add({ text: input.value, why, file });
      s.close();
      if (duplicate) toast('You already kept this', { action: 'Open', onAction: () => ctx.router.go(`/keep/${keep.id}`) });
      else { toast('Kept in your Trove', { action: 'Open', onAction: () => ctx.router.go(`/keep/${keep.id}`) }); ctx.pipeline.run(keep.id).catch(() => {}); }
    } catch (e) { toast(ctx.errorText(e)); save.disabled = false; }
  } });
  fill(s.body, input, h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
    h('button', { class: 'chip', onClick: async () => { try { const t = await navigator.clipboard.readText(); if (t) { input.value = t; } } catch (e) { toast('Long press the box and choose Paste'); } } }, icon('link', 16), 'Paste'),
    h('button', { class: 'chip', onClick: () => picker.click() }, icon('file', 16), 'Image or PDF'), picker), fileLbl,
    h('div', { class: 'lbl-strong', text: 'Why did you save this?' }), chips, save);
  setTimeout(() => input.focus(), 280);
  return s;
}
export { firstUrl };
