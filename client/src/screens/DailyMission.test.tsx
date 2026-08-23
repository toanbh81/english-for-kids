import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { logActivity } from '../progress/activity'
import { DailyMission } from './DailyMission'

const NOW = new Date('2026-08-23T10:00:00').getTime()

function renderMission() {
  render(<MemoryRouter><DailyMission /></MemoryRouter>)
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => {
  vi.useRealTimers()
})

it('lists the three steps with their titles and estimated minutes', () => {
  renderMission()

  expect(screen.getByRole('heading', { name: 'Nhiệm vụ hôm nay 🌞' })).toBeInTheDocument()
  expect(screen.getByText('3 bước nhỏ — khoảng 12 phút thôi!')).toBeInTheDocument()
  expect(screen.getByText('Nghe 1 truyện')).toBeInTheDocument()
  expect(screen.getByText('5 thẻ phát âm')).toBeInTheDocument()
  expect(screen.getByText('3 từ mới')).toBeInTheDocument()
  expect(screen.getByText('≈ 4 phút')).toBeInTheDocument()
  expect(screen.getByText('≈ 5 phút')).toBeInTheDocument()
  expect(screen.getByText('≈ 3 phút')).toBeInTheDocument()
})

it('starts the child on step 1 when nothing is done yet', () => {
  renderMission()

  expect(screen.getByText('Bước 1 · bắt đầu ở đây!')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Bắt đầu 🎧' })).toHaveAttribute('href', '/stories')
})

it('moves the highlight to step 2 once the story is listened to', () => {
  logActivity({ ts: NOW - 1000, kind: 'story', id: 'little-fox' })

  renderMission()

  expect(screen.queryByText('Bước 1 · bắt đầu ở đây!')).not.toBeInTheDocument()
  expect(screen.getByText('Bước 2 · bắt đầu ở đây!')).toBeInTheDocument()
  expect(screen.getByText('✓ Xong')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Bắt đầu 🗣️' })).toHaveAttribute('href', '/level/sound-zoo')
})

it('points at the words step when only that one is left', () => {
  logActivity({ ts: NOW - 1000, kind: 'story', id: 'little-fox' })
  for (let i = 0; i < 5; i++) logActivity({ ts: NOW - 900 + i, kind: 'speak', id: `sz-${i}` })

  renderMission()

  expect(screen.getByText('Bước 3 · bắt đầu ở đây!')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Bắt đầu 🧩' })).toHaveAttribute('href', '/words')
})

it('sends the child back to the map when every step is done', () => {
  logActivity({ ts: NOW - 1000, kind: 'story', id: 'little-fox' })
  for (let i = 0; i < 5; i++) logActivity({ ts: NOW - 900 + i, kind: 'speak', id: `sz-${i}` })
  for (let i = 0; i < 3; i++) logActivity({ ts: NOW - 800 + i, kind: 'word', id: `w-${i}` })

  renderMission()

  expect(screen.queryByText(/bắt đầu ở đây/)).not.toBeInTheDocument()
  expect(screen.getAllByText('✓ Xong')).toHaveLength(3)
  expect(screen.getByRole('link', { name: 'Về bản đồ 🏝️' })).toHaveAttribute('href', '/')
})
