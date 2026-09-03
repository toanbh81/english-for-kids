import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TOPICS } from '../content/words'
import { WordTopics } from './WordTopics'
import { promote } from '../progress/leitner'

function renderTopics() {
  render(
    <MemoryRouter initialEntries={['/words']}>
      <Routes>
        <Route path="/words" element={<WordTopics />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Unlocks a deck the way the map does: six of its eight words in the Leitner box. */
function openDeck(id: string) {
  const deck = TOPICS.find(t => t.id === id)!
  deck.words.slice(0, 6).forEach(w => promote(w.id))
}

beforeEach(() => localStorage.clear())

it('sits in the shared page frame', () => {
  renderTopics()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

it('lists only the topics the map has unlocked, plus the review card', () => {
  renderTopics()

  // The first four islands are open from the start (Phase 9 §3).
  for (const name of ['Động vật', 'Đồ ăn', 'Trường học', 'Gia đình']) {
    expect(screen.getByText(name)).toBeInTheDocument()
  }
  expect(screen.getAllByText('0/8 mở')).toHaveLength(4)
  expect(screen.getByText('Ôn tập')).toBeInTheDocument()
  expect(screen.getByText('Chưa có từ ôn')).toBeInTheDocument()

  // Everything behind the fourth island is still locked, and this screen is not a way in.
  for (const name of ['Thời tiết', 'Màu sắc', 'Cơ thể', 'Đồ chơi']) {
    expect(screen.queryByText(name)).not.toBeInTheDocument()
  }
})

it('shows a topic as soon as the map opens it', () => {
  openDeck('family')
  renderTopics()

  expect(screen.getByText('Thời tiết')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Thời tiết/ })).toHaveAttribute('href', '/words/weather')
  expect(screen.queryByText('Màu sắc')).not.toBeInTheDocument()
})

it('reflects unlocked words in a topic', () => {
  promote('animals-elephant')
  renderTopics()
  expect(screen.getByText('1/8 mở')).toBeInTheDocument()
})

it('links the topic card to /words/:topic and the review card to /words/review', () => {
  renderTopics()
  expect(screen.getByRole('link', { name: /Động vật/ })).toHaveAttribute('href', '/words/animals')
  expect(screen.getByRole('link', { name: /Ôn tập hôm nay/ })).toHaveAttribute('href', '/words/review')
})

it('no longer counts the day\'s new words in the header', () => {
  renderTopics()
  expect(screen.getByRole('heading', { name: 'Từ mới hôm nay 🧩' })).toBeInTheDocument()
  expect(screen.queryByText('0/3')).not.toBeInTheDocument()
})

it('offers a way back home', () => {
  renderTopics()
  expect(screen.getByRole('link', { name: 'Về nhà' })).toHaveAttribute('href', '/')
})

it('the review tile is the accent tile with a solid-coral count chip', () => {
  renderTopics()
  const tile = screen.getByRole('link', { name: /Ôn tập/ })
  expect(tile).toHaveClass('bg-sun-50', 'shadow-[0_5px_0_#EFDDA8]')
  expect(screen.queryByText('0 từ hôm nay')).not.toBeInTheDocument()
  expect(screen.getByText('Chưa có từ ôn')).toHaveClass('bg-cream-50', 'text-ink-500')
  expect(tile).toHaveAttribute('href', '/words/review')
})

it('with due words the chip is coralSolid', () => {
  promote('food-apple', Date.now() - 2 * 24 * 3600e3)
  renderTopics()
  expect(screen.getByText('1 từ hôm nay')).toHaveClass('bg-coral-500', 'text-white')
})

it('a topic tile carries a "n/8 mở" sun chip and the subtitle moved into the header', () => {
  renderTopics()
  expect(screen.getByText(/^\d+ chủ đề đã mở · chạm để học$/)).toBeInTheDocument()
  expect(screen.queryByText('Chạm thẻ để lật — nói đúng để mở khoá!')).toBeNull()
  expect(screen.getAllByText('0/8 mở')[0]).toHaveClass('text-[11px]', 'md:text-[13px]')
  expect(screen.getByTestId('list-grid')).toHaveClass('grid-cols-3', 'md:grid-cols-5', 'ipad:grid-cols-6')
})
