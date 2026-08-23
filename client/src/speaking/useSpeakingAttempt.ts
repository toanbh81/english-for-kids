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
  // 10 s) would find the MediaRecorder already closed and score an empty blob.
  const rec = useRecorder({ maxMs: Math.max(8000, autoStopMs + 1000) })
  // Kept in a ref so a new callback identity (e.g. from a parent re-render) never re-fires it.
  const onResultRef = useRef(opts.onResult)
  onResultRef.current = opts.onResult
  const [scorer, setScorer] = useState<ScorerBundle | null>(null)
  const [result, setResult] = useState<PronunciationResult | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scoring, setScoring] = useState(false)
  const [wsRecording, setWsRecording] = useState(false)
  const timerRef = useRef<number | null>(null)
  const stoppedRef = useRef(true)

  useEffect(() => {
    setResult(null); setError(null); setScoring(false)
    setWsRecording(false)
    stoppedRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    createScorer().then(setScorer)
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.resetKey])

  const isWebSpeech = scorer?.engine === 'webspeech'
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
      setScorer(fresh)
      if (fresh.engine !== 'azure') throw e
      return await fresh.scorer.score(blob, text)
    }
  }

  async function stopAndScore() {
    if (stoppedRef.current) return
    stoppedRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (!scorer) return
    // Web Speech never opened a MediaRecorder (iOS cannot run both at once), so there is
    // no recorded blob to stop, play back or send — score() just stops the recognizer.
    const blob = isWebSpeech ? new Blob() : await rec.stop()
    if (isWebSpeech) setWsRecording(false)
    else setLastBlob(blob)
    setScoring(true)
    try {
      const r = await scoreWithTokenRefresh(scorer, blob, opts.targetText)
      setResult(r)
      onResultRef.current?.(r, isWebSpeech ? null : blob)
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
    if (!scorer || scoring) return
    setResult(null); setError(null)
    if (isWebSpeech) {
      if (!WebSpeechScorer.isSupported()) { setError('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói'); return }
      try {
        (scorer.scorer as LiveScorer).start()
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
  }

  function onMic() {
    if (recording) { void stopAndScore(); return }
    if (rec.state === 'idle') void startRecording()
  }

  function reset() { setResult(null); setError(null) }

  const micState = !scorer ? 'disabled' : scoring ? 'processing' : recording ? 'recording' : rec.state

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
