import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Confetti } from './Confetti'
import { Foxy } from './Foxy'
import { MissionCard } from './MissionCard'
import { StreakWeek } from './StreakWeek'
import { WeekDots } from './ui/WeekDots'

describe('Foxy', () => {
  it('draws the mascot and reports its mood', () => {
    const { rerender } = render(<Foxy mood="happy" />)
    const foxy = screen.getByTestId('foxy')
    expect(foxy).toHaveAttribute('data-mood', 'happy')
    // The drawing is decorative — it must not turn up in the accessibility tree.
    expect(foxy.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    rerender(<Foxy mood="cheer" say="Giỏi quá!" />)
    expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
    expect(screen.getByText('Giỏi quá!')).toBeInTheDocument()
  })

  it('grows with the size prop', () => {
    const { rerender } = render(<Foxy mood="idle" size="sm" />)
    expect(screen.getByTestId('foxy').querySelector('svg')).toHaveAttribute('width', '64')

    rerender(<Foxy mood="idle" size="lg" />)
    expect(screen.getByTestId('foxy').querySelector('svg')).toHaveAttribute('width', '160')
  })

  it('has no speech bubble when say is omitted', () => {
    render(<Foxy mood="idle" />)
    expect(screen.queryByText(/./, { selector: '[data-testid="foxy-bubble"]' })).not.toBeInTheDocument()
  })
})

describe('MissionCard', () => {
  function renderCard(status: { doneCount: number; total: number; done: boolean }) {
    render(<MemoryRouter><MissionCard status={status} /></MemoryRouter>)
  }

  it('shows how far through today lesson the child is, and the way into it', () => {
    renderCard({ doneCount: 3, total: 10, done: false })
    expect(screen.getByText('🌞 Nhiệm vụ hôm nay')).toBeInTheDocument()
    expect(screen.getByText('3/10')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
    expect(screen.getByRole('link', { name: 'Tiếp tục ▸' })).toHaveAttribute('href', '/mission')
  })

  // "Bắt đầu" is a promise about the lesson, not about the tap: a child who has already done two
  // steps is carrying on, and the card must say so (spec §2).
  it('says Bắt đầu on an untouched lesson and Tiếp tục once a step is done', () => {
    const { unmount } = render(<MemoryRouter><MissionCard status={{ doneCount: 0, total: 10, done: false }} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Bắt đầu ▸' })).toHaveAttribute('href', '/mission')
    unmount()

    renderCard({ doneCount: 1, total: 10, done: false })
    expect(screen.getByRole('link', { name: 'Tiếp tục ▸' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bắt đầu ▸' })).not.toBeInTheDocument()
  })

  it('celebrates when the whole lesson is done and offers a replay', () => {
    renderCard({ doneCount: 10, total: 10, done: true })
    expect(screen.getByText(/Hoàn thành! 🎉/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByRole('link', { name: /Chơi lại/ })).toHaveAttribute('href', '/mission')
  })

  // A lesson can be empty only if generation found nothing at all; the bar must not go NaN.
  it('shows an empty bar rather than NaN when there is no lesson', () => {
    renderCard({ doneCount: 0, total: 0, done: false })
    expect(screen.getByText('0/0')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})

// Monday..Sunday, index 4 (Friday) is today; 5 and 6 (Sat/Sun) are still to come.
const sevenDots = [
  { day: '2026-08-01', done: true, isToday: false },
  { day: '2026-08-02', done: true, isToday: false },
  { day: '2026-08-03', done: false, isToday: false },
  { day: '2026-08-04', done: false, isToday: false },
  { day: '2026-08-05', done: false, isToday: true },
  { day: '2026-08-06', done: false, isToday: false },
  { day: '2026-08-07', done: false, isToday: false },
]

// Keyed by day, not by array index — a `WeekDots` caller's minutes source need not share the
// dots' own window (see the Home.test.tsx regression for why that distinction matters).
const sevenMinutes: Record<string, number> = {
  '2026-08-01': 14, '2026-08-02': 18, '2026-08-03': 9, '2026-08-04': 16,
  '2026-08-05': 0, '2026-08-06': 0, '2026-08-07': 0,
}

describe('WeekDots', () => {
  it('draws seven 34px dots, marks today and dims the future', () => {
    render(<WeekDots dots={sevenDots} minutes={sevenMinutes} />)

    for (const label of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    const dots = screen.getAllByTestId('streak-dot')
    expect(dots).toHaveLength(7)
    expect(dots[0]).toHaveClass('h-[34px]', 'bg-sun-400')
    expect(dots[4]).toHaveAttribute('data-today', 'true')
    expect(dots[4]).toHaveClass('ring-[4px]', 'ring-today')
    expect(dots[6]).toHaveClass('opacity-45')
    expect(dots[0]).not.toHaveClass('opacity-45')
    expect(screen.getByText("14'")).toBeInTheDocument()
  })

  it('shrinks to 24px with size="sm" and skips per-day minutes without a minutes prop', () => {
    render(<WeekDots dots={sevenDots} size="sm" />)
    const dots = screen.getAllByTestId('streak-dot')
    expect(dots[0]).toHaveClass('h-6', 'w-6')
    expect(screen.queryByText("14'")).not.toBeInTheDocument()
  })
})

describe('StreakWeek', () => {
  it('shows the compact strip with today marked and the streak count', () => {
    render(<MemoryRouter><StreakWeek dots={sevenDots} streak={2} longest={5} weekMinutes={30} stars={10} /></MemoryRouter>)
    expect(screen.getAllByTestId('streak-dot')).toHaveLength(7)
    expect(screen.getByText('🔥 2 ngày')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('tapping the streak strip opens the panel with the three numbers, and Đóng or Escape closes it', () => {
    render(<MemoryRouter><StreakWeek dots={sevenDots} streak={4} longest={9} weekMinutes={57} stars={128} /></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: /Tuần này/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const sheet = screen.getByRole('dialog', { name: 'Tuần này của con 🔥' })
    expect(sheet).toHaveTextContent('4 ngày')
    expect(sheet).toHaveTextContent('9 ngày')
    expect(sheet).toHaveTextContent("57'")
    expect(sheet).toHaveTextContent('⭐ 128')
    expect(sheet).toHaveClass('rounded-t-r28', 'ipad:rounded-r22')

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes on Escape', () => {
    render(<MemoryRouter><StreakWeek dots={sevenDots} streak={1} longest={1} weekMinutes={5} stars={2} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Tuần này/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says "bắt đầu hôm nay" instead of a streak number when the streak is 0', () => {
    render(<MemoryRouter><StreakWeek dots={sevenDots} streak={0} longest={3} weekMinutes={0} stars={0} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Tuần này/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('0 ngày · bắt đầu hôm nay nhé!')
  })
})

describe('Confetti', () => {
  afterEach(() => vi.useRealTimers())

  it('drops 24 pieces that never intercept taps, then removes itself after 2 s', () => {
    vi.useFakeTimers()
    render(<Confetti />)

    const layer = screen.getByTestId('confetti')
    expect(layer).toHaveClass('pointer-events-none')
    expect(layer.children).toHaveLength(24)

    act(() => { vi.advanceTimersByTime(2000) })

    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  })

  it('lays the pieces out deterministically, so re-rendering does not reshuffle them', () => {
    const { unmount } = render(<Confetti />)
    const first = Array.from(screen.getByTestId('confetti').children).map(c => c.getAttribute('style'))
    unmount()

    render(<Confetti />)
    const second = Array.from(screen.getByTestId('confetti').children).map(c => c.getAttribute('style'))

    expect(second).toEqual(first)
    expect(new Set(first).size).toBeGreaterThan(1)
  })
})
