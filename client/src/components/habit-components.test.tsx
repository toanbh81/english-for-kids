import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Confetti } from './Confetti'
import { Foxy } from './Foxy'
import { MissionCard } from './MissionCard'
import { StreakWeek } from './StreakWeek'

describe('Foxy', () => {
  it('renders the mood and an optional speech bubble', () => {
    const { rerender } = render(<Foxy mood="happy" />)
    const foxy = screen.getByTestId('foxy')
    expect(foxy).toHaveAttribute('data-mood', 'happy')

    rerender(<Foxy mood="cheer" say="Giỏi quá!" />)
    expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
    expect(screen.getByText('Giỏi quá!')).toBeInTheDocument()
  })

  it('has no speech bubble when say is omitted', () => {
    render(<Foxy mood="idle" />)
    expect(screen.queryByText(/./, { selector: '[data-testid="foxy-bubble"]' })).not.toBeInTheDocument()
  })
})

describe('MissionCard', () => {
  function renderCard(status: { story: number; speak: number; word: number; done: boolean }) {
    render(<MemoryRouter><MissionCard status={status} /></MemoryRouter>)
  }

  it('shows counts for each mission row as links to the right screens', () => {
    renderCard({ story: 0, speak: 2, word: 0, done: false })
    expect(screen.getByText(/1 truyện 0\/1/)).toBeInTheDocument()
    expect(screen.getByText(/5 thẻ 2\/5/)).toBeInTheDocument()
    expect(screen.getByText(/3 từ 0\/3/)).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /truyện/i })).toHaveAttribute('href', '/stories')
    expect(screen.getByRole('link', { name: /thẻ/i })).toHaveAttribute('href', '/level/sound-zoo')
    expect(screen.getByRole('link', { name: /từ/i })).toHaveAttribute('href', '/words')
  })

  it('celebrates when all missions are done', () => {
    renderCard({ story: 1, speak: 5, word: 3, done: true })
    expect(screen.getByText(/Hoàn thành! 🎉/)).toBeInTheDocument()
  })
})

describe('StreakWeek', () => {
  it('shows 7 dots labeled Mon..Sun with today marked and the streak count', () => {
    const dots = [
      { day: '2026-08-17', done: true, isToday: false },
      { day: '2026-08-18', done: true, isToday: false },
      { day: '2026-08-19', done: false, isToday: false },
      { day: '2026-08-20', done: false, isToday: false },
      { day: '2026-08-21', done: false, isToday: false },
      { day: '2026-08-22', done: false, isToday: false },
      { day: '2026-08-23', done: false, isToday: true },
    ]
    render(<StreakWeek dots={dots} streak={2} />)

    for (const label of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getAllByText('★')).toHaveLength(2)
    expect(screen.getAllByText('○')).toHaveLength(5)
    expect(screen.getByText('🔥 2 ngày')).toBeInTheDocument()
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
