import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { Word } from '../content/words/types'
import type { PronunciationResult } from '../scoring/types'
import { findTopic, findWord } from '../content/words'
import { shuffleTiles } from '../content/shuffle'
import { getBox, promote, demote, dueWords } from '../progress/leitner'
import { logActivity } from '../progress/activity'
import { useMissionNext } from '../progress/missionNav'
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
import { BackButton, Button, Chip } from '../components/ui'

const UNLOCK_SCORE = 60

/** Matches the .animate-shake keyframe duration in styles.css. */
const SHAKE_MS = 400

/** How long "Đoán đúng rồi! 🎉" stays up. Long enough to read, short enough that it is plainly
 * about the guess and gone before the child records — it used to linger until the first flip,
 * where it read as praise for a pronunciation that had not happened yet (spec §8). */
const PRAISE_MS = 1500

/** Two wrong Vietnamese meanings to go with the right one, picked deterministically from the
 * word's own topic so a repeat visit to the same card sees the same three options. */
function pickDistractors(word: Word, topic: string): Word[] {
  const others = (findTopic(topic)?.words ?? []).filter(w => w.id !== word.id)
  return shuffleTiles(others, `${word.id}-distractors`).slice(0, 2)
}

/** Both faces sit on top of each other inside the rotating shell; only the one facing the
 * child is painted (`backface-visibility`). */
const FACE = 'absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl4 [backface-visibility:hidden]'

const SPEAK_CHIP =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-white px-6 font-display text-lg font-extrabold text-teal-600 shadow-[0_4px_0_#F2DFC9] active:translate-y-[2px]'

export function WordCard() {
  const { topic = '', wordId = '' } = useParams()
  const word = findWord(wordId)

  if (!word) {
    return (
      <main className="h-full overflow-y-auto bg-cream-50 p-6">
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
  const [guessJustCorrect, setGuessJustCorrect] = useState(false)
  const [wrongOption, setWrongOption] = useState<number | null>(null)
  const wrongTimerRef = useRef<number | null>(null)
  const praiseTimerRef = useRef<number | null>(null)
  const [hintRevealed, setHintRevealed] = useState(false)

  const guessOptions = useMemo(
    () => shuffleTiles([word, ...pickDistractors(word, topic)], `${word.id}-options`),
    [word, topic],
  )

  useEffect(() => () => {
    if (wrongTimerRef.current) clearTimeout(wrongTimerRef.current)
    if (praiseTimerRef.current) clearTimeout(praiseTimerRef.current)
  }, [])

  /** Wrong guess shakes just that option and invites another try; right guess retires the whole
   * step so the flip card + mic can take over. */
  function handleGuess(option: Word) {
    if (wrongTimerRef.current) { clearTimeout(wrongTimerRef.current); wrongTimerRef.current = null }
    if (option.id === word.id) {
      setWrongOption(null)
      setGuessPending(false)
      setGuessJustCorrect(true)
      praiseTimerRef.current = window.setTimeout(() => {
        setGuessJustCorrect(false)
        praiseTimerRef.current = null
      }, PRAISE_MS)
      return
    }
    const idx = guessOptions.indexOf(option)
    setWrongOption(idx)
    wrongTimerRef.current = window.setTimeout(() => {
      setWrongOption(null)
      wrongTimerRef.current = null
    }, SHAKE_MS)
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
    : guessJustCorrect ? 'happy'
    : 'idle'
  // "Đoán", not just "Đúng": the bare praise landed right where the pronunciation score lands and
  // read as a score for a word the child had not spoken yet (spec §8).
  const say = outcome === 'retry' ? 'Thử lại nhé' : guessJustCorrect ? 'Đoán đúng rồi! 🎉' : undefined
  const score = attempt.result && Number.isFinite(attempt.result.overall) ? Math.round(attempt.result.overall) : null
  /** The shrunken result-state card keeps its content off the rounded edge. */
  const facePad = attempt.result ? 'p-4' : 'p-6'

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-4">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center gap-3">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to={backTo} label={backLabel} />
          <div className="flex flex-1 flex-col items-center gap-1">
            {mission && <Chip tone="teal">Từ mới {mission.pos.index}/{mission.pos.total}</Chip>}
            <h1 className="font-display text-[30px] font-extrabold leading-none text-ink-900">Từ mới hôm nay 🧩</h1>
            <p className="font-display text-lg font-extrabold text-ink-500">Chạm thẻ để lật — nói đúng để mở khoá!</p>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {guessPending ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
            <span aria-hidden="true" className="text-[96px] leading-none">{word.emoji}</span>
            <span className="font-display text-[44px] font-extrabold leading-none text-ink-900">{word.word}</span>
            <p className="font-display text-xl font-extrabold text-ink-500">Từ này nghĩa là gì?</p>
            <div className="flex flex-wrap justify-center gap-4">
              {guessOptions.map((option, idx) => (
                <Button
                  key={option.id}
                  variant="outline"
                  className={`min-w-[160px] font-display text-2xl ${wrongOption === idx ? 'animate-shake' : ''}`}
                  onClick={() => handleGuess(option)}
                >
                  {option.vi}
                </Button>
              ))}
            </div>
            <Foxy
              mood={wrongOption !== null ? 'surprised' : 'idle'}
              size="sm"
              say={wrongOption !== null ? 'Thử lại nhé' : undefined}
            />
          </div>
        ) : (
          <>
            {/* The card shrinks once it has been spoken to: the result rows below it are what the
                child is reading now, and the full 360 px shell would spend the height they need on
                a card whose job is done. The faces lose a little padding with it, or their own
                content (96 px emoji, 58 px 🔊) would spill past the rounded edge. */}
            <div className={`${attempt.result ? 'h-[300px]' : 'h-[360px]'} w-[320px] shrink-0 [perspective:1200px]`}>
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
                  <span aria-hidden="true" className="text-[96px] leading-none">{word.emoji}</span>
                  {isReview && !hintRevealed ? (
                    <>
                      <span className="text-center font-display text-[36px] font-extrabold leading-tight text-coral-600">{word.vi}</span>
                      <span aria-hidden="true" className="font-display text-[44px] font-extrabold leading-none text-ink-300">?</span>
                      <Button variant="ghost" onClick={e => onFaceButton(e, () => setHintRevealed(true))}>Gợi ý</Button>
                    </>
                  ) : (
                    <>
                      {isReview && (
                        <span className="text-center font-display text-[36px] font-extrabold leading-tight text-coral-600">{word.vi}</span>
                      )}
                      <span className="font-display text-[44px] font-extrabold leading-none text-ink-900">{word.word}</span>
                      <span className="text-xl font-bold text-ink-300">{word.ipa}</span>
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
                      className="flex h-16 w-16 items-center justify-center active:translate-y-[2px]"
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
                  <span className="text-center font-display text-[36px] font-extrabold leading-tight text-coral-600">{word.vi}</span>
                  <span className="text-center text-[22px] font-bold leading-snug text-ink-500">{word.example}</span>
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
            <div className="flex flex-wrap items-end justify-center gap-6 pb-2">
              <Foxy mood={mood} size="sm" say={say} />
              <div className="flex flex-col items-center gap-2">
                <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
                <p className="font-display text-xl font-extrabold text-ink-500">🎤 Nói để mở khoá</p>
              </div>
              {outcome && (
                <div className="flex flex-wrap justify-center gap-4">
                  <Button variant="outline" onClick={retry}>Thử lại</Button>
                  <Button size="lg" pulse onClick={goNext}>
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
