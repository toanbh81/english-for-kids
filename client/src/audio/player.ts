/** The one clip `playUrl` currently has sounding, with the callback that settles its promise.
 * Two samples overlapping is bad enough on its own, but the real damage is the promise: every
 * caller flips a "playing" flag off when it settles, so a clip that is silently abandoned leaves
 * that flag stuck on for the rest of the screen's life. */
let current: { audio: HTMLAudioElement; settle: () => void } | null = null

/**
 * Silence whatever the app has sounding, whether `playUrl` started it or a screen registered its
 * own element with `trackAudio`. Safe to call when nothing is playing.
 */
export function stopCurrentAudio(): void {
  stopCurrent()
}

/**
 * Hand an element a screen drives itself under the same one-clip-at-a-time rule. Sentence Stars'
 * rhythm card needs the clip's `duration` to time its dots, which only an element it holds can
 * give it — but it must still stop when anything else starts, and stop anything else when it
 * starts. `onSuperseded` runs when another clip takes over, so the screen can clear its own state.
 */
export function trackAudio(audio: HTMLAudioElement, onSuperseded: () => void): void {
  stopCurrent()
  current = { audio, settle: onSuperseded }
}

/** Silence whatever is sounding and settle its promise — superseded, not failed. */
function stopCurrent() {
  const c = current
  if (!c) return
  current = null
  c.audio.onended = null
  c.audio.onerror = null
  c.audio.pause()
  c.settle()
}

/**
 * Play a clip to its end. Resolves on `ended` (or when a later clip supersedes it), rejects when
 * the element errors *or* when `play()` is refused — Safari does the latter for a blocked
 * autoplay and never fires `error`, which used to hang the promise forever.
 */
export function playUrl(url: string): Promise<void> {
  stopCurrent()
  return new Promise<void>((resolve, reject) => {
    const a = new Audio(url)
    const done = (finish: () => void) => () => {
      a.onended = null
      a.onerror = null
      if (current?.audio === a) current = null
      finish()
    }
    const ok = done(resolve)
    const fail = done(() => reject(new Error('audio failed')))
    a.onended = ok
    a.onerror = fail
    current = { audio: a, settle: ok }
    Promise.resolve(a.play()).catch(fail)
  })
}

export async function playBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob)
  try { await playUrl(url) } finally { URL.revokeObjectURL(url) }
}
