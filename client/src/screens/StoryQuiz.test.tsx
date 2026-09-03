import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import * as storiesModule from '../content/stories'
import { findStory, STORIES } from '../content/stories'
import { StoryQuiz } from './StoryQuiz'

/** Where a link landed, and whether it was still carrying `{ mission: true }` — the flag leaves no
 * trace in the DOM, so the probe is the only way to see it. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname} {JSON.stringify(location.state)}</p>
}

function renderQuiz(id = 'little-fox', mission = false) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/story/${id}/quiz`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/story/:id/quiz" element={<StoryQuiz />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const story = findStory('little-fox')!

/** Answer all three correctly — the quickest way to the result screen and its three exits. */
function finishQuiz() {
  story.quiz.forEach(q => {
    fireEvent.click(screen.getByRole('button', { name: q.options[q.answer].label }))
    act(() => { vi.advanceTimersByTime(900) })
  })
}

/** Miss every question once before getting it right — the 0-star path (R27's worst case): no
 * question is ever first-try-correct, so `firstTryCorrect` never leaves 0. */
function answerWrongThenRight() {
  story.quiz.forEach(q => {
    const wrongIndex = q.options.findIndex((_, i) => i !== q.answer)
    fireEvent.click(screen.getByRole('button', { name: q.options[wrongIndex].label }))
    fireEvent.click(screen.getByRole('button', { name: q.options[q.answer].label }))
    act(() => { vi.advanceTimersByTime(900) })
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('answering all three questions correctly on the first try gives 3 stars and saves progress', () => {
  renderQuiz()

  story.quiz.forEach(q => {
    const correctOption = q.options[q.answer]
    fireEvent.click(screen.getByRole('button', { name: correctOption.label }))
    act(() => { vi.advanceTimersByTime(900) })
  })

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  const saved = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(saved['story:little-fox']).toBe(3)
  expect(screen.getByText('Bé trả lời đúng 3/3')).toBeInTheDocument()
})

it('a wrong first attempt on one question, corrected, still passes the other two questions first-try, gives 2 stars', () => {
  renderQuiz()

  // Question 1: tap wrong option first, then the correct one.
  const q0 = story.quiz[0]
  const wrongIndex0 = q0.options.findIndex((_, i) => i !== q0.answer)
  fireEvent.click(screen.getByRole('button', { name: q0.options[wrongIndex0].label }))
  expect(screen.getByText('🦊 Chưa đúng, thử lại nhé')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: q0.options[q0.answer].label }))
  expect(screen.getByText('🦊 Đúng rồi!')).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(900) })

  // Questions 2 and 3: correct on first try.
  story.quiz.slice(1).forEach(q => {
    fireEvent.click(screen.getByRole('button', { name: q.options[q.answer].label }))
    act(() => { vi.advanceTimersByTime(900) })
  })

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  const saved = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(saved['story:little-fox']).toBe(2)
  expect(screen.getByText('Bé trả lời đúng 2/3')).toBeInTheDocument()
})

it('never tints the answer keyword inside the question, in any story', () => {
  for (const story of STORIES) {
    const { container, unmount } = renderQuiz(story.id)

    for (const q of story.quiz) {
      // The question renders as one uninterrupted text node — no coral-tinted span giving the
      // answer away before the child has picked a card.
      expect(screen.getByText(q.q)).toBeInTheDocument()
      expect(container.querySelectorAll('.text-coral-text')).toHaveLength(0)

      fireEvent.click(screen.getByRole('button', { name: q.options[q.answer].label }))
      act(() => { vi.advanceTimersByTime(900) })
    }

    unmount()
  }
})

it('shows a not-found message for an unknown story id', () => {
  renderQuiz('nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy truyện này 🦊')
  expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/stories')
})

/** No story means no lesson position, so `LessonChip` suppresses itself here too and this link is
 * the only way off the screen. It may not point out of the lesson. */
it('leads a mission child home even when the story itself is missing', () => {
  renderQuiz('nope', true)
  expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/mission')
})

it('shows the question progress indicator', () => {
  renderQuiz()
  expect(screen.getByText('Câu 1/3')).toBeInTheDocument()
})

it('offers a way back to the story from the question screen', () => {
  renderQuiz()
  const back = screen.getByRole('link', { name: 'Truyện' })
  expect(back).toHaveAttribute('href', '/story/little-fox')
  expect(back).toHaveClass('h-14', 'w-14', 'md:h-16', 'md:w-16')
})

it('ignores taps while the correct-answer advance is pending', () => {
  renderQuiz()
  const q0 = story.quiz[0]
  fireEvent.click(screen.getByRole('button', { name: q0.options[q0.answer].label }))
  // Tap again during the 900ms pending window: should be ignored.
  const otherIndex = q0.options.findIndex((_, i) => i !== q0.answer)
  fireEvent.click(screen.getByRole('button', { name: q0.options[otherIndex].label }))
  expect(screen.getByText('🦊 Đúng rồi!')).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(900) })
  expect(screen.getByText('Câu 2/3')).toBeInTheDocument()
})

