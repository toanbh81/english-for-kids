import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { TopicId } from '../content/topics'
import { findTopic } from '../content/words'
import { setStars } from '../progress/store'
import { TopicHub } from './TopicHub'

function renderHub(id: string) {
  render(
    <MemoryRouter initialEntries={[`/topic/${id}`]}>
      <Routes>
        <Route path="/topic/:id" element={<TopicHub />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Puts the first `n` words of a topic's deck in Leitner box 1 — the unlock and star currency. */
function unlockWords(topic: TopicId, n: number) {
  const deck = findTopic(topic)?.words ?? []
  const raw: Record<string, { box: number; due: number }> =
    JSON.parse(localStorage.getItem('speakup.leitner') ?? '{}')
  for (const w of deck.slice(0, n)) raw[w.id] = { box: 1, due: 0 }
  localStorage.setItem('speakup.leitner', JSON.stringify(raw))
}

beforeEach(() => localStorage.clear())

it('shows the topic header, its stars and the three sections', () => {
  unlockWords('animals', 6)
  setStars('sentence:s13', 2)

  renderHub('animals')

  expect(screen.getByRole('heading', { name: 'Động vật' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Về nhà/ })).toHaveAttribute('href', '/')

  const words = screen.getByRole('link', { name: /Từ mới/ })
  expect(words).toHaveAttribute('href', '/words/animals')
  expect(within(words).getByText('6/8 từ')).toBeInTheDocument()

  const sentences = screen.getByRole('link', { name: /Ghép câu/ })
  expect(sentences).toHaveAttribute('href', '/sentences?topic=animals')
  expect(within(sentences).getByText('1/4 câu có sao')).toBeInTheDocument()
})

it('lists the topic stories with their stars', () => {
  setStars('story:little-fox', 3)

  renderHub('animals')

  const story = screen.getByRole('link', { name: /Chú cáo nhỏ/ })
  expect(story).toHaveAttribute('href', '/story/little-fox')
  expect(within(story).getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByRole('link', { name: /Ở sở thú/ })).toHaveAttribute('href', '/story/at-the-zoo')
  expect(screen.queryByText('Sắp có 📖')).not.toBeInTheDocument()
})

it('shows a muted "Sắp có" card, not a link, for a topic with no story yet', () => {
  unlockWords('animals', 6)
  unlockWords('food', 6)

  renderHub('school')

  expect(screen.getByText('Sắp có 📖')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Truyện/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link').map(a => a.getAttribute('href')))
    .toEqual(['/', '/words/school', '/sentences?topic=school'])
})

it('counts only the unlocked words of the topic', () => {
  unlockWords('animals', 3)

  renderHub('animals')

  expect(screen.getByText('3/8 từ')).toBeInTheDocument()
  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
})

it('shows the locked screen for a topic the child has not reached', () => {
  renderHub('weather')

  expect(screen.getByRole('heading', { name: 'Chưa mở khóa' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Về nhà/ })).toHaveAttribute('href', '/')
  expect(screen.queryByRole('link', { name: /Từ mới/ })).not.toBeInTheDocument()
})

it('shows the locked screen for an unknown topic id', () => {
  renderHub('dinosaurs')

  expect(screen.getByRole('heading', { name: 'Chưa mở khóa' })).toBeInTheDocument()
})
