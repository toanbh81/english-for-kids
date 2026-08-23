import { render, screen } from '@testing-library/react'
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
  expect(screen.getByRole('link', { name: 'Về bản đồ' })).toHaveAttribute('href', '/')
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
