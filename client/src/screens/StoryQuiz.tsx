import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { QuizQ } from '../content/stories/types'
import { findStory } from '../content/stories'
import { setStars } from '../progress/store'
import { Stars } from '../components/Stars'

const ADVANCE_MS = 900
const TAP_TARGET = 'min-h-[64px] flex items-center'

export function StoryQuiz() {
  const { id = '' } = useParams()
  const story = findStory(id)
  if (!story) {
    return (
      <main className="p-8">
        <p className="text-2xl mb-4">Không tìm thấy truyện</p>
        <Link to="/stories" className={`text-2xl px-4 ${TAP_TARGET}`}>← Truyện</Link>
      </main>
    )
  }
  return <StoryQuizInner quiz={story.quiz} id={id} />
}

type Feedback = 'idle' | 'correct' | 'wrong'

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
      <main className="p-8 flex flex-col items-center gap-6">
        <Stars value={result.stars} animate={result.stars === 3} />
        <p className="text-2xl">Bé trả lời đúng {result.correctCount}/3</p>
        <div className="flex gap-4">
          <Link
            to={`/story/${id}/retell`}
            className={`px-6 rounded-2xl bg-coral text-white text-2xl font-extrabold justify-center active:scale-95 ${TAP_TARGET}`}
          >
            Kể lại câu chuyện →
          </Link>
          <Link
            to={`/story/${id}`}
            className={`px-6 rounded-2xl bg-white shadow text-2xl font-extrabold justify-center active:scale-95 ${TAP_TARGET}`}
          >
            Nghe lại
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="p-8 flex flex-col items-center gap-6">
      <div className="w-full flex items-center justify-between">
        <Link to={`/story/${id}`} className={`text-2xl px-4 ${TAP_TARGET}`}>← Truyện</Link>
        <p className="text-lg text-slate-500">Câu {qIndex + 1}/3</p>
      </div>
      <p className="text-3xl font-extrabold text-center">{q.q}</p>
      <p className="text-xl text-slate-500 text-center">{q.qVi}</p>
      <div className="flex gap-5 flex-wrap justify-center">
        {q.options.map((opt, i) => {
          const isCorrectTap = selected === i && feedback === 'correct'
          const isWrongTap = selected === i && feedback === 'wrong'
          const stateClass = isCorrectTap
            ? 'bg-good/20 ring-4 ring-good'
            : isWrongTap
              ? 'bg-fix/20 ring-4 ring-fix'
              : 'bg-white'
          return (
            <button
              key={i}
              type="button"
              aria-label={opt.label}
              onClick={() => handleTap(i)}
              className={`min-w-[120px] min-h-[120px] flex flex-col items-center justify-center gap-1 shadow rounded-3xl active:scale-95 ${stateClass}`}
            >
              <span className="text-[72px] leading-none">{opt.emoji}</span>
              <span className="text-xl">{opt.label}</span>
            </button>
          )
        })}
      </div>
      <p className="text-2xl h-8">
        {feedback === 'correct' && '🦊 Đúng rồi!'}
        {feedback === 'wrong' && '🦊 Chưa đúng, thử lại nhé'}
      </p>
    </main>
  )
}
