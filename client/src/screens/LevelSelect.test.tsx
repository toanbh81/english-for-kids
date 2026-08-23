import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LevelSelect } from './LevelSelect'

function renderLevel(levelId = 'sound-zoo') {
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
  expect(screen.getByRole('heading', { name: /Sound Zoo/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /three/ })).toHaveAttribute('href', '/practice/sz-th-three')
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
