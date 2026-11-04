/** A recorded voice note. The audio file is already stored. The words are read only when the person taps Transcribe, because that sends the audio to the AI provider.
 * @param {any} k */
export async function voiceExtractor(k) {
  if (k.meta && k.meta.hasTranscript) return { status: 'ready', how: 'Voice note with transcript' };
  return { text: k.title, status: 'partial', how: 'Voice note saved. Tap Transcribe to turn it into text', meta: { hasTranscript: false, transcriptError: (k.meta && k.meta.transcriptError) || 'Nothing has been transcribed yet.' } };
}
