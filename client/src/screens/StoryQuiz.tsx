import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import type { QuizQ } from '../content/stories/types'
import { findStory } from '../content/stories'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { MISSION_STATE } from '../progress/missionNav'
import { speakText } from '../story/speak'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { Button, Chip, HomeLabel, PAGE_SHELL, SpeechBubble, StarRow } from '../components/ui'

const ADVANCE_MS = 900
const TAP_TARGET = 'min-h-[64px] flex items-center'
const BACK_LINK = `${TAP_TARGET} rounded-full bg-white px-5 font-display text-xl font-extrabold text-ink-900 shadow-card-sm active:translate-y-[2px]`

/**
 * Phone rules at the default breakpoint, `md:` (768) putting the landscape value back — the
 * phase-10 idiom documented in `screens/SoundPractice.tsx`. `max-md:` only ever overrides a class
 * a shared primitive writes for itself (here `Button`'s own `min-h-[72px] px-10 text-[26px]`),
 * where an unprefixed rule of ours would be a coin toss on Tailwind's utility order.
 */
const CTA_PHONE = 'max-md:min-h-[64px] max-md:w-full max-md:px-4 max-md:text-lg'

export function StoryQuiz() {
  const { id = '' } = useParams()
  const story = findStory(id)
  if (!story) {
    return (
      <main className={`flex h-full flex-col items-center justify-center gap-6 bg-cream-50 px-8 [--page-pad-bottom:2rem] [--page-pad-top:2rem] ${PAGE_SHELL}`}>
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

function StoryQuizInner({ quiz, id }: { quiz: QuizQ[]; id: string }) {
  /**
   * This screen sits on `/story/:id/quiz` — a SUB-route of the lesson's `/story/:id` step — and
   * `missionNav` matches item routes whole by design (its `routeIs`), so `useMissionNext()` would
   * find nothing here. The forwarded flag is the only thing that knows the child is inside a
   * lesson, so the screen reads it straight off the location and passes it on down every hop it
   * owns: back to the story, on to the retell, and the replay in the result row.
   */
  const { state } = useLocation()
  const inMission = (state as { mission?: unknown } | null)?.mission === true
  const missionState = inMission ? MISSION_STATE : undefined

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
      // The three exits are a full-width stack on a phone (the row would wrap into three ragged
      // lines anyway) and the row of the landscape frame from 768 up.
      <main className={`flex h-full flex-col items-center justify-center gap-4 overflow-y-auto bg-cream-50 px-5 md:gap-7 md:p-8 ${PAGE_SHELL}`}>
        <Foxy mood={result.stars === 3 ? 'cheer' : 'happy'} size="lg" />
        <StarRow value={result.stars} size="lg" animate={result.stars === 3} />
        <p className="font-display text-2xl font-extrabold text-ink-900">Bé trả lời đúng {result.correctCount}/3</p>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:justify-center md:gap-4">
          <Button to={`/story/${id}/retell`} state={missionState} size="lg" className={CTA_PHONE}>Kể lại câu chuyện →</Button>
          <Button to={`/story/${id}`} state={missionState} size="lg" variant="outline" className={CTA_PHONE}>Nghe lại</Button>
          {/* The way out. Retell and re-listen both keep the child inside this story, so without
              this the only exit was the browser's own back gesture. In a lesson the way out is the
              lesson: `/` is the one place a child with steps still owed must not be dropped, and
              the map is not even drawn there on a phone. */}
          {inMission
            ? <Button to="/mission" size="lg" variant="secondary" className={CTA_PHONE}>Về nhiệm vụ →</Button>
            : <Button to="/" size="lg" variant="secondary" className={CTA_PHONE}><HomeLabel /></Button>}
        </div>
      </main>
    )
  }

  const mood: FoxyMood = feedback === 'correct' ? 'happy' : feedback === 'wrong' ? 'surprised' : 'idle'
  const foxySays = feedback === 'correct' ? '🦊 Đúng rồi!' : feedback === 'wrong' ? '🦊 Chưa đúng, thử lại nhé' : null

  return (
    // 20 px of side frame on a phone (design §10 M6b), the 24 px this screen has always had from
    // 768 up.
    <main className={`flex h-full flex-col items-center gap-3 overflow-y-auto bg-cream-50 px-5 md:gap-5 md:px-6 ${PAGE_SHELL}`}>
      <div className="flex w-full items-center justify-between max-md:shrink-0">
        {/* Not `/mission`, even in a lesson: this arrow says "Truyện" and means it — it is the way
            to hear the tale again, and the player it lands on is the screen that carries the arrow
            home. It only has to hand the flag on so that trip back is still inside the lesson. */}
        <Link to={`/story/${id}`} state={missionState} className={BACK_LINK}>← Truyện</Link>
        <Chip tone="teal">Câu {qIndex + 1}/3</Chip>
      </div>

      <div className="flex w-full max-w-3xl items-start justify-center gap-3 max-md:shrink-0 md:gap-4">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <Foxy mood={mood} size="md" />
          {/* Foxy's line and the banner at the foot of the screen say the same thing. On a phone
              only the banner is kept: the bubble is what pushed the third answer card off the
              bottom, and the fox's face has already changed mood beside it. */}
          {foxySays && <SpeechBubble title={foxySays} className="text-center max-md:hidden" />}
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-[22px] rounded-bl-[6px] bg-white px-3 py-3 shadow-card-sm md:gap-3 md:px-5 md:py-4">
          <div className="flex-1 text-center">
            {/* The question is never keyword-tinted: highlighting the answer word inside it gave
                the answer away before the child had picked a card. */}
            <p className="font-display text-[19px] font-extrabold leading-tight text-ink-900 md:text-[30px]">{q.q}</p>
            <p className="mt-1 text-[14px] font-bold text-ink-500 md:text-lg">{q.qVi}</p>
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

      {/* Three answers, three shapes of the same DOM. The landscape frame lays them out as a row
          of 250×270 picture cards; the design's phone frame stacks them (§10 M6b) and the stack
          is what has to be measured, because at 390×844 the row version put the third card at
          y875 — 31 px of it on screen out of 270.
          They are sized by `flex-1` rather than the design's flat 170 px so that the same rule
          gives 170-ish at 844 and the design's own 128-ish at 667 without a second breakpoint;
          `min-h-[96px]` is the floor, comfortably above the 64 px tap target. */}
      <div className="flex w-full flex-1 flex-col justify-center gap-3 max-md:min-h-0 md:w-auto md:flex-initial md:flex-row md:flex-wrap md:gap-5">
        {q.options.map((opt, i) => {
          const state = selected === i && feedback !== 'idle' ? CARD_STATE[feedback] : 'shadow-card'
          const badge = selected === i && feedback === 'correct' ? '✅' : selected === i && feedback === 'wrong' ? '🙈' : null
          return (
            <button
              key={i}
              type="button"
              aria-label={opt.label}
              onClick={() => handleTap(i)}
              className={`relative flex w-full max-w-full flex-1 flex-col items-center justify-center gap-2 rounded-[22px] bg-white transition-shadow active:translate-y-[2px] max-md:min-h-[96px] md:h-[270px] md:w-[250px] md:flex-initial md:rounded-xl3 ${state}`}
            >
              <span aria-hidden="true" className="text-[64px] leading-none md:text-[110px]">{opt.emoji}</span>
              <span className="font-display text-lg font-extrabold text-ink-500 md:text-xl">{opt.label}</span>
              {badge && <span aria-hidden="true" className="absolute right-3 top-3 text-3xl md:right-4 md:top-4 md:text-4xl">{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Fixed height so the cards never jump when the banner appears. */}
      <div className="flex h-[46px] items-center max-md:shrink-0 md:h-[60px]">
        {feedback === 'correct' && (
          <p className="rounded-full bg-good-50 px-4 py-2 font-display text-lg font-extrabold text-good-700 md:px-6 md:py-3 md:text-2xl">
            Đúng rồi! Giỏi quá! 🎉
          </p>
        )}
        {feedback === 'wrong' && (
          <p className="rounded-full bg-sun-50 px-4 py-2 font-display text-lg font-extrabold text-sun-700 md:px-6 md:py-3 md:text-2xl">
            Gần đúng rồi — thử lại nhé! 💪
          </p>
        )}
      </div>
    </main>
  )
}
