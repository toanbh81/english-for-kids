import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const playerControl = vi.hoisted(() => ({ playUrl: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl }))

import { SoundWordList } from './SoundWordList'
import { PHONEME_TIPS } from '../scoring/feedback'
import { findSound } from '../content'

function renderList(ph = 'th') {
  render(
    <MemoryRouter initialEntries={[`/sound/${ph}`]}>
      <Routes>
        <Route path="/sound/:ph" element={<SoundWordList />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
})

it('heads the list with the sound itself and its mouth tip', () => {
  renderList()
  expect(screen.getByText('/θ/')).toBeInTheDocument()
  expect(screen.getByText(PHONEME_TIPS.th)).toBeInTheDocument()
})

it('shows one card per word of the sound, each linking to its own drill', () => {
  renderList()

  const cards = findSound('th')!.cards
  expect(cards).toHaveLength(3)
  for (const c of cards) {
    const link = screen.getByRole('link', { name: `Từ ${c.text}` })
    expect(link).toHaveAttribute('href', `/sound/th/${c.id}`)
    expect(within(link).getByText(c.text)).toBeInTheDocument()
    expect(within(link).getByText(c.ipa)).toBeInTheDocument()
  }
})

it('gives every word its own stars', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sword:sz-th-three': 3, 'sword:sz-th-thank': 1 }))
  renderList()

  expect(within(screen.getByRole('link', { name: 'Từ three' })).getAllByTestId('star-filled')).toHaveLength(3)
  expect(within(screen.getByRole('link', { name: 'Từ thank' })).getAllByTestId('star-filled')).toHaveLength(1)
  expect(within(screen.getByRole('link', { name: 'Từ think' })).queryAllByTestId('star-filled')).toHaveLength(0)
})

/** The sound's own key is the *sound's* score, never a word's — showing it on all three cards
 * would tell the child words they have not touched are already done. */
it('does not spend the legacy sound key on the individual words', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3 }))
  renderList()

  for (const name of ['Từ three', 'Từ thank', 'Từ think']) {
    expect(within(screen.getByRole('link', { name })).queryAllByTestId('star-filled')).toHaveLength(0)
  }
})

it('plays the sound on its own, and says so when that sample is missing', async () => {
  playerControl.playUrl.mockReturnValue(new Promise<void>(() => {})) // still playing: no state change yet
  renderList()
  fireEvent.click(screen.getByRole('button', { name: /nghe âm lẻ/i }))
  expect(playerControl.playUrl).toHaveBeenCalledWith('/audio/sounds/th.mp3')

  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  fireEvent.click(screen.getByRole('button', { name: /nghe âm lẻ/i }))
  await screen.findByText('Chưa có audio âm này')
})

it('goes back to the stairs', () => {
  renderList()
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
})

it('shows a not-found message for a phoneme that has no group', () => {
  renderList('nope')
  expect(screen.getByText('Không tìm thấy âm')).toBeInTheDocument()
})
