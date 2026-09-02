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
  expect(screen.getAllByText('0/8 đã mở khoá')).toHaveLength(4)
  expect(screen.getByText('Ôn tập hôm nay (0)')).toBeInTheDocument()

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
  expect(screen.getByText('1/8 đã mở khoá')).toBeInTheDocument()
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
