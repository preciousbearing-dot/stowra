import { h } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { rich } from '../kit/rich.js';
import { toast } from '../kit/overlay.js';
import { transcriptOf } from '../../ai/study.js';
import { studyKeep } from '../../ai/study.js';
import { analyseKeep } from '../../ai/analyse.js';

const KIND_LABEL = { educational: 'Teaches something', entertainment: 'Entertainment', inspirational: 'Inspirational', creative: 'An edit or craft to recreate', news: 'News', reference: 'Reference', other: 'Other' };

/** No transcript yet: say why, offer another try, and let the person paste one. @param {any} k @param {any} ctx @param {() => void} redraw */
export function noTranscriptView(k, ctx, redraw) {
  const why = (k.meta && k.meta.transcriptError) || 'Stowra has not tried to read the transcript yet.';
  const ta = h('textarea', { class: 'field', placeholder: 'Paste the transcript here', 'aria-label': 'Transcript text', style: { minHeight: '120px' } });
  const status = h('div', { class: 'hint', style: { marginTop: '8px' }, 'aria-live': 'polite' });
  const isVideo = k.kind === 'video';
  const transcribe = h('button', { class: 'btn', text: 'Transcribe with Groq', onClick: async () => {
    transcribe.disabled = true; status.textContent = 'Sending the audio to Groq. This can take a minute.';
    try {
      const stored = await ctx.repo.chunks.get(`file:${k.id}`); if (!stored || !stored.blob) throw new Error('The video file is missing.');
      const text = await ctx.ai.transcribe(stored.blob, (k.meta.file && k.meta.file.name) || 'video.mp4');
      if (!text) { status.textContent = 'No speech was found in this video.'; transcribe.disabled = false; return; }
      await ctx.keeps.update(k.id, { text: `${k.title}\n\nTranscript:\n${text}`, status: 'ready', meta: { ...k.meta, hasTranscript: true, transcriptError: '', analysis: undefined } }); toast('Transcript saved'); redraw();
    } catch (e) { transcribe.disabled = false; status.textContent = ctx.errorText ? ctx.errorText(e) : String(e.message || e); }
  } });
  const retry = isVideo ? transcribe : h('button', { class: 'btn', text: 'Try to get the transcript again', onClick: async () => { retry.disabled = true; status.textContent = 'Asking YouTube'; try { await ctx.pipeline.run(k.id); } catch (e) { /* shown below */ } redraw(); } });
  const save = h('button', { class: 'chip', style: { marginTop: '10px' }, text: 'Use this transcript', onClick: async () => {
    const v = ta.value.trim(); if (v.length < 200) { status.textContent = 'That is too short to be a transcript.'; return; }
    const head = String(k.text || '').split('\n\nTranscript:')[0];
    await ctx.keeps.update(k.id, { text: `${head}\n\nTranscript:\n${v}`, status: 'ready', meta: { ...k.meta, hasTranscript: true, transcriptError: '', pasted: true, analysis: undefined } }); toast('Transcript saved'); redraw();
  } });
  return h('div', { style: { marginTop: '20px' } },
    h('div', { class: 'notice', style: { margin: 0 } }, h('div', { style: { fontWeight: '600' }, text: 'No transcript yet' }), h('p', { style: { margin: '6px 0 12px' }, text: isVideo ? 'Stowra reads the speech only when you tap this. The video file is sent to Groq (free key), up to 25 MB.' : why }), retry, status),
    h('div', { class: 'lbl-strong', style: { marginTop: '20px' }, text: 'Or paste it yourself' }),
    h('p', { class: 'hint', style: { margin: '4px 0 8px' }, text: 'On YouTube, open the video, tap the description, then Show transcript. Copy it and paste it here.' }), ta, save);
}

/** Full transcript, one tappable time per line. @param {any} k */
export function transcriptView(k) {
  const t = transcriptOf(k.text);
  const lines = t.split('\n').filter(Boolean);
  const note = [k.meta.autoCaptions ? 'Automatic captions, so some words may be wrong.' : '', k.meta.transcriptLang ? `Language: ${k.meta.transcriptLang}.` : ''].filter(Boolean).join(' ');
  return h('div', { style: { marginTop: '20px' } },
    note ? h('p', { class: 'hint', style: { margin: '0 0 12px' }, text: note }) : null,
    h('div', { class: 'tx' }, lines.map((l) => {
      const m = l.match(/^\[(\d\d):(\d\d)\]\s*(.*)$/);
      if (!m) return h('p', { class: 'tx-line' }, ...rich(l));
      const secs = Number(m[1]) * 60 + Number(m[2]);
      const href = k.url ? `${k.url}${k.url.includes('?') ? '&' : '?'}t=${secs}s` : '';
      return h('p', { class: 'tx-line' }, href ? h('a', { class: 'ext tx-time', href, onClick: (e) => { e.preventDefault(); import('../../platform/native.js').then((n) => n.native.openExternal(href)); } }, m[1] + ':' + m[2]) : h('span', { class: 'tx-time', text: `${m[1]}:${m[2]}` }), ' ', ...rich(m[3]));
    })));
}

