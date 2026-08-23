import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PAIRS, findPair } from '../content'
import type { PairItem } from '../content/types'
import type { PronunciationResult } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { HintCard } from '../components/HintCard'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Card, Chip } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/** How many listens the child has to get right before the mic step opens. */
const NEEDED = 2

type Side = 'a' | 'b'

/**
 * Which of the two words 🔊 plays, decided from the number of listens so far.
 *
 * It has to alternate (a child who always hears the same word learns nothing) and it has to be
 * *deterministic* — a random draw would make the screen untestable and would let the same pair
 * open with the same word only by luck. So the listens alternate a/b, and the pair's id seeds
 * which side goes first: an even-length id starts on `a`, an odd-length one on `b`. Every pair
 * therefore has its own fixed order that is stable across reloads.
 */
function targetFor(pair: PairItem, listens: number): Side {
  const firstIsA = pair.id.length % 2 === 0
  const evenTurn = listens % 2 === 0
  return evenTurn === firstIsA ? 'a' : 'b'
}

const OPTION =
  'flex min-h-[240px] w-[220px] flex-col items-center justify-center gap-2 rounded-xl3 bg-white p-5 shadow-card transition-transform active:translate-y-[2px] disabled:opacity-50 disabled:active:translate-y-0'

export function PairPractice() {
  const { id = '' } = useParams()
  const pair = findPair(id)
  // The hooks live in the inner component so an unknown pair never renders half of them.
  if (!pair) return <p>Không tìm thấy cặp từ</p>
  return <PairRun key={pair.id} pair={pair} />
}

