import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findCard, LEVELS } from '../content'
import { useRecorder } from '../audio/recorder'
import { playBlob, playUrl } from '../audio/player'
import { createScorer } from '../scoring/createScorer'
import { toFeedback } from '../scoring/feedback'
import type { Feedback, PronunciationScorer } from '../scoring/types'
import { WebSpeechScorer } from '../scoring/webSpeechScorer'
import { setStars } from '../progress/store'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { HintCard } from '../components/HintCard'

const AUTO_STOP_MS = 6000
const TAP_TARGET = 'min-h-[64px] min-w-[64px] flex items-center'

export function PracticeCard() {
  const { cardId = '' } = useParams()
  const nav = useNavigate()
  const card = findCard(cardId)
  const rec = useRecorder({ maxMs: 8000 })
  const [scorer, setScorer] = useState<{ scorer: PronunciationScorer; engine: string } | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [scoring, setScoring] = useState(false)
  const timerRef = useRef<number | null>(null)
  const stoppedRef = useRef(true)

  useEffect(() => {
    setFeedback(null); setAttempts(0); setError(null); setScoring(false)
    stoppedRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    createScorer().then(setScorer)
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  }, [cardId])

  if (!card) return <p>Không tìm thấy thẻ</p>
  const allCards = LEVELS.flatMap(l => l.cards)
  const next = allCards[allCards.findIndex(c => c.id === cardId) + 1]

  async function stopAndScore() {
    if (stoppedRef.current) return
    stoppedRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (!scorer) return
    const blob = await rec.stop(); setLastBlob(blob)
    setScoring(true)
    try {
      const fb = toFeedback(await scorer.scorer.score(blob, card!.text))
      setFeedback(fb); setAttempts(a => a + 1); setStars(card!.id, fb.stars)
    } catch (e) {
      setError('Không nghe rõ, bé thử lại nhé!'); console.error(e)
    } finally {
      setScoring(false)
    }
  }

  async function startRecording() {
    if (!scorer || scoring) return
    setFeedback(null); setError(null)
    try {
      if (scorer.scorer instanceof WebSpeechScorer) scorer.scorer.start()
      await rec.start()
      stoppedRef.current = false
      timerRef.current = window.setTimeout(() => { void stopAndScore() }, AUTO_STOP_MS)
    } catch (e) {
      setError('Bé cho phép dùng mic nhé! 🎤'); console.error(e)
    }
  }

  function onMic() {
    if (rec.state === 'idle') { void startRecording(); return }
    if (rec.state === 'recording') void stopAndScore()
  }

  function retry() { setFeedback(null); setError(null) }

  const micState = !scorer ? 'disabled' : scoring ? 'processing' : rec.state
  return (
    <main className="h-full flex flex-col items-center justify-between p-6">
      <div className="w-full flex justify-between text-xl">
        <Link to={`/level/${LEVELS.find(l => l.cards.includes(card))!.id}`} className="inline-flex items-center min-h-[64px] px-4">← Quay lại</Link>
        <span className="text-slate-400">{scorer?.engine === 'webspeech' ? 'chế độ offline' : ''}</span>
      </div>
      <div className="flex items-center gap-10">
        <span className="text-[120px]">{card.emoji}</span>
        <div className="text-center">
          <div className="text-7xl font-extrabold">{card.text}</div>
          <div className="text-2xl text-slate-500">{card.ipa}</div>
          <button onClick={() => playUrl(card.audio).catch(() => {})} className="mt-4 w-20 h-20 rounded-full bg-teal text-white text-4xl">🔊</button>
        </div>
      </div>
      {error && <p className="text-2xl text-fix">{error}</p>}
      {feedback && (
        <section className="flex flex-col items-center gap-4">
          <Stars value={feedback.stars} />
          <p className="text-3xl font-extrabold">{feedback.message}</p>
          <ScoredWords words={feedback.words} onWordTap={() => playUrl(card.audio).catch(() => {})} />
          {feedback.hint && <HintCard hint={feedback.hint} />}
          <div className="flex gap-4 text-xl">
            {lastBlob && <button onClick={() => playBlob(lastBlob).catch(() => {})} className={`px-6 py-3 rounded-2xl bg-white shadow ${TAP_TARGET}`}>🎧 Nghe mình</button>}
            <button onClick={() => playUrl(card.audio).catch(() => {})} className={`px-6 py-3 rounded-2xl bg-white shadow ${TAP_TARGET}`}>🔊 Nghe mẫu</button>
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
