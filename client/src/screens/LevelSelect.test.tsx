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

it('sits in the shared page frame', () => {
  renderLevel()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

// Fix wave P1: the header now names the bậc from the single band table, not the level content's
// own (English) `title` — "Word Pop" used to be a fourth, divergent source for the same bậc the
// stairs and the mission chip already call "Đọc từ".
it('shows the band name (not the level content title) and one card per practice card', () => {
  renderLevel()
  expect(screen.getByRole('heading', { name: 'Đọc từ' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Word Pop/ })).not.toBeInTheDocument()
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

it('back goes to the stairs and the "Xem các bậc" pill is gone', () => {
  renderLevel('word-pop')
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
  expect(screen.queryByText('🗣️ Xem các bậc')).toBeNull()
})

it('12 small tiles with emoji + word + stars, no lg:', () => {
  renderLevel('word-pop')
  expect(screen.getByText('Chạm vào một thẻ để luyện nói nhé!')).toBeInTheDocument()
  expect(screen.getAllByTestId('tile')).toHaveLength(12)
  expect(screen.getByTestId('list-grid').className).not.toMatch(/\blg:/)
  expect(screen.getAllByTestId('stars')[0]).toHaveClass('text-[13px]')
})

it('shows a not-found message for an unknown level id', () => {
  renderLevel('nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy bậc này 🦊')
  expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/')
})
