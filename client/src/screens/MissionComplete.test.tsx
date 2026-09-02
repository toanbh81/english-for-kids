import { render, screen, within } from '@testing-library/react'
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
  expect(within(back).getByText('Về trang chủ 🏠')).toHaveClass('md:hidden')
  expect(within(back).getByText('Về bản đồ 🏝️')).toHaveClass('hidden', 'md:inline')
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
