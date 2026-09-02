import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VoiceLevel } from './VoiceLevel'
import { STORY_VOICE } from '../content'

function renderLevel() {
  render(<MemoryRouter><VoiceLevel /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

it('sits in the shared page frame', () => {
  renderLevel()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

it('shows one card per passage, with its mood and opening line', () => {
  renderLevel()

  expect(screen.getByRole('heading', { name: /Story Voice/ })).toBeInTheDocument()
  expect(screen.getByText('Đọc có hồn — vui, buồn, ngạc nhiên!')).toBeInTheDocument()
  expect(STORY_VOICE).toHaveLength(8)

  const cards = screen.getAllByRole('link', { name: /^Đoạn \d/ })
  expect(cards).toHaveLength(8)
  STORY_VOICE.forEach((v, i) => {
    const card = screen.getByRole('link', { name: `Đoạn ${i + 1}: ${v.moodVi}` })
    expect(card).toHaveAttribute('href', `/voice/${v.id}`)
    expect(within(card).getByText(v.moodVi)).toBeInTheDocument()
    // Only the first sentence, so every card stays the same height.
    expect(within(card).getByText(v.text.split(/(?<=[.!?])\s+/)[0])).toBeInTheDocument()
  })
})

it('reads the stars off the passage key', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'voice:sv1': 3, sv2: 2 }))

  renderLevel()

  const first = screen.getByRole('link', { name: `Đoạn 1: ${STORY_VOICE[0].moodVi}` })
  expect(within(first).getAllByTestId('star-filled')).toHaveLength(3)
  const second = screen.getByRole('link', { name: `Đoạn 2: ${STORY_VOICE[1].moodVi}` })
  expect(within(second).queryAllByTestId('star-filled')).toHaveLength(0)
})

it('goes back to the stairs, the bậc Story Voice belongs to', () => {
  renderLevel()
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
})
