/** A video or screen recording picked from the phone: a cover frame and the length. The speech is read only when the person taps Transcribe. @param {any} k @param {any} tools */
export async function videoExtractor(k, tools) {
  if (k.meta && k.meta.media) {
    if (k.meta.hasTranscript) return { status: 'ready', how: 'Video with transcript' };
    const secs = k.meta.durationSecs || 0;
    return { text: k.title, status: 'partial', how: `Video sound is ready${secs ? `, ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} long` : ''}. Tap Transcribe in the Transcript tab to read what is said`, meta: { hasTranscript: false, transcriptError: (k.meta && k.meta.transcriptError) || 'Nothing has been transcribed yet.' } };
  }
  const blob = await tools.repo.files.blob(k);
  if (!blob) return { status: 'failed', how: 'The video file is missing.' };
  const info = await frameOf(blob);
  const secs = info ? Math.round(info.secs) : 0;
  return { thumb: info && info.thumb, text: k.title, status: 'partial', how: `Video saved${secs ? `, ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} long` : ''}. Tap Transcribe in the Transcript tab to read what is said`, meta: { hasTranscript: false, durationSecs: secs, transcriptError: 'Nothing has been transcribed yet.' } };
}

/** First readable frame as a small JPEG, plus duration. Never throws. @param {Blob|string} blob a file, or an address the page can play */
export function frameOf(blob) {
  return new Promise((resolve) => {
    let done = false; const own = typeof blob !== 'string'; const url = own ? URL.createObjectURL(blob) : blob;
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true;
    const end = (r) => { if (done) return; done = true; if (own) URL.revokeObjectURL(url); resolve(r); };
    const t = setTimeout(() => end(null), 12000);
    v.addEventListener('error', () => { clearTimeout(t); end(null); });
    v.addEventListener('loadeddata', () => { try { v.currentTime = Math.min(1, (v.duration || 1) / 4); } catch (e) { clearTimeout(t); end(null); } });
    v.addEventListener('seeked', () => {
      clearTimeout(t);
      try { const w = 640; const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360; const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(v, 0, 0, w, h); end({ thumb: c.toDataURL('image/jpeg', 0.8), secs: v.duration || 0 }); } catch (e) { end({ thumb: null, secs: v.duration || 0 }); }
    });
    v.src = url;
  });
}
