/**
 * Speak a short English phrase with the browser's built-in voice.
 *
 * No-op where speech synthesis is missing (older Safari, jsdom) so callers never need to guard.
 * The `speak()` is deferred one task because WebKit silently drops an utterance queued in the same
 * task as `cancel()` — without the hop, a second tap can leave the app mute.
 */
export function speakText(text: string): void {
  const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return
  // Cancel first so a double-tap restarts instead of queueing behind the previous utterance.
  synth.cancel()
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    synth.speak(u)
  }, 0)
}
