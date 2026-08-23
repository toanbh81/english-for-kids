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

it('reads the stars off the sound key, not off the individual word cards', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 2, 'sz-dh-this': 3 }))

  renderLevel()

  const th = screen.getByRole('link', { name: /Âm θ/ })
  expect(within(th).getAllByTestId('star-filled')).toHaveLength(2)
  const dh = screen.getByRole('link', { name: /Âm ð/ })
  expect(within(dh).queryAllByTestId('star-filled')).toHaveLength(0)
})

it('goes back to the stairs, the bậc Tập âm belongs to', () => {
  renderLevel()
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
})
