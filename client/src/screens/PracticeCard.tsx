import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findCard, LEVELS } from '../content'
import { useRecorder } from '../audio/recorder'
import { playBlob, playUrl } from '../audio/player'
import { createScorer } from '../scoring/createScorer'
import { toFeedback } from '../scoring/feedback'
import type { Feedback, PronunciationResult, PronunciationScorer } from '../scoring/types'
import { WebSpeechScorer } from '../scoring/webSpeechScorer'
import { setStars } from '../progress/store'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { HintCard } from '../components/HintCard'

const AUTO_STOP_MS = 6000
const TAP_TARGET = 'min-h-[64px] min-w-[64px] flex items-center'

/** The Web Speech engine listens on its own stream, so it needs an explicit start(). */
type LiveScorer = PronunciationScorer & { start(): void }
type ScorerBundle = { scorer: PronunciationScorer; engine: string }

export function PracticeCard() {
  const { cardId = '' } = useParams()
  const nav = useNavigate()
  const card = findCard(cardId)
  const rec = useRecorder({ maxMs: 8000 })
  const [scorer, setScorer] = useState<ScorerBundle | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [scoring, setScoring] = useState(false)
  const [wsRecording, setWsRecording] = useState(false)
  const [audioMissing, setAudioMissing] = useState(false)
  const timerRef = useRef<number | null>(null)
  const stoppedRef = useRef(true)

  useEffect(() => {
    setFeedback(null); setAttempts(0); setError(null); setScoring(false)
    setWsRecording(false); setAudioMissing(false)
    stoppedRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    createScorer().then(setScorer)
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  }, [cardId])

  if (!card) return <p>Không tìm thấy thẻ</p>
  const allCards = LEVELS.flatMap(l => l.cards)
  const next = allCards[allCards.findIndex(c => c.id === cardId) + 1]

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
      const fb = toFeedback(await scoreWithTokenRefresh(scorer, blob, card!.text))
      setFeedback(fb); setAttempts(a => a + 1); setStars(card!.id, fb.stars)
    } catch (e) {
      setError('Không nghe rõ, bé thử lại nhé!'); console.error(e)
    } finally {
      setScoring(false)
    }
  }

  function armAutoStop() {
    stoppedRef.current = false
    timerRef.current = window.setTimeout(() => { void stopAndScore() }, AUTO_STOP_MS)
  }

  async function startRecording() {
    if (!scorer || scoring) return
    setFeedback(null); setError(null)
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

  function retry() { setFeedback(null); setError(null) }

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(card!.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  const micState = !scorer ? 'disabled' : scoring ? 'processing' : recording ? 'recording' : rec.state
  return (
    <main className="h-full flex flex-col items-center justify-between p-6">
      <div className="w-full flex justify-between text-xl">
        <Link to={`/level/${LEVELS.find(l => l.cards.includes(card))!.id}`} className="inline-flex items-center min-h-[64px] px-4">← Quay lại</Link>
        <span className="text-slate-400">{isWebSpeech ? 'chế độ đơn giản' : ''}</span>
      </div>
      <div className="flex items-center gap-10">
        <span className="text-[120px]">{card.emoji}</span>
        <div className="text-center">
          <div className="text-7xl font-extrabold">{card.text}</div>
          <div className="text-2xl text-slate-500">{card.ipa}</div>
          <button onClick={playSample} className="mt-4 w-20 h-20 rounded-full bg-teal text-white text-4xl">🔊</button>
          {audioMissing && <p className="mt-2 text-lg text-slate-400">Chưa có audio mẫu</p>}
        </div>
      </div>
      {error && <p className="text-2xl text-fix">{error}</p>}
      {feedback && (
        <section className="flex flex-col items-center gap-4">
          <Stars value={feedback.stars} animate={feedback.stars === 3} />
          <p className="text-3xl font-extrabold">{feedback.message}</p>
          <ScoredWords words={feedback.words} onWordTap={playSample} />
          {feedback.hint && <HintCard hint={feedback.hint} />}
          <div className="flex gap-4 text-xl">
            {lastBlob && <button onClick={() => playBlob(lastBlob).catch(() => {})} className={`px-6 py-3 rounded-2xl bg-white shadow ${TAP_TARGET}`}>🎧 Nghe mình</button>}
            <button onClick={playSample} className={`px-6 py-3 rounded-2xl bg-white shadow ${TAP_TARGET}`}>🔊 Nghe mẫu</button>
            <button onClick={retry} className={`px-6 py-3 rounded-2xl bg-white shadow ${TAP_TARGET}`}>Thử lại</button>
            {next && (feedback.stars === 3 || attempts >= 3) && (
              <button onClick={() => nav(`/practice/${next.id}`)} className={`px-6 py-3 rounded-2xl bg-coral text-white font-extrabold ${TAP_TARGET}`}>Tiếp theo →</button>
            )}
          </div>
        </section>
      )}
      <MicButton state={micState} level={rec.level} onPress={onMic} />
    </main>
  )
}
