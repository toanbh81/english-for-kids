import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { dayKey, logActivity } from '../progress/activity'
import { Home } from './Home'

const NOW = new Date('2026-08-23T10:00:00').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

function renderHome() {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

/** Logs a full day's worth of mission activity so that day counts as done. */
function seedDoneDay(ts: number) {
  logActivity({ ts, kind: 'story', id: 'little-fox' })
  for (let i = 0; i < 5; i++) logActivity({ ts: ts + i, kind: 'speak', id: `sz-${i}` })
  for (let i = 0; i < 3; i++) logActivity({ ts: ts + i, kind: 'word', id: `w-${i}` })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => {
  vi.useRealTimers()
})

it('shows mission progress from seeded activity and a happy Foxy', () => {
  logActivity({ ts: NOW - 5000, kind: 'story', id: 'little-fox' })
  logActivity({ ts: NOW - 4000, kind: 'speak', id: 'sz-th-three' })
  logActivity({ ts: NOW - 3000, kind: 'speak', id: 'sz-th-thank' })

  renderHome()

  expect(screen.getByText('1 truyện 1/1')).toBeInTheDocument()
  expect(screen.getByText('5 thẻ 2/5')).toBeInTheDocument()
  expect(screen.getByText('3 từ 0/3')).toBeInTheDocument()
  const foxy = screen.getByTestId('foxy')
  expect(foxy).toHaveAttribute('data-mood', 'happy')
  expect(screen.getByText('Giỏi lắm, tiếp tục nhé!')).toBeInTheDocument()
})

it('shows a cheering Foxy once the daily mission is complete', () => {
  seedDoneDay(NOW - 1000)
  renderHome()

  const foxy = screen.getByTestId('foxy')
  expect(foxy).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByText('Hoàn thành nhiệm vụ rồi! 🎉')).toBeInTheDocument()
})

it('shows an idle Foxy greeting with no activity yet', () => {
  renderHome()

  const foxy = screen.getByTestId('foxy')
  expect(foxy).toHaveAttribute('data-mood', 'idle')
  expect(screen.getByText('Chào bé! Hôm nay mình học gì nào?')).toBeInTheDocument()
})

it('rains confetti when the mission is finished, then clears it after 2 s', () => {
  seedDoneDay(NOW - 1000)

  renderHome()

  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(localStorage.getItem('speakup.celebrated')).toBe(dayKey(NOW))

  act(() => { vi.advanceTimersByTime(2000) })

  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
})

it('does not celebrate the same finished mission twice in one day', () => {
  seedDoneDay(NOW - 1000)
  localStorage.setItem('speakup.celebrated', dayKey(NOW))

  renderHome()

  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
})

it('celebrates again on a new day even if yesterday was celebrated', () => {
  seedDoneDay(NOW - 1000)
  localStorage.setItem('speakup.celebrated', dayKey(NOW - DAY_MS))

  renderHome()

  expect(screen.getByTestId('confetti')).toBeInTheDocument()
})

it('shows no confetti while the mission is unfinished', () => {
  logActivity({ ts: NOW, kind: 'story', id: 'little-fox' })

  renderHome()

  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  expect(localStorage.getItem('speakup.celebrated')).toBeNull()
})

it('shows a 3-day streak after three consecutive completed days', () => {
  seedDoneDay(NOW - 2 * DAY_MS)
  seedDoneDay(NOW - DAY_MS)
  seedDoneDay(NOW)

  renderHome()

  expect(screen.getByText('🔥 3 ngày')).toBeInTheDocument()
})

it('shows the time-limit banner once minutes today reach the configured limit', () => {
  localStorage.setItem('speakup.limit.minutes', '1')
  logActivity({ ts: NOW - 3 * 60 * 1000, kind: 'speak', id: 'sz-th-three' })
  logActivity({ ts: NOW, kind: 'speak', id: 'sz-th-thank' })

  renderHome()

  expect(screen.getByTestId('limit-banner')).toHaveTextContent('Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!')
})

it('does not show the time-limit banner under the limit', () => {
  localStorage.setItem('speakup.limit.minutes', '20')
  logActivity({ ts: NOW, kind: 'speak', id: 'sz-th-three' })

  renderHome()

  expect(screen.queryByTestId('limit-banner')).not.toBeInTheDocument()
})

it('links to every module and to the parent area', () => {
  renderHome()

  expect(screen.getByRole('link', { name: /Nghe kể chuyện/ })).toHaveAttribute('href', '/stories')
  expect(screen.getByRole('link', { name: /Sound Zoo/ })).toHaveAttribute('href', '/level/sound-zoo')
  expect(screen.getByRole('link', { name: /Word Pop/ })).toHaveAttribute('href', '/level/word-pop')
  expect(screen.getByRole('link', { name: /Từ vựng/ })).toHaveAttribute('href', '/words')
  expect(screen.getByRole('link', { name: /Ghép câu/ })).toHaveAttribute('href', '/sentences')
  const parentLink = screen.getByRole('link', { name: /Phụ huynh/ })
  expect(parentLink).toHaveAttribute('href', '/parent')
})
