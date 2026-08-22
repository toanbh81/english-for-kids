import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { findStory } from '../content/stories'
import { StoryQuiz } from './StoryQuiz'

function renderQuiz(id = 'little-fox') {
  render(
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

it('shows a not-found message for an unknown story id', () => {
  renderQuiz('nope')
  expect(screen.getByText('Không tìm thấy truyện')).toBeInTheDocument()
})

it('shows the question progress indicator', () => {
  renderQuiz()
  expect(screen.getByText('Câu 1/3')).toBeInTheDocument()
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
})
