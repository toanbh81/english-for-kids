import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const playerControl = vi.hoisted(() => ({ playUrl: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl }))

import { SoundWordList } from './SoundWordList'
import { PHONEME_TIPS } from '../scoring/feedback'
import { findSound, SOUNDS } from '../content'

/** Where a tap landed, and whether it was still carrying `{ mission: true }` — the flag leaves no
 * trace in the DOM, so the probe is the only way to see it. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname} {JSON.stringify(location.state)}</p>
}

function renderList(ph = 'th', mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/sound/${ph}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/sound/:ph" element={<SoundWordList />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
})

it('sits in the shared page frame', () => {
  renderList()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

/** Brief §2 B2: "chip 'Âm 2/9'" in the header — the sound's own place among the 9, same number
 * SoundPractice counts against (`SOUNDS.length`), never the word list's own doing. */
it('heads with the sound’s own place among the 9 sounds', () => {
  renderList()
  expect(screen.getByText(`Âm ${SOUNDS.findIndex(s => s.ph === 'th') + 1}/${SOUNDS.length}`)).toBeInTheDocument()
})

it('heads the list with the sound itself and its mouth tip, via the shared SoundTier', () => {
  renderList()
  expect(screen.getByText('/θ/')).toBeInTheDocument()
  expect(screen.getByText(PHONEME_TIPS.th)).toBeInTheDocument()
  expect(screen.getByTestId('sound-tier')).toHaveClass('md:max-w-[640px]')
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

// --- round-2 grid + Foxy (brief §2 B2 + R21) ---------------------------------------------------

/** Always 3 columns — the phone deck and the iPad one are the same `grid-cols-3`, never swapped
 * for a stretched `md:grid-cols-3` that would pull the tiles apart across the wider column. */
it('lays the words out as a 3-column grid, not a stretched md:grid-cols-3 deck', () => {
  renderList()

  const link = screen.getByRole('link', { name: 'Từ three' })
  expect(link.className).toContain('md:h-[180px]')
  expect(link.className).toContain('md:w-[200px]')

  const grid = link.parentElement!
  expect(grid.className).toContain('grid-cols-3')
  expect(grid.className).not.toMatch(/\bmd:grid-cols-3\b/)
})

/** Round 3 (Phase 14 task 7): the three word tiles are the standard small `Tile`, not a
 * bespoke card — 110 tall on a phone, 200×180 on iPad, word 15/19px, stars 13px. */
it('the three word tiles are the standard small tile, 110 on a phone', () => {
  renderList()
  const tiles = screen.getAllByTestId('tile')
  expect(tiles).toHaveLength(3)
  expect(tiles[0]).toHaveClass('h-[110px]', 'md:h-[180px]', 'md:w-[200px]')
  expect(screen.getByText('three')).toHaveClass('text-[15px]', 'md:text-[19px]')
  expect(screen.getAllByTestId('stars')[0]).toHaveClass('text-[13px]')
})

it('the centre header keeps its Phase 13 chip, not a title/sub header', () => {
  renderList()
  expect(screen.getByText(`Âm ${SOUNDS.findIndex(s => s.ph === 'th') + 1}/${SOUNDS.length}`)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
})

it('prompts to pick a word with Foxy below the grid, and says which prize it earns', () => {
  renderList()
  expect(screen.getByText('Chọn một từ để luyện nhé!')).toBeInTheDocument()
  expect(screen.getByText('Luyện đủ 3 từ để xanh cả âm!')).toBeInTheDocument()
  expect(screen.getByTestId('foxy')).toBeInTheDocument()
})

it('goes back to the stairs', () => {
  renderList()
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
})

it('sends the child on to a word with no mission flag attached', () => {
  renderList()
  fireEvent.click(screen.getByRole('link', { name: 'Từ three' }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/sound/th/sz-th-three null')
})

// --- reached from a lesson persisted before per-word steps existed ----------------------------

/** A lesson saved yesterday still holds `/sound/<ph>` items, so a mission tap can still land here.
 * The list is not a step and shows no "Âm i/n" mission chip — but it must not be a dead end
 * either: the child gets their way back to the mission, and the flag rides on into the word they
 * pick. */
it('offers the way back to the mission when a stale lesson step lands here', () => {
  renderList('th', true)

  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
  expect(screen.queryByRole('link', { name: 'Các bậc' })).not.toBeInTheDocument()
})

it('carries the mission flag on into the word the child picks', () => {
  renderList('th', true)
  fireEvent.click(screen.getByRole('link', { name: 'Từ thank' }))

  expect(screen.getByTestId('probe')).toHaveTextContent('/sound/th/sz-th-thank {"mission":true}')
})

it('shows a not-found message for a phoneme that has no group', () => {
  renderList('nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy âm này 🦊')
})
