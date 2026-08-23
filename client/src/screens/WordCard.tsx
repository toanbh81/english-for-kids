import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { Word } from '../content/words/types'
import type { PronunciationResult } from '../scoring/types'
import { findTopic, findWord } from '../content/words'
import { getBox, promote, demote, dueWords } from '../progress/leitner'
import { logActivity, missionStatus } from '../progress/activity'
import { saveRecording } from '../progress/recordings'
import { playUrl } from '../audio/player'
import { speakText } from '../story/speak'
import { toFeedback } from '../scoring/feedback'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { MicButton } from '../components/MicButton'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { HintCard } from '../components/HintCard'
import { BackButton, Button, Chip } from '../components/ui'

const UNLOCK_SCORE = 60

/** The daily mission asks for 3 new words; the header counts today's progress towards it. */
const WORD_TARGET = 3

/** Both faces sit on top of each other inside the rotating shell; only the one facing the
 * child is painted (`backface-visibility`). */
const FACE = 'absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl4 p-6 [backface-visibility:hidden]'

/** 64 px tap target in the face's bottom corner — the explicit, focusable way to flip, so the
 * card never has to pretend to be a button. */
const FLIP_BUTTON =
  'absolute bottom-2 right-2 flex h-16 w-16 items-center justify-center rounded-full text-3xl active:translate-y-[2px]'

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
  // Read once on mount: the counter is the day's tally as the child opened this card, so it does
  // not tick up mid-attempt and distract from the word in front of them.
  const [wordsToday] = useState(() => Math.min(missionStatus().word, WORD_TARGET))
  const [flipped, setFlipped] = useState(false)
  const [audioMissing, setAudioMissing] = useState(false)
  const [outcome, setOutcome] = useState<'unlocked' | 'retry' | null>(null)

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
  const backTo = isReview ? '/words/review' : `/words/${topic}`

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

  function flip() { setFlipped(f => !f) }

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
    : outcome === 'unlocked' ? 'cheer' : outcome === 'retry' ? 'surprised' : 'idle'

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to={backTo} label={isReview ? 'Ôn tập' : 'Từ vựng'} />
          <div className="flex flex-1 flex-col items-center gap-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[30px] font-extrabold leading-none text-ink-900">Từ mới hôm nay 🧩</h1>
              <Chip tone="sun">{wordsToday}/{WORD_TARGET}</Chip>
            </div>
            <p className="font-display text-lg font-extrabold text-ink-500">Chạm thẻ để lật — nói đúng để mở khoá!</p>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        <div className="h-[360px] w-[320px] shrink-0 [perspective:1200px]">
          {/* A plain div, not a `role="button"`: the whole card stays tap-anywhere for a small
              finger, while the flip each face carries is the real control screen readers and
              keyboards use. */}
          <div
            data-testid="flip-card"
            onClick={flip}
            onKeyDown={onCardKey}
            className={`relative h-full w-full cursor-pointer transition-transform duration-500 [transform-style:preserve-3d] ${
              flipped ? '[transform:rotateY(180deg)]' : ''
            }`}
          >
            {/* The face turned away is still painted-over by `backface-visibility`, but that is a
                purely visual trick: `inert` + `aria-hidden` are what keep its buttons out of the
                tab order and out of the screen reader. */}
            <div
              data-testid="face-front"
              className={`${FACE} bg-white shadow-card`}
              inert={flipped}
              aria-hidden={flipped ? 'true' : undefined}
            >
              <span aria-hidden="true" className="text-[96px] leading-none">{word.emoji}</span>
              <span className="font-display text-[44px] font-extrabold leading-none text-ink-900">{word.word}</span>
              <span className="text-xl font-bold text-ink-300">{word.ipa}</span>
              {/* 58 px circle inside a 64 px tap target — the handoff's size without shrinking the
                  area a small finger has to hit. */}
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
              <Chip className="absolute bottom-4">MẶT TRƯỚC</Chip>
              <button type="button" aria-label="Lật thẻ" onClick={e => onFaceButton(e, flip)} className={FLIP_BUTTON}>
                <span aria-hidden="true">🔄</span>
              </button>
            </div>

            <div
              data-testid="face-back"
              className={`${FACE} bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9] [transform:rotateY(180deg)]`}
              inert={!flipped}
              aria-hidden={flipped ? undefined : 'true'}
            >
              <span className="text-center font-display text-[36px] font-extrabold leading-tight text-coral-600">{word.vi}</span>
              <span className="text-center text-[22px] font-bold leading-snug text-ink-500">{word.example}</span>
              <button type="button" onClick={e => onFaceButton(e, () => speakText(word.example))} className={SPEAK_CHIP}>
                🔊 Nghe câu ví dụ
              </button>
              <Chip className="absolute bottom-4">MẶT SAU</Chip>
              <button type="button" aria-label="Lật thẻ" onClick={e => onFaceButton(e, flip)} className={FLIP_BUTTON}>
                <span aria-hidden="true">🔄</span>
              </button>
            </div>
          </div>
        </div>

        {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}

        {outcome === 'unlocked' && (
          <span className="inline-flex items-center gap-2 rounded-xl2 bg-sun-50 px-6 py-3 font-display text-2xl font-extrabold text-sun-700 shadow-chunky-sun">
            🔓 Mở khoá!
          </span>
        )}

        {attempt.error && <p className="font-display text-2xl font-extrabold text-fix-700">{attempt.error}</p>}

        {outcome === 'retry' && feedback?.hint && <HintCard hint={feedback.hint} />}

        <div className="flex items-end gap-6">
          <Foxy mood={mood} size="sm" say={outcome === 'retry' ? 'Thử lại nhé' : undefined} />
          <div className="flex flex-col items-center gap-2">
            <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
            <p className="font-display text-xl font-extrabold text-ink-500">🎤 Nói để mở khoá</p>
          </div>
        </div>

        {outcome && (
          <div className="flex flex-wrap justify-center gap-4 pb-2">
            <Button variant="outline" onClick={retry}>Thử lại</Button>
            <Button size="lg" pulse onClick={() => nav(next ? `/words/${topic}/${next.id}` : backTo)}>
              Tiếp theo →
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
