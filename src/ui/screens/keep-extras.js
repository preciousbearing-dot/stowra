import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { rich } from '../kit/rich.js';
import { toast } from '../kit/overlay.js';
import { transcriptOf } from '../../ai/study.js';
import { studyKeep } from '../../ai/study.js';
import { analyseKeep } from '../../ai/analyse.js';
import { readImageFile } from '../../capture/images.js';
import { PROVIDERS } from '../../ai/providers.js';
import { transcribeKeep } from '../../capture/voice-flow.js';
import { mediaKind } from './viewer.js';

const KIND_LABEL = { educational: 'Teaches something', entertainment: 'Entertainment', inspirational: 'Inspirational', creative: 'An edit or craft to recreate', news: 'News', reference: 'Reference', other: 'Other' };

/** No transcript yet: say why, offer another try, and let the person paste one. @param {any} k @param {any} ctx @param {() => void} redraw */
export function noTranscriptView(k, ctx, redraw) {
  const why = (k.meta && k.meta.transcriptError) || 'Stowra has not tried to read the transcript yet.';
  const ta = h('textarea', { class: 'field', placeholder: 'Paste the transcript here', 'aria-label': 'Transcript text', style: { minHeight: '120px' } });
  const status = h('div', { class: 'hint', style: { marginTop: '8px' }, 'aria-live': 'polite' });
  const hasVideoFile = mediaKind(k) === 'video' && Boolean(k.meta.file && k.meta.file.store);
  const isVideo = k.kind === 'video' || k.kind === 'voice' || hasVideoFile;
  const transcribe = h('button', { class: 'btn', text: k.kind === 'voice' ? 'Turn into text' : 'Transcribe with Groq', onClick: async () => {
    transcribe.disabled = true; status.textContent = 'Sending the audio to Groq. This can take a minute.';
    try {
      let kk = k;
      if (hasVideoFile && !(k.meta.media && k.meta.media.segments && k.meta.media.segments.length) && ctx.native.files && ctx.native.files.prepare) {
        status.textContent = 'Getting the sound out of the video.';
        const p = await ctx.native.files.prepare(k.meta.file.store);
        await ctx.keeps.update(k.id, { ...(!k.thumb && p.thumb ? { thumb: `data:image/jpeg;base64,${p.thumb}` } : {}), meta: { ...k.meta, durationSecs: Math.round((p.durationMs || 0) / 1000), media: { dir: p.dir, segments: p.segments, durationMs: p.durationMs } } });
        kk = await ctx.keeps.get(k.id);
      }
      if (k.kind === 'voice' || (kk.meta.media && kk.meta.media.segments && kk.meta.media.segments.length)) { const lang = await ctx.repo.prefs.read('voiceLang', ''); const r = await transcribeKeep(ctx, k.id, { language: lang, onStatus: (t) => { status.textContent = t; } }); if (r.empty) { status.textContent = 'No speech was found in this recording.'; transcribe.disabled = false; return; } toast('Transcript saved'); redraw(); return; }
      const vb = await ctx.repo.files.blob(k); if (!vb) throw new Error('The video file is missing.');
      const text = await ctx.ai.transcribe(vb, (k.meta.file && k.meta.file.name) || 'video.mp4');
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
    h('div', { class: 'notice', style: { margin: 0 } }, h('div', { style: { fontWeight: '600' }, text: 'No transcript yet' }), h('p', { style: { margin: '6px 0 12px' }, text: isVideo ? (k.meta.transcriptError && k.meta.transcriptError !== 'Nothing has been transcribed yet.' ? `${k.meta.transcriptError} ` : '') + 'Stowra reads the speech only when you tap this. The audio is sent to your speech provider (Groq or Gemini).' : why }), retry, status),
    h('div', { class: 'lbl-strong', style: { marginTop: '20px' }, text: 'Or paste it yourself' }),
    h('p', { class: 'hint', style: { margin: '4px 0 8px' }, text: 'On YouTube, open the video, tap the description, then Show transcript. Copy it and paste it here.' }), ta, save);
}

/** Full transcript, one tappable time per line. @param {any} k */
export function transcriptView(k) {
  if (k.meta.rawTranscript && k.meta.voice && k.meta.voice.cleaned) {
    let raw = false; const wrap = h('div'); const bar = h('div', { class: 'vrow', style: { marginTop: '16px', marginBottom: '0' } });
    const draw = () => { const btn = h('button', { class: 'chip', text: raw ? 'Showing original wording' : 'Showing tidied text', onClick: () => { raw = !raw; draw(); } }); fill(bar, btn, h('span', { class: 'hint', text: raw ? 'Exactly what the speech model heard.' : 'Punctuation and names fixed. Tap to see the original.' })); fill(wrap, bar, body(raw)); };
    const body = (r) => transcriptView({ ...k, text: r ? `Transcript:\n${k.meta.rawTranscript}` : k.text, meta: { ...k.meta, rawTranscript: '' } });
    draw(); return wrap;
  }
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

/** Player, summary and stated to-dos for a voice note. @param {any} k @param {any} ctx */
export function voiceCard(k, ctx) {
  const box = h('div', { style: { marginTop: '20px' } });
  const v = k.meta.voice || {};
  ctx.repo.files.open(k).then((f) => {
    if (!f) return;
    ctx.onLeave && ctx.onLeave(f.release);
    box.prepend(h('audio', { class: 'vplayer', controls: true, src: f.url, preload: 'metadata', 'aria-label': 'Play the voice note' }));
  }).catch(() => {});
  if (v.summary) box.append(h('div', { class: 'notice', style: { margin: '16px 0 0' } }, h('div', { class: 'lbl', text: 'In short' }), h('p', { style: { margin: '6px 0 0' } }, ...rich(v.summary))));
  if (v.todo && v.todo.length) box.append(h('div', { class: 'notice', style: { margin: '12px 0 0' } }, h('div', { class: 'lbl', text: 'You said you would' }), h('ul', { class: 'lp' }, v.todo.map((x) => h('li', {}, ...rich(x))))));
  return box;
}

/** Read a picture with AI, only on a tap. The on-phone text reading has already run. @param {any} k @param {any} ctx @param {() => void} redraw */
export function imageReadCard(k, ctx, redraw) {
  const r = k.meta.aiRead;
  if (r) return h('div', { class: 'notice', style: { margin: '20px 0 0' } }, h('div', { class: 'lbl', text: 'What the picture shows' }), r.description ? h('p', { style: { margin: '6px 0 0', whiteSpace: 'pre-wrap' } }, ...rich(r.description)) : null);
  const p = ['gemini', 'openai', 'openrouter'].find((x) => ctx.ai.connected().includes(x));
  const status = h('div', { class: 'hint', style: { marginTop: '8px' }, 'aria-live': 'polite' });
  const go = h('button', { class: 'btn', text: p ? 'Read this picture with AI' : 'Connect AI', onClick: async () => {
    if (!p) return ctx.router.go('/settings/ai');
    go.disabled = true; status.textContent = `Sending the picture to ${PROVIDERS[p].name}.`;
    try {
      const pb = await ctx.repo.files.blob(k); if (!pb) throw new Error('The picture file is missing.');
      const out = await ctx.ai.readImage(await readImageFile(pb, 1600));
      const own = String(k.text || '').trim();
      const text = [k.title, out.description, out.text && !own.includes(out.text.slice(0, 30)) ? `Text in the picture:\n${out.text}` : '', own && own !== k.title ? own : ''].filter(Boolean).join('\n\n');
      await ctx.keeps.update(k.id, { text, status: 'ready', meta: { ...k.meta, aiRead: { description: out.description, kind: out.kind, provider: out.provider, at: Date.now() }, analysis: undefined } }); toast('Picture read'); redraw();
    } catch (e) { go.disabled = false; status.textContent = ctx.errorText ? ctx.errorText(e) : String(e.message || e); }
  } });
  return h('div', { class: 'notice', style: { margin: '20px 0 0' } }, h('div', { style: { fontWeight: '600' }, text: 'Read it with AI' }), h('p', { style: { margin: '6px 0 12px' }, text: p ? `Describes the picture and copies its text. This sends the picture to ${PROVIDERS[p].name}. Nothing is sent until you tap.` : 'Needs a Gemini or OpenAI key. The text in the picture is already read on this phone when it can be.' }), go, status);
}
