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
import { BackButton, Button, Chip, ChipPair, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { MicButton, ResultCard, SpeakError, SpeakPrompt } from '../components/speak'
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

/** Round-2 (brief §2 B4) phase-1 option tile: 96 px on a phone, 200 on iPad — no IPA, the tick
 * line under the pair already carries each word's own name. The tile is `disabled` in two very
 * different states — genuinely unplayable (before any 🔊) and merely locked-till-the-next-🔊
 * (right after an answer, while its ring is the whole point) — so opacity is NOT tied to
 * `disabled:` (fix round 1): only the former dims to .45 (`option()`'s own `dimmed` class), the
 * ring on an answered tile always paints at full opacity. Green for a hit and pink for a miss —
 * the OTHER card stays plain even on a wrong pick, since only the tapped one was the child's
 * answer. */
const OPTION = 'flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-r18 bg-white p-2 shadow-card'
  + ' transition-transform active:translate-y-[2px] disabled:active:translate-y-0'
  + ' md:h-[200px] md:w-[200px] md:gap-2.5'

const RING = {
  right: 'shadow-[0_6px_0_#7ED99A,0_0_0_4px_#B9ECC8]',
  wrong: 'shadow-[0_6px_0_#F8A3AE,0_0_0_4px_#FFD4DA]',
} as const

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
  // Which card the child actually tapped for the current/last round — drives the per-card ring;
  // cleared on every fresh 🔊 so a stale ring never survives into the next round.
  const [lastPick, setLastPick] = useState<Side | null>(null)
  // One tick per WORD, not a count of correct answers. Two right picks used to open the mic, and
  // the draw can serve the same side twice — so a child could pass the listening game having
  // heard only "ship", which proves nothing about the contrast the pair exists to teach.
  const [done, setDone] = useState<Record<Side, boolean>>({ a: false, b: false })
  const [audioMissing, setAudioMissing] = useState(false)
  const [sampleMissing, setSampleMissing] = useState(false)
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

  // Brief §1 "Tầng dạy gập": the teach column collapses to a tap-to-expand strip once a result
  // lands, and reopens either on tap or on a fresh attempt — a retry should not leave the child
  // staring at yesterday's collapsed strip once they start reading again.
  const [teachOpen, setTeachOpen] = useState(true)
  useEffect(() => {
    if (attempt.result) setTeachOpen(false)
  }, [attempt.result])

  // Headless screenshots land straight on a scored attempt via `?fixture=result3`/`result1`
  // (`useSpeakingAttempt` injects it on its own — see `speaking/fixture.ts`), with no real
  // listening game behind it. A real result can never exist before both words are done (the mic
  // only renders in phase 2), so this only ever fires for that DEV-only shortcut — it backfills
  // the ticks so the summary/result never contradicts "not listened to yet".
  useEffect(() => {
    if (attempt.result && !(done.a && done.b)) setDone({ a: true, b: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.result])

  const index = PAIRS.findIndex(p => p.id === pair.id)
  const next = PAIRS[index + 1]
  // Phase 1 (brief §2 B4): listen & pick, no mic at all. Phase 2 opens once BOTH words have been
  // picked correctly at least once.
  const listening = !(done.a && done.b)
  /** "ship ✓ · sheep ○" — which word the child still owes, in one line. */
  const ticks = `${pair.a.word} ${done.a ? '✓' : '○'} · ${pair.b.word} ${done.b ? '✓' : '○'}`
  // Nothing played yet at all (not merely "locked until the next 🔊 after an answer") — the
  // speaker's pulse ring and the option tiles' dimming both key off exactly this.
  const unplayed = target === null && answer === null

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function listen() {
    const side = targetFor(pair, listens)
    setTarget(side)
    setAnswer(null)
    setLastPick(null)
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
    const correct = side === target
    setAnswer(correct ? 'right' : 'wrong')
    setLastPick(side)
    if (correct) setDone(d => ({ ...d, [target]: true }))
    setTarget(null)
  }

  /** Plays both words back to back — the "hear the pair" sample once the child moves on to saying
   * them, rather than the single-word 🔊 the listening game uses. */
  function playSample() {
    playUrl(pair.a.audio)
      .then(() => playUrl(pair.b.audio))
      .then(() => setSampleMissing(false), () => setSampleMissing(true))
  }

  function option(side: Side) {
    const w = pair[side]
    const ring = answer && lastPick === side ? RING[answer] : ''
    // Fix round 1: dimming is "not yet playable at all" — the same condition the speaker's own
    // pulse ring uses below — never "locked because an answer just landed", or the celebratory /
    // miss ring would fade to 45% opacity right when it is supposed to be the clearest signal.
    const dimmed = unplayed ? 'opacity-45' : ''
    return (
      <button
        key={side}
        type="button"
        onClick={() => choose(side)}
        disabled={target === null}
        aria-label={w.word}
        className={`${OPTION} ${dimmed} ${ring}`}
      >
        <span aria-hidden="true" className="text-[32px] leading-none md:text-[80px]">{w.emoji}</span>
        <span className="font-display text-[15px] font-extrabold leading-none text-ink-900 md:text-[36px]">{w.word}</span>
      </button>
    )
  }

  function wordCard(side: Side) {
    const w = pair[side]
    return (
      <div key={side} data-testid={`pair-word-${side}`} className="flex w-[150px] flex-col items-center gap-1.5 rounded-xl3 bg-white p-3 shadow-card md:w-[220px] md:gap-2.5 md:p-5">
        <span aria-hidden="true" className="text-[48px] leading-none md:text-[84px]">{w.emoji}</span>
        <span className="font-display text-[30px] font-extrabold leading-none text-ink-900 md:text-[44px]">{w.word}</span>
        <span className="text-[13px] font-bold text-ink-300 md:text-[17px]">{w.ipa}</span>
      </div>
    )
  }

  const onErrorAction = useSpeakErrorAction(attempt)

  return (
    <PageShell gutter="20">
      <PageHeader
        back={mission ? <BackButton to="/mission" label="Nhiệm vụ" /> : <BackButton to="/level/minimal-pairs" label="Quay lại" />}
        engine={attempt.engine}
        dimmed={recording}
      >
        {recording
          ? <Chip tone="coral">● Đang ghi</Chip>
          : (
            <ChipPair
              left={mission ? `${missionNoun(mission.pos, 'Thẻ')} ${mission.pos.index}/${mission.pos.total}` : `Cặp ${index + 1}/${PAIRS.length}`}
              right={pair.contrast}
            />
          )}
      </PageHeader>
      <PageBody
        actGrow={!!feedback}
        split={{
          teach: listening ? (
            <div className="flex w-full flex-col items-center gap-3 md:gap-4">
              <button
                type="button"
                aria-label="Nghe"
                onClick={listen}
                className={[
                  'flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-[22px] leading-none text-white shadow-chunky-teal transition-transform active:translate-y-[2px]',
                  'md:h-16 md:w-16 md:text-[26px]',
                  unplayed ? 'outline outline-4 outline-teal-line animate-pulse-soft' : '',
                ].join(' ')}
              >
                🔊
              </button>
              {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}

              <div className="flex w-full items-center justify-center gap-3 md:gap-6">
                {option('a')}
                {option('b')}
              </div>

              <p className="text-[15px] font-bold text-ink-500 md:text-[17px]">{ticks}</p>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-3">
              <div data-testid="pair-listen-done" className="flex w-full items-center justify-center gap-2 rounded-r12 bg-good-50 px-3.5 py-2 text-center text-[13px] font-bold text-good-700">
                {`✓ Nghe & chọn xong: ${ticks}`}
              </div>
              <p className="font-display text-[17px] font-extrabold text-ink-900">Giờ nói cả hai từ nhé</p>
              <div className="flex w-full items-center justify-center gap-3 md:gap-6">
                {wordCard('a')}
                {wordCard('b')}
              </div>
              <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              {sampleMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}
            </div>
          ),
          collapsed: feedback && !teachOpen ? { emoji: pair.a.emoji, label: targetText, onExpand: () => setTeachOpen(true) } : undefined,
          act: feedback ? (
            <>
              {feedback.stars === 3 && <Confetti />}
              <ResultCard
                stars={feedback.stars}
                praise={feedback.message}
                score={attempt.result?.overall}
                words={feedback.words}
                bars={attempt.result ?? undefined}
                hint={feedback.hint}
                canReplay={!!attempt.lastBlob}
                onReplay={() => playBlob(attempt.lastBlob!).catch(() => {})}
                onSample={playSample}
                onRetry={() => { attempt.reset(); setTeachOpen(true) }}
                primary={mission
                  ? { label: mission.label, onClick: mission.go }
                  : next
                    ? { label: 'Tiếp theo →', to: `/pair/${next.id}` }
                    : { label: 'Hoàn thành 🎉', to: '/level/minimal-pairs' }}
                animate={feedback.stars === 3}
                fox={{
                  mood: feedback.stars === 3 ? 'cheer' : feedback.stars === 2 ? 'happy' : 'idle',
                  say: feedback.stars === 3 ? 'Foxy: "Nghe rõ cả hai từ luôn!"' : feedback.stars === 2 ? 'Foxy: "Gần chuẩn rồi đó!"' : 'Foxy: "Luyện thêm chút nữa nhé!"',
                }}
              />
            </>
          ) : listening ? (
            <p data-testid="listen-feedback" className="text-center font-display text-base font-extrabold text-ink-900 md:text-xl">
              {answer === 'right' ? '✅ Đúng rồi! 🎉' : answer === 'wrong' ? '🙈 Nghe lại rồi chọn nhé' : target === null ? 'Bấm 🔊 trước nhé' : ''}
            </p>
          ) : (
            <>
              <SpeakPrompt mood={recording ? 'listening' : 'idle'} say={recording ? 'Foxy đang lắng nghe…' : `Nói cả hai từ: ${targetText}`} />
              {attempt.error && <SpeakError error={attempt.error} onAction={onErrorAction} onDismiss={attempt.dismissError} />}
              <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} secondsLeft={recording ? secondsLeft : undefined} countdownLayout="row" />
            </>
          ),
        }}
      />
    </PageShell>
  )
}
