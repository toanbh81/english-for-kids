import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LevelStairs } from './LevelStairs'

function renderStairs() {
  render(<MemoryRouter><LevelStairs /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

it('links the three playable levels and shows the other two as locked', () => {
  renderStairs()
  expect(screen.getByRole('link', { name: /Tập âm/ })).toHaveAttribute('href', '/level/sound-zoo')
  expect(screen.getByRole('link', { name: /Đọc từ/ })).toHaveAttribute('href', '/level/word-pop')
  expect(screen.getByRole('link', { name: /Nghe & chọn/ })).toHaveAttribute('href', '/level/minimal-pairs')

  expect(screen.getAllByText('Sắp có')).toHaveLength(2)
  for (const name of ['Sentence Stars', 'Story Voice']) {
    expect(screen.getByText(name)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: new RegExp(name) })).not.toBeInTheDocument()
  }
})

it('reads the Nghe & chọn stars off the pair keys, not off any word card', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'pair:pair-ship-sheep': 2, 'pair:pair-cap-cup': 1 }))
  renderStairs()

  // The best of the eight pairs is what the step shows.
  const step = within(screen.getByTestId('step-minimal-pairs'))
  expect(step.getAllByTestId('star-filled')).toHaveLength(2)
  // Tập âm is unaffected by a pair key.
  expect(within(screen.getByTestId('step-sound-zoo')).queryAllByTestId('star-filled')).toHaveLength(0)
})

it('stands Foxy on the first step that is not finished yet', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 3 }))
  renderStairs()
  // Tập âm has 3 stars on a card, so it is done and Foxy moves on to Đọc từ.
  expect(within(screen.getByTestId('step-word-pop')).getByTestId('foxy')).toBeInTheDocument()
})

it('moves Foxy on to Nghe & chọn once the two word levels are done', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 3, 'wp-cat': 3 }))
  renderStairs()
  expect(within(screen.getByTestId('step-minimal-pairs')).getByTestId('foxy')).toBeInTheDocument()
})

it('keeps Foxy off the locked steps once every playable level is finished', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 3, 'wp-cat': 3, 'pair:pair-ship-sheep': 3 }))
  renderStairs()
  // Nothing is left to climb, so he waits on a level he can actually play.
  expect(within(screen.getByTestId('step-word-pop')).getByTestId('foxy')).toBeInTheDocument()
  for (const key of ['sentence-stars', 'story-voice']) {
    expect(within(screen.getByTestId(`step-${key}`)).queryByTestId('foxy')).not.toBeInTheDocument()
  }
})
