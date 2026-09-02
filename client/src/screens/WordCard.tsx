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
import type { SpeakErrorKind } from '../speaking/speakError'
import { MicButton, ResultCard, SpeakError } from '../components/speak'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip, PAGE_SHELL } from '../components/ui'
import { PageShell, PageHeader, PageBody, PageFooter } from '../components/ui/page'

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
 */
const FACE = 'absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl4 [backface-visibility:hidden] md:gap-3'

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

  const score = attempt.result && Number.isFinite(attempt.result.overall) ? Math.round(attempt.result.overall) : undefined

  const onErrorAction = (kind: SpeakErrorKind) => {
    if (kind === 'limit') nav('/')
    else if (kind === 'noSpeech' || kind === 'notReady') attempt.reset()
  }

  return (
    <PageShell gutter="20">
      <PageHeader back={<BackButton to={backTo} label={backLabel} />} engine={attempt.engine}>
        <div className="flex flex-col items-center gap-1">
          {mission && (
            <Chip tone="teal">
              {missionNoun(mission.pos, 'Từ mới')} {mission.pos.index}/{mission.pos.total}
            </Chip>
          )}
          <h1 className="hidden font-display text-[22px] font-extrabold leading-none text-ink-900 md:block">Từ mới hôm nay 🧩</h1>
          <p className="text-center font-display text-[13px] font-extrabold leading-snug text-ink-500 md:text-lg md:leading-7">Chạm thẻ để lật — nói đúng để mở khoá!</p>
        </div>
      </PageHeader>

      {guessPending ? (
        <>
          <PageBody center>
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 py-2 md:gap-6 md:py-4">
              <span aria-hidden="true" className="text-[74px] leading-none md:text-[96px]">{word.emoji}</span>
              <span className="font-display text-[40px] font-extrabold leading-none text-ink-900 md:text-[44px]">{word.word}</span>
              <p className="font-display text-lg font-extrabold text-ink-500 md:text-xl">Từ này nghĩa là gì?</p>
              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:justify-center md:gap-4">
                {guessOptions.map((option, idx) => (
                  <Button
                    key={option.id}
                    variant="outline"
                    className={`w-full font-display text-2xl max-md:min-h-[76px] max-md:justify-start max-md:gap-3.5 max-md:rounded-[22px] max-md:px-5 max-md:text-xl md:w-auto md:min-w-[160px] ${
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
              <Button size="lg" pulse className="w-full" onClick={startSpeaking}>Tiếp theo →</Button>
            </PageFooter>
          )}
        </>
      ) : (
        <PageBody split={{
          teach: (
            <div className="flex w-full flex-col items-center gap-3">
              <div className={`aspect-[16/17] w-[min(320px,82%)] shrink-0 [perspective:1200px] [@media(max-width:767px)_and_(max-height:700px)]:w-[min(320px,68%)] md:aspect-auto md:w-[320px] ${attempt.result ? 'md:h-[300px]' : 'md:h-[360px]'}`}>
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
              {audioMissing && <p className="mt-2 text-center text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
              </div>
            </div>
          ),
          act: feedback ? (
            <ResultCard
              stars={feedback.stars}
              praise={feedback.message}
              score={score}
              sub={outcome === 'unlocked' ? '🔓 Mở khoá!' : undefined}
              words={feedback.words}
              hint={outcome === 'retry' ? feedback.hint : undefined}
              onRetry={retry}
              primary={{ label: mission ? mission.label : 'Tiếp theo →', onClick: goNext }}
              animate
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              {attempt.error && <SpeakError error={attempt.error} onAction={onErrorAction} onDismiss={attempt.dismissError} />}
              <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
              <p className="font-display text-base font-extrabold text-ink-500 md:text-xl">🎤 Nói để mở khoá</p>
            </div>
          ),
        }} />
      )}
    </PageShell>
  )
}
