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

// Task 10 (spec decisions 18/19): a fixed 300×128 tile with a 48px nowrap CTA and four states —
// empty ("—", never happened yet), untouched ("0/n"), in progress ("n/total"), done ("✓ n/n").
describe('MissionCard', () => {
  function renderCard(status: { doneCount: number; total: number; done: boolean }) {
    render(<MemoryRouter><MissionCard status={status} /></MemoryRouter>)
  }

  it('is a fixed 300×128 card with the design tokens for radius, border and shadow', () => {
    renderCard({ doneCount: 3, total: 11, done: false })
    const card = screen.getByTestId('mission-card')
    expect(card).toHaveClass(
      'h-[128px]', 'w-full', 'max-w-[300px]', 'rounded-r22', 'px-4', 'py-3.5',
      'shadow-[0_6px_0_#EFE2CC]', 'border-2', 'border-[#F1E7D4]',
    )
    expect(screen.getByText('🌞 Nhiệm vụ hôm nay')).toBeInTheDocument()
  })

  it('shows the in-progress count in teal and a 48px nowrap Tiếp tục CTA', () => {
    renderCard({ doneCount: 3, total: 11, done: false })
    expect(screen.getByText('3/11')).toHaveClass('text-teal-600')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '27')
    const cta = screen.getByRole('link', { name: 'Tiếp tục ▸' })
    expect(cta).toHaveClass('min-h-[48px]', 'rounded-r16', 'text-[17px]', 'whitespace-nowrap')
    expect(cta).toHaveAttribute('href', '/mission')
  })

  // "Bắt đầu" is a promise about the lesson, not about the tap: a child who has already done two
  // steps is carrying on, and the card must say so (spec §2). The untouched count reads dimmer
  // (ink-500) than an in-progress one (teal-600).
  it('says Bắt đầu with a coral CTA on an untouched lesson', () => {
    renderCard({ doneCount: 0, total: 11, done: false })
    expect(screen.getByText('0/11')).toHaveClass('text-ink-500')
    const cta = screen.getByRole('link', { name: 'Bắt đầu ▸' })
    expect(cta).toHaveClass('bg-coral-500')
    expect(cta).toHaveAttribute('href', '/mission')
  })

  // The standalone "Hoàn thành! 🎉" line is gone (spec decision 18) — the ✓ count and the teal
  // "Chơi lại 🎉" CTA carry the celebration on their own.
  it('celebrates a finished lesson with a ✓ count and a teal Chơi lại CTA, no separate banner', () => {
    renderCard({ doneCount: 11, total: 11, done: true })
    expect(screen.getByText('✓ 11/11')).toHaveClass('text-good-700')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    const cta = screen.getByRole('link', { name: 'Chơi lại 🎉' })
    expect(cta).toHaveClass('bg-teal-500')
    expect(cta).toHaveAttribute('href', '/mission')
    expect(screen.queryByText('Hoàn thành! 🎉')).toBeNull()
  })

  // A lesson can be empty only if generation found nothing at all: the fourth state, distinct from
  // "untouched" — the count reads "—" instead of "0/0", and the CTA offers free practice on the
  // map rather than a lesson with nothing in it.
  it('shows an empty dash and an outline free-practice CTA when there is no lesson yet', () => {
    renderCard({ doneCount: 0, total: 0, done: false })
    expect(screen.getByText('—')).toHaveClass('text-ink-300')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    const cta = screen.getByRole('link', { name: 'Luyện tự do →' })
    expect(cta).toHaveClass('border-teal-line')
    expect(cta).toHaveAttribute('href', '/')
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
    expect(sheet).toHaveAttribute('aria-modal', 'true')
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

  it('moves focus to Đóng on open and restores it to the trigger on close', () => {
    render(<MemoryRouter><StreakWeek dots={sevenDots} streak={4} longest={9} weekMinutes={57} stars={128} /></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: /Tuần này/ })
    trigger.focus()
    fireEvent.click(trigger)

    const closeBtn = screen.getByRole('button', { name: 'Đóng' })
    expect(document.activeElement).toBe(closeBtn)

    fireEvent.click(closeBtn)
    expect(document.activeElement).toBe(trigger)
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
