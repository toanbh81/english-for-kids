import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findCard, LEVELS } from '../content'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { HintCard } from '../components/HintCard'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

const TAP_TARGET = 'min-h-[64px] min-w-[64px] flex items-center'

export function PracticeCard() {
  const { cardId = '' } = useParams()
  const nav = useNavigate()
  const card = findCard(cardId)
  const attempt = useSpeakingAttempt({ targetText: card?.text ?? '', resetKey: cardId })
  const [attempts, setAttempts] = useState(0)
  const [audioMissing, setAudioMissing] = useState(false)

  const feedback = useMemo(() => (attempt.result ? toFeedback(attempt.result) : null), [attempt.result])

  useEffect(() => {
    setAttempts(0); setAudioMissing(false)
  }, [cardId])

  useEffect(() => {
    if (feedback) { setAttempts(a => a + 1); setStars(cardId, feedback.stars) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.result])

  if (!card) return <p>Không tìm thấy thẻ</p>
  const allCards = LEVELS.flatMap(l => l.cards)
  const next = allCards[allCards.findIndex(c => c.id === cardId) + 1]

  const isWebSpeech = attempt.engine === 'webspeech'

  function retry() { attempt.reset() }

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(card!.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

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
      {attempt.error && <p className="text-2xl text-fix">{attempt.error}</p>}
      {feedback && (
        <section className="flex flex-col items-center gap-4">
          <Stars value={feedback.stars} animate={feedback.stars === 3} />
          <p className="text-3xl font-extrabold">{feedback.message}</p>
          <ScoredWords words={feedback.words} onWordTap={playSample} />
          {feedback.hint && <HintCard hint={feedback.hint} />}
          <div className="flex gap-4 text-xl">
            {attempt.lastBlob && <button onClick={() => playBlob(attempt.lastBlob!).catch(() => {})} className={`px-6 py-3 rounded-2xl bg-white shadow ${TAP_TARGET}`}>🎧 Nghe mình</button>}
            <button onClick={playSample} className={`px-6 py-3 rounded-2xl bg-white shadow ${TAP_TARGET}`}>🔊 Nghe mẫu</button>
            <button onClick={retry} className={`px-6 py-3 rounded-2xl bg-white shadow ${TAP_TARGET}`}>Thử lại</button>
            {next && (feedback.stars === 3 || attempts >= 3) && (
              <button onClick={() => nav(`/practice/${next.id}`)} className={`px-6 py-3 rounded-2xl bg-coral text-white font-extrabold ${TAP_TARGET}`}>Tiếp theo →</button>
            )}
          </div>
        </section>
      )}
      <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
    </main>
  )
}
