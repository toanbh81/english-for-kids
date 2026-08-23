import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LevelStairs } from './LevelStairs'

function renderStairs() {
  render(<MemoryRouter><LevelStairs /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

it('links the two playable levels and shows the other three as locked', () => {
  renderStairs()
  expect(screen.getByRole('link', { name: /Sound Zoo/ })).toHaveAttribute('href', '/level/sound-zoo')
  expect(screen.getByRole('link', { name: /Word Pop/ })).toHaveAttribute('href', '/level/word-pop')

  expect(screen.getAllByText('Sắp có')).toHaveLength(3)
  for (const name of ['Minimal Pairs', 'Sentence Stars', 'Story Voice']) {
    expect(screen.getByText(name)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: new RegExp(name) })).not.toBeInTheDocument()
  }
})

it('stands Foxy on the first step that is not finished yet', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 3 }))
  renderStairs()
  // Sound Zoo has 3 stars on a card, so it is done and Foxy moves on to Word Pop.
  expect(within(screen.getByTestId('step-word-pop')).getByTestId('foxy')).toBeInTheDocument()
})

it('keeps Foxy off the locked steps once both playable levels are finished', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 3, 'wp-cat': 3 }))
  renderStairs()
  // Nothing is left to climb, so he waits on the last level he can actually play.
  expect(within(screen.getByTestId('step-word-pop')).getByTestId('foxy')).toBeInTheDocument()
  for (const key of ['minimal-pairs', 'sentence-stars', 'story-voice']) {
    expect(within(screen.getByTestId(`step-${key}`)).queryByTestId('foxy')).not.toBeInTheDocument()
  }
})
