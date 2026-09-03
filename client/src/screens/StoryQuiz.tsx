import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { QuizQ } from '../content/stories/types'
import { findStory } from '../content/stories'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { MISSION_ROUTE, MISSION_STATE, RETURN_LABEL, useMissionFlag } from '../progress/missionNav'
import { speakText } from '../story/speak'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { BackButton, Button, Chip, HomeLabel, LinkText, NotFound, SpeechBubble, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody, PageFooter } from '../components/ui/page'

const ADVANCE_MS = 900

export function StoryQuiz() {
  const { id = '' } = useParams()
  // Before the guard: a story that cannot be found has no lesson position, so `LessonChip`
  // suppresses itself here too and this link is the only way off the screen.
  const mission = useMissionFlag()
  const story = findStory(id)
  // A child mid-lesson who hits a dead story link must land back in the lesson, not out of it.
  if (!story) return <NotFound what="truyện" to={mission ? MISSION_ROUTE : '/stories'} />
  return <StoryQuizInner quiz={story.quiz} id={id} mission={mission} />
}

type Feedback = 'idle' | 'correct' | 'wrong'

const CARD_STATE: Record<Exclude<Feedback, 'idle'>, string> = {
  // Chunky shadow in the state colour plus a soft outer ring — the handoff's "picked" card.
  correct: 'shadow-[0_8px_0_#7ED99A,0_0_0_6px_#B9ECC8]',
  wrong: 'shadow-[0_8px_0_#F8A3AE,0_0_0_6px_#FFD4DA]',
}

/**
 * This screen sits on `/story/:id/quiz` — a SUB-route of the lesson's `/story/:id` step — and
 * `missionNav` matches item routes whole by design (its `routeIs`), so `useMissionNext()` would
 * find nothing here. The forwarded flag is the only thing that knows the child is inside a lesson,
 * so the screen passes it on down every hop it owns: back to the story, on to the retell, and the
 * replay in the result row.
 */
