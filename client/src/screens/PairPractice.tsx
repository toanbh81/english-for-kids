import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { HintCard } from '../components/HintCard'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Card, Chip, PAGE_SHELL } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/**
 * Phone layout follows `SoundPractice`'s idiom to the letter (see the comment block at the top of
 * that file): phone values sit unprefixed, `md:` restores the exact landscape value, and `max-md:`
 * appears only where a shared primitive writes a competing class of its own. Nothing is `sticky`.
 */
const CTA_PHONE = 'max-md:min-h-[64px] max-md:px-4 max-md:text-lg'

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

/** Two 220×240 slabs side by side is the landscape pair; at 390 px they wrap to two rows and cut
 * the second word off the bottom of the screen. On a phone they are half-width tiles on one line
 * instead — still 150 px tall, so each is a comfortably large target for a small finger — and
 * `md:` puts the landscape numbers back exactly (`md:flex-initial`, never `md:flex-none`). */
const OPTION =
  'flex min-h-[150px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl3 bg-white p-3 shadow-card transition-transform active:translate-y-[2px] disabled:opacity-50 disabled:active:translate-y-0'
  + ' md:min-h-[240px] md:w-[220px] md:flex-initial md:gap-2 md:p-5'

export function PairPractice() {
  const { id = '' } = useParams()
  const pair = findPair(id)
  // The hooks live in the inner component so an unknown pair never renders half of them.
  if (!pair) return <p>Không tìm thấy cặp từ</p>
  return <PairRun key={pair.id} pair={pair} />
}

