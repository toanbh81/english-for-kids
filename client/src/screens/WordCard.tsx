import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { Word } from '../content/words/types'
import type { PronunciationResult } from '../scoring/types'
import { findTopic, findWord } from '../content/words'
import { shuffleTiles } from '../content/shuffle'
import { getBox, promote, demote, dueWords } from '../progress/leitner'
import { logActivity } from '../progress/activity'
import { missionNoun, useMissionFlag, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { totalStars } from '../progress/store'
import { playUrl } from '../audio/player'
import { speakText } from '../story/speak'
import { toFeedback } from '../scoring/feedback'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'
import { MicButton, ResultCard, SpeakError, SpeakPrompt } from '../components/speak'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip, NotFound } from '../components/ui'
import { useLessonChipStatus } from '../components/LessonChip'
import { PageShell, PageHeader, PageBody, PageFooter } from '../components/ui/page'

const UNLOCK_SCORE = 60

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/** Matches the .animate-shake keyframe duration in styles.css. */
const SHAKE_MS = 400

/** Two wrong Vietnamese meanings to go with the right one, picked deterministically from the
 * word's own topic so a repeat visit to the same card sees the same three options. */
function pickDistractors(word: Word, topic: string): Word[] {
  const others = (findTopic(topic)?.words ?? []).filter(w => w.id !== word.id)
  return shuffleTiles(others, `${word.id}-distractors`).slice(0, 2)
}

/**
 * Both faces sit on top of each other inside the rotating shell; only the one facing the
 * child is painted (`backface-visibility`).
 */
const FACE = 'absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl3 [backface-visibility:hidden] md:gap-3'