it('shows result buttons linking to retell and to listen again', () => {
  renderQuiz()
  story.quiz.forEach(q => {
    fireEvent.click(screen.getByRole('button', { name: q.options[q.answer].label }))
    act(() => { vi.advanceTimersByTime(900) })
  })
  const retellLink = screen.getByRole('link', { name: /Kể lại câu chuyện/ })
  expect(retellLink).toHaveAttribute('href', '/story/little-fox/retell')
  const listenLink = screen.getByRole('link', { name: 'Nghe lại' })
  expect(listenLink).toHaveAttribute('href', '/story/little-fox')
  // Retell and re-listen both stay inside the story — the result screen must also offer a way out.
  expect(screen.getByRole('link', { name: /Về bản đồ 🏝️/ })).toHaveAttribute('href', '/')
})

/* ---- Phase 14, round-3 brief §2 C3 / R27: the 0-star result, and the 3-star one left alone ---- */

it('3 correct keeps the Phase 12 result exactly', () => {
  renderQuiz()
  finishQuiz()
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByRole('link', { name: 'Kể lại câu chuyện →' })).toBeInTheDocument()
  const saved = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(saved['story:little-fox']).toBe(3)
})

it('0 correct: 0 stars, idle Foxy, no store write, activity still logged', () => {
  renderQuiz()
  answerWrongThenRight()

  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'idle')
  expect(screen.getAllByTestId('star-empty')).toHaveLength(3)
  expect(screen.getByTestId('stars')).toHaveClass('text-[44px]')
  expect(screen.getByText('Bé trả lời đúng 0/3')).toBeInTheDocument()
  expect(screen.getByText('Không sao! Nghe lại truyện một lần rồi thử lại nhé.')).toBeInTheDocument()

  // `setStars` only ever raises a score, so 0 is simply never written — but the attempt still
  // counts as today's story activity.
  const savedStars = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(savedStars['story:little-fox']).toBeUndefined()
  const activity = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(activity).toContainEqual(expect.objectContaining({ kind: 'story', id: 'little-fox' }))
})

it('0 correct changes the primary CTA and demotes the third action to a 44px link', () => {
  renderQuiz()
  answerWrongThenRight()

  expect(screen.getByRole('link', { name: '🎧 Nghe lại truyện' })).toHaveClass('bg-coral-500', 'min-h-[56px]')
  expect(screen.getByRole('link', { name: 'Làm quiz lại' })).toHaveClass('border-teal-line')
  const third = screen.getByRole('link', { name: /Về nhiệm vụ|Về trang chủ/ })
  expect(third).toHaveClass('min-h-[44px]', 'underline')
  expect(third.className).not.toMatch(/min-h-\[64px\]/)
})

it('replays the quiz locally from the 0-star result, without leaving the route', () => {
  renderQuiz()
  answerWrongThenRight()
  expect(screen.getByText('Bé trả lời đúng 0/3')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('link', { name: 'Làm quiz lại' }))
  expect(screen.getByText('Câu 1/3')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'fox' })).toBeInTheDocument()
})

/* ---- Phase 14, round-3 brief §2 C3 / R26: phone row cards, iPad 4:3 cards, the image branch ---- */

/** jsdom has no layout, so these pin *which breakpoint each rule is written at*; the pixel
 * geometry (three cards fully on screen at 390×844 and 375×667) is the browser's job. */
it('answer cards are a phone row and a 4:3 iPad card', () => {
  const { container } = renderQuiz()
  const card = screen.getByRole('button', { name: 'fox' })
  expect(card).toHaveClass('flex-row', 'max-md:min-h-[96px]', 'md:flex-col', 'md:aspect-[4/3]', 'md:max-w-[300px]', 'md:flex-1')
  expect(card.className).not.toMatch(/md:h-\[270px\]|md:w-\[250px\]/)
  expect(within(card).getByText('🦊')).toHaveClass('text-[56px]', 'md:text-[96px]')
  expect(within(card).getByText('fox')).toHaveClass('text-[20px]')
  expect(container.querySelector('main')).toHaveClass('px-5', 'md:px-6')
})

/** Q14 (round-3 §3): data has no `image` on any option today, so this stubs `findStory` for the
 * one test that needs one — the layout slot is real even though no story fills it yet. */
it('an option with an image renders a 16:9 picture instead of the emoji', () => {
  const withImage = {
    ...story,
    quiz: [
      { ...story.quiz[0], options: story.quiz[0].options.map((o, i) => (i === 0 ? { ...o, image: '/art/fox.png' } : o)) },
      ...story.quiz.slice(1),
    ],
  }
  vi.spyOn(storiesModule, 'findStory').mockReturnValue(withImage)
  renderQuiz()
  const img = screen.getByRole('img', { name: withImage.quiz[0].options[0].label })
  expect(img).toHaveClass('aspect-[16/9]', 'object-cover')
  expect(img).toHaveAttribute('src', '/art/fox.png')
})

