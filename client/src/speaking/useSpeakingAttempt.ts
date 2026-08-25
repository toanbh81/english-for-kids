import { useEffect, useRef, useState } from 'react'
import { useRecorder } from '../audio/recorder'
import { createScorer } from '../scoring/createScorer'
import type { PronunciationResult, PronunciationScorer } from '../scoring/types'
import { WebSpeechScorer } from '../scoring/webSpeechScorer'

/** The Web Speech engine listens on its own stream, so it needs an explicit start(). */
type LiveScorer = PronunciationScorer & { start(): void }
type ScorerBundle = { scorer: PronunciationScorer; engine: string }

export type SpeakingAttempt = {
  micState: 'idle' | 'recording' | 'processing' | 'disabled'
  level: number
  engine: 'azure' | 'webspeech' | null
  result: PronunciationResult | null
  error: string | null
  lastBlob: Blob | null
  onMic(): void
  reset(): void
}

export function useSpeakingAttempt(opts: {
  targetText: string
  autoStopMs?: number
  resetKey?: string
  onResult?: (result: PronunciationResult, blob: Blob | null) => void
}): SpeakingAttempt {
  const autoStopMs = opts.autoStopMs ?? 6000
  // The recorder must outlive the auto-stop, or a longer attempt (Story Voice opens the mic for
  // 13 s) would find the MediaRecorder already closed and score an empty blob.
  const rec = useRecorder({ maxMs: Math.max(8000, autoStopMs + 1000) })
  // Kept in a ref so a new callback identity (e.g. from a parent re-render) never re-fires it.
  const onResultRef = useRef(opts.onResult)
  onResultRef.current = opts.onResult
  const [scorer, setScorer] = useState<ScorerBundle | null>(null)
  // The state drives the UI (the engine badge); the ref is what an in-flight attempt reads. A
  // scorer adopted inside startRecording must score THIS attempt, and setState is only visible on
  // the next render — the closure stopAndScore runs in would still hold the old bundle.
  const scorerRef = useRef<ScorerBundle | null>(null)
  const [result, setResult] = useState<PronunciationResult | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scoring, setScoring] = useState(false)
  const [wsRecording, setWsRecording] = useState(false)
  // Opening the mic is not instant — the Azure re-check can spend a round trip and a backoff
  // first. `starting` is what the child sees during that window (a busy mic, not a live one);
  // `startingRef` is the same fact read synchronously, which is what actually rejects a second
  // tap that slips in before the re-render disables the button.
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const stoppedRef = useRef(true)

  /** Every scorer swap goes through here, so the ref and the badge can never disagree. */
  function adoptScorer(bundle: ScorerBundle) {
    scorerRef.current = bundle
    setScorer(bundle)
  }

  useEffect(() => {
    setResult(null); setError(null); setScoring(false)
    setWsRecording(false)
    stoppedRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    // A token round trip outlives the card that asked for it — a child tapping through a deck
    // starts one per word — and the answers can come back out of order. Without this the slow
    // first lookup lands last and overwrites the fresh card's scorer with the previous card's,
    // which on a bad token means the new card is quietly demoted to the simple engine.
    let cancelled = false
    createScorer().then(bundle => { if (!cancelled) adoptScorer(bundle) })
    return () => {
      cancelled = true
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.resetKey])

  const recording = rec.state === 'recording' || wsRecording

  /**
   * Azure tokens expire after ~10 minutes, which a kid easily outlasts on one card.
   * On an Azure failure, mint a fresh scorer and retry exactly once — never in a loop.
   */
  async function scoreWithTokenRefresh(active: ScorerBundle, blob: Blob, text: string): Promise<PronunciationResult> {
    try {
      return await active.scorer.score(blob, text)
    } catch (e) {
      if (active.engine !== 'azure') throw e
      console.error(e)
      const fresh = await createScorer()
      adoptScorer(fresh)
      if (fresh.engine !== 'azure') throw e
      return await fresh.scorer.score(blob, text)
    }
  }

  async function stopAndScore() {
    if (stoppedRef.current) return
    stoppedRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    // The bundle this attempt actually opened the mic with — see the scorerRef note above.
    const active = scorerRef.current
    if (!active) return
    const onWebSpeech = active.engine === 'webspeech'
    // Web Speech never opened a MediaRecorder (iOS cannot run both at once), so there is
    // no recorded blob to stop, play back or send — score() just stops the recognizer.
    const blob = onWebSpeech ? new Blob() : await rec.stop()
    if (onWebSpeech) setWsRecording(false)
    else setLastBlob(blob)
    setScoring(true)
    try {
      const r = await scoreWithTokenRefresh(active, blob, opts.targetText)
      setResult(r)
      onResultRef.current?.(r, onWebSpeech ? null : blob)
    } catch (e) {
      setError('Không nghe rõ, bé thử lại nhé!'); console.error(e)
    } finally {
      setScoring(false)
    }
  }

  function armAutoStop() {
    stoppedRef.current = false
    timerRef.current = window.setTimeout(() => { void stopAndScore() }, autoStopMs)
  }

  async function startRecording() {
    // The Azure re-check below is awaited, so a second tap could otherwise open the mic twice.
    if (!scorerRef.current || scoring || startingRef.current) return
    startingRef.current = true
    setStarting(true)
    try {
      setResult(null); setError(null)
      let active = scorerRef.current
      // The Web Speech fallback is never permanent. One failed token fetch used to pin the whole
      // card to an engine that cannot score a single sound; now every attempt asks again, and the
      // moment Azure answers the child gets phoneme detail back — before the mic even opens.
      if (active.engine === 'webspeech' && navigator.onLine) {
        const fresh = await createScorer()
        if (fresh.engine === 'azure') { adoptScorer(fresh); active = fresh }
      }
      if (active.engine === 'webspeech') {
        if (!WebSpeechScorer.isSupported()) { setError('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói'); return }
        try {
          (active.scorer as LiveScorer).start()
          setWsRecording(true)
          armAutoStop()
        } catch (e) {
          setError('Bé cho phép dùng mic nhé! 🎤'); console.error(e)
        }
        return
      }
      try {
        await rec.start()
        armAutoStop()
      } catch (e) {
        setError('Bé cho phép dùng mic nhé! 🎤'); console.error(e)
      }
    } finally {
      // By here the mic is open (the recorder is already 'recording', the recognizer already
      // listening) or the attempt has failed with a message — either way it is no longer busy.
      startingRef.current = false
      setStarting(false)
    }
  }

  function onMic() {
    if (recording) { void stopAndScore(); return }
    if (rec.state === 'idle') void startRecording()
  }

  function reset() { setResult(null); setError(null) }

  // `starting` reads as 'processing' on purpose: MicButton already draws that as a busy,
  // unpressable mic, which is exactly what a tap being worked on looks like.
  const micState = !scorer ? 'disabled' : scoring || starting ? 'processing' : recording ? 'recording' : rec.state

  return {
    micState,
    level: rec.level,
    engine: (scorer?.engine as 'azure' | 'webspeech' | undefined) ?? null,
    result,
    error,
    lastBlob,
    onMic,
    reset,
  }
}