/** Study this: lessons from the transcript. Nothing to quiz, nothing to flip. @param {any} k @param {any} ctx @param {() => void} redraw */
export function studyView(k, ctx, redraw) {
  const st = k.meta.study;
  if (!k.meta.hasTranscript) return noTranscriptView(k, ctx, redraw);
  const box = h('div', { style: { marginTop: '20px' } });
  const noAI = !ctx.ai.ready();
  if (!st) {
    const status = h('div', { class: 'hint', style: { marginTop: '10px' }, 'aria-live': 'polite' });
    let ctl = null;
    const go = h('button', { class: 'btn', text: noAI ? 'Connect AI' : 'Build lessons from this video', onClick: async () => {
      if (noAI) return ctx.router.go('/settings/ai');
      go.disabled = true; cancel.hidden = false; ctl = new AbortController();
      try {
        const study = await studyKeep(ctx.ai, k, { signal: ctl.signal, onProgress: (d, n) => { status.textContent = `Building lessons, step ${Math.min(d + 1, n)} of ${n}`; } });
        await ctx.keeps.update(k.id, { meta: { ...k.meta, study } }); toast('Lessons are ready');
      } catch (e) { go.disabled = false; cancel.hidden = true; if (e && e.name === 'AbortError') status.textContent = 'Stopped.'; else status.textContent = ctx.errorText ? ctx.errorText(e) : String(e.message || e); }
    } });
    const cancel = h('button', { class: 'chip', text: 'Stop', hidden: true, style: { marginLeft: '8px' }, onClick: () => ctl && ctl.abort() });
    box.append(h('div', { class: 'notice', style: { margin: 0 } }, h('div', { style: { fontWeight: '600' }, text: 'Study this' }), h('p', { style: { margin: '6px 0 12px' }, text: 'Turns what is said in the video into short lessons with key points and examples. It uses the transcript only, sends it to your AI provider in parts, and keeps the result in this Keep.' }), go, cancel, status));
    return box;
  }
  box.append(...[
    h('h2', { class: 'h2', style: { margin: '0 0 6px' }, text: st.title || k.title }),
    st.goal ? h('p', { style: { margin: '0 0 16px', color: 'var(--t2)' }, text: st.goal }) : null,
    ...st.lessons.map((l, i) => h('section', { class: 'lesson' },
      h('div', { class: 'lbl', text: `Lesson ${i + 1}${l.timestamp ? `, ${l.timestamp}` : ''}` }), h('h3', { class: 'lt', text: l.title }),
      h('p', { style: { whiteSpace: 'pre-wrap', margin: '6px 0' } }, ...rich(l.explanation)),
      l.keyPoints.length ? h('ul', { class: 'lp' }, l.keyPoints.map((p) => h('li', {}, ...rich(p)))) : null,
      l.example ? h('div', { class: 'notice', style: { margin: '8px 0 0' } }, h('b', { text: 'Example. ' }), ...rich(l.example)) : null)),
    st.recap && st.recap.length ? h('section', { class: 'lesson' }, h('h3', { class: 'lt', text: 'Recap' }), h('ul', { class: 'lp' }, st.recap.map((p) => h('li', {}, ...rich(p))))) : null,
    h('button', { class: 'chip', style: { marginTop: '16px' }, text: 'Build again', onClick: async () => { const { study, ...rest } = k.meta; await ctx.keeps.update(k.id, { meta: rest }); } })].filter(Boolean));
  return box;
}

const CHOICES = [['Summary', 'Summarise this'], ['Study', 'study'], ['Why it works', 'Explain why this works and what makes it effective'], ['Just keep it', 'keep']];

/** What this Keep is and what to do with it. Runs once, on first open, when the AI is ready. @param {any} k @param {any} ctx @param {(tab: string) => void} openTab */
export function analysisCard(k, ctx, openTab) {
  const a = k.meta.analysis;
  const slot = h('div', { class: 'analysis' });
  const ask = (q) => { ctx.kikoPreset = q; ctx.router.go(`/kiko/keep/${k.id}`); };
  const choose = (v) => (v === 'study' ? openTab('study') : v === 'keep' ? ctx.keeps.update(k.id, { meta: { ...k.meta, analysis: { ...a, dismissed: true } } }) : ask(v));
  if (!a) {
    if (!ctx.ai.ready() || (k.text || '').length < 200 || k.status === 'processing' || k.status === 'saved') return null;
    slot.append(h('div', { class: 'notice', style: { margin: '20px 0 0' }, text: 'Reading this to see what it is.' }));
    if (!ctx.__analysing) ctx.__analysing = new Set();
    if (!ctx.__analysing.has(k.id)) {
      ctx.__analysing.add(k.id);
      analyseKeep(ctx.ai, k).then((r) => ctx.keeps.update(k.id, { meta: { ...k.meta, analysis: r || { kind: 'other', confidence: 0, overview: '', actions: [], studyable: false, none: true, at: Date.now() } } }), () => {}).finally(() => ctx.__analysing.delete(k.id));
    }
    return slot;
  }
  if (a.none || a.dismissed) return null;
  const low = a.confidence < 0.5;
  slot.append(h('div', { class: 'notice', style: { margin: '20px 0 0' } },
    h('div', { class: 'lbl', text: KIND_LABEL[a.kind] || 'Overview' }),
    a.overview ? h('p', { style: { margin: '6px 0 0' } }, ...rich(a.overview)) : null,
    low ? h('div', { style: { marginTop: '12px', fontWeight: '600' }, text: 'What would you like from this?' }) : null,
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' } },
      low ? CHOICES.filter((c) => c[1] !== 'study' || k.meta.hasTranscript).map(([l, v]) => h('button', { class: 'chip', text: l, onClick: () => choose(v) }))
        : [a.studyable ? h('button', { class: 'chip on', onClick: () => openTab('study') }, icon('spark', 16), 'Study this') : null, ...a.actions.map((x) => h('button', { class: 'chip', text: x, onClick: () => ask(x) }))])));
  return slot;
}
