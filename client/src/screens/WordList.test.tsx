import { render, screen } from '@testing-library/react'
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

it('shows a not-found message for an unknown topic', () => {
  renderList('nope')
  expect(screen.getByText('Không tìm thấy chủ đề')).toBeInTheDocument()
})

it('lists all 8 words of a topic, locked by default', () => {
  renderList('food')
  expect(screen.getByText('apple')).toBeInTheDocument()
  expect(screen.getAllByText('🔒')).toHaveLength(8)
})

it('shows 🔓 for an unlocked word', () => {
  promote('food-apple')
  renderList('food')
  expect(screen.getAllByText('🔓')).toHaveLength(1)
  expect(screen.getAllByText('🔒')).toHaveLength(7)
})

it('links each word card to /words/:topic/:wordId', () => {
  renderList('food')
  expect(screen.getByRole('link', { name: /apple/ })).toHaveAttribute('href', '/words/food/food-apple')
})

it('review topic with no due words shows the empty-state message', () => {
  renderList('review')
  expect(screen.getByText('Chưa có từ cần ôn hôm nay 🎉')).toBeInTheDocument()
})

it('review topic lists due words across all topics', () => {
  const past = Date.now() - 2 * 24 * 60 * 60 * 1000
  promote('food-apple', past)
  promote('school-book', past)
  renderList('review')
  expect(screen.getByText('apple')).toBeInTheDocument()
  expect(screen.getByText('book')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /apple/ })).toHaveAttribute('href', '/words/review/food-apple')
})
