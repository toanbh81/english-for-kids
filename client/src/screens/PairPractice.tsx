import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PAIRS, findPair } from '../content'
import { seededSide } from '../content/shuffle'
import type { PairItem } from '../content/types'
import type { PronunciationResult } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { missionNoun, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Card, Chip, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { MicButton, ResultCard, SpeakError } from '../components/speak'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

type Side = 'a' | 'b'

const SIDES = ['a', 'b'] as const

/**
 * Which of the two words 🔊 plays, decided from the number of listens so far: the `listens`-th
 * draw of a PRNG stream seeded by the pair's id. Unpredictable to the child (no alternation to
 * count) but fixed per pair — see `seededSide`.
 */
function targetFor(pair: PairItem, listens: number): Side {
  return seededSide(pair.id, listens, SIDES)
}

const OPTION =
  'flex min-h-[150px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl3 bg-white p-3 shadow-card transition-transform active:translate-y-[2px] disabled:opacity-50 disabled:active:translate-y-0'
  + ' md:min-h-[240px] md:w-[220px] md:flex-initial md:gap-2 md:p-5'

export function PairPractice() {
  const { id = '' } = useParams()
  const pair = findPair(id)
  // The hooks live in the inner component so an unknown pair never renders half of them.
  if (!pair) return <NotFound what="cặp từ" />
  return <PairRun key={pair.id} pair={pair} />
}

function PairRun({ pair }: { pair: PairItem }) {
  // Null unless the child arrived from the mission: only then is this pair step "Thẻ 2/4" of
  // today's lesson rather than pair 2 of the bậc (spec §3).
  const mission = useMissionNext()
  // Both words in one breath — that is the whole point of a minimal pair: the child has to make
  // the contrast audible twice in a row.
  const targetText = `${pair.a.word}, ${pair.b.word}`

  const [listens, setListens] = useState(0)
  const [target, setTarget] = useState<Side | null>(null)
  const [answer, setAnswer] = useState<'right' | 'wrong' | null>(null)
  // One tick per WORD, not a count of correct answers. Two right picks used to open the mic, and
  // the draw can serve the same side twice — so a child could pass the listening game having
  // heard only "ship", which proves nothing about the contrast the pair exists to teach.
  const [done, setDone] = useState<Record<Side, boolean>>({ a: false, b: false })
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
  const listening = !(done.a && done.b)
  /** "ship ✓ · sheep ○" — which word the child still owes, in one line. */
  const ticks = `${pair.a.word} ${done.a ? '✓' : '○'} · ${pair.b.word} ${done.b ? '✓' : '○'}`

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
    if (side === target) setDone(d => ({ ...d, [target]: true }))
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
        <span aria-hidden="true" className="text-[56px] leading-none md:text-[88px]">{w.emoji}</span>
        <span className="font-display text-[26px] font-extrabold leading-none text-ink-900 md:text-[40px]">{w.word}</span>
        <span className="text-[13px] font-bold text-ink-300 md:text-[18px]">{w.ipa}</span>
      </button>
    )
  }

  const onErrorAction = useSpeakErrorAction(attempt)

  return (
    <PageShell gutter="20">
      <PageHeader back={mission ? <BackButton to="/mission" label="Nhiệm vụ" /> : <BackButton to="/level/minimal-pairs" label="Quay lại" />} engine={attempt.engine}>
        {mission
          ? <Chip tone="coral">{missionNoun(mission.pos, 'Thẻ')} {mission.pos.index}/{mission.pos.total}</Chip>
          : <Chip tone="coral">Cặp {index + 1}/{PAIRS.length}</Chip>}
        <Chip tone="teal" size="sm">{pair.contrast}</Chip>
      </PageHeader>
      {listening ? (
        <PageBody center>
          <div className="flex w-full flex-1 flex-col items-center gap-2.5 md:gap-4">
            <p className="font-display text-lg font-extrabold text-ink-900 md:text-2xl">Nghe rồi chọn từ đúng nhé!</p>

            <Button
              variant="secondary"
              size="lg"
              pulse={target === null}
              onClick={listen}
              className="px-8 text-[24px] md:px-12 md:text-[30px]"
            >
              🔊 Nghe
            </Button>
            {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}

            <div className="flex w-full items-center justify-center gap-3 md:w-auto md:flex-wrap md:gap-6">
              {option('a')}
              {option('b')}
            </div>

            <div className="flex min-h-[64px] flex-col items-center gap-2 md:min-h-[80px]">
              {answer === 'right' && (
                <div className="flex items-end gap-3">
                  <span aria-hidden="true" className="text-[34px] leading-none md:text-[44px]">✅</span>
                  <Foxy mood="happy" size="sm" say="Đúng rồi! 🎉" />
                </div>
              )}
              {answer === 'wrong' && (
                <>
                  <div className="flex items-end gap-3">
                    <span aria-hidden="true" className="text-[34px] leading-none md:text-[44px]">🙈</span>
                    <Foxy mood="surprised" size="sm" say="Nghe lại nhé" />
                  </div>
                  <p className="font-display text-base font-extrabold text-ink-300 md:text-xl">Bấm 🔊 nghe lại nhé</p>
                </>
              )}
              {answer === null && target === null && (
                <p className="font-display text-base font-extrabold text-ink-300 md:text-xl">Bấm 🔊 trước nhé</p>
              )}
            </div>

            <p className="font-display text-base font-extrabold text-ink-500 md:text-xl">{ticks}</p>
          </div>
        </PageBody>
      ) : (
        <PageBody split={{
          teach: (
            <Card className="flex min-h-[64px] w-full items-center justify-center gap-3 px-4 py-2 md:px-6 md:py-3">
              <span aria-hidden="true" className="text-[24px] leading-none md:text-[28px]">👂</span>
              <span className="font-display text-base font-extrabold text-ink-900 md:text-xl">{`Nghe & chọn: ${ticks}`}</span>
            </Card>
          ),
          act: feedback ? (
            <>
              {feedback.stars === 3 && <Confetti />}
              <ResultCard
                stars={feedback.stars}
                praise={feedback.message}
                score={attempt.result?.overall}
                words={feedback.words}
                hint={feedback.hint}
                canReplay={!!attempt.lastBlob}
                onReplay={() => playBlob(attempt.lastBlob!).catch(() => {})}
                onRetry={() => attempt.reset()}
                primary={mission
                  ? { label: mission.label, onClick: mission.go }
                  : next
                    ? { label: 'Tiếp theo →', to: `/pair/${next.id}` }
                    : { label: 'Hoàn thành 🎉', to: '/level/minimal-pairs' }}
                animate={feedback.stars === 3}
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {!recording && (
                <>
                  <p className="font-display text-base font-extrabold text-ink-900 md:text-2xl">Giờ đọc cả hai từ nào!</p>
                  <div className="font-display text-[30px] font-extrabold leading-none text-ink-900 md:text-[40px]">{targetText}</div>
                </>
              )}
              {attempt.error && <SpeakError error={attempt.error} onAction={onErrorAction} onDismiss={attempt.dismissError} />}
              <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} secondsLeft={recording ? secondsLeft : undefined} />
            </div>
          ),
        }} />
      )}
    </PageShell>
  )
}
