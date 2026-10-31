// Stage 0 media checks: grab a thumbnail frame from a screen recording, and test speech recognition.

/**
 * Pull one frame out of a video file (this is the Instagram fallback: the user shares a screen recording).
 * @param {File} file
 * @returns {Promise<{ok:boolean, ms:number, w?:number, h?:number, canvas?:HTMLCanvasElement, note?:string}>}
 */
export function grabFrame(file) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const finish = (out) => { URL.revokeObjectURL(url); resolve({ ms: Math.round(performance.now() - t0), ...out }); };
    const timer = setTimeout(() => finish({ ok: false, note: 'Timed out' }), 15000);
    video.onerror = () => { clearTimeout(timer); finish({ ok: false, note: 'This phone could not read that video' }); };
    video.onloadedmetadata = () => { video.currentTime = Math.min(1, (video.duration || 2) / 4); };
    video.onseeked = () => {
      clearTimeout(timer);
      const scale = Math.min(1, 480 / (video.videoWidth || 480));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      finish({ ok: true, w: video.videoWidth, h: video.videoHeight, canvas });
    };
    video.src = url;
  });
}

/** Which speech recognition API does this browser offer, if any? */
export function speechApi() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Listen once and return the transcript. */
export function listenOnce() {
  return new Promise((resolve) => {
    const Api = speechApi();
    if (!Api) return resolve({ ok: false, note: 'Speech recognition is not available here' });
    const rec = new Api();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e) => resolve({ ok: true, text: e.results[0][0].transcript, confidence: e.results[0][0].confidence });
    rec.onerror = (e) => resolve({ ok: false, note: `Error: ${e.error}` });
    rec.onnomatch = () => resolve({ ok: false, note: 'Heard nothing clear' });
    rec.start();
  });
}
