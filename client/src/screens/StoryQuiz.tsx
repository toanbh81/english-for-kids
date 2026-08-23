import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { QuizQ } from '../content/stories/types'
import { findStory } from '../content/stories'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { speakText } from '../story/speak'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { Button, Chip, SpeechBubble, StarRow } from '../components/ui'

const ADVANCE_MS = 900
const TAP_TARGET = 'min-h-[64px] flex items-center'
const BACK_LINK = `${TAP_TARGET} rounded-full bg-white px-5 font-display text-xl font-extrabold text-ink-900 shadow-card-sm active:translate-y-[2px]`

export function StoryQuiz() {
  const { id = '' } = useParams()
  const story = findStory(id)
  if (!story) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-6 bg-cream-50 p-8">
        <p className="font-display text-3xl font-extrabold text-ink-900">Không tìm thấy truyện</p>
        <Link to="/stories" className={BACK_LINK}>← Truyện</Link>
      </main>
    )
  }
  return <StoryQuizInner quiz={story.quiz} id={id} />
}

type Feedback = 'idle' | 'correct' | 'wrong'

const CARD_STATE: Record<Exclude<Feedback, 'idle'>, string> = {
  // Chunky shadow in the state colour plus a soft outer ring — the handoff's "picked" card.
  correct: 'shadow-[0_8px_0_#7ED99A,0_0_0_6px_#B9ECC8]',
  wrong: 'shadow-[0_8px_0_#F8A3AE,0_0_0_6px_#FFD4DA]',
}

/** Splits `text` so an exact word match on `keyword` can be tinted coral. Word boundaries keep
 * "fox" from colouring half of "Foxy". */
function highlight(text: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`\\b${escaped}\\b`, 'i').exec(text)
  if (!match) return text
  return (
    <>
      {text.slice(0, match.index)}
      <span className="text-coral-text">{match[0]}</span>
      {text.slice(match.index + match[0].length)}
    </>
  )
}

function StoryQuizInner({ quiz, id }: { quiz: QuizQ[]; id: string }) {
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hasWrong, setHasWrong] = useState(false)
  const [firstTryCorrect, setFirstTryCorrect] = useState(0)
  const [result, setResult] = useState<{ stars: 1 | 2 | 3; correctCount: number } | null>(null)

  const pendingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedRef = useRef(false)

  // Clear any pending advance timer if the child navigates away mid-quiz.
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const q = quiz[qIndex]

  function handleTap(i: number) {
    if (pendingRef.current) return
    if (i === q.answer) {
      const earnedFirstTry = !hasWrong
      setSelected(i)
      setFeedback('correct')
      pendingRef.current = true
      timeoutRef.current = setTimeout(() => {
        pendingRef.current = false
        const nextFirstTryCorrect = firstTryCorrect + (earnedFirstTry ? 1 : 0)
        if (qIndex === quiz.length - 1) {
          const stars: 1 | 2 | 3 = nextFirstTryCorrect === 3 ? 3 : nextFirstTryCorrect === 2 ? 2 : 1
          if (!savedRef.current) {
            savedRef.current = true
            setStars(`story:${id}`, stars)
            logActivity({ ts: Date.now(), kind: 'story', id })
          }
          setFirstTryCorrect(nextFirstTryCorrect)
          setResult({ stars, correctCount: nextFirstTryCorrect })
        } else {
          setFirstTryCorrect(nextFirstTryCorrect)
          setQIndex(qIndex + 1)
          setSelected(null)
          setFeedback('idle')
          setHasWrong(false)
        }
      }, ADVANCE_MS)
    } else {
      setSelected(i)
      setFeedback('wrong')
      setHasWrong(true)
    }
  }

  if (result) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-7 overflow-y-auto bg-cream-50 p-8">
        <Foxy mood={result.stars === 3 ? 'cheer' : 'happy'} size="lg" />
        <StarRow value={result.stars} size="lg" animate={result.stars === 3} />
        <p className="font-display text-2xl font-extrabold text-ink-900">Bé trả lời đúng {result.correctCount}/3</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button to={`/story/${id}/retell`} size="lg">Kể lại câu chuyện →</Button>
          <Button to={`/story/${id}`} size="lg" variant="outline">Nghe lại</Button>
        </div>
      </main>
    )
  }

  const mood: FoxyMood = feedback === 'correct' ? 'happy' : feedback === 'wrong' ? 'surprised' : 'idle'
  const foxySays = feedback === 'correct' ? '🦊 Đúng rồi!' : feedback === 'wrong' ? '🦊 Chưa đúng, thử lại nhé' : null

  return (
    <main className="flex h-full flex-col items-center gap-5 overflow-y-auto bg-cream-50 p-6">
      <div className="flex w-full items-center justify-between">
        <Link to={`/story/${id}`} className={BACK_LINK}>← Truyện</Link>
        <Chip tone="teal">Câu {qIndex + 1}/3</Chip>
      </div>

      <div className="flex w-full max-w-3xl items-start justify-center gap-4">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <Foxy mood={mood} size="md" />
          {foxySays && <SpeechBubble title={foxySays} className="text-center" />}
        </div>
        <div className="flex flex-1 items-center gap-3 rounded-[22px] rounded-bl-[6px] bg-white px-5 py-4 shadow-card-sm">
          <div className="flex-1 text-center">
            <p className="font-display text-[30px] font-extrabold leading-tight text-ink-900">
              {highlight(q.q, q.options[q.answer].label)}
            </p>
            <p className="mt-1 text-lg font-bold text-ink-500">{q.qVi}</p>
          </div>
          {/* 58 px circle inside a 64 px tap target — the picture stays small, the finger doesn't. */}
          <button
            type="button"
            aria-label="Nghe câu hỏi"
            onClick={() => speakText(q.q)}
            className="flex h-[64px] w-[64px] shrink-0 items-center justify-center active:translate-y-[2px]"
          >
            <span aria-hidden="true" className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-teal-500 text-2xl text-white shadow-chunky-teal">
              🔊
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-5">
        {q.options.map((opt, i) => {
          const state = selected === i && feedback !== 'idle' ? CARD_STATE[feedback] : 'shadow-card'
          const badge = selected === i && feedback === 'correct' ? '✅' : selected === i && feedback === 'wrong' ? '🙈' : null
          return (
            <button
              key={i}
              type="button"
              aria-label={opt.label}
              onClick={() => handleTap(i)}
              className={`relative flex h-[270px] w-[250px] max-w-full flex-col items-center justify-center gap-2 rounded-xl3 bg-white transition-shadow active:translate-y-[2px] ${state}`}
            >
              <span aria-hidden="true" className="text-[110px] leading-none">{opt.emoji}</span>
              <span className="font-display text-xl font-extrabold text-ink-500">{opt.label}</span>
              {badge && <span aria-hidden="true" className="absolute right-4 top-4 text-4xl">{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Fixed height so the cards never jump when the banner appears. */}
      <div className="flex h-[60px] items-center">
        {feedback === 'correct' && (
          <p className="rounded-full bg-good-50 px-6 py-3 font-display text-2xl font-extrabold text-good-700">
            Đúng rồi! Giỏi quá! 🎉
          </p>
        )}
        {feedback === 'wrong' && (
          <p className="rounded-full bg-sun-50 px-6 py-3 font-display text-2xl font-extrabold text-sun-700">
            Gần đúng rồi — thử lại nhé! 💪
          </p>
        )}
      </div>
    </main>
  )
}