it('drops Foxy\'s bubble on a phone, where the banner at the foot already says it', () => {
  renderQuiz()
  const q0 = story.quiz[0]
  const wrong = q0.options.findIndex((_, i) => i !== q0.answer)
  fireEvent.click(screen.getByRole('button', { name: q0.options[wrong].label }))
  // In the DOM at every width, and laid out again from 768 up, where it is the landscape frame's
  // bubble; below 768 it goes, because it is what pushed the third answer card under the fold.
  // `hidden` is `display:none`, so on a phone it leaves the accessibility tree too — nothing is
  // lost, because the banner at the foot of the screen says the same thing in the same state and
  // is the assertion on the next line.
  expect(screen.getByText('🦊 Chưa đúng, thử lại nhé').parentElement).toHaveClass('max-md:hidden')
  expect(screen.getByText('Gần đúng rồi — thử lại nhé! 💪')).toBeInTheDocument()
})

it('stacks the two secondary result exits full width on a phone and keeps the row from md up', () => {
  renderQuiz()
  finishQuiz()
  const row = screen.getByRole('link', { name: 'Nghe lại' }).parentElement!
  expect(row).toHaveClass('w-full', 'flex-col', 'md:w-auto', 'md:flex-row', 'md:flex-wrap', 'md:gap-4')
  for (const name of [/^Nghe lại$/, /Về bản đồ/]) {
    expect(screen.getByRole('link', { name })).toHaveClass('w-full', 'md:w-auto')
  }
  // The primary exit lives in the footer, full width on a phone.
  expect(screen.getByRole('link', { name: /Kể lại câu chuyện/ })).toHaveClass('w-full', 'md:w-auto')
})

// --- as part of a lesson step (fix: the story chain keeps its thread back) ---------------------
//
// `/story/:id/quiz` is a SUB-route of the 🎧 step's `/story/:id`, and `missionNav` matches item
// routes whole on purpose, so nothing resolves here: the forwarded flag is the only thing that
// knows the child is inside a lesson, and every hop this screen owns has to pass it on.

it('keeps the mission alive on the hop back to the story', () => {
  renderQuiz('little-fox', true)

  const back = screen.getByRole('link', { name: 'Truyện' })
  // Still the story, not the mission: this arrow is the way to hear the tale again, and the
  // player it lands on is the screen that carries the arrow home.
  expect(back).toHaveAttribute('href', '/story/little-fox')

  fireEvent.click(back)
  expect(screen.getByTestId('probe')).toHaveTextContent('/story/little-fox {"mission":true}')
})

it('forwards the mission from the result screen to the retell and to the replay', () => {
  renderQuiz('little-fox', true)
  finishQuiz()

  fireEvent.click(screen.getByRole('link', { name: /Kể lại câu chuyện/ }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/story/little-fox/retell {"mission":true}')
})

it('replays the story still in the lesson', () => {
  renderQuiz('little-fox', true)
  finishQuiz()

  fireEvent.click(screen.getByRole('link', { name: 'Nghe lại' }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/story/little-fox {"mission":true}')
})

/** The third exit is the one that leaves the story. In a lesson that is the mission, never the
 * map: the child still has steps to do and `/` is where they lose them. */
it('swaps the way out for the mission when the child is in a lesson', () => {
  renderQuiz('little-fox', true)
  finishQuiz()

  expect(screen.queryByRole('link', { name: /Về bản đồ|Về trang chủ/ })).not.toBeInTheDocument()
  const out = screen.getByRole('link', { name: /Về nhiệm vụ/ })
  expect(out).toHaveAttribute('href', '/mission')
  // The exit keeps the phone sizing the other secondary exit has — it is the same row.
  expect(out).toHaveClass('w-full', 'md:w-auto')
})

/** Free play is byte-identical: no flag, no change to a single target or label. */
it('leaves every free-play exit exactly where it was', () => {
  renderQuiz()
  expect(screen.getByRole('link', { name: 'Truyện' })).toHaveAttribute('href', '/story/little-fox')
  finishQuiz()

  expect(screen.getByRole('link', { name: /Kể lại câu chuyện/ })).toHaveAttribute('href', '/story/little-fox/retell')
  expect(screen.getByRole('link', { name: 'Nghe lại' })).toHaveAttribute('href', '/story/little-fox')
  expect(screen.getByRole('link', { name: /Về bản đồ/ })).toHaveAttribute('href', '/')
  expect(screen.queryByRole('link', { name: /Về nhiệm vụ/ })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('link', { name: /Kể lại câu chuyện/ }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/story/little-fox/retell null')
})