function PairRun({ pair }: { pair: PairItem }) {
  const nav = useNavigate()
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
        <span aria-hidden="true" className="text-[56px] leading-none md:text-[96px]">{w.emoji}</span>
        <span className="font-display text-[26px] font-extrabold leading-none text-ink-900 md:text-[44px]">{w.word}</span>
        <span className="text-[13px] font-bold text-ink-300 md:text-[20px]">{w.ipa}</span>
      </button>
    )
  }

  return (
    // 20 px of side frame on a phone (design §1, the speak-frame family), the 24 px this screen
    // has always had from the tablet breakpoint up. The vertical padding is the safe-area shell
    // resting at the 1.25 rem of the old `py-5` — the same 20 px with no notch to clear.
    <main className={`h-full overflow-y-auto bg-cream-50 px-5 [--page-pad-bottom:1.25rem] [--page-pad-top:1.25rem] md:px-6 ${PAGE_SHELL}`}>
      {/* A *definite* height on the phone is what lets the result read-out below take the leftover
        * space and scroll inside it instead of walking the CTA row off the bottom of the screen.
        * It is switched on only for the result: a definite height also lets a `flex-1` section be
        * squeezed below its content, which is fine for a read-out that scrolls but would paint the
        * recording countdown over the mic. Every other state keeps the growing `min-h-full`
        * column, so the worst it can do is make the page scroll. */}
      <div className={`mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-2.5 md:gap-4 ${feedback ? 'max-md:h-full' : ''}`}>
        <header className="flex w-full items-center justify-between gap-4">
          {mission
            ? <BackButton to="/mission" label="Nhiệm vụ" />
            : <BackButton to="/level/minimal-pairs" label="Quay lại" />}
          <div className="flex flex-col items-center gap-2">
            {/* In a lesson the bậc's own count is the wrong count, and two counters are one too
                many for a child to read — so the mission's position replaces it. */}
            {mission
              ? <Chip tone="coral">{missionNoun(mission.pos, 'Thẻ')} {mission.pos.index}/{mission.pos.total}</Chip>
              : <Chip tone="coral">Cặp {index + 1}/{PAIRS.length}</Chip>}
            <Chip tone="teal" size="sm">{pair.contrast}</Chip>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {listening ? (
          <section className="flex w-full flex-1 flex-col items-center gap-2.5 md:gap-4">
            <p className="font-display text-lg font-extrabold text-ink-900 md:text-2xl">Nghe rồi chọn từ đúng nhé!</p>

            {/* 30 px type in the landscape frame, 24 px on a phone — the 30 px version is 215 px
                wide, which is most of a 350 px column.
                The height is `Button`'s own lg 72 px and always has been. This call site used to
                carry `min-h-[104px]`, and it never won: two *plain* arbitrary utilities for the
                same property are decided by Tailwind's own emission order, and `min-h-[72px]` is
                emitted after `min-h-[104px]`. That is exactly the coin toss the phase's `max-md:`
                rule exists to avoid. Restating it as `md:min-h-[104px]` would have won — every
                variant is emitted after the plain utilities — and grown the iPad's button by
                32 px, which the phase forbids, so the dead class is gone instead of left here
                reading like a promise. 72 px is comfortably over the 64 px floor. */}
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
          </section>
        ) : (
          <>
            {/* The listening game is over, so it shrinks to one line and hands the screen to the mic. */}
            <Card className={`flex min-h-[64px] items-center justify-center gap-3 px-4 py-2 md:px-6 md:py-3 ${feedback ? 'max-md:hidden' : ''}`}>
              <span aria-hidden="true" className="text-[24px] leading-none md:text-[28px]">👂</span>
              <span className="font-display text-base font-extrabold text-ink-900 md:text-xl">{`Nghe & chọn: ${ticks}`}</span>
            </Card>

            {feedback ? (
              /* On a phone the read-out is a bounded scrolling region with the CTA row as its
                 *sibling* underneath — never a `sticky` overlay, which would paint over whichever
                 word chip happened to sit at its y. `md:contents` takes the wrapper out of the box
                 tree from 768 up, so the landscape frame is the same flat column it always was. */
              <section className="flex w-full flex-col items-center gap-2.5 pb-2 max-md:min-h-0 max-md:flex-1 md:w-auto md:gap-4">
                {feedback.stars === 3 && <Confetti />}
                <div className="flex w-full flex-col items-center gap-2.5 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto md:contents">
                  <Stars value={feedback.stars} animate={feedback.stars === 3} />
                  <p className="font-display text-xl font-extrabold text-ink-900 md:text-3xl">{feedback.message}</p>
                  <ScoredWords words={feedback.words} />
                  {feedback.hint && <HintCard hint={feedback.hint} />}
                  {attempt.lastBlob && (
                    <Button variant="outline" className={CTA_PHONE} onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
                  )}
                </div>
                <div className="flex w-full flex-wrap justify-center gap-2 pt-1 md:w-auto md:gap-4">
                  <Button variant="outline" className={`${CTA_PHONE} max-md:flex-1`} onClick={attempt.reset}>↻ Thử lại</Button>
                  {mission
                    ? <Button size="lg" pulse className={`${CTA_PHONE} max-md:flex-[1.35]`} onClick={mission.go}>{mission.label}</Button>
                    : next
                      ? <Button size="lg" pulse className={`${CTA_PHONE} max-md:flex-[1.35]`} onClick={() => nav(`/pair/${next.id}`)}>Tiếp theo →</Button>
                      : <Button size="lg" pulse className={`${CTA_PHONE} max-md:flex-[1.35]`} onClick={() => nav('/level/minimal-pairs')}>Hoàn thành 🎉</Button>}
                </div>
              </section>
            ) : (
              <section className="flex flex-1 flex-col items-center justify-center gap-3">
                <p className="font-display text-base font-extrabold text-ink-900 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-2xl">Giờ đọc cả hai từ nào!</p>
                <div className="font-display text-[30px] font-extrabold leading-none text-ink-900 md:text-[44px]">{targetText}</div>
                {recording && (
                  <>
                    <div aria-hidden="true" className="font-display text-[44px] font-extrabold leading-none text-coral-text md:text-[56px]">{secondsLeft}</div>
                    <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
                  </>
                )}
              </section>
            )}

            {attempt.error && <p className="font-display text-xl font-extrabold text-fix-700 md:text-2xl">{attempt.error}</p>}

            {!feedback && (
              <div className="mt-auto flex flex-col items-center gap-2 pb-1 pt-1 [@media(max-width:767px)_and_(max-height:700px)]:pb-0 [@media(max-width:767px)_and_(max-height:700px)]:pt-0 md:mt-0 md:gap-3 md:pb-2">
                <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
                {!recording && <p className="font-display text-base font-extrabold text-ink-500 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-xl">Chạm để nói nào!</p>}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
