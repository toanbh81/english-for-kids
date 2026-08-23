import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { findCard, LEVELS } from '../content'
import type { PronunciationResult } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { ScoreBars } from '../components/ScoreBars'
import { HintCard } from '../components/HintCard'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { BackButton, Button, Card } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

const SAMPLE_CHIP =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-teal-50 px-7 font-display text-xl font-extrabold text-teal-600 shadow-[0_5px_0_#C4E8E1] active:translate-y-[2px]'

export function PracticeCard() {
  const { cardId = '' } = useParams()
  const nav = useNavigate()
  const card = findCard(cardId)

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: cardId, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${cardId}:${Date.now()}`, ts: Date.now(), text: card?.text ?? '', blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({ targetText: card?.text ?? '', autoStopMs: AUTO_STOP_MS, resetKey: cardId, onResult: handleResult })
  const [attempts, setAttempts] = useState(0)
  const [audioMissing, setAudioMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)

  const feedback = useMemo(() => (attempt.result ? toFeedback(attempt.result) : null), [attempt.result])

  useEffect(() => {
    setAttempts(0); setAudioMissing(false)
  }, [cardId])

  useEffect(() => {
    if (feedback) { setAttempts(a => a + 1); setStars(cardId, feedback.stars) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.result])

  // The countdown only exists while the mic is open: it restarts on every recording and the
  // interval is cleared the moment the state changes (or the card unmounts).
  const recording = attempt.micState === 'recording'
  useEffect(() => {
    if (!recording) return
    setSecondsLeft(COUNTDOWN_FROM)
    const id = window.setInterval(() => setSecondsLeft(s => (s > 1 ? s - 1 : 1)), 1000)
    return () => clearInterval(id)
  }, [recording])

  if (!card) return <p>Không tìm thấy thẻ</p>
  const level = LEVELS.find(l => l.cards.includes(card))!
  const cardIndex = level.cards.findIndex(c => c.id === cardId)
  // "Tiếp theo" stays inside this level, so it agrees with the "Thẻ n/N" counter above it: on
  // card N of N there is no next card, and the run ends with "Hoàn thành 🎉" back at the level.
  const next = level.cards[cardIndex + 1]

  const mood: FoxyMood = recording
    ? 'listening'
    : feedback?.stars === 3 ? 'cheer' : feedback?.stars === 2 ? 'happy' : 'idle'

  const isWebSpeech = attempt.engine === 'webspeech'

  function retry() { attempt.reset() }

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(card!.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-5">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to={`/level/${level.id}`} label="Quay lại" />
          <div className="flex flex-col items-center gap-2">
            <span className="font-display text-xl font-extrabold text-ink-500">Thẻ {cardIndex + 1}/{level.cards.length}</span>
            <div className="flex gap-2">
              {level.cards.map((c, i) => (
                <span
                  key={c.id}
                  aria-hidden="true"
                  className={`h-4 w-4 rounded-full ${i < cardIndex ? 'bg-teal-500' : i === cardIndex ? 'bg-coral-500' : 'bg-line-200'}`}
                />
              ))}
            </div>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">{isWebSpeech ? 'chế độ đơn giản' : ''}</span>
        </header>

        {feedback ? (
          <>
            {feedback.stars === 3 && <Confetti />}
            <section className="flex flex-col items-center gap-4 pb-2">
              <Stars value={feedback.stars} animate />
              <div className="flex items-end gap-3">
                <Foxy mood={mood} size="sm" />
                <p className="font-display text-3xl font-extrabold text-ink-900">{feedback.message}</p>
              </div>
              <ScoredWords words={feedback.words} onWordTap={playSample} />
              {feedback.hint && <HintCard hint={feedback.hint} />}
              <div className="flex flex-wrap justify-center gap-4">
                {attempt.lastBlob && (
                  <Button variant="outline" onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
                )}
                <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              </div>
              {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
              {attempt.result && <ScoreBars result={attempt.result} />}
              <div className="flex flex-wrap justify-center gap-4 pt-1">
                <Button variant="outline" onClick={retry}>↻ Thử lại</Button>
                {(feedback.stars === 3 || attempts >= 3) && (
                  next
                    ? <Button size="lg" pulse onClick={() => nav(`/practice/${next.id}`)}>Tiếp theo →</Button>
                    : <Button size="lg" pulse onClick={() => nav(`/level/${level.id}`)}>Hoàn thành 🎉</Button>
                )}
              </div>
            </section>
          </>
        ) : recording ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="font-display text-[44px] font-extrabold text-[#D9C9AE]">{card.text}</div>
            <div aria-hidden="true" className="font-display text-[56px] font-extrabold leading-none text-coral-text">{secondsLeft}</div>
            <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
          </section>
        ) : (
          <section className="flex w-full flex-1 flex-wrap items-center justify-center gap-8">
            <Card className="flex h-[220px] w-[220px] shrink-0 flex-col items-center justify-center gap-2">
              <span aria-hidden="true" className="text-[104px] leading-none">{card.emoji}</span>
              <span className="text-base font-bold text-ink-300">nghĩa của từ</span>
            </Card>

            <div className="flex flex-col items-center gap-3">
              <div className={`font-display font-extrabold leading-none text-ink-900 ${card.text.length > 12 ? 'text-[46px]' : 'text-[64px]'}`}>
                {card.text}
              </div>
              <div className="text-[22px] font-bold text-ink-300">{card.ipa}</div>
              <button onClick={playSample} className={SAMPLE_CHIP}>🔊 Nghe mẫu</button>
              {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
            </div>

            <div className="flex h-[220px] w-[220px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl3 bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9]">
              <span aria-hidden="true" className="animate-wiggle text-[76px] leading-none">👄</span>
              <span className="text-base font-bold text-ink-500">Khẩu hình miệng</span>
            </div>
          </section>
        )}

        {attempt.error && <p className="font-display text-2xl font-extrabold text-fix-700">{attempt.error}</p>}

        {!feedback && (
          <div className="flex flex-col items-center gap-3 pb-2 pt-1">
            <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
            {!recording && <p className="font-display text-xl font-extrabold text-ink-500">Chạm để nói nào!</p>}
          </div>
        )}
      </div>
    </main>
  )
}