const SPEAK_CHIP =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-white px-6 font-display text-lg font-extrabold text-teal-600 shadow-[0_4px_0_#F2DFC9] active:translate-y-[2px]'

export function WordCard() {
  const { topic = '', wordId = '' } = useParams()
  const word = findWord(wordId)

  if (!word) return <NotFound what="từ" to="/words" />

  const isReview = topic === 'review'
  const list: Word[] = isReview
    ? dueWords().map(findWord).filter((w): w is Word => !!w)
    : (findTopic(topic)?.words ?? [word])

  // Keying on the word id remounts the inner component on navigation, which resets its local
  // flip/outcome state for free instead of needing a synchronizing effect.
  return <WordCardInner key={word.id} word={word} topic={topic} isReview={isReview} list={list} />
}

function WordCardInner({ word, topic, isReview, list }: { word: Word; topic: string; isReview: boolean; list: Word[] }) {
  const nav = useNavigate()
  // Null unless the child arrived from the mission: only then is this card step "Từ mới 2/3" of
  // today's lesson rather than one card of a deck (spec §3).
  const mission = useMissionNext()
  const { pathname } = useLocation()
  const inMission = useMissionFlag()
  // The header's right cell defaults to `LessonChip`, which draws nothing outside a running
  // lesson step (Home/mission/parent screens excluded, or nothing on today's route matches) — this
  // is the very same rule `LessonChip` itself uses to decide whether to render, so a total-stars
  // badge only ever appears exactly where the lesson chip would otherwise have left the cell empty.
  const lessonChipVisible = !!useLessonChipStatus(pathname, inMission)
  const [flipped, setFlipped] = useState(false)
  // Sticky, unlike `flipped`: the peek nudge is a one-time lesson ("this card turns over"), so the
  // very first flip retires it for good rather than letting it come back on every flip home.
  const [hasFlipped, setHasFlipped] = useState(false)
  const [audioMissing, setAudioMissing] = useState(false)
  const [outcome, setOutcome] = useState<'unlocked' | 'retry' | null>(null)

  // A brand-new, still-locked word makes the child guess its meaning before the flip card ever
  // shows. Read once on mount (like wordsToday above): a word that unlocks mid-session must not
  // suddenly grow a guess step, and one already unlocked when the card opened must never show it.
  const [guessPending, setGuessPending] = useState(() => !isReview && getBox(word.id) === 0)
  // The guess has been answered correctly and the praise is up — the step is still on screen and
  // waits for "Tiếp theo →" (spec decision 3).
  const [guessSolved, setGuessSolved] = useState(false)
  const [wrongOption, setWrongOption] = useState<number | null>(null)
  const wrongTimerRef = useRef<number | null>(null)
  const [hintRevealed, setHintRevealed] = useState(false)

  const guessOptions = useMemo(
    () => shuffleTiles([word, ...pickDistractors(word, topic)], `${word.id}-options`),
    [word, topic],
  )

  useEffect(() => () => {
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current)
  }, [])

  /** Wrong guess shakes just that option and invites another try; right guess praises and stops
   * the step there. The step ends when the child says so, by tapping "Tiếp theo →" (spec decision
   * 3, design §8). */
  function handleGuess(option: Word) {
    if (guessSolved) return
    if (wrongTimerRef.current) { clearTimeout(wrongTimerRef.current); wrongTimerRef.current = null }
    if (option.id === word.id) {
      setWrongOption(null)
      setGuessSolved(true)
      return
    }
    const idx = guessOptions.indexOf(option)
    setWrongOption(idx)
    wrongTimerRef.current = window.setTimeout(() => {
      setWrongOption(null)
      wrongTimerRef.current = null
    }, SHAKE_MS)
  }

  /** The child's own hand-off from the guess to the speaking step. The praise goes with the step
   * that earned it: it is about the meaning they picked, not about a word they have yet to say. */
  function startSpeaking() {
    setGuessSolved(false)
    setGuessPending(false)
  }

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    if (result.overall >= UNLOCK_SCORE) {
      promote(word.id)
      setOutcome('unlocked')
    } else {
      if (getBox(word.id) > 0) demote(word.id)
      setOutcome('retry')
    }
    const ts = Date.now()
    logActivity({ ts, kind: 'word', id: word.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    // Timestamped id: keying on the word alone overwrote the previous take of the same word, so
    // the "last 20 recordings" list silently held fewer than 20.
    if (blob) saveRecording({ id: `${word.id}:${ts}`, ts, text: word.word, blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({ targetText: word.word, autoStopMs: AUTO_STOP_MS, resetKey: word.id, onResult: handleResult })
  const feedback = useMemo(() => (attempt.result ? toFeedback(attempt.result) : null), [attempt.result])

  // Headless screenshots land straight on a scored attempt via `?fixture=result3`/`result1`
  // (`useSpeakingAttempt` injects it on its own — see `speaking/fixture.ts`), with no guess ever
  // answered. Backfill `guessPending` to false so `word-result3` renders the flip card + the
  // compact result, not an untouched guess step sitting in front of a result nobody earned.
  useEffect(() => {
    if (attempt.result && guessPending) setGuessPending(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.result])

  // The countdown only exists while the mic is open: it restarts on every recording and the
  // interval is cleared the moment the state changes (or the card unmounts).
  const recording = attempt.micState === 'recording'
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)
  useEffect(() => {
    if (!recording) return
    setSecondsLeft(COUNTDOWN_FROM)
    const id = window.setInterval(() => setSecondsLeft(s => (s > 1 ? s - 1 : 1)), 1000)
    return () => clearInterval(id)
  }, [recording])

  const index = list.findIndex(w => w.id === word.id)
  const next = index >= 0 ? list[index + 1] : undefined
  // A map topic belongs to its island, so leaving the last card of a deck lands there rather than
  // on the flat word index, which no longer lists locked topics at all.
  const backTo = mission ? '/mission' : isReview ? '/words/review' : `/topic/${topic}`
  const backLabel = mission ? 'Nhiệm vụ' : isReview ? 'Ôn tập' : findTopic(topic)?.title ?? 'Từ vựng'

  /** In a lesson the deck order is not the child's path — the next step of today's mission is,
   * and the mission screen is where a finished lesson celebrates. */
  function goNext() {
    if (mission) mission.go()
    else nav(next ? `/words/${topic}/${next.id}` : backTo)
  }

  /** The outcome banner belongs to this attempt, so clear it with the attempt — otherwise
   * "🔓 Mở khoá!" stays on screen while the child records again. */
  function retry() {
    attempt.reset()
    setOutcome(null)
  }

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(word.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  function flip() {
    setFlipped(f => !f)
    setHasFlipped(true)
  }

  /** The card is the flip target, so the audio buttons riding on its faces must not flip it too. */
  function onFaceButton(e: MouseEvent, run: () => void) {
    e.stopPropagation()
    run()
  }

  /** Only the card surface itself flips on Enter/Space: a key press aimed at one of the buttons
   * riding on a face bubbles up here, and swallowing it would flip the card instead of playing
   * the sound for anyone using a keyboard. */
  function onCardKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    flip()
  }

  const score = attempt.result && Number.isFinite(attempt.result.overall) ? Math.round(attempt.result.overall) : undefined

  const onErrorAction = useSpeakErrorAction(attempt)

  return (
    <PageShell gutter="20">
      <PageHeader
        back={<BackButton to={backTo} label={backLabel} />}
        engine={attempt.engine}
        dimmed={recording}
        right={lessonChipVisible ? undefined : <Chip tone="sun">⭐ {totalStars()}</Chip>}
      >
        {recording
          ? <Chip tone="coral">● Đang ghi</Chip>
          : mission
            ? <Chip tone="coral">{missionNoun(mission.pos, 'Từ mới')} {mission.pos.index}/{mission.pos.total}</Chip>
            : <Chip tone="teal">Từ mới {index + 1}/{list.length}</Chip>}
      </PageHeader>

      {guessPending ? (
        <>
          <PageBody center>
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 py-2 md:gap-6 md:py-4">
              <span aria-hidden="true" className="text-[64px] leading-none">{word.emoji}</span>
              <span className="font-display text-[36px] font-extrabold leading-none text-ink-900">{word.word}</span>
              <Button variant="outline" size="adult" onClick={playSample}>🔊 Nghe lại</Button>
              {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
              <p className="font-display text-lg font-extrabold text-ink-500 md:text-xl">Từ này nghĩa là gì?</p>
              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:justify-center md:gap-4">
                {guessOptions.map((option, idx) => {
                  const isCorrect = option.id === word.id
                  const locked = guessSolved && !isCorrect
                  return (
                    <Button
                      key={option.id}
                      variant="outline"
                      disabled={locked}
                      className={`w-full min-h-[56px] font-display text-2xl md:w-auto md:min-w-[160px] ${
                        wrongOption === idx ? 'animate-shake shadow-[0_5px_0_#F8A3AE,0_0_0_4px_#FFD4DA]' : ''
                      } ${isCorrect && guessSolved ? 'border-good-300 text-ink-900 shadow-[0_5px_0_#7ED99A,0_0_0_4px_#B9ECC8]' : ''} ${locked ? 'opacity-50' : ''}`}
                      onClick={() => handleGuess(option)}
                    >
                      <span aria-hidden="true" className="text-[26px] leading-none">{option.emoji}</span>
                      {option.vi}
                      {isCorrect && guessSolved && <span aria-hidden="true" className="ml-auto text-2xl">✅</span>}
                    </Button>
                  )
                })}
              </div>
              {/* The guess step's own bubble — this one is kept outside the mic entirely, since
                  the mic is not even in play yet. */}
              <Foxy
                mood={guessSolved ? 'happy' : wrongOption !== null ? 'surprised' : 'idle'}
                size="sm"
                // "Đoán", not just "Đúng": a bare "Đúng rồi" lands where the pronunciation score
                // lands and reads as a score for a word the child has not spoken yet (spec §8).
                say={guessSolved ? 'Đoán đúng rồi! 🎉' : wrongOption !== null ? 'Thử lại nhé' : undefined}
              />
            </div>
          </PageBody>
          {guessSolved && (
            <PageFooter>
              <Button pulse className="w-full" onClick={startSpeaking}>Tiếp theo →</Button>
            </PageFooter>
          )}
        </>
      ) : (
        <PageBody
          actGrow={!!feedback}
          split={{
          teach: (
            <div className="flex w-full flex-col items-center gap-3">
              <div className="relative aspect-[16/17] w-[min(320px,82%)] shrink-0 rounded-[30px] [perspective:1200px] short:w-[min(320px,68%)] md:aspect-auto md:w-[320px] md:h-[360px]">
              {/* Round-2 decision: the corner icon is a one-time "this turns over" nudge, retired
                  for good the moment the child flips once — it does not come back on a flip home —
                  and it is hidden mid-recording along with the peek animation below (Foxy is
                  listening; nothing should be inviting a flip). */}
              {!hasFlipped && !recording && (
                <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 z-[1] text-[22px] leading-none opacity-30">🔄</span>
              )}
              <div
                data-testid="flip-card"
                role="button"
                tabIndex={0}
                aria-label="Lật thẻ"
                onClick={flip}
                onKeyDown={onCardKey}
                className={`relative h-full w-full cursor-pointer transition-transform duration-500 [transform-style:preserve-3d] ${
                  flipped ? '[transform:rotateY(180deg)]' : ''
                } ${hasFlipped || flipped || recording ? '' : 'animate-peek'}`}
              >
                <div
                  data-testid="face-front"
                  className={`${FACE} p-5 md:p-6 bg-white shadow-card`}
                  inert={flipped}
                  aria-hidden={flipped ? 'true' : undefined}
                >
                  <span aria-hidden="true" className="text-[90px] leading-none md:text-[80px]">{word.emoji}</span>
                  {isReview && !hintRevealed ? (
                    <>
                      <span className="text-center font-display text-[30px] font-extrabold leading-tight text-coral-600 md:text-[32px]">{word.vi}</span>
                      <span aria-hidden="true" className="font-display text-[38px] font-extrabold leading-none text-ink-300 md:text-[40px]">?</span>
                      <Button variant="ghost" onClick={e => onFaceButton(e, () => setHintRevealed(true))}>Gợi ý</Button>
                    </>
                  ) : (
                    <>
                      {isReview && (
                        <span className="text-center font-display text-[30px] font-extrabold leading-tight text-coral-600 md:text-[32px]">{word.vi}</span>
                      )}
                      <span className="font-display text-[38px] font-extrabold leading-none text-ink-900 md:text-[40px]">{word.word}</span>
                      <span className="text-base font-bold text-ink-300 md:text-xl">{word.ipa}</span>
                    </>
                  )}
                  {(!isReview || hintRevealed) && (
                    <button
                      type="button"
                      aria-label="Nghe mẫu"
                      onClick={e => onFaceButton(e, playSample)}
                      className="flex h-16 w-16 shrink-0 items-center justify-center active:translate-y-[2px]"
                    >
                      <span aria-hidden="true" className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-teal-500 text-3xl text-white shadow-chunky-teal">
                        🔊
                      </span>
                    </button>
                  )}
                </div>

                <div
                  data-testid="face-back"
                  className={`${FACE} p-5 md:p-6 bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9] [transform:rotateY(180deg)]`}
                  inert={!flipped}
                  aria-hidden={flipped ? undefined : 'true'}
                >
                  <span className="text-center font-display text-[30px] font-extrabold leading-tight text-coral-600 md:text-[32px]">{word.vi}</span>
                  <span className="text-center text-lg font-bold leading-snug text-ink-500 md:text-[20px] md:leading-snug">{word.example}</span>
                  <button type="button" onClick={e => onFaceButton(e, () => speakText(word.example))} className={SPEAK_CHIP}>
                    🔊 Nghe câu ví dụ
                  </button>
                </div>
              </div>
              </div>
              {audioMissing && <p className="text-center text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
              {/* Q9: no text label rides on the card itself — this is the hint's only home, and it
                  gives way to the compact result the moment there is one (that result sits right
                  below it in the same stacked column, brief R16). */}
              {!feedback && (
                <p className="text-center text-[13px] font-bold text-[#B0A18E]">Mặt sau: nghĩa + câu ví dụ + 🔊</p>
              )}
            </div>
          ),
          act: feedback ? (
            <>
              <ResultCard
                compact
                stars={feedback.stars}
                praise={feedback.message}
                score={score}
                sub={outcome === 'unlocked' ? '🔓 Đã mở khoá' : 'thử lại để mở khoá'}
                hint={outcome === 'retry' ? feedback.hint : undefined}
                onRetry={retry}
                primary={{ label: mission ? mission.label : 'Tiếp theo →', onClick: goNext }}
                animate
              />
              {/* R16: the mic is redundant next to "Thử lại" on a phone (no room for both), but on
                  an iPad it rides alongside the CTA so a re-record needs no extra tap. */}
              <div className="max-md:hidden">
                <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} secondsLeft={recording ? secondsLeft : undefined} countdownLayout="row" />
              </div>
            </>
          ) : (
            <>
              <SpeakPrompt mood={recording ? 'listening' : 'idle'} say={recording ? 'Foxy đang lắng nghe…' : 'Đọc to từ trên thẻ nhé!'} />
              {attempt.error && <SpeakError error={attempt.error} onAction={onErrorAction} onDismiss={attempt.dismissError} />}
              <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} secondsLeft={recording ? secondsLeft : undefined} countdownLayout="row" />
            </>
          ),
        }} />
      )}
    </PageShell>
  )
}
