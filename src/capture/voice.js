/** Records speech as small Opus audio. 24 kbit/s mono keeps 90 minutes under 17 MB, inside the 25 MB limit of speech services, and Whisper listens at 16 kHz anyway. */
export const MAX_SECS = 90 * 60;

const TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
export const pickType = () => (globalThis.MediaRecorder && TYPES.find((t) => MediaRecorder.isTypeSupported(t))) || '';

/** Ask for the microphone with the settings that help speech most: echo and noise handling on, one channel. */
export async function openMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !globalThis.MediaRecorder) throw new Error('This phone cannot record audio here.');
  try { return await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw new Error('Stowra needs the microphone. Allow it in the phone settings for Stowra, then try again.');
    if (e && e.name === 'NotFoundError') throw new Error('No microphone was found.');
    throw new Error('The microphone could not start.');
  }
}

/**
 * A recorder with pause, resume, a live level for the meter, and a hard length cap.
 * @param {MediaStream} stream @param {{onLevel?: (v: number) => void, onTick?: (secs: number) => void, onLimit?: () => void}} [o]
 */
export function createRecorder(stream, o = {}) {
  const type = pickType();
  const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 24000 });
  const parts = []; let started = 0; let acc = 0; let timer = 0; let raf = 0; let ctx = null; let state = 'idle';
  rec.addEventListener('dataavailable', (e) => { if (e.data && e.data.size) parts.push(e.data); });
  const secs = () => acc + (state === 'recording' ? (Date.now() - started) / 1000 : 0);
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AC && o.onLevel) {
      ctx = new AC(); const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an); const buf = new Uint8Array(an.fftSize);
      const loop = () => { an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); o.onLevel(state === 'recording' ? Math.min(1, m / 90) : 0); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }
  } catch (e) { /* the meter is optional */ }
  const tick = () => { const s = secs(); o.onTick && o.onTick(s); if (s >= MAX_SECS && state === 'recording') { o.onLimit && o.onLimit(); } };
  return {
    start() { rec.start(1000); started = Date.now(); state = 'recording'; timer = setInterval(tick, 250); },
    pause() { if (state !== 'recording') return; rec.pause(); acc += (Date.now() - started) / 1000; state = 'paused'; },
    resume() { if (state !== 'paused') return; rec.resume(); started = Date.now(); state = 'recording'; },
    get state() { return state; },
    secs,
    /** @returns {Promise<{blob: Blob, secs: number, mime: string}>} */
    stop() {
      return new Promise((resolve) => {
        const total = secs();
        const done = () => { clearInterval(timer); cancelAnimationFrame(raf); try { ctx && ctx.close(); } catch (e) { /* ignore */ } stream.getTracks().forEach((t) => t.stop()); state = 'stopped'; resolve({ blob: new Blob(parts, { type: rec.mimeType || type || 'audio/webm' }), secs: total, mime: rec.mimeType || type || 'audio/webm' }); };
        if (rec.state === 'inactive') return done();
        rec.addEventListener('stop', done, { once: true }); rec.stop();
      });
    },
    /** Throw the recording away and free the microphone. */
    cancel() { clearInterval(timer); cancelAnimationFrame(raf); try { rec.state !== 'inactive' && rec.stop(); } catch (e) { /* ignore */ } try { ctx && ctx.close(); } catch (e) { /* ignore */ } stream.getTracks().forEach((t) => t.stop()); state = 'stopped'; },
  };
}
