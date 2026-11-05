import { vocabularyHint, cleanTranscript } from '../ai/voice-clean.js';

/**
 * Read a stored voice note (or video) and save the words on its Keep. Raw wording is always kept next to the tidied text.
 * Sends the audio to the speech provider, so callers only run it from a clear tap.
 * @param {any} ctx @param {string} id @param {{language?: string, terms?: string, tidy?: boolean, signal?: AbortSignal, onStatus?: (s: string) => void}} [o]
 */
export async function transcribeKeep(ctx, id, o = {}) {
  const say = o.onStatus || (() => {});
  const k = await ctx.keeps.get(id);
  if (!k) throw new Error('That Keep is no longer here.');
  const media = k.meta.media && k.meta.media.segments && k.meta.media.segments.length ? k.meta.media : null;
  let parts;
  if (media) parts = media.segments.map((sg) => ({ startMs: sg.startMs || 0, name: 'part.m4a', load: async () => { const r = await fetch(ctx.native.mediaFileUrl(sg.path)); if (!r.ok) throw new Error('The saved sound for this video is gone. Choose the video again.'); return r.blob(); } }));
  else {
    const stored = await ctx.repo.files.blob(k);
    if (!stored) throw new Error('The recording is missing.');
    parts = [{ startMs: 0, name: (k.meta.file && k.meta.file.name) || 'voice.webm', load: async () => stored }];
  }
  const fail = async (e) => { await ctx.keeps.update(id, { meta: { ...k.meta, transcriptError: ctx.errorText ? ctx.errorText(e) : String(e.message || e) } }); throw e; };
  if (o.terms && o.terms.trim()) { try { const old = String(await ctx.repo.prefs.read('voiceTerms', '')); const merged = [...new Set([...old.split(/[,\n;]+/), ...o.terms.split(/[,\n;]+/)].map((x) => x.trim()).filter(Boolean))].slice(0, 80).join(', '); await ctx.repo.prefs.write('voiceTerms', merged); } catch (e) { /* the hint still works for this note */ } }
  const vocab = await vocabularyHint(ctx.repo, o.terms || '');
  const texts = []; let last = null;
  for (let i = 0; i < parts.length; i++) {
    say(parts.length > 1 ? `Listening, part ${i + 1} of ${parts.length}. Long videos take a few minutes.` : 'Listening to the recording. Longer notes take a minute.');
    let res; let tries = 0;
    for (;;) {
      try { res = await ctx.ai.transcribeFull(await parts[i].load(), parts[i].name, { accurate: !media, language: o.language || undefined, prompt: vocab, signal: o.signal }); break; }
      catch (e) {
        if (e && e.name === 'AbortError') throw e;
        if (e && e.code === '429' && tries < 3 && parts.length > 1) { tries++; say(`The free limit was reached. Waiting a moment, then part ${i + 1} again.`); await new Promise((r) => setTimeout(r, 30000)); continue; }
        return fail(e);
      }
    }
    last = res; if (res.text) texts.push(shift(res.text, parts[i].startMs));
  }
  const rawAll = texts.join('\n');
  if (!rawAll) { await ctx.keeps.update(id, { meta: { ...k.meta, transcriptError: 'No speech was found in this recording.' } }); return { empty: true }; }
  let clean = rawAll; let title = ''; let summary = ''; let todo = []; let cleaned = false;
  if (o.tidy !== false && !media && ctx.ai.ready()) {
    say('Tidying punctuation and names.');
    try { const t = await cleanTranscript(ctx.ai, rawAll, { vocab, signal: o.signal }); clean = t.clean; title = t.title; summary = t.summary; todo = t.todo; cleaned = t.cleaned; } catch (e) { if (e && e.name === 'AbortError') throw e; }
  }
  const name = title || k.title || 'Voice note';
  const meta = { ...k.meta, hasTranscript: true, transcriptError: '', rawTranscript: cleaned ? rawAll : '', analysis: undefined, transcriptLang: (last && last.language) || '', voice: { provider: last && last.provider, model: last && last.model, language: last && last.language, cleaned, summary, todo, at: Date.now() } };
  if (media) { meta.media = { ...media, segments: [], done: true }; try { await ctx.native.cleanupMedia(media.dir); } catch (e) { /* the cache is cleared by Android anyway */ } }
  await ctx.keeps.update(id, { title: name, text: `${name}\n\nTranscript:\n${clean}`, status: 'ready', meta });
  return { empty: false, title: name };
}

/** Move every [MM:SS] marker later by a number of milliseconds, so parts of one video join up. @param {string} text @param {number} ms */
export function shift(text, ms) {
  if (!ms) return text;
  return text.replace(/\[(\d\d):(\d\d)\]/g, (_, m, s) => { const t = Number(m) * 60 + Number(s) + Math.round(ms / 1000); return `[${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}]`; });
}
