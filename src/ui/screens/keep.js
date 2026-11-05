import { h, fill, ago } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { cover, STATUS_LABEL, statusDot } from '../kit/cards.js';
import { menu, sheet, confirmBox, promptBox, toast } from '../kit/overlay.js';
import { native } from '../../platform/native.js';
import { WHY } from '../../capture/why.js';
import { readImageFile } from '../../capture/images.js';
import { scrollRow } from '../kit/scrollrow.js';
import { openViewer, mediaOverlay } from './viewer.js';
import { relatedSmart } from '../../core/discover.js';
import { keepCard } from '../kit/cards.js';
import { rich } from '../kit/rich.js';
import { transcriptView, noTranscriptView, studyView, analysisCard, voiceCard, imageReadCard } from './keep-extras.js';

/** One Keep: cover, why, status, summary, key ideas, reading text, notes, tags, Collections. */
export async function keepScreen(ctx, { id }) {
  const { keeps, router } = ctx;
  const el = h('div', { class: 'keep-page' });
  let tab = 'overview';

  async function draw() {
    const k = await keeps.get(id);
    if (!k) return fill(el, h('div', { class: 'empty' }, h('div', { class: 'h2', text: 'This Keep is gone' }), h('button', { class: 'btn small', text: 'Back to Trove', onClick: () => router.go('/trove') })));
    const cols = await keeps.collectionsOf(id);
    const related = await relatedSmart(k, await keeps.list({}), ctx.smart);
    const hero = h('div', { style: { position: 'relative' } }, cover(k),
      h('button', { class: 'iconbtn', style: { position: 'absolute', left: '16px', top: '16px', background: 'rgba(0,0,0,.4)', color: '#fff', border: '0' }, 'aria-label': 'Back', onClick: () => router.back() }, icon('back')),
      h('button', { class: 'iconbtn', style: { position: 'absolute', right: '16px', top: '16px', background: 'rgba(0,0,0,.4)', color: '#fff', border: '0' }, 'aria-label': 'More', onClick: () => more(k) }, icon('more')));
    hero.firstChild.style.setProperty('aspect-ratio', '16 / 10');
    const mo = mediaOverlay(ctx, k); if (mo) hero.firstChild.append(mo);
    const noAI = !ctx.ai.ready();
    fill(el, hero,
      h('div', { class: 'pad', style: { paddingTop: '24px' } },
        h('h1', { class: 'title', style: { fontSize: '28px', lineHeight: '34px' }, text: k.title }),
        h('p', { class: 'sub', text: `${k.source}, kept ${ago(k.createdAt)}` }),
        h('button', { class: 'notice', style: { margin: '20px 0 0', width: '100%', textAlign: 'left' }, onClick: () => whySheet(k) }, h('div', { class: 'lbl', text: 'Why you saved this' }), h('div', { style: { color: 'var(--tx)', fontWeight: '500', fontSize: '16px', marginTop: '4px' }, text: k.why || 'Add a reason' })),
        h('div', { class: 'cs', style: { marginTop: '16px', fontSize: '14px', gap: '8px' } }, statusDot(k), h('b', { text: STATUS_LABEL[k.status] }), h('span', { text: k.error || statusNote(k) }),
          ['saved', 'failed', 'attention', 'partial', 'ready'].includes(k.status) && k.url ? h('button', { class: 'chip', style: { marginLeft: 'auto', height: '36px' }, onClick: async () => { toast('Reading again'); await ctx.pipeline.run(id); }, text: k.status === 'ready' ? 'Read again' : 'Try again' }) : null),
        k.status === 'attention' || (k.kind === 'tiktok' || k.kind === 'instagram') ? h('div', { class: 'notice', style: { margin: '12px 0 0' }, text: `${k.source} shares no cover or caption. Paste the caption into Notes, or add a screen recording, and Stowra can read it.` }) : null,
        scrollRow(h('div', { class: 'seg', style: { marginTop: '24px' } }, [['overview', 'Overview'], ['reading', 'Reading'], ...(k.meta.hasTranscript || k.kind === 'youtube' || k.kind === 'video' || k.kind === 'voice' ? [['transcript', 'Transcript'], ['study', 'Study']] : []), ['notes', 'Notes']].map(([t, l]) => h('button', { class: tab === t ? 'on' : '', text: l, onClick: () => { tab = t; draw(); } })))),
        tab === 'overview' ? [k.kind === 'voice' ? voiceCard(k, ctx) : null, k.kind === 'image' ? imageReadCard(k, ctx, draw) : null, analysisCard(k, ctx, (t) => { tab = t; draw(); }), overview(k, noAI)] : tab === 'reading' ? reading(k) : tab === 'transcript' ? (k.meta.hasTranscript ? transcriptView(k) : noTranscriptView(k, ctx, draw)) : tab === 'study' ? studyView(k, ctx, draw) : notes(k),
        h('div', { style: { marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } },
          k.tags.map((t) => h('button', { class: 'chip', text: t, onClick: () => removeTag(k, t), 'aria-label': `Remove tag ${t}` })),
          h('button', { class: 'chip', onClick: () => addTag(k) }, icon('plus', 16), 'Tag'),
          h('button', { class: 'chip', onClick: () => collectionsSheet(k) }, icon('collections', 16), cols.length ? cols.map((c) => c.name).join(', ') : 'Add to Collection'))),
      related.length ? h('div', { class: 'sect' }, h('h2', { class: 'h2', text: 'Related Keeps' }), h('div', { class: 'grid', style: { padding: '12px 0 0' } }, related.map((r) => keepCard(r, { onOpen: () => router.go(`/keep/${r.id}`), onHold: () => {} })))) : null,
      h('div', { style: { height: '96px' } }),
      h('div', { class: 'keep-bar' },
        h('button', { class: 'btn', style: { flex: 1, display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }, onClick: () => router.go(`/kiko/keep/${id}`) }, icon('kiko'), 'Ask Kiko about this'),
        k.url ? h('button', { class: 'iconbtn', 'aria-label': 'Open original', onClick: () => native.openExternal(k.url) }, icon('external')) : null,
        h('button', { class: 'iconbtn', 'aria-label': 'Share', onClick: () => share(k) }, icon('share'))));
  }

  const statusNote = (k) => ({ saved: 'Waiting to be read', processing: 'Reading now', ready: k.meta.how || '', partial: k.meta.how || 'Some parts could not be read', failed: '', attention: k.meta.how || '' }[k.status] || '');

  function overview(k, noAI) {
    const out = [];
    if (k.summary) out.push(h('div', { style: { marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, h('h2', { class: 'h2', text: 'Summary' }), h('span', { class: 'chip', style: { height: '28px', fontSize: '12px' }, text: 'From this Keep' })), h('p', { style: { margin: '12px 0 0', fontSize: '16px', lineHeight: '26px', color: 'var(--tx)', whiteSpace: 'pre-wrap' } }, ...rich(k.summary)));
    if (k.points.length) out.push(h('h2', { class: 'h2', style: { margin: '28px 0 4px' }, text: 'Key ideas' }), ...k.points.map((p, i) => h('div', { style: { display: 'flex', gap: '14px', padding: '14px 0', borderBottom: '1px solid var(--ln)' } }, h('span', { class: 'lbl', style: { width: '20px', lineHeight: '24px' }, text: String(i + 1) }), h('span', {}, ...rich(p)))));
    if (!k.summary) {
      const readable = (k.text || k.note).length > 80;
      out.push(h('div', { class: 'notice', style: { margin: '24px 0 0' } }, h('div', { text: !readable ? 'There is not enough text yet to summarise. Add a note or let Stowra read the page.' : noAI ? 'Connect an AI provider in Settings to get a summary and key ideas. Everything else works without one.' : 'Ready to summarise. Only the text of this Keep is sent.' }),
        readable && !noAI ? h('button', { class: 'btn small', style: { marginTop: '12px' }, text: 'Summarise', onClick: async (e) => { e.target.disabled = true; e.target.textContent = 'Summarising'; try { await ctx.ai.summarise(id); } catch (err) { toast(ctx.errorText(err)); } draw(); } }) : null,
        readable && noAI ? h('button', { class: 'btn small', style: { marginTop: '12px' }, text: 'Connect AI', onClick: () => router.go('/settings/ai') }) : null));
    }
    return h('div', {}, out);
  }
  const reading = (k) => h('div', { style: { marginTop: '20px' } }, k.text ? h('p', { style: { whiteSpace: 'pre-wrap', fontSize: '17px', lineHeight: '28px', margin: 0 } }, ...rich(k.text.slice(0, 40000))) : h('div', { class: 'notice', style: { margin: 0 }, text: 'Stowra has not read the text of this Keep yet.' }));
  function notes(k) {
    const ta = h('textarea', { class: 'field', style: { height: '180px', marginTop: '20px' }, placeholder: 'Your notes, or paste the caption here', 'aria-label': 'Notes', value: k.note });
    let t; ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => keeps.update(id, { note: ta.value }), 500); });
    return h('div', {}, ta, h('p', { class: 'hint', text: 'Saved on this phone as you type. Notes are searchable.' }));
  }

  function whySheet(k) {
    const s = sheet({ title: 'Why did you save this?' });
    const own = h('input', { class: 'field', placeholder: 'Or write your own reason', 'aria-label': 'Your own reason', maxlength: '120', value: WHY.includes(k.why) ? '' : (k.why || '') });
    const setOwn = async () => { const v = own.value.trim(); if (!v) return; await keeps.update(id, { why: v }); s.close(); draw(); };
    own.addEventListener('keydown', (e) => { if (e.key === 'Enter') setOwn(); });
    fill(s.body, h('div', { style: { display: 'flex', gap: '8px', marginBottom: '16px' } }, own, h('button', { class: 'btn small', text: 'Save', onClick: setOwn })), h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } }, WHY.map((w) => h('button', { class: 'chip' + (k.why === w ? ' on' : ''), text: w, onClick: async () => { await keeps.update(id, { why: k.why === w ? '' : w }); s.close(); draw(); } }))));
  }
  async function addTag(k) { const t = await promptBox('Add a tag', 'Tag'); if (t) { await keeps.update(id, { tags: [...k.tags, t] }); draw(); } }
  async function removeTag(k, t) { if (await confirmBox(`Remove "${t}"?`, 'The tag comes off this Keep only.', 'Remove', false)) { await keeps.update(id, { tags: k.tags.filter((x) => x !== t) }); draw(); } }
  async function collectionsSheet(k) {
    const cs = await keeps.collections(); const mine = new Set((await keeps.collectionsOf(id)).map((c) => c.id));
    const s = sheet({ title: 'Collections' });
    fill(s.body, h('div', { class: 'menu' }, cs.map((c) => h('button', { class: 'menu-item', onClick: async () => { mine.has(c.id) ? await keeps.removeFromCollection(c.id, [id]) : await keeps.addToCollection(c.id, [id]); s.close(); draw(); } }, icon(mine.has(c.id) ? 'check' : 'collections', 20), h('span', { text: c.name }))),
      h('button', { class: 'menu-item', onClick: async () => { s.close(); const n = await promptBox('New Collection', 'Name', '', 'Create'); if (n) { const c = await keeps.addCollection(n); await keeps.addToCollection(c.id, [id]); draw(); } } }, icon('plus', 20), h('span', { text: 'New Collection' }))));
  }
  async function share(k) {
    const text = [k.title, k.url].filter(Boolean).join('\n');
    try { if (navigator.share) await navigator.share({ title: k.title, text }); else { await navigator.clipboard.writeText(text); toast('Copied'); } } catch (e) { /* cancelled */ }
  }
  function more(k) {
    menu('Keep', [
      { label: 'Rename', icon: 'edit', run: async () => { const t = await promptBox('Rename', 'Title', k.title); if (t) { await keeps.update(id, { title: t, meta: { ...k.meta, autoTitle: false } }); draw(); } } },
      { label: 'Replace picture', icon: 'image', run: () => pickThumb() },
      native.files && (k.meta.file && k.meta.file.mime && !k.meta.file.missing) ? { label: 'Save to gallery', icon: 'download', run: async () => { try { const r = await ctx.repo.files.exportToGallery(k); toast(`Saved in ${r.where || 'your gallery'}`); } catch (e) { toast(ctx.errorText(e)); } } } : null,
      k.url ? { label: 'Copy link', icon: 'copy', run: async () => { try { await navigator.clipboard.writeText(k.url); toast('Link copied'); } catch (e) { toast('Could not copy'); } } } : null,
      { label: k.archivedAt ? 'Restore from archive' : 'Archive', icon: 'archive', run: async () => { k.archivedAt ? await keeps.unarchive(id) : await keeps.archive(id); toast(k.archivedAt ? 'Restored' : 'Archived'); router.go('/trove'); } },
      { label: 'Move to bin', icon: 'trash', danger: true, run: async () => { await keeps.trash(id); toast('Moved to the bin', { action: 'Undo', onAction: () => keeps.restore(id) }); router.go('/trove'); } },
    ].filter(Boolean));
  }
  function pickThumb() {
    const f = h('input', { type: 'file', accept: 'image/*' });
    f.addEventListener('change', async () => { if (f.files[0]) { try { await keeps.update(id, { thumb: await readImageFile(f.files[0], 640) }); draw(); } catch (e) { toast('Could not use that picture'); } } });
    f.click();
  }
  keeps.touch(id);
  await draw();
  const off = keeps.bus.on('changed', (c) => { if (el.isConnected && c && c.id === id && c.type === 'update') draw(); });
  ctx.onLeave(off);
  return el;
}
