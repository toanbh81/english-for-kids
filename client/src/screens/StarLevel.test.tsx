import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StarLevel } from './StarLevel'
import { SENTENCE_STARS } from '../content'

function renderLevel() {
  render(<MemoryRouter><StarLevel /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

it('sits in the shared page frame', () => {
  renderLevel()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

it('shows one card per sentence, with its Vietnamese meaning', () => {
  renderLevel()

  expect(screen.getByRole('heading', { name: /Sentence Stars/ })).toBeInTheDocument()
  expect(screen.getByText('Nói cả câu — nhấn đúng chỗ, nối âm mượt!')).toBeInTheDocument()
  expect(SENTENCE_STARS).toHaveLength(10)

  const cards = screen.getAllByRole('link', { name: /^Câu \d/ })
  expect(cards).toHaveLength(10)
  SENTENCE_STARS.forEach((s, i) => {
    const card = screen.getByRole('link', { name: `Câu ${i + 1}: ${s.text}` })
    expect(card).toHaveAttribute('href', `/star/${s.id}`)
    expect(within(card).getByText(s.text)).toBeInTheDocument()
    expect(within(card).getByText(s.vi)).toBeInTheDocument()
  })
})

it('reads the stars off the sentence key', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sstar:ss1': 3, ss2: 2 }))

  renderLevel()

  const first = screen.getByRole('link', { name: `Câu 1: ${SENTENCE_STARS[0].text}` })
  expect(within(first).getAllByTestId('star-filled')).toHaveLength(3)
  const second = screen.getByRole('link', { name: `Câu 2: ${SENTENCE_STARS[1].text}` })
  expect(within(second).queryAllByTestId('star-filled')).toHaveLength(0)
})

it('goes back to the stairs, the bậc Sentence Stars belongs to', () => {
  renderLevel()
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
})
