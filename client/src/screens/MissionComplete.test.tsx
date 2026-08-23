import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { logActivity } from '../progress/activity'
import { MissionComplete } from './MissionComplete'

const NOW = new Date('2026-08-23T10:00:00').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

function renderDone() {
  render(<MemoryRouter><MissionComplete /></MemoryRouter>)
}

/** Logs a full day's worth of mission activity so that day counts as done. */
function seedDoneDay(ts: number) {
  logActivity({ ts, kind: 'story', id: 'little-fox' })
  for (let i = 0; i < 5; i++) logActivity({ ts: ts + i, kind: 'speak', id: `sz-${i}`, score: 90 })
  for (let i = 0; i < 3; i++) logActivity({ ts: ts + i, kind: 'word', id: `w-${i}`, score: 80 })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => {
  vi.useRealTimers()
})

it('celebrates with confetti, a cheering Foxy and a way back to the map', () => {
  seedDoneDay(NOW - 1000)

  renderDone()

  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByRole('heading', { name: 'Nhiệm vụ hoàn thành! 🎉' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về bản đồ 🏝️' })).toHaveAttribute('href', '/')
})

it("counts today's passing attempts as the stars just earned", () => {
  seedDoneDay(NOW - 1000)
  logActivity({ ts: NOW - 500, kind: 'speak', id: 'sz-miss', score: 40 }) // below the pass bar
  logActivity({ ts: NOW - 2 * DAY_MS, kind: 'speak', id: 'sz-old', score: 95 }) // another day

  renderDone()

  expect(screen.getByText('+8 ⭐')).toBeInTheDocument()
})

it('shows the streak built by consecutive completed days', () => {
  seedDoneDay(NOW - DAY_MS)
  seedDoneDay(NOW - 1000)

  renderDone()

  expect(screen.getByText('🔥 Chuỗi 2 ngày liên tiếp — giỏi lắm!')).toBeInTheDocument()
})
