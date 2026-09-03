import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { WordList } from './WordList'
import { promote } from '../progress/leitner'

function renderList(topic: string) {
  render(
    <MemoryRouter initialEntries={[`/words/${topic}`]}>
      <Routes>
        <Route path="/words/:topic" element={<WordList />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())

it('a topic list is a 3-column small-tile grid with a counted subtitle and no lg:', () => {
  renderList('food')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('🍎 Đồ ăn')
  expect(screen.getByText('8 từ · chạm để học')).toBeInTheDocument()
  expect(screen.getByTestId('list-grid')).toHaveClass('grid-cols-3', 'md:grid-cols-5', 'ipad:grid-cols-6')
  expect(screen.getAllByTestId('tile')).toHaveLength(8)
  expect(screen.getByTestId('page-body')).toHaveClass('gap-2.5', 'after:sticky')
  expect(screen.queryAllByTestId('sticky-group')).toHaveLength(0)
})

it('a word tile shows emoji, word and the lock chip, never stars', () => {
  promote('food-apple')
  renderList('food')
  const tile = screen.getByRole('link', { name: /apple/ })
  expect(tile).toHaveClass('h-[110px]', 'md:h-[136px]')
  expect(tile).toHaveAttribute('href', '/words/food/food-apple')
  expect(screen.getAllByText('🔓')).toHaveLength(1)
  expect(screen.getAllByText('🔒')).toHaveLength(7)
  expect(screen.queryByTestId('stars')).toBeNull()
})

it('the review deck groups due words by topic in TOPICS order, with sticky H2s', () => {
  // `promote` sets `due` a day+ in the future, so these three must be back-dated far enough that
  // it still lands in the past — pass `now` as two days ago (brief note under Step 1).
  const past = Date.now() - 2 * 24 * 3600e3
  promote('food-apple', past)
  promote('animals-elephant', past)
  promote('animals-giraffe', past)
  renderList('review')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('📚 Ôn tập hôm nay')
  expect(screen.getByText('3 từ · chạm để ôn')).toBeInTheDocument()
  const groups = screen.getAllByTestId('sticky-group')
  expect(groups.map(h => h.textContent)).toEqual(['🐘Động vật· 2 từ', '🍎Đồ ăn· 1 từ'])
  expect(groups[0]).toHaveClass('sticky', 'top-0', 'bg-cream-50')
  expect(screen.getByRole('link', { name: /apple/ })).toHaveAttribute('href', '/words/review/food-apple')
})

it('the empty state exists only on the review deck', () => {
  renderList('review')
  expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  cleanup()
  renderList('food')
  expect(screen.queryByTestId('empty-state')).toBeNull()
})

it('shows a not-found message for an unknown topic', () => {
  renderList('nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy chủ đề này 🦊')
  expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/words')
})

// A map topic was reached from its island, so that is where back goes; the flat word index is only
// the review deck's home now.
it('sends a map topic back to its island, and the review deck to the word index', () => {
  renderList('food')
  expect(screen.getByRole('link', { name: 'Đồ ăn' })).toHaveAttribute('href', '/topic/food')

  cleanup()
  renderList('review')
  expect(screen.getByRole('link', { name: 'Từ vựng' })).toHaveAttribute('href', '/words')
})