function PairRun({ pair }: { pair: PairItem }) {
  const nav = useNavigate()
  // Both words in one breath — that is the whole point of a minimal pair: the child has to make
  // the contrast audible twice in a row.
  const targetText = `${pair.a.word}, ${pair.b.word}`

  const [listens, setListens] = useState(0)
  const [target, setTarget] = useState<Side | null>(null)
  const [answer, setAnswer] = useState<'right' | 'wrong' | null>(null)
  const [correct, setCorrect] = useState(0)
  const [audioMissing, setAudioMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: pair.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${pair.id}:${Date.now()}`, ts: Date.now(), text: targetText, blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({
    targetText,
    autoStopMs: AUTO_STOP_MS,
    resetKey: pair.id,
    onResult: handleResult,
  })

  const feedback = useMemo(() => (attempt.result ? toFeedback(attempt.result) : null), [attempt.result])

  // A retry can only raise the pair's stars — `setStars` keeps the highest it has seen.
  useEffect(() => {
    if (feedback) setStars(`pair:${pair.id}`, feedback.stars)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.result])

  // The countdown only exists while the mic is open: it restarts on every recording and the
  // interval is cleared the moment the state changes (or the screen unmounts).
  const recording = attempt.micState === 'recording'
  useEffect(() => {
    if (!recording) return
    setSecondsLeft(COUNTDOWN_FROM)
    const id = window.setInterval(() => setSecondsLeft(s => (s > 1 ? s - 1 : 1)), 1000)
    return () => clearInterval(id)
  }, [recording])

  const index = PAIRS.findIndex(p => p.id === pair.id)
  const next = PAIRS[index + 1]
  const listening = correct < NEEDED

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function listen() {
    const side = targetFor(pair, listens)
    setTarget(side)
    setAnswer(null)
    setListens(n => n + 1)
    playUrl(pair[side].audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  /**
   * Either answer closes the round and locks the cards until the next 🔊. Leaving a missed round
   * armed would hand the child a free win — with only two cards, "not that one" is the answer —
   * and the exercise would stop being about listening at all.
   */
  function choose(side: Side) {
    if (!target) return
    setAnswer(side === target ? 'right' : 'wrong')
    if (side === target) setCorrect(c => c + 1)
    setTarget(null)
  }

  function option(side: Side) {
    const w = pair[side]
    return (
      <button
        key={side}
        onClick={() => choose(side)}
        disabled={target === null}
        aria-label={w.word}
        className={OPTION}
      >
        <span aria-hidden="true" className="text-[96px] leading-none">{w.emoji}</span>
        <span className="font-display text-[44px] font-extrabold leading-none text-ink-900">{w.word}</span>
        <span className="text-[20px] font-bold text-ink-300">{w.ipa}</span>
      </button>
    )
  }

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to="/level/minimal-pairs" label="Quay lại" />
          <div className="flex flex-col items-center gap-2">
            <Chip tone="coral">Cặp {index + 1}/{PAIRS.length}</Chip>
            <Chip tone="teal" size="sm">{pair.contrast}</Chip>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {listening ? (
          <section className="flex w-full flex-1 flex-col items-center gap-4">
            <p className="font-display text-2xl font-extrabold text-ink-900">Nghe rồi chọn từ đúng nhé!</p>

            <Button
              variant="secondary"
              size="lg"
              pulse={target === null}
              onClick={listen}
              className="min-h-[104px] px-12 text-[30px]"
            >
              🔊 Nghe
            </Button>
            {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}

            <div className="flex flex-wrap items-center justify-center gap-6">
              {option('a')}
              {option('b')}
            </div>

            <div className="flex min-h-[80px] flex-col items-center gap-2">
              {answer === 'right' && (
                <div className="flex items-end gap-3">
                  <span aria-hidden="true" className="text-[44px] leading-none">✅</span>
                  <Foxy mood="happy" size="sm" say="Đúng rồi! 🎉" />
                </div>
              )}
              {answer === 'wrong' && (
                <>
                  <div className="flex items-end gap-3">
                    <span aria-hidden="true" className="text-[44px] leading-none">🙈</span>
                    <Foxy mood="surprised" size="sm" say="Nghe lại nhé" />
                  </div>
                  <p className="font-display text-xl font-extrabold text-ink-300">Bấm 🔊 nghe lại nhé</p>
                </>
              )}
              {answer === null && target === null && (
                <p className="font-display text-xl font-extrabold text-ink-300">Bấm 🔊 trước nhé</p>
              )}
            </div>

            <p className="font-display text-xl font-extrabold text-ink-500">Đúng {correct}/{NEEDED}</p>
          </section>
        ) : (
          <>
            {/* The listening game is over, so it shrinks to one line and hands the screen to the mic. */}
            <Card className="flex min-h-[64px] items-center justify-center gap-3 px-6 py-3">
              <span aria-hidden="true" className="text-[28px] leading-none">👂</span>
              <span className="font-display text-xl font-extrabold text-ink-900">Nghe &amp; chọn: {correct}/{NEEDED} đúng ✅</span>
            </Card>

            {feedback ? (
              <section className="flex flex-col items-center gap-4 pb-2">
                {feedback.stars === 3 && <Confetti />}
                <Stars value={feedback.stars} animate={feedback.stars === 3} />
                <p className="font-display text-3xl font-extrabold text-ink-900">{feedback.message}</p>
                <ScoredWords words={feedback.words} />
                {feedback.hint && <HintCard hint={feedback.hint} />}
                {attempt.lastBlob && (
                  <Button variant="outline" onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
                )}
                <div className="flex flex-wrap justify-center gap-4 pt-1">
                  <Button variant="outline" onClick={attempt.reset}>↻ Thử lại</Button>
                  {next
                    ? <Button size="lg" pulse onClick={() => nav(`/pair/${next.id}`)}>Tiếp theo →</Button>
                    : <Button size="lg" pulse onClick={() => nav('/level/minimal-pairs')}>Hoàn thành 🎉</Button>}
                </div>
              </section>
            ) : (
              <section className="flex flex-1 flex-col items-center justify-center gap-3">
                <p className="font-display text-2xl font-extrabold text-ink-900">Giờ đọc cả hai từ nào!</p>
                <div className="font-display text-[44px] font-extrabold leading-none text-ink-900">{targetText}</div>
                {recording && (
                  <>
                    <div aria-hidden="true" className="font-display text-[56px] font-extrabold leading-none text-coral-text">{secondsLeft}</div>
                    <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
                  </>
                )}
              </section>
            )}

            {attempt.error && <p className="font-display text-2xl font-extrabold text-fix-700">{attempt.error}</p>}

            {!feedback && (
              <div className="flex flex-col items-center gap-3 pb-2 pt-1">
                <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
                {!recording && <p className="font-display text-xl font-extrabold text-ink-500">Chạm để nói nào!</p>}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