function StoryQuizInner({ quiz, id, mission: inMission }: { quiz: QuizQ[]; id: string; mission: boolean }) {
  const missionState = inMission ? MISSION_STATE : undefined

  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [hasWrong, setHasWrong] = useState(false)
  const [firstTryCorrect, setFirstTryCorrect] = useState(0)
  const [result, setResult] = useState<{ stars: 0 | 1 | 2 | 3; correctCount: number } | null>(null)

  const pendingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedRef = useRef(false)

  // Clear any pending advance timer if the child navigates away mid-quiz.
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const q = quiz[qIndex]

  // "Làm quiz lại" on the 0-star result stays on `/story/:id/quiz` (same route, same component) —
  // a `<Link to>` there is not a remount, so replaying is this local reset, not a navigation.
  function resetQuiz() {
    savedRef.current = false
    setQIndex(0)
    setSelected(null)
    setFeedback('idle')
    setHasWrong(false)
    setFirstTryCorrect(0)
    setResult(null)
  }

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
          // First-try-correct count IS the star count, 0 included — `setStars` only ever raises a
          // score, never lowers it, so 0 is simply not written; the day's attempt is still logged.
          const stars = nextFirstTryCorrect as 0 | 1 | 2 | 3
          if (!savedRef.current) {
            savedRef.current = true
            if (stars !== 0) setStars(`story:${id}`, stars)
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
    const { stars, correctCount } = result
    // 3 → cheer, 2 → happy, 1 and 0 both → idle: a single first-try slip is not a reason for a sad
    // fox, but only a clean sweep earns the big reaction (R27).
    const mood: FoxyMood = stars === 3 ? 'cheer' : stars === 2 ? 'happy' : 'idle'

    if (stars === 0) {
      // Worst case: no footer, no confetti, three stacked exits sized to clear 667px tall.
      return (
        <PageShell gutter="20">
          <PageBody center className="items-center gap-3.5 text-center">
            <Foxy mood={mood} size="lg" className="[&_svg]:h-[126px] [&_svg]:w-[130px]" />
            <StarRow value={stars} size="lg" />
            <p className="font-display text-2xl font-extrabold text-ink-900">Bé trả lời đúng {correctCount}/3</p>
            <p className="text-[14px] font-bold text-ink-500">Không sao! Nghe lại truyện một lần rồi thử lại nhé.</p>
            <div className="flex w-full flex-col items-center gap-3 md:w-auto">
              <Button to={`/story/${id}`} state={missionState} size="md" className="w-full md:w-auto">🎧 Nghe lại truyện</Button>
              {/* Same route, not a fresh mount — `resetQuiz` is what actually replays the quiz; the
                  `Link` just keeps the URL, the mission flag and the tap target honest. */}
              <Button to={`/story/${id}/quiz`} state={missionState} variant="outline" size="md" onClick={resetQuiz} className="w-full md:w-auto">Làm quiz lại</Button>
              <LinkText to={inMission ? MISSION_ROUTE : '/'} state={missionState}>{inMission ? RETURN_LABEL : <HomeLabel />}</LinkText>
            </div>
          </PageBody>
        </PageShell>
      )
    }

    return (
      <PageShell gutter="20">
        <PageBody center className="items-center gap-4 text-center md:gap-7">
          <Foxy mood={mood} size="lg" />
          <StarRow value={stars} size="lg" animate={stars === 3} />
          <p className="font-display text-2xl font-extrabold text-ink-900">Bé trả lời đúng {correctCount}/3</p>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:justify-center md:gap-4">
            <Button to={`/story/${id}`} state={missionState} variant="outline" size="md" className="w-full md:w-auto">Nghe lại</Button>
            {/* The way out. Retell and re-listen both keep the child inside this story, so without
                this the only exit was the browser's own back gesture. In a lesson the way out is the
                lesson: `/` is the one place a child with steps still owed must not be dropped, and
                the map is not even drawn there on a phone. */}
            {inMission
              ? <Button to={MISSION_ROUTE} variant="outline" size="md" className="w-full md:w-auto">{RETURN_LABEL}</Button>
              : <Button to="/" variant="outline" size="md" className="w-full md:w-auto"><HomeLabel /></Button>}
          </div>
        </PageBody>
        <PageFooter>
          <Button to={`/story/${id}/retell`} state={missionState} size="lg" className="mx-auto w-full md:w-auto">Kể lại câu chuyện →</Button>
        </PageFooter>
      </PageShell>
    )
  }

  const mood: FoxyMood = feedback === 'correct' ? 'happy' : feedback === 'wrong' ? 'surprised' : 'idle'
  const foxySays = feedback === 'correct' ? '🦊 Đúng rồi!' : feedback === 'wrong' ? '🦊 Chưa đúng, thử lại nhé' : null

  return (
    <PageShell gutter="20">
      <PageHeader back={<BackButton to={`/story/${id}`} state={missionState} label="Truyện" variant="child" />}>
        <Chip tone="teal">Câu {qIndex + 1}/3</Chip>
      </PageHeader>
      <PageBody className="items-center gap-3">
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

        {/* Three answers, three shapes of the same DOM. On a phone each card is itself a row —
            emoji beside the label, `min-h-[96px]` tall, stacked in a column — because at 390×844
            the old 250×270 picture-card row put the third card at y875, 31 px of it off screen.
            From `md` up the card flips to a portrait 4:3 tile (emoji 96) and the deck lays all
            three out in one row, `flex-1` up to a `300px` cap so they still fill it evenly.
            `opt.image` (Q14, no story ships one yet) swaps in a 16:9 picture in the same slot —
            the layout around it never changes. */}
        <div className="flex w-full max-w-3xl flex-1 flex-col justify-center gap-3 max-md:min-h-0 md:flex-initial md:flex-row md:flex-nowrap md:items-start md:gap-5">
          {q.options.map((opt, i) => {
            const state = selected === i && feedback !== 'idle' ? CARD_STATE[feedback] : 'shadow-card'
            const badge = selected === i && feedback === 'correct' ? '✅' : selected === i && feedback === 'wrong' ? '🙈' : null
            return (
              <button
                key={i}
                type="button"
                aria-label={opt.label}
                onClick={() => handleTap(i)}
                className={`relative flex w-full max-w-full flex-1 flex-row items-center justify-center gap-3 rounded-r22 bg-white px-4 transition-shadow active:translate-y-[2px] max-md:min-h-[96px] md:aspect-[4/3] md:max-w-[300px] md:flex-1 md:flex-col md:gap-2 md:px-0 md:rounded-r28 ${state}`}
              >
                {opt.image
                  ? <img src={opt.image} alt={opt.label} className="aspect-[16/9] w-full rounded-r16 object-cover" />
                  : <span aria-hidden="true" className="text-[56px] leading-none md:text-[96px]">{opt.emoji}</span>}
                <span className="font-display text-[20px] font-extrabold text-ink-500 md:text-xl">{opt.label}</span>
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
      </PageBody>
    </PageShell>
  )
}
