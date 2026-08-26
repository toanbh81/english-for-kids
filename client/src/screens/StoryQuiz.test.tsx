import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { findStory, STORIES } from '../content/stories'
import { StoryQuiz } from './StoryQuiz'

function renderQuiz(id = 'little-fox') {
  return render(
    <MemoryRouter initialEntries={[`/story/${id}/quiz`]}>
      <Routes>
        <Route path="/story/:id/quiz" element={<StoryQuiz />} />
      </Routes>
    </MemoryRouter>,
  )
}

const story = findStory('little-fox')!

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
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
  expect(screen.getByText('Không tìm thấy truyện')).toBeInTheDocument()
})

it('shows the question progress indicator', () => {
  renderQuiz()
  expect(screen.getByText('Câu 1/3')).toBeInTheDocument()
})

it('offers a way back to the story from the question screen', () => {
  renderQuiz()
  const back = screen.getByRole('link', { name: '← Truyện' })
  expect(back).toHaveAttribute('href', '/story/little-fox')
  expect(back).toHaveClass('min-h-[64px]')
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
  expect(screen.getByRole('link', { name: 'Về bản đồ 🏝️' })).toHaveAttribute('href', '/')
})

/* ---- Phase 10, design §10 M6b: the phone stack, with the landscape row untouched ---- */

/** jsdom has no layout, so these pin *which breakpoint each rule is written at*; the pixel
 * geometry (three cards fully on screen at 390×844 and 375×667) is the browser's job. */
it('stacks the three answers on a phone and keeps the wrapped row from md up', () => {
  const { container } = renderQuiz()
  const deck = screen.getByRole('button', { name: 'cat' }).parentElement!
  expect(deck).toHaveClass('flex', 'w-full', 'flex-1', 'flex-col')
  expect(deck).toHaveClass('md:w-auto', 'md:flex-initial', 'md:flex-row', 'md:flex-wrap', 'md:gap-5')

  for (const label of ['cat', 'fox', 'dog']) {
    const card = screen.getByRole('button', { name: label })
    // Sized by `flex-1` on a phone, so the same rule gives ~178 px at 844 and ~119 px at 667 —
    // both comfortably over the 64 px tap floor, which `min-h-[96px]` guarantees outright.
    expect(card).toHaveClass('w-full', 'flex-1', 'max-md:min-h-[96px]')
    expect(card).toHaveClass('md:h-[270px]', 'md:w-[250px]', 'md:flex-initial')
  }
  expect(container.querySelector('main')).toHaveClass('px-5', 'md:px-6')
})

it('drops Foxy\'s bubble on a phone, where the banner at the foot already says it', () => {
  renderQuiz()
  const q0 = story.quiz[0]
  const wrong = q0.options.findIndex((_, i) => i !== q0.answer)
  fireEvent.click(screen.getByRole('button', { name: q0.options[wrong].label }))
  // Still rendered — and still read by a screen reader at every width — only hidden below 768,
  // because it is what pushed the third answer card under the fold.
  expect(screen.getByText('🦊 Chưa đúng, thử lại nhé').parentElement).toHaveClass('max-md:hidden')
  expect(screen.getByText('Gần đúng rồi — thử lại nhé! 💪')).toBeInTheDocument()
})

it('stacks the three result exits full width on a phone and keeps the row from md up', () => {
  renderQuiz()
  story.quiz.forEach(q => {
    fireEvent.click(screen.getByRole('button', { name: q.options[q.answer].label }))
    act(() => { vi.advanceTimersByTime(900) })
  })
  const row = screen.getByRole('link', { name: 'Nghe lại' }).parentElement!
  expect(row).toHaveClass('w-full', 'flex-col', 'md:w-auto', 'md:flex-row', 'md:flex-wrap', 'md:gap-4')
  for (const name of [/Kể lại câu chuyện/, /^Nghe lại$/, /Về bản đồ/]) {
    // `max-md:` only, so `Button`'s own `min-h-[72px] px-10 text-[26px]` is what 1194 still gets.
    expect(screen.getByRole('link', { name })).toHaveClass('max-md:w-full', 'max-md:min-h-[64px]')
  }
})
