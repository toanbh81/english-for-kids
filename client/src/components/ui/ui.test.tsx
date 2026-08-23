import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BackButton } from './BackButton'
import { Button } from './Button'
import { Chip } from './Chip'
import { ProgressBar } from './ProgressBar'
import { SceneDots } from './SceneDots'
import { SpeechBubble } from './SpeechBubble'
import { StarRow } from './StarRow'
import { Toast } from './Toast'
import { Toggle } from './Toggle'
import { useToast } from './useToast'

function router(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Button', () => {
  it('forwards clicks and button props', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} aria-label="Bắt đầu">Bắt đầu ▸</Button>)

    const button = screen.getByRole('button', { name: 'Bắt đầu' })
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(button).toHaveClass('min-h-[64px]', 'font-display')
  })

  it('does not fire when disabled', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Bắt đầu</Button>)

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('paints each variant with its own background and chunky shadow', () => {
    const { rerender } = render(<Button variant="primary">A</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-coral-500', 'shadow-chunky-coral')

    rerender(<Button variant="secondary">A</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-teal-500', 'shadow-chunky-teal')

    rerender(<Button variant="outline">A</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-white', 'text-teal-600')
  })

  it('pulses only when asked to', () => {
    const { rerender } = render(<Button pulse>A</Button>)
    expect(screen.getByRole('button')).toHaveClass('animate-pulse-soft')

    rerender(<Button>A</Button>)
    expect(screen.getByRole('button')).not.toHaveClass('animate-pulse-soft')
  })

  it('renders a router link, not a button, when given a destination', () => {
    router(<Button to="/mission" variant="secondary">Bắt đầu</Button>)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bắt đầu' })).toHaveAttribute('href', '/mission')
    expect(screen.getByRole('link', { name: 'Bắt đầu' })).toHaveClass('bg-teal-500')
  })
})

describe('BackButton', () => {
  it('links home and names itself for screen readers', () => {
    router(<BackButton to="/stories" label="Quay lại truyện" />)

    const link = screen.getByRole('link', { name: 'Quay lại truyện' })
    expect(link).toHaveAttribute('href', '/stories')
  })

  it('falls back to a Vietnamese default label', () => {
    router(<BackButton to="/" />)
    expect(screen.getByRole('link', { name: 'Quay lại' })).toBeInTheDocument()
  })
})

describe('Toggle', () => {
  it('is a switch that reports its state and flips on tap', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Toggle on={false} onChange={onChange} emoji="🎵" label="Nhạc nền" />)

    const toggle = screen.getByRole('switch', { name: /Nhạc nền/ })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Nhạc nền')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)

    rerender(<Toggle on onChange={onChange} emoji="🎵" label="Nhạc nền" />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })
})

describe('Chip', () => {
  it('renders its children with the tone colours', () => {
    render(<Chip tone="sun">🔥 5 ngày</Chip>)
    expect(screen.getByText('🔥 5 ngày')).toHaveClass('bg-sun-50', 'text-sun-700')
  })
})

describe('ProgressBar', () => {
  it('fills to the percentage and clamps out-of-range values', () => {
    const { rerender } = render(<ProgressBar value={66} />)
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '66%' })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '66')

    rerender(<ProgressBar value={140} />)
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '100%' })

    rerender(<ProgressBar value={-10} />)
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '0%' })
  })
})

describe('StarRow', () => {
  it('fills as many of the three stars as the score', () => {
    render(<StarRow value={2} />)

    expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
    expect(screen.getAllByTestId('star-empty')).toHaveLength(1)
    expect(screen.getAllByTestId('star-filled')[0]).toHaveClass('text-sun-400')
  })
})

describe('SceneDots', () => {
  it('marks the active scene among the dots', () => {
    render(<SceneDots count={4} active={1} />)

    const dots = screen.getByTestId('scene-dots').children
    expect(dots).toHaveLength(4)
    expect(dots[1]).toHaveClass('bg-coral-500')
    expect(dots[0]).toHaveClass('bg-line-200')
  })
})

describe('SpeechBubble', () => {
  it('shows the title and the optional subtitle', () => {
    const { rerender } = render(<SpeechBubble title="Chào bé! 👋" subtitle="Luyện nói nhé!" />)
    expect(screen.getByText('Chào bé! 👋')).toBeInTheDocument()
    expect(screen.getByText('Luyện nói nhé!')).toBeInTheDocument()

    rerender(<SpeechBubble title="Chào bé! 👋" />)
    expect(screen.queryByText('Luyện nói nhé!')).not.toBeInTheDocument()
  })
})

describe('Toast', () => {
  afterEach(() => vi.useRealTimers())

  function Harness() {
    const { message, show } = useToast()
    return (
      <>
        <button onClick={() => show('Đã lưu!')}>show</button>
        <Toast message={message} />
      </>
    )
  }

  it('shows nothing until a message arrives, then hides itself after 1.4 s', () => {
    vi.useFakeTimers()
    render(<Harness />)

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()

    act(() => { screen.getByText('show').click() })
    expect(screen.getByTestId('toast')).toHaveTextContent('Đã lưu!')

    act(() => { vi.advanceTimersByTime(1399) })
    expect(screen.getByTestId('toast')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
  })

  it('does not fire its timer after the caller unmounts', () => {
    vi.useFakeTimers()
    const { unmount } = render(<Harness />)

    act(() => { screen.getByText('show').click() })
    unmount()

    expect(() => act(() => { vi.advanceTimersByTime(2000) })).not.toThrow()
  })
})
