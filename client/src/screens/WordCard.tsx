import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { Word } from '../content/words/types'
import type { PronunciationResult } from '../scoring/types'
import { findTopic, findWord } from '../content/words'
import { shuffleTiles } from '../content/shuffle'
import { getBox, promote, demote, dueWords } from '../progress/leitner'
import { logActivity } from '../progress/activity'
import { missionNoun, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { playUrl } from '../audio/player'
import { speakText } from '../story/speak'
import { toFeedback } from '../scoring/feedback'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { MicButton } from '../components/MicButton'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { HintCard } from '../components/HintCard'
import { Stars } from '../components/Stars'
import { BackButton, Button, Chip, PAGE_SHELL } from '../components/ui'

const UNLOCK_SCORE = 60

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
 *
 * The phone breakpoint idiom is `SoundPractice.tsx`'s (phase 10, task 4): **phone rules live at
 * the default breakpoint and `md:` (768) puts the exact previous value back**, so 1194×834 renders
 * as it always did. `max-md:` is used only to override a class one of the shared primitives writes
 * for itself (`Button`'s `px-8` / `min-h-[64px]` / `rounded-xl3`), where an unprefixed override of
 * ours would be a coin toss on Tailwind's utility order.
 *
 * The gap comes down to 8 px on the phone because the card is no longer a fixed 360 px tall: at
 * 320 px wide the 16/17 shell is only ~244 px, and the four things on the front face have to stay
 * inside it.
 */
const FACE = 'absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl4 [backface-visibility:hidden] md:gap-3'

/** `Button`'s own size map is off-limits (brief §15 risk 5), so a phone-sized CTA is written as an
 * override of it: the design's 64 px row instead of the landscape frame's 72. */
const CTA_PHONE = 'max-md:min-h-[64px] max-md:px-4 max-md:text-lg'

/**
 * The short-phone rules — `[@media(max-width:767px)_and_(max-height:700px)]:…`, spelled out at
 * every use because Tailwind reads the source as text and would never see an interpolated one.
 * They are this screen's version of the design's "375×667" line (M3 shrinks its picture card, M4
 * drops the word's IPA): the flip card comes down a size, the guess step loses its written
 * question, and the answer rows lose 8 px.
 *
 * They exist to keep the bottom block from being *stuck on first paint*. A `sticky bottom-0` row
 * with an opaque background that starts life above its own place in the flow covers whatever is
 * behind it — here the last 48 px of the tip card — and no amount of space reserved *below* it
 * moves it back down; the only thing that does is content that ends above the pinned row. That is
 * what these rules buy. The width bound is deliberate: a height-only query would also catch a
 * short laptop window, which renders the landscape layout. Grep `max-height:700px` for all four.
 */

const SPEAK_CHIP =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-white px-6 font-display text-lg font-extrabold text-teal-600 shadow-[0_4px_0_#F2DFC9] active:translate-y-[2px]'

export function WordCard() {
  const { topic = '', wordId = '' } = useParams()
  const word = findWord(wordId)

  if (!word) {
    return (
      <main className={`h-full overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
        <p className="mb-4 font-display text-2xl font-extrabold text-ink-900">Không tìm thấy từ</p>
        <BackButton to="/words" label="Từ vựng" />
      </main>
    )
  }

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
   * the step there. It used to retire itself after 1.5 s and drop the child straight onto the flip
   * card — the praise, the card and the mic all arrived while nobody had asked for them. The step
   * now ends when the child says so, by tapping "Tiếp theo →" (spec decision 3, design §8). */
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

  const attempt = useSpeakingAttempt({ targetText: word.word, resetKey: word.id, onResult: handleResult })
  const feedback = useMemo(() => (attempt.result ? toFeedback(attempt.result) : null), [attempt.result])

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

  const mood: FoxyMood = attempt.micState === 'recording'
    ? 'listening'
    : outcome === 'unlocked' ? 'cheer'
    : outcome === 'retry' ? 'surprised'
    : 'idle'
  const say = outcome === 'retry' ? 'Thử lại nhé' : undefined
  const score = attempt.result && Number.isFinite(attempt.result.overall) ? Math.round(attempt.result.overall) : null
  /** The shrunken result-state card keeps its content off the rounded edge — a landscape rule
   * only: on a phone the shell keeps its size through the result (design §7, "không đổi bố cục"),
   * so the padding has nothing to give back. */
  const facePad = attempt.result ? 'p-5 md:p-4' : 'p-5 md:p-6'

  return (
    // 20 px of side frame on a phone (design §1, the speak-frame family), the 24 px this screen has
    // always had from the tablet breakpoint up. The shell rests at the 1 rem of the old `py-4`, so
    // with no notch to clear — iPad, desktop, jsdom — the vertical padding is unchanged.
    <main className={`h-full overflow-y-auto bg-cream-50 px-5 [--page-pad-bottom:1rem] [--page-pad-top:1rem] md:px-6 ${PAGE_SHELL}`}>
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center gap-3">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to={backTo} label={backLabel} />
          <div className="flex flex-1 flex-col items-center gap-1">
            {mission && (
              <Chip tone="teal">
                {missionNoun(mission.pos, 'Từ mới')} {mission.pos.index}/{mission.pos.total}
              </Chip>
            )}
            {/* The design's phone header is back + chip only: a 30 px title that wraps to two lines
                inside a 178 px column costs the card more height than the words are worth, and the
                card below says "Từ mới hôm nay" by simply being there. The line that teaches the
                gesture stays at every width — it is the only thing on the screen that says the card
                turns over — just smaller. Both are untouched from `md` up. */}
            <h1 className="hidden font-display text-[30px] font-extrabold leading-none text-ink-900 md:block">Từ mới hôm nay 🧩</h1>
            <p className="text-center font-display text-sm font-extrabold leading-snug text-ink-500 md:text-lg md:leading-7">Chạm thẻ để lật — nói đúng để mở khoá!</p>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {guessPending ? (
          /* M5b on a phone (design §8): the prompt shrinks a little and the three Vietnamese
             answers stop being a wrapping row of pills — they are three full-width 76 px rows, each
             led by its own emoji, which is the only shape a five-year-old can hit reliably with a
             thumb. From `md` up this is the wrapping row of `min-w-[160px]` pills it has always
             been, emoji and all removed from the box tree. */
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 py-2 md:w-auto md:gap-6 md:py-4">
            <span aria-hidden="true" className="text-[74px] leading-none [@media(max-width:767px)_and_(max-height:700px)]:text-[56px] md:text-[96px]">{word.emoji}</span>
            <span className="font-display text-[40px] font-extrabold leading-none text-ink-900 md:text-[44px]">{word.word}</span>
            {/* The design drops this line on the phone outright and lets the three answers ask the
                question. It is kept where there is room for it — a child who has met the step once
                does not need the sentence, a child meeting it for the first time does. */}
            <p className="font-display text-lg font-extrabold text-ink-500 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-xl">Từ này nghĩa là gì?</p>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:justify-center md:gap-4">
              {guessOptions.map((option, idx) => (
                <Button
                  key={option.id}
                  variant="outline"
                  className={`w-full font-display text-2xl max-md:min-h-[76px] max-md:justify-start max-md:gap-3.5 max-md:rounded-[22px] max-md:px-5 max-md:text-xl [@media(max-width:767px)_and_(max-height:700px)]:min-h-[68px] md:w-auto md:min-w-[160px] ${
                    wrongOption === idx ? 'animate-shake' : ''
                  } ${option.id === word.id && guessSolved ? 'border-good-300 text-ink-900 shadow-[0_6px_0_#7ED99A]' : ''}`}
                  onClick={() => handleGuess(option)}
                >
                  <span aria-hidden="true" className="text-[32px] leading-none md:hidden">{option.emoji}</span>
                  {option.vi}
                  {option.id === word.id && guessSolved && <span aria-hidden="true" className="ml-auto text-2xl">✅</span>}
                </Button>
              ))}
            </div>
            <Foxy
              mood={guessSolved ? 'happy' : wrongOption !== null ? 'surprised' : 'idle'}
              size="sm"
              // "Đoán", not just "Đúng": a bare "Đúng rồi" lands where the pronunciation score lands
              // and reads as a score for a word the child has not spoken yet (spec §8).
              say={guessSolved ? 'Đoán đúng rồi! 🎉' : wrongOption !== null ? 'Thử lại nhé' : undefined}
            />
            {/* The step is over when the child says it is. On a phone the CTA takes the bottom
                edge of the frame; from `md` up it is a centred button under Foxy. */}
            {guessSolved && (
              <div className="sticky bottom-0 z-10 flex w-full justify-center bg-cream-50 pt-1 max-md:mt-auto md:static md:bg-transparent md:pt-0">
                <Button size="lg" pulse className={`${CTA_PHONE} max-md:w-full`} onClick={startSpeaking}>
                  Tiếp theo →
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* On a phone the shell is the design's elastic card (§7): `min(320px, 82%)` wide at
                the 16/17 ratio the frame is drawn on, so a 320 px screen gets ~230×244 and a 390 px
                one ~287×305 instead of a 320 px card pressed against both margins. It keeps that
                size through the result — "không đổi bố cục" — because the rows underneath it are
                the compressed M3b ones, which do not need the height back.

                From `md` up it is the fixed 320×360 it has always been, and it still shrinks to 300
                once it has been spoken to: the result rows of the landscape frame are what the
                child is reading then, and the full shell would spend the height they need on a card
                whose job is done. The faces lose a little padding with it, or their own content
                (96 px emoji, 58 px 🔊) would spill past the rounded edge. */}
            <div className={`aspect-[16/17] w-[min(320px,82%)] shrink-0 [perspective:1200px] [@media(max-width:767px)_and_(max-height:700px)]:w-[min(320px,68%)] md:aspect-auto md:w-[320px] ${attempt.result ? 'md:h-[300px]' : 'md:h-[360px]'}`}>
              {/* The card *is* the control now: a 🔄 button in the corner plus a "MẶT TRƯỚC" label
                  asked a five-year-old to read two labels before touching anything, and they read
                  as decoration. One tap target the size of the whole card, announced as "Lật thẻ",
                  says the same thing without words — and the peek nudge below shows it (spec §6). */}
              <div
                data-testid="flip-card"
                role="button"
                tabIndex={0}
                aria-label="Lật thẻ"
                onClick={flip}
                onKeyDown={onCardKey}
                className={`relative h-full w-full cursor-pointer transition-transform duration-500 [transform-style:preserve-3d] ${
                  flipped ? '[transform:rotateY(180deg)]' : ''
                } ${hasFlipped || flipped ? '' : 'animate-peek'}`}
              >
                {/* The face turned away is still painted-over by `backface-visibility`, but that is a
                    purely visual trick: `inert` + `aria-hidden` are what keep its buttons out of the
                    tab order and out of the screen reader. */}
                <div
                  data-testid="face-front"
                  className={`${FACE} ${facePad} bg-white shadow-card`}
                  inert={flipped}
                  aria-hidden={flipped ? 'true' : undefined}
                >
                  {/* The design's phone type scale for the face (§7: emoji 90, từ 38, IPA 16, 🔊
                      64) — the four of them plus the 8 px gaps are what fits the 16/17 shell all
                      the way down to 320 px. `md:` is the landscape face, unchanged. */}
                  <span aria-hidden="true" className="text-[90px] leading-none [@media(max-width:767px)_and_(max-height:700px)]:text-[64px] md:text-[96px]">{word.emoji}</span>
                  {isReview && !hintRevealed ? (
                    <>
                      <span className="text-center font-display text-[30px] font-extrabold leading-tight text-coral-600 md:text-[36px]">{word.vi}</span>
                      <span aria-hidden="true" className="font-display text-[38px] font-extrabold leading-none text-ink-300 md:text-[44px]">?</span>
                      <Button variant="ghost" className={CTA_PHONE} onClick={e => onFaceButton(e, () => setHintRevealed(true))}>Gợi ý</Button>
                    </>
                  ) : (
                    <>
                      {isReview && (
                        <span className="text-center font-display text-[30px] font-extrabold leading-tight text-coral-600 md:text-[36px]">{word.vi}</span>
                      )}
                      <span className="font-display text-[38px] font-extrabold leading-none text-ink-900 md:text-[44px]">{word.word}</span>
                      <span className="text-base font-bold text-ink-300 md:text-xl">{word.ipa}</span>
                    </>
                  )}
                  {/* 58 px circle inside a 64 px tap target — the handoff's size without shrinking the
                      area a small finger has to hit. It is withheld while a review card is still
                      hidden: 🔊 speaks the word, so it *is* the answer, and one tap would retire the
                      recall step that "Gợi ý" exists to gate. */}
                  {(!isReview || hintRevealed) && (
                    <button
                      type="button"
                      aria-label="Nghe mẫu"
                      onClick={e => onFaceButton(e, playSample)}
                      // `shrink-0` on the phone only: the elastic card can be shorter than its own
                      // face content at 375×667, and the first thing flex takes it out of is this
                      // button — which is the one thing on the face that may not go under 64 px.
                      // `md:shrink` hands the landscape card back the flex it has always had.
                      className="flex h-16 w-16 shrink-0 items-center justify-center active:translate-y-[2px] md:shrink"
                    >
                      <span aria-hidden="true" className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-teal-500 text-3xl text-white shadow-chunky-teal">
                        🔊
                      </span>
                    </button>
                  )}
                </div>

                <div
                  data-testid="face-back"
                  className={`${FACE} ${facePad} bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9] [transform:rotateY(180deg)]`}
                  inert={!flipped}
                  aria-hidden={flipped ? undefined : 'true'}
                >
                  <span className="text-center font-display text-[30px] font-extrabold leading-tight text-coral-600 md:text-[36px]">{word.vi}</span>
                  <span className="text-center text-lg font-bold leading-snug text-ink-500 md:text-[22px] md:leading-snug">{word.example}</span>
                  <button type="button" onClick={e => onFaceButton(e, () => speakText(word.example))} className={SPEAK_CHIP}>
                    🔊 Nghe câu ví dụ
                  </button>
                </div>
              </div>
            </div>

            {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}

            {/* The attempt was already scored — the screen just never showed it, so a child who
                spoke saw the 🔓 (or nothing at all) and no idea how well they did (spec §7).
                One row, not three stacked bands: stars, score and the unlock badge each used to
                claim a line of their own, which on the iPad's 834 px landscape pushed "Tiếp theo"
                off the bottom of the screen — the one control the child needs after a result. */}
            {(feedback || outcome === 'unlocked') && (
              <section className="flex flex-wrap items-center justify-center gap-4">
                {feedback && <Stars value={feedback.stars} animate size="sm" />}
                {/* webspeech has no phoneme scoring but does return an overall; only a result that
                    carries no usable number at all drops the chip rather than showing "Điểm: NaN". */}
                {feedback && score !== null && <Chip tone="teal">{`Điểm: ${score}`}</Chip>}
                {outcome === 'unlocked' && (
                  <span className="inline-flex items-center gap-2 rounded-xl2 bg-sun-50 px-5 py-2 font-display text-2xl font-extrabold text-sun-700 shadow-chunky-sun">
                    🔓 Mở khoá!
                  </span>
                )}
              </section>
            )}

            {attempt.error && <p className="font-display text-2xl font-extrabold text-fix-700">{attempt.error}</p>}

            {outcome === 'retry' && feedback?.hint && <HintCard hint={feedback.hint} />}

            {/* The result CTAs stand BESIDE the mic, not under it: a band of their own put "Tiếp
                theo" below the fold of the iPad's 834 px landscape, and a control a child cannot
                see is a control they do not have. Aligned on their bottom edges so the mic, Foxy
                and the two buttons sit on one line. */}
            {/* `mt-auto` on the phone: the card no longer stretches, so this block takes the free
                height and sits on the bottom edge of the frame, which is where the design pins it.
                Once a result is in, the phone drops the mic (design §5 M3b: "ở M3b, mic biến mất")
                and the two CTAs become the bottom row, `flex-1` / `flex-[1.35]` — "Thử lại" is the
                way back to recording, and it brings the mic with it. Every one of those rules is
                undone from `md` up, where this is the one landscape row it has always been. */}
            <div className="sticky bottom-0 z-10 flex w-full flex-wrap items-end justify-center gap-3 bg-cream-50 pb-2 pt-1 max-md:mt-auto md:static md:w-auto md:bg-transparent md:pt-0 md:gap-6">
              <Foxy mood={mood} size="sm" say={say} />
              <div className={`flex flex-col items-center gap-2 ${outcome ? 'max-md:hidden' : ''}`}>
                <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
                <p className="font-display text-base font-extrabold text-ink-500 md:text-xl">🎤 Nói để mở khoá</p>
              </div>
              {outcome && (
                <div className="flex w-full flex-wrap justify-center gap-3 md:w-auto md:gap-4">
                  <Button variant="outline" className={`${CTA_PHONE} max-md:flex-1`} onClick={retry}>Thử lại</Button>
                  <Button size="lg" pulse className={`${CTA_PHONE} max-md:flex-[1.35]`} onClick={goNext}>
                    {mission ? mission.label : 'Tiếp theo →'}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
