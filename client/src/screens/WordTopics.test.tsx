import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

beforeEach(() => localStorage.clear())

it('shows the 5 topic cards with unlocked counts and the review card', () => {
  renderTopics()
  expect(screen.getByText('Động vật')).toBeInTheDocument()
  expect(screen.getByText('Đồ ăn')).toBeInTheDocument()
  expect(screen.getByText('Trường học')).toBeInTheDocument()
  expect(screen.getByText('Gia đình')).toBeInTheDocument()
  expect(screen.getByText('Thời tiết')).toBeInTheDocument()
  expect(screen.getAllByText('0/8 đã mở khoá')).toHaveLength(5)
  expect(screen.getByText('Ôn tập hôm nay (0)')).toBeInTheDocument()
})

it('reflects unlocked words in a topic', () => {
  promote('food-apple')
  renderTopics()
  expect(screen.getByText('1/8 đã mở khoá')).toBeInTheDocument()
})

it('links each topic card to /words/:topic and the review card to /words/review', () => {
  renderTopics()
  expect(screen.getByRole('link', { name: /Đồ ăn/ })).toHaveAttribute('href', '/words/food')
  expect(screen.getByRole('link', { name: /Ôn tập hôm nay/ })).toHaveAttribute('href', '/words/review')
})

it('offers a way back home', () => {
  renderTopics()
  expect(screen.getByRole('link', { name: 'Về nhà' })).toHaveAttribute('href', '/')
})
