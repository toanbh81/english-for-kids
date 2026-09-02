import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BackButton } from './BackButton'
import { Button } from './Button'
import { Chip } from './Chip'
import { PAGE_SHELL } from './pageShell'
import { ProgressBar } from './ProgressBar'
import { SceneDots } from './SceneDots'
import { SpeechBubble } from './SpeechBubble'
import { Stars } from './Stars'
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
    expect(button).toHaveClass('min-h-[56px]', 'md:min-h-[64px]', 'font-display')
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
    expect(screen.getByRole('button')).toHaveClass('animate-pulse-coral')

    rerender(<Button>A</Button>)
    expect(screen.getByRole('button')).not.toHaveClass('animate-pulse-coral')
  })

  it('renders a router link, not a button, when given a destination', () => {
    router(<Button to="/mission" variant="secondary">Bắt đầu</Button>)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bắt đầu' })).toHaveAttribute('href', '/mission')
    expect(screen.getByRole('link', { name: 'Bắt đầu' })).toHaveClass('bg-teal-500')
  })

  it('md is 56 on a phone and 64 from md, with the design radius and 5px edge', () => {
    render(<Button>Bắt đầu ▸</Button>)
    const b = screen.getByRole('button')
    expect(b).toHaveClass('min-h-[56px]', 'md:min-h-[64px]', 'rounded-r18', 'md:rounded-r20', 'text-[18px]', 'md:text-[22px]', 'shadow-chunky-coral')
    expect(b).not.toHaveClass('rounded-xl3')
  })

  it('lg is 64 on a phone and 72 from md', () => {
    render(<Button size="lg">Về trang chủ</Button>)
    expect(screen.getByRole('button')).toHaveClass('min-h-[64px]', 'md:min-h-[72px]', 'rounded-r20', 'md:rounded-r24', 'md:text-[26px]')
  })

  it('adult is 44 at every width', () => {
    render(<Button size="adult">Lưu</Button>)
    const b = screen.getByRole('button')
    expect(b).toHaveClass('min-h-[44px]', 'rounded-r12', 'text-[14px]')
    expect(b.className).not.toMatch(/md:min-h/)
  })

  it('outline has the teal edge and disabled flattens the shadow', () => {
    render(<Button variant="outline" disabled>Nghe lại</Button>)
    expect(screen.getByRole('button')).toHaveClass('border-teal-line', 'shadow-edge-outline', 'disabled:opacity-45', 'disabled:shadow-none')
  })

  it('pulse uses the coral ring animation', () => {
    render(<Button pulse>Bắt đầu ▸</Button>)
    expect(screen.getByRole('button')).toHaveClass('animate-pulse-coral')
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

  it('child variant is 56 with a 64 hit band on a phone and 64 from md', () => {
    router(<BackButton to="/" label="Về nhà" />)
    const a = screen.getByRole('link', { name: 'Về nhà' })
    expect(a).toHaveClass('h-14', 'w-14', 'md:h-16', 'md:w-16', 'after:-inset-1')
    expect(a.className).not.toMatch(/66px/)
  })

  it('adult variant is 44 with a visible label', () => {
    router(<BackButton to="/" label="Về nhà" variant="adult" />)
    const a = screen.getByRole('link', { name: 'Về nhà' })
    expect(a).toHaveClass('h-11', 'rounded-r14')
    expect(a).toHaveTextContent('Về nhà')
  })

  it('onArt variant is 48 on a translucent white disc', () => {
    router(<BackButton to="/stories" label="Truyện" variant="onArt" />)
    expect(screen.getByRole('link')).toHaveClass('h-12', 'w-12', 'bg-white/[.94]', 'after:-inset-2')
  })
})

describe('Toggle', () => {
  it('is a switch that reports its state and flips on tap', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Toggle on={false} onChange={onChange} emoji="🇻🇳" label="Phụ đề" />)

    const toggle = screen.getByRole('switch', { name: /Phụ đề/ })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Phụ đề')).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)

    rerender(<Toggle on onChange={onChange} emoji="🇻🇳" label="Phụ đề" />)
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

  it('has a small size, so callers need no className override to shrink the label', () => {
    const { rerender } = render(<Chip>Sắp có</Chip>)
    expect(screen.getByText('Sắp có')).toHaveClass('text-lg')

    rerender(<Chip size="sm">Sắp có</Chip>)
    expect(screen.getByText('Sắp có')).toHaveClass('text-base')
    expect(screen.getByText('Sắp có')).not.toHaveClass('text-lg')
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

describe('Stars', () => {
  it('sizes sm/md/lg are 16/28/44 with the star token colours', () => {
    const { rerender } = render(<Stars value={2} size="sm" />)
    expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
    expect(screen.getAllByTestId('star-empty')).toHaveLength(1)
    expect(screen.getByTestId('stars')).toHaveClass('text-[16px]', 'tracking-[2px]')
    expect(screen.getAllByTestId('star-filled')[0]).toHaveClass('text-star')
    expect(screen.getAllByTestId('star-empty')[0]).toHaveClass('text-star-empty')
    rerender(<Stars value={3} size="lg" animate />)
    expect(screen.getByTestId('stars')).toHaveClass('text-[44px]')
    expect(screen.getAllByTestId('star-filled')[2]).toHaveStyle({ animationDelay: '0.36s' })
  })
})

describe('StarRow', () => {
  it('fills as many of the three stars as the score', () => {
    render(<StarRow value={2} />)

    expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
    expect(screen.getAllByTestId('star-empty')).toHaveLength(1)
    expect(screen.getAllByTestId('star-filled')[0]).toHaveClass('text-star')
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

describe('PAGE_SHELL', () => {
  const TOP = 'pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_9px))]'
  const BOTTOM = 'pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]'

  it('pads a page by the safe-area inset plus the design breathing room', () => {
    render(<main data-testid="page" className={`px-6 ${PAGE_SHELL}`}>xin chào</main>)

    // 47 px of notch + 9 = the design's 56 px top frame; 34 px of home indicator + 10 = its 44.
    expect(screen.getByTestId('page')).toHaveClass(TOP, BOTTOM)
    expect(PAGE_SHELL).toContain('env(safe-area-inset-top)_+_9px')
    expect(PAGE_SHELL).toContain('env(safe-area-inset-bottom)_+_10px')
  })

  it('falls back to the screen own padding where there is no inset, so the iPad is untouched', () => {
    // Every inset is 0 on an iPad, a desktop browser and in a test: `max()` then hands back the
    // screen's resting padding (1.5rem = the `p-6` the screens had) instead of a bare 9 px.
    expect(PAGE_SHELL).toContain('max(var(--page-pad-top,1.5rem)')
    expect(PAGE_SHELL).toContain('max(var(--page-pad-bottom,1.5rem)')
  })

  it('leaves horizontal padding to the screen, whose frame width differs per design family', () => {
    expect(PAGE_SHELL).not.toMatch(/(^|\s)p[xlr]?-/)
  })
})
