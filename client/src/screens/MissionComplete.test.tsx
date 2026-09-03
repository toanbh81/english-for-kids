import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { logActivity } from '../progress/activity'
import { MissionComplete } from './MissionComplete'

const NOW = new Date('2026-08-23T10:00:00').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

function renderDone(opts: { starsToday?: number; streak?: number } = {}) {
  const { starsToday = 0, streak: streakDays } = opts
  // One passing 'word' event per star — the component's own star count (Phase 12) only reads
  // today's passing speak/word/sentence attempts, so this alone drives starsToday without also
  // satisfying `dayIsDone` (which needs a story too), which would otherwise seed an unwanted streak.
  for (let i = 0; i < starsToday; i++) {
    logActivity({ ts: NOW - 1000 - i, kind: 'word', id: `star-${i}`, score: 90 })
  }
  if (streakDays) {
    for (let d = 1; d <= streakDays; d++) seedDoneDay(NOW - d * DAY_MS + 1000)
  }
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

it('sits in the shared page frame', () => {
  renderDone()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
  expect(screen.getByRole('contentinfo')).not.toHaveClass('sticky', 'fixed')
})

it('celebrates with confetti, a cheering Foxy and a way back to the map', () => {
  seedDoneDay(NOW - 1000)

  renderDone()

  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByRole('heading', { name: 'Nhiệm vụ hoàn thành! 🎉' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Về bản đồ 🏝️/ })).toHaveAttribute('href', '/')
})

// Spec decision 1: Home drops the island map below the tablet breakpoint, so the way out of the
// celebration cannot promise a map there. Both wordings are in the DOM and the breakpoint picks one.
it('offers the map on a tablet and the home screen on a phone', () => {
  seedDoneDay(NOW - 1000)

  renderDone()

  const back = screen.getByRole('link', { name: /Về bản đồ 🏝️/ })
  expect(back).toHaveAttribute('href', '/')
  expect(within(back).getByText('Về trang chủ 🏠')).toHaveClass('ipad:hidden')
  expect(within(back).getByText('Về bản đồ 🏝️')).toHaveClass('hidden', 'ipad:inline')
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

/**
 * `text-2xl` sets a 32 px line-height as well as a 24 px size, and the phone pass restored only
 * the size — so at 1194×834 the pill came out 56 px tall instead of the 69 it has always been, and
 * the whole centred stack moved with it (mascot and title 6 px down, streak line and CTA 7 px up).
 * jsdom cannot lay that out, so the guard is on the class list: any `md:text-[...]` restore of a
 * `text-<scale>` phone value has to restate the leading it is stepping on.
 */
it('restores the iPad leading, not just the size, on the star pill', () => {
  seedDoneDay(NOW - 1000)

  renderDone()

  const pill = screen.getByText(/^\+\d+ ⭐$/)
  expect(pill).toHaveClass('text-2xl', 'md:text-[30px]', 'md:leading-normal')
})

// Spec decision 20 (Task 11): a mission that closed with zero stars is still a mission closed —
// the screen stops celebrating (no confetti, no cheering Foxy) without turning into a failure page.
it('0 stars: happy Foxy, no confetti, a white card instead of the +n pill, a two-line H1', () => {
  renderDone({ starsToday: 0 })

  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'happy')
  expect(screen.queryByTestId('confetti')).toBeNull()
  expect(screen.queryByText('+0 ⭐')).toBeNull()
  expect(screen.getByText('Mai làm lại để lấy ⭐ nhé')).toHaveClass('rounded-r18', 'bg-white', 'text-[18px]', 'text-ink-500', 'shadow-card-sm')
  const h1 = screen.getByRole('heading', { level: 1 })
  expect(h1).toHaveTextContent('Xong nhiệm vụ rồi! 🦊Con đã rất cố gắng.')
})

it('≥1 star keeps the Phase 12 celebration exactly', () => {
  renderDone({ starsToday: 2 })

  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(screen.getByText('+2 ⭐')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nhiệm vụ hoàn thành! 🎉')
})

it('a zero streak gets its own line', () => {
  renderDone({ starsToday: 0, streak: 0 })

  expect(screen.getByText('🔥 Bắt đầu chuỗi mới từ hôm nay!')).toBeInTheDocument()
  expect(screen.queryByText(/Chuỗi 0 ngày/)).toBeNull()
})

it('the whole column still fits 667 without scrolling (no fixed heights added)', () => {
  renderDone({ starsToday: 0, streak: 0 })

  expect(screen.getByTestId('page-body')).toHaveClass('justify-center')
})
