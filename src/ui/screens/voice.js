import { h, fill } from '../kit/dom.js';
import { icon } from '../kit/icons.js';
import { sheet, toast } from '../kit/overlay.js';
import { openMic, createRecorder, MAX_SECS } from '../../capture/voice.js';
import { transcribeKeep } from '../../capture/voice-flow.js';
import { PROVIDERS } from '../../ai/providers.js';

export const LANGS = [['', 'Detect it'], ['en', 'English'], ['fr', 'French'], ['yo', 'Yoruba'], ['ha', 'Hausa'], ['sw', 'Swahili'], ['pt', 'Portuguese'], ['es', 'Spanish'], ['ar', 'Arabic']];
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Record a voice note, then keep it and, on a clear tap, turn it into accurate text. @param {any} ctx */
export function openVoice(ctx) {
  let rec = null; let result = null; let ctl = null; let busy = false;
  const s = sheet({ title: 'Voice note', onClose: () => { if (rec && rec.state !== 'stopped') rec.cancel(); if (ctl) ctl.abort(); } });
  const status = h('div', { class: 'hint', 'aria-live': 'polite', style: { minHeight: '20px', marginTop: '12px', textAlign: 'center' } });
  const timer = h('div', { class: 'vtime', text: '00:00', 'aria-live': 'off' });
  const bars = Array.from({ length: 28 }, () => h('i', { class: 'vbar' }));
  const meter = h('div', { class: 'vmeter', 'aria-hidden': 'true' }, bars);
  const hist = new Array(bars.length).fill(0);
  const level = (v) => { hist.push(v); hist.shift(); bars.forEach((b, i) => { b.style.height = `${6 + Math.round(hist[i] * 54)}px`; }); };
  const lang = h('select', { class: 'field', 'aria-label': 'Language spoken' }, LANGS.map(([v, l]) => h('option', { value: v, text: l })));
  const terms = h('input', { class: 'field', placeholder: 'Names or terms you will say (optional)', 'aria-label': 'Names or terms', maxlength: '200' });
  ctx.repo.prefs.read('voiceLang', '').then((v) => { lang.value = v || ''; }).catch(() => {});
  lang.addEventListener('change', () => ctx.repo.prefs.write('voiceLang', lang.value).catch(() => {}));
  const aiName = () => { const a = ctx.ai.connected().includes('groq') ? 'groq' : ctx.ai.connected().includes('gemini') ? 'gemini' : ''; return a ? PROVIDERS[a].name : ''; };

  const drawIdle = () => {
    fill(s.body,
      h('p', { class: 'hint', style: { margin: '0 0 12px' }, text: 'Hold the phone close and speak normally. Pauses are fine. Recording stays on this phone until you choose to turn it into text.' }),
      h('div', { class: 'vrow' }, h('label', { class: 'vlbl', text: 'Language' }), lang), terms,
      h('button', { class: 'vrec', 'aria-label': 'Start recording', onClick: begin }, icon('mic', 30)),
      h('div', { class: 'hint', style: { textAlign: 'center' }, text: `Up to ${MAX_SECS / 60} minutes` }), status);
  };
  const drawRecording = () => {
    const pause = h('button', { class: 'chip', text: 'Pause', onClick: () => { if (rec.state === 'recording') { rec.pause(); pause.textContent = 'Resume'; status.textContent = 'Paused'; } else { rec.resume(); pause.textContent = 'Pause'; status.textContent = ''; } } });
    fill(s.body, timer, meter,
      h('div', { class: 'vrow', style: { justifyContent: 'center', gap: '12px' } }, pause, h('button', { class: 'chip', text: 'Discard', onClick: () => { rec.cancel(); rec = null; drawIdle(); } })),
      h('button', { class: 'vstop', 'aria-label': 'Stop recording', onClick: finish }, h('i', { class: 'vsq' })), status);
  };
  const drawDone = () => {
    const n = aiName();
    const tidy = h('input', { type: 'checkbox', checked: true, id: 'vtidy' });
    fill(s.body,
      h('div', { class: 'notice', style: { margin: 0 } }, h('div', { style: { fontWeight: '600' }, text: `Recorded ${fmt(result.secs)}` }), h('p', { style: { margin: '6px 0 0' }, text: n ? `Turning it into text sends the audio to ${n}. Nothing is sent until you tap.` : 'Connect Groq (best accuracy) or Gemini in You, then AI connection, to turn it into text. You can still keep the audio.' })),
      n ? h('button', { class: 'btn', style: { width: '100%', marginTop: '16px' }, text: 'Turn into text and keep', onClick: () => save(true, tidy.checked) }) : null,
      n ? h('label', { class: 'hint', style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '12px 0 0' } }, tidy, 'Also fix punctuation and names with AI. The original wording is kept.') : null,
      h('button', { class: n ? 'chip' : 'btn', style: n ? { marginTop: '12px' } : { width: '100%', marginTop: '16px' }, text: 'Keep the audio only', onClick: () => save(false) }),
      h('button', { class: 'chip', style: { marginTop: '8px' }, text: 'Discard', onClick: () => s.close() }), status);
  };

  async function begin() {
    try {
      const stream = await openMic();
      rec = createRecorder(stream, { onLevel: level, onTick: (t) => { timer.textContent = fmt(t); }, onLimit: finish });
      rec.start(); drawRecording();
    } catch (e) { status.textContent = String(e.message || e); }
  }
  async function finish() {
    if (!rec || rec.state === 'stopped') return;
    result = await rec.stop(); rec = null;
    if (result.secs < 1 || result.blob.size < 200) { status.textContent = 'That was too short to keep.'; drawIdle(); return; }
    drawDone();
  }
  async function save(transcribe, tidy = true) {
    if (busy) return; busy = true;
    const d = new Date(); const title = `Voice note, ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
    const ext = /ogg/.test(result.mime) ? 'ogg' : /mp4/.test(result.mime) ? 'm4a' : 'webm';
    try {
      const { keep } = await ctx.keeps.add({ text: '', title, file: { name: `voice-${Date.now()}.${ext}`, mime: result.mime.split(';')[0], size: result.blob.size, blob: result.blob } });
      await ctx.keeps.update(keep.id, { meta: { ...(await ctx.keeps.get(keep.id)).meta, durationSecs: Math.round(result.secs) } });
      await ctx.pipeline.run(keep.id).catch(() => {});
      if (!transcribe) { s.close(); toast('Voice note kept', { action: 'Open', onAction: () => ctx.router.go(`/keep/${keep.id}`) }); busy = false; return; }
      ctl = new AbortController();
      fill(s.body, h('div', { class: 'notice', style: { margin: 0 }, text: 'Working on it' }), status, h('button', { class: 'chip', style: { marginTop: '12px' }, text: 'Keep audio only, skip the text', onClick: () => { ctl.abort(); } }));
      try {
        const r = await transcribeKeep(ctx, keep.id, { language: lang.value, terms: terms.value, tidy, signal: ctl.signal, onStatus: (t) => { status.textContent = t; } });
        s.close(); toast(r.empty ? 'No speech found. The audio is kept.' : 'Voice note ready', { action: 'Open', onAction: () => ctx.router.go(`/keep/${keep.id}`) });
      } catch (e) { s.close(); toast(e && e.name === 'AbortError' ? 'Audio kept. Tap Transcribe on the note when you want the text.' : `Audio kept. ${ctx.errorText(e)}`, { action: 'Open', onAction: () => ctx.router.go(`/keep/${keep.id}`) }); }
    } catch (e) { toast(ctx.errorText(e)); }
    busy = false;
  }
  drawIdle();
  return s;
}
