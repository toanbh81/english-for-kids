import type { ReactNode } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BackButton } from './BackButton'
import { Button } from './Button'
import { Chip } from './Chip'
import { ChipPair } from './ChipPair'
import { DialogProvider } from './DialogProvider'
import { EmptyState } from './EmptyState'
import { GateBlobs, GateCard } from './GateCard'
import { HomeLabel } from './HomeLabel'
import { NotFound } from './NotFound'
import { Notice } from './Notice'
import { NoticeStack } from './NoticeStack'
import { PAGE_SHELL } from './pageShell'
import { ProgressBar } from './ProgressBar'
import { SceneDots } from './SceneDots'
import { AccountCardSkeleton } from './Skeleton'
import { SpeechBubble } from './SpeechBubble'
import { Stars } from './Stars'
import { StarRow } from './StarRow'
import { SyncPill } from './SyncPill'
import type { SyncStatus } from '../../cloud/sync'
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

  it('danger is a pale-red outline on white — a real variant, not a className', () => {
    render(<Button size="adult" variant="danger">↺ Đặt lại tiến trình…</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-white', 'text-fix-700', 'border-2', 'border-fix-300', 'min-h-[44px]', 'rounded-r12')
  })

  it('pulse uses the coral ring animation', () => {
    render(<Button pulse>Bắt đầu ▸</Button>)
    expect(screen.getByRole('button')).toHaveClass('animate-pulse-coral')
  })

  it('size sm is the 48px mission CTA', () => {
    render(<Button size="sm">Chơi lại 🎉</Button>)
    expect(screen.getByRole('button')).toHaveClass('min-h-[48px]', 'px-4', 'text-[17px]', 'rounded-r16', 'whitespace-nowrap')
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

  it('mdLabel follows the same iPad-landscape breakpoint as HomeLabel', () => {
    router(<BackButton to="/" label="Về trang chủ" mdLabel="Về bản đồ" />)
    expect(screen.getByText('Về trang chủ')).toHaveClass('sr-only', 'ipad:hidden')
    expect(screen.getByText('Về bản đồ')).toHaveClass('sr-only', 'hidden', 'ipad:inline')
  })

  it('adult variant is 44 with a visible label', () => {
    router(<BackButton to="/" label="Về nhà" variant="adult" />)
    const a = screen.getByRole('link', { name: 'Về nhà' })
    expect(a).toHaveClass('h-11', 'rounded-r14')
    expect(a).toHaveTextContent('Về nhà')
  })

  it('adult variant swaps its VISIBLE label at ipad:, unlike the icon-only variants', () => {
    router(<BackButton to="/" label="Về nhà" mdLabel="Về bản đồ 🏝️" variant="adult" />)
    // The pill's own printed text carries the wording, so — unlike `mdLabel` on the icon-only
    // child variant above — this swap is plain visible text, not `sr-only`: exactly one of the two
    // is ever `display:none` at a time (round-4 fix wave 2: content, not a static `aria-label`, so
    // the announced name always matches what's actually printed on screen at that breakpoint).
    expect(screen.getByText('Về nhà')).toHaveClass('ipad:hidden')
    expect(screen.getByText('Về nhà').className).not.toMatch(/sr-only/)
    expect(screen.getByText('Về bản đồ 🏝️')).toHaveClass('hidden', 'ipad:inline')
    expect(screen.getByText('Về bản đồ 🏝️').className).not.toMatch(/sr-only/)
    // jsdom loads no stylesheet, so it can't tell which span is `display:none` and reports the
    // accessible name as both concatenated — the same limitation `HomeLabel`'s own test (below)
    // works around by asserting the two spans directly rather than a role/name query; a prefix
    // match on the un-swapped label is enough here to confirm it still leads the jsdom-rendered
    // name, without claiming jsdom can resolve the real, single-label accessible name a browser
    // computes once its stylesheet excludes the `display:none` span.
    expect(screen.getByRole('link', { name: /^Về nhà/ })).toBeInTheDocument()
  })

  it('onArt variant is 48 on a translucent white disc', () => {
    router(<BackButton to="/stories" label="Truyện" variant="onArt" />)
    expect(screen.getByRole('link')).toHaveClass('h-12', 'w-12', 'bg-white/[.94]', 'after:-inset-2')
  })
})

describe('HomeLabel', () => {
  it('promises the map only on iPad landscape', () => {
    render(<HomeLabel />)
    expect(screen.getByText('Về trang chủ 🏠')).toHaveClass('ipad:hidden')
    expect(screen.getByText('Về bản đồ 🏝️')).toHaveClass('hidden', 'ipad:inline')
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

  // Fix round 1 (task-5 review, Important #1): `xs` is a real size variant, not a `className`
  // override fighting Chip's own base classes — a `className` override never won the cascade
  // (Tailwind's generated stylesheet order beats JSX class order), which is how the list `Tile`
  // chip shipped at 16px/pill instead of the spec's 11px/radius-9. The negative assertions here
  // are the ones that matter: they'd catch a regression back to the old shared
  // `rounded-full px-4 py-2 text-base` base classes leaking onto `xs`.
  it('xs is the list-tile chip size — 11/13px, radius 9, padding 2×8, one line — not the sm/md pill', () => {
    render(<Chip size="xs">Chưa có từ ôn</Chip>)
    const chip = screen.getByText('Chưa có từ ôn')
    expect(chip).toHaveClass('text-[11px]', 'md:text-[13px]', 'px-2', 'py-0.5', 'rounded-[9px]', 'whitespace-nowrap')
    expect(chip).not.toHaveClass('px-4', 'py-2', 'text-base', 'rounded-full')
  })

  // Fix wave I2/P6/M5: same lesson, reapplied — three call sites (DailyMission's band/group
  // chips, StoryPlayer's scene chip) tried to shrink the `md` pill with a `className` override and
  // always lost the same way `Tile`'s chip did above.
  it('header is the 15px band/scene chip — radius 12, padding 7×14 — not the sm/md pill', () => {
    render(<Chip size="header">Cảnh 2/7</Chip>)
    const chip = screen.getByText('Cảnh 2/7')
    expect(chip).toHaveClass('text-[15px]', 'rounded-r12', 'px-3.5', 'py-[7px]')
    expect(chip).not.toHaveClass('px-4', 'py-2', 'text-lg', 'rounded-full')
  })

  it('coralSolid is solid coral with white text', () => {
    render(<Chip tone="coralSolid">12 từ hôm nay</Chip>)
    expect(screen.getByText('12 từ hôm nay')).toHaveClass('bg-coral-500', 'text-white')
  })

  it('sand is the locked-tile chip colour, #EFE2CC/#A79781', () => {
    render(<Chip tone="sand">Chưa mở khoá</Chip>)
    expect(screen.getByText('Chưa mở khoá')).toHaveClass('bg-line-200', 'text-sand-text')
  })
})

describe('ChipPair', () => {
  it('joins a teal left half and a coral right half', () => {
    render(<ChipPair left="Âm 2/9" right="Từ 1/3" />)
    const pair = screen.getByTestId('chip-pair')
    expect(pair.children[0]).toHaveClass('bg-teal-50', 'text-teal-600', 'rounded-l-r12', 'rounded-r-none')
    expect(pair.children[1]).toHaveClass('bg-coral-50', 'text-coral-text', 'rounded-r-r12', 'rounded-l-none')
    expect(pair).toHaveTextContent('Âm 2/9Từ 1/3')
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

  it('gains the 13 and 14 marks without moving the old four', () => {
    const { rerender } = render(<Stars value={2} size="13" />)
    expect(screen.getByTestId('stars')).toHaveClass('text-[13px]', 'tracking-[2px]')
    rerender(<Stars value={2} size="14" />); expect(screen.getByTestId('stars')).toHaveClass('text-[14px]')
    rerender(<Stars value={2} size="xs" />); expect(screen.getByTestId('stars')).toHaveClass('text-[12px]')
    rerender(<Stars value={2} />); expect(screen.getByTestId('stars')).toHaveClass('text-[28px]')
  })

  // Fix wave P3: `tone="band"` reads both the filled and the empty stars as pale yellow on teal
  // (TopicHub's island header), never the app-default gold/tan pair — and never changes a size.
  it('tone="band" reads pale-yellow filled and empty stars; tone="default" (the default) is unchanged', () => {
    const { rerender } = render(<Stars value={2} size="13" tone="band" />)
    expect(screen.getByTestId('stars')).toHaveClass('text-[13px]')
    expect(screen.getAllByTestId('star-filled')[0]).toHaveClass('text-star-band')
    expect(screen.getByTestId('star-empty')).toHaveClass('text-star-band/50')
    expect(screen.getAllByTestId('star-filled')[0]).not.toHaveClass('text-star')
    expect(screen.getByTestId('star-empty')).not.toHaveClass('text-star-empty')

    rerender(<Stars value={2} size="13" />)
    expect(screen.getAllByTestId('star-filled')[0]).toHaveClass('text-star')
    expect(screen.getByTestId('star-empty')).toHaveClass('text-star-empty')
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

  it('shows nothing until a message arrives, then hides itself after 2.4 s', () => {
    vi.useFakeTimers()
    render(<Harness />)

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()

    act(() => { screen.getByText('show').click() })
    expect(screen.getByTestId('toast')).toHaveTextContent('Đã lưu!')

    act(() => { vi.advanceTimersByTime(2399) })
    expect(screen.getByTestId('toast')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
  })

  it('does not fire its timer after the caller unmounts', () => {
    vi.useFakeTimers()
    const { unmount } = render(<Harness />)

    act(() => { screen.getByText('show').click() })
    unmount()

    expect(() => act(() => { vi.advanceTimersByTime(2500) })).not.toThrow()
  })

  it('sits under the safe-area top, capped at 360 and two lines', () => {
    render(<Toast message="Đã lưu câu: Chị của con có một con búp bê em bé." />)
    const t = screen.getByTestId('toast')
    expect(t).toHaveClass('w-[min(360px,calc(100%-32px))]', 'line-clamp-2', 'rounded-r16', 'shadow-toast')
    expect(t.className).toMatch(/top-\[max\(1rem,calc\(env\(safe-area-inset-top\)/)
    expect(t).not.toHaveClass('top-6', 'rounded-full')
  })

  it('hides after 2.4 s', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast())
    act(() => result.current.show('x'))
    act(() => { vi.advanceTimersByTime(2399) })
    expect(result.current.message).toBe('x')
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.message).toBeNull()
    vi.useRealTimers()
  })
})

describe('NotFound', () => {
  it('names the thing, shows surprised Foxy and a way home', () => {
    router(<NotFound what="cặp từ" />)
    expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy cặp từ này 🦊')
    expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/')
    expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'surprised')
  })
})

describe('EmptyState', () => {
  it('centres emoji, title, sub and an optional outline CTA', () => {
    router(<EmptyState emoji="📚" title="Chưa có từ cần ôn hôm nay" sub="Học thêm từ mới, mai quay lại ôn nhé!" cta={{ label: 'Từ mới hôm nay →', to: '/words' }} />)
    expect(screen.getByTestId('empty-state')).toHaveClass('min-h-[150px]', 'rounded-r18', 'bg-cream-50')
    expect(screen.getByRole('link', { name: 'Từ mới hôm nay →' })).toHaveClass('min-h-[44px]')
  })

  it('adult variant is smaller', () => {
    render(<EmptyState adult emoji="🎙️" title="Chưa có bản ghi nào" sub="Bản ghi xuất hiện sau khi bé luyện nói." />)
    expect(screen.getByText('Chưa có bản ghi nào')).toHaveClass('text-[14px]')
  })

  it('hero swaps the emoji for a 120px Foxy and grows the type', () => {
    render(<EmptyState size="hero" title="Hôm nay chưa có nhiệm vụ" sub="Bé có thể luyện tự do ở bất kỳ đảo nào — hoặc leo các bậc luyện nói." />)
    const box = screen.getByTestId('empty-state')
    expect(box).toHaveClass('flex-1', 'justify-center', 'gap-3', 'bg-transparent')
    expect(screen.getByTestId('foxy')).toBeInTheDocument()
    expect(screen.getByText('Hôm nay chưa có nhiệm vụ')).toHaveClass('text-[22px]')
    expect(screen.getByText(/luyện tự do/)).toHaveClass('text-[14px]')
  })

  it('dashed is a 120px dashed box and leaves the card variant untouched', () => {
    const { rerender } = render(<EmptyState adult variant="dashed" emoji="📈" title="Chưa có lịch sử luyện" sub="Biểu đồ hiện từ ngày học đầu tiên." />)
    const box = screen.getByTestId('empty-state')
    expect(box).toHaveClass('min-h-[120px]', 'rounded-r12', 'border-2', 'border-dashed', 'border-sand-edge', 'bg-transparent')
    expect(box.className).not.toMatch(/bg-cream-50|min-h-\[150px\]/)

    rerender(<EmptyState adult emoji="🎙️" title="Chưa có bản ghi nào" sub="Bản ghi xuất hiện sau khi bé luyện nói." />)
    expect(screen.getByTestId('empty-state')).toHaveClass('min-h-[150px]', 'rounded-r18', 'bg-cream-50')
  })
})

describe('GateCard', () => {
  it('is Dialog.tsx:84 in another place: 420, r20, p20, gap 12, left-aligned text, centred card', () => {
    render(<GateCard><h1>Dành cho phụ huynh</h1></GateCard>)
    const card = screen.getByTestId('gate-card')
    expect(card).toHaveClass('mx-auto', 'flex', 'w-[min(420px,calc(100%-32px))]', 'flex-col', 'gap-3', 'rounded-r20', 'bg-white', 'p-5', 'shadow-[0_6px_0_#EFE2CC]', 'text-left')
    expect(card.className).not.toMatch(/max-w-md|text-center|\blg:|\bsm:/)
  })
})

describe('GateBlobs', () => {
  it('is a decorative, negatively-stacked fill behind the card (round-4 fix wave 1)', () => {
    render(<GateBlobs />)
    const blobs = screen.getByTestId('gate-blobs')
    expect(blobs).toHaveClass('pointer-events-none', 'absolute', 'inset-0', '-z-10', 'overflow-hidden')
    expect(blobs).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Notice', () => {
  it('colours by kind and shows action/close', () => {
    const onClose = vi.fn()
    render(<Notice kind="warn" title="Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!" sub="Giới hạn 20 phút/ngày" onClose={onClose} />)
    const n = screen.getByRole('status')
    expect(n).toHaveClass('bg-sun-50', 'border-[#FFDF9E]', 'text-sun-700', 'rounded-r16', 'border-[3px]')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalled()
  })
  it('credential kind shows the code and a copy button', () => {
    render(<Notice kind="credential" title="Mã khôi phục — chụp màn hình lại nhé" sub="Chỉ hiện 1 lần." code="QZQJ7MFC" />)
    expect(screen.getByText('QZQJ7MFC')).toHaveClass('tracking-[4px]', 'text-[24px]')
    expect(screen.getByRole('button', { name: 'Chép mã' })).toBeInTheDocument()
  })

  it('on a child screen (the default), close and action buttons are 44px with an invisible hit band to 64px', () => {
    render(<Notice kind="info" title="A" action={{ label: 'Đi', onClick: () => {} }} onClose={() => {}} />)
    const close = screen.getByRole('button', { name: 'Đóng' })
    const action = screen.getByRole('button', { name: 'Đi' })
    for (const btn of [close, action]) {
      expect(btn).toHaveClass('min-h-[44px]', 'min-w-[44px]')
      expect(btn.className).toMatch(/after:-inset-2\.5/)
    }
  })

  it('adult notices are 44px with no hit band', () => {
    render(<Notice kind="info" adult title="A" action={{ label: 'Đi', onClick: () => {} }} onClose={() => {}} />)
    const close = screen.getByRole('button', { name: 'Đóng' })
    const action = screen.getByRole('button', { name: 'Đi' })
    for (const btn of [close, action]) {
      expect(btn).toHaveClass('min-h-[44px]', 'min-w-[44px]')
      expect(btn.className).not.toMatch(/after:/)
    }
  })

  it('icon overrides the glyph and keeps the kind tone', () => {
    render(<Notice kind="warn" adult icon="📡" title="Đang ngoại tuyến — sẽ tự kết nối khi có mạng." />)
    expect(screen.getByRole('status')).toHaveClass('bg-sun-50', 'text-sun-700')
    expect(screen.getByText('📡')).toBeInTheDocument()
    expect(screen.queryByText('⚠️')).toBeNull()
  })
})

describe('NoticeStack', () => {
  it('orders by priority and folds the third into a button naming it', () => {
    render(<NoticeStack items={[{ kind: 'info', title: 'A' }, { kind: 'error', title: 'B' }, { kind: 'warn', title: 'C' }]} />)
    const titles = screen.getAllByRole('status').map(n => n.textContent)
    expect(titles[0]).toContain('B'); expect(titles[1]).toContain('C')
    expect(screen.getByRole('button', { name: '+1 thông báo (A) ▸' })).toBeInTheDocument()
  })

  it('the "+N" row is a 44px button naming the first hidden banner, and opens a dialog listing the rest', async () => {
    render(<DialogProvider><NoticeStack items={[
      { kind: 'warn', title: 'Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!' },
      { kind: 'info', title: 'Liên kết email để giữ tiến độ của bé' },
      { kind: 'info', title: 'Thêm vào Màn hình chính' },
    ]} /></DialogProvider>)
    const more = screen.getByRole('button', { name: '+1 thông báo (Thêm vào Màn hình chính) ▸' })
    expect(more).toHaveClass('min-h-[44px]', 'text-[12px]', 'font-extrabold', 'text-ink-500')
    fireEvent.click(more)
    expect(await screen.findByRole('dialog')).toHaveTextContent('Thêm vào Màn hình chính')
  })

  it('the "+N" button still renders with no DialogProvider, as a no-op', () => {
    render(<NoticeStack items={[
      { kind: 'warn', title: 'A' },
      { kind: 'info', title: 'B' },
      { kind: 'info', title: 'C' },
    ]} />)
    const more = screen.getByRole('button', { name: '+1 thông báo (C) ▸' })
    expect(() => fireEvent.click(more)).not.toThrow()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('no "+N" row at or under max, and the priority order is unchanged', () => {
    render(<NoticeStack items={[{ kind: 'info', title: 'a' }, { kind: 'error', title: 'b' }]} />)
    expect(screen.queryByRole('button', { name: /thông báo/ })).toBeNull()
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('b')
  })
})

describe('PAGE_SHELL', () => {
  const TOP = 'pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_8px))]'
  const BOTTOM = 'pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]'

  it('pads a page by the safe-area inset plus the design breathing room', () => {
    render(<main data-testid="page" className={`px-6 ${PAGE_SHELL}`}>xin chào</main>)

    // 47 px of notch + 8 = the design's 55 px top frame; 34 px of home indicator + 10 = its 44.
    expect(screen.getByTestId('page')).toHaveClass(TOP, BOTTOM)
    expect(PAGE_SHELL).toContain('env(safe-area-inset-top)_+_8px')
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

describe('SyncPill', () => {
  const base = { state: 'synced', pending: 0, syncing: false, lastError: null, lastSyncedAt: null } as const

  it('maps the seven states to copy and colour', () => {
    const { rerender } = render(<SyncPill status={{ ...base } as SyncStatus} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('✓ Đã đồng bộ')

    rerender(<SyncPill status={{ ...base, state: 'pending', pending: 500 } as SyncStatus} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('● Chưa đồng bộ 500 mục')

    rerender(<SyncPill status={{ ...base, syncing: true } as SyncStatus} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Đang đồng bộ…')

    rerender(<SyncPill status={{ ...base, lastError: 'x' } as SyncStatus} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Không đồng bộ được')
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()

    rerender(<SyncPill status={{ ...base, lastSyncedAt: new Date(2026, 8, 2, 9, 41).getTime() } as SyncStatus} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Đã đồng bộ · 09:41')

    rerender(<SyncPill status={{ ...base, state: 'off' } as SyncStatus} onRetry={() => {}} />)
    expect(screen.queryByTestId('sync-status')).toBeNull()
  })

  it('the retry button calls onRetry', () => {
    const onRetry = vi.fn()
    render(<SyncPill status={{ ...base, lastError: 'x' } as SyncStatus} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps its six old states byte-identical at the default size', () => {
    render(<SyncPill status={{ ...base } as SyncStatus} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveClass('h-8', 'rounded-r10', 'px-2.5', 'text-[12px]')
  })

  it('merges the clock state into "✓ Đã đồng bộ · HH:MM" on good-50', () => {
    render(<SyncPill status={{ ...base, lastSyncedAt: new Date(2026, 8, 2, 9, 41).getTime() } as SyncStatus} onRetry={() => {}} />)
    const pill = screen.getByTestId('sync-status')
    expect(pill).toHaveTextContent('✓ Đã đồng bộ · 09:41')
    expect(pill).toHaveClass('bg-good-50', 'text-good-700')
  })

  it('says "Chưa kết nối" only when a session is known to be missing — never when cloud is off', () => {
    const { rerender } = render(<SyncPill status={{ ...base } as SyncStatus} hasSession={false} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Chưa kết nối')

    rerender(<SyncPill status={{ ...base, state: 'offline' } as SyncStatus} hasSession={false} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Ngoại tuyến') // offline wins over no-session

    rerender(<SyncPill status={{ ...base, state: 'off' } as SyncStatus} hasSession={false} onRetry={() => {}} />)
    expect(screen.queryByTestId('sync-status')).toBeNull() // cloud unconfigured stays silent

    rerender(<SyncPill status={{ ...base } as SyncStatus} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('✓ Đã đồng bộ') // hasSession undefined = old behaviour
  })

  it('size sm is the 28px pill of the narrow panel', () => {
    render(<SyncPill status={{ ...base } as SyncStatus} size="sm" onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveClass('h-7', 'rounded-lg', 'px-2', 'text-[11px]')
  })
})

describe('Skeleton', () => {
  it('account skeleton keeps the card height', () => {
    render(<AccountCardSkeleton />)
    expect(screen.getByTestId('skeleton-account')).toHaveClass('h-[150px]')
    expect(screen.getByTestId('skeleton-account').className).not.toMatch(/h-\[168px\]/)
    expect(screen.getAllByTestId('skeleton')[0]).toHaveClass('animate-shimmer')
  })
})
