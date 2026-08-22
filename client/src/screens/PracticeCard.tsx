import { useEffect, useState } from 'react'
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

export function PracticeCard() {
  const { cardId = '' } = useParams()
  const nav = useNavigate()
  const card = findCard(cardId)
  const rec = useRecorder({ maxMs: 6000 })
  const [scorer, setScorer] = useState<{ scorer: PronunciationScorer; engine: string } | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setFeedback(null); setAttempts(0); createScorer().then(setScorer) }, [cardId])
  if (!card) return <p>Không tìm thấy thẻ</p>
  const allCards = LEVELS.flatMap(l => l.cards)
  const next = allCards[allCards.findIndex(c => c.id === cardId) + 1]

  async function onMic() {
    if (!scorer) return
    if (rec.state === 'idle') {
      setFeedback(null); setError(null)
      if (scorer.scorer instanceof WebSpeechScorer) scorer.scorer.start()
      await rec.start(); return
    }
    if (rec.state === 'recording') {
      const blob = await rec.stop(); setLastBlob(blob)
      try {
        const fb = toFeedback(await scorer.scorer.score(blob, card!.text))
        setFeedback(fb); setAttempts(a => a + 1); setStars(card!.id, fb.stars)
      } catch (e) { setError('Không nghe rõ, bé thử lại nhé!'); console.error(e) }
    }
  }

  const micState = !scorer ? 'disabled' : rec.state
  return (
    <main className="h-full flex flex-col items-center justify-between p-6">
      <div className="w-full flex justify-between text-xl">
        <Link to={`/level/${LEVELS.find(l => l.cards.includes(card))!.id}`}>← Quay lại</Link>
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
            {lastBlob && <button onClick={() => playBlob(lastBlob)} className="px-6 py-3 rounded-2xl bg-white shadow">🎧 Nghe mình</button>}
            <button onClick={() => playUrl(card.audio).catch(() => {})} className="px-6 py-3 rounded-2xl bg-white shadow">🔊 Nghe mẫu</button>
            {next && (feedback.stars === 3 || attempts >= 3) && (
              <button onClick={() => nav(`/practice/${next.id}`)} className="px-6 py-3 rounded-2xl bg-coral text-white font-extrabold">Tiếp theo →</button>
            )}
          </div>
        </section>
      )}
      <MicButton state={micState} level={rec.level} onPress={onMic} />
    </main>
  )
}
