import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LevelSelect } from './LevelSelect'

function renderLevel(levelId = 'word-pop') {
  render(
    <MemoryRouter initialEntries={[`/level/${levelId}`]}>
      <Routes>
        <Route path="/level/:levelId" element={<LevelSelect />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())

it('shows the level title and one card per practice card', () => {
  renderLevel()
  expect(screen.getByRole('heading', { name: /Word Pop/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /cat/ })).toHaveAttribute('href', '/practice/wp-cat')
})

it('hands Tập âm over to the sound-tile screen instead of listing its 27 cards', () => {
  renderLevel('sound-zoo')
  expect(screen.getByRole('heading', { name: /Tập âm/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Âm θ/ })).toHaveAttribute('href', '/sound/th')
  // 9 sound tiles, not the 27 word cards: nothing here links straight into `/practice`.
  expect(screen.getAllByRole('link', { name: /^Âm / })).toHaveLength(9)
  expect(screen.queryAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/practice'))).toHaveLength(0)
})

it('goes back to the map, the entry point the child actually came from', () => {
  renderLevel()
  expect(screen.getByRole('link', { name: /Về bản đồ/ })).toHaveAttribute('href', '/')
})

// Spec decision 1: Home drops the island map below the tablet breakpoint, so the back arrow cannot
// name a map there — not even to a screen reader. `BackButton`'s `mdLabel` puts both wordings in
// the DOM as `sr-only` spans and lets the breakpoint take one out of the accessibility tree.
it('names the phone destination and the map one at their own breakpoints', () => {
  renderLevel()

  const back = screen.getByRole('link', { name: /Về bản đồ/ })
  // No `aria-label`: it is one string and could only ever say one of the two.
  expect(back).not.toHaveAttribute('aria-label')
  expect(within(back).getByText('Về trang chủ')).toHaveClass('sr-only', 'md:hidden')
  expect(within(back).getByText('Về bản đồ')).toHaveClass('sr-only', 'hidden', 'md:inline')
})

it('offers the stairs as a second way into the other levels', () => {
  renderLevel()
  // `/levels` has no island of its own on the map, so this chip is what keeps it reachable.
  const stairs = screen.getByRole('link', { name: /Xem các bậc/ })
  expect(stairs).toHaveAttribute('href', '/levels')
  expect(stairs).toHaveClass('min-h-[64px]')
})

it('shows a not-found message for an unknown level id', () => {
  renderLevel('nope')
  expect(screen.getByText('Không tìm thấy')).toBeInTheDocument()
})
