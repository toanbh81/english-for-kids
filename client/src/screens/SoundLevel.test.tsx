import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SoundLevel } from './SoundLevel'
import { SOUNDS } from '../content'

function renderLevel() {
  render(<MemoryRouter><SoundLevel /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

it('shows one tile per sound, with its IPA symbol and an example word', () => {
  renderLevel()

  expect(screen.getByRole('heading', { name: /Tập âm/ })).toBeInTheDocument()
  expect(SOUNDS).toHaveLength(9)
  for (const s of SOUNDS) {
    const tile = screen.getByRole('link', { name: new RegExp(`Âm ${s.ipa}`) })
    expect(tile).toHaveAttribute('href', `/sound/${s.ph}`)
    expect(within(tile).getByText(`/${s.ipa}/`)).toBeInTheDocument()
    expect(within(tile).getByText(s.example)).toBeInTheDocument()
  }
})

/** A tile means "all three words are green", so it shows the sound's WEAKEST word — one lucky
 * card must not fill it, and the legacy per-card `sz-*` key is not a word's stars at all. */
it('reads the stars off the sound’s words, not off one lucky card', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({
    'sword:sz-th-three': 3, 'sword:sz-th-thank': 2, 'sword:sz-th-think': 3,
    'sword:sz-dh-this': 3, 'sz-dh-that': 3,
  }))

  renderLevel()

  const th = screen.getByRole('link', { name: /Âm θ/ })
  expect(within(th).getAllByTestId('star-filled')).toHaveLength(2)
  // Only one of ð's three words is done, so the sound is still empty.
  const dh = screen.getByRole('link', { name: /Âm ð/ })
  expect(within(dh).queryAllByTestId('star-filled')).toHaveLength(0)
})

/** Phase 9 stopped writing `sound:<ph>`, but a child who finished the old 3-word run still has it
 * — the tile keeps that as a floor rather than resetting them to zero. */
it('still honours a legacy sound key as a floor', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3 }))
  renderLevel()

  const th = screen.getByRole('link', { name: /Âm θ/ })
  expect(within(th).getAllByTestId('star-filled')).toHaveLength(3)
})

it('goes back to the stairs, the bậc Tập âm belongs to', () => {
  renderLevel()
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
})
