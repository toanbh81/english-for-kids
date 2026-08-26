import { render, screen, fireEvent } from '@testing-library/react'
import { SceneArt } from './SceneArt'
import { Karaoke } from './Karaoke'
import { PlayerControls } from './PlayerControls'
import type { StoryWord } from '../content/stories/types'

const words: StoryWord[] = [{ w: 'The' }, { w: 'cat' }, { w: 'runs' }]

describe('SceneArt', () => {
  it('renders the emoji when no image is given', () => {
    render(<SceneArt emoji="🐱" bg="#fff" />)
    expect(screen.getByText('🐱')).toHaveClass('text-[160px]')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
  it('renders an img when image is given', () => {
    const { container } = render(<SceneArt emoji="🐱" bg="#fff" image="/cat.png" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/cat.png')
    expect(img).toHaveAttribute('alt', '')
    expect(screen.queryByText('🐱')).not.toBeInTheDocument()
  })
})

describe('Karaoke', () => {
  it('renders one button per word with active/past classes', () => {
    render(<Karaoke words={words} activeIndex={1} onWordTap={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    // Phase 10: the size is written twice — the design's phone value unprefixed, the landscape
    // one behind `md:` — so 1194 keeps the 44/32 px line it has always had.
    expect(buttons[1]).toHaveClass('text-coral-text', 'text-[28px]', 'md:text-[44px]')
    expect(buttons[0]).toHaveClass('text-[#CDBFA9]', 'text-[21px]', 'md:text-[32px]')
    expect(buttons[2]).toHaveClass('text-ink-900', 'text-[21px]', 'md:text-[32px]')
  })
  it('gives every word a 64px-wide centred tap target', () => {
    render(<Karaoke words={words} activeIndex={1} onWordTap={() => {}} />)
    // Short words like "a" or "is" are otherwise far too narrow for a 5-year-old's finger.
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('min-h-[64px]', 'min-w-[64px]', 'justify-center')
    }
  })
  it('calls onWordTap with the tapped index', () => {
    const fn = vi.fn()
    render(<Karaoke words={words} activeIndex={1} onWordTap={fn} />)
    fireEvent.click(screen.getAllByRole('button')[2])
    expect(fn).toHaveBeenCalledWith(2)
  })
  it('shows the subtitle line when provided', () => {
    render(<Karaoke words={words} activeIndex={0} onWordTap={() => {}} subtitle="Con mèo chạy." />)
    expect(screen.getByText('Con mèo chạy.')).toHaveClass('text-[14px]', 'md:text-[19px]', 'text-ink-300')
  })
  it('does not render a subtitle line when omitted', () => {
    render(<Karaoke words={words} activeIndex={0} onWordTap={() => {}} />)
    expect(screen.queryByText(/./, { selector: '.text-ink-300' })).not.toBeInTheDocument()
  })
})

describe('PlayerControls', () => {
  const baseProps = {
    playing: false, rate: 1 as 0.75 | 1, subtitles: true,
    sceneIndex: 1, sceneCount: 3,
    onToggle: vi.fn(), onRate: vi.fn(), onPrev: vi.fn(), onNext: vi.fn(), onSubtitles: vi.fn(),
  }

  it('shows "Phát" when paused and "Tạm dừng" when playing', () => {
    const { rerender } = render(<PlayerControls {...baseProps} playing={false} />)
    expect(screen.getByRole('button', { name: 'Phát' })).toBeInTheDocument()
    rerender(<PlayerControls {...baseProps} playing={true} />)
    expect(screen.getByRole('button', { name: 'Tạm dừng' })).toBeInTheDocument()
  })

  it('play button is the 96px teal circle on a phone and the 104px one of the handoff from md up', () => {
    render(<PlayerControls {...baseProps} />)
    const play = screen.getByRole('button', { name: 'Phát' })
    expect(play).toHaveClass('h-24', 'w-24', 'text-[38px]')
    expect(play).toHaveClass('md:w-[104px]', 'md:h-[104px]', 'md:text-[44px]')
    expect(play).toHaveClass('rounded-full', 'bg-teal-500', 'text-white')
  })

  /** The wrap at 390 px would otherwise put the speed pill and ⏮ on the first line and the play
   * button on the second; the design (§9 M6) pins ⏮ ▶ ⏭ together as the transport row. */
  it('orders the transport ahead of the options below md, and hands the DOM order back at md', () => {
    render(<PlayerControls {...baseProps} />)
    for (const name of ['Cảnh trước', 'Phát', 'Cảnh sau']) {
      expect(screen.getByRole('button', { name })).toHaveClass('order-1', 'md:order-none')
    }
    expect(screen.getByRole('button', { name: 'Tốc độ 0.75' })).toHaveClass('order-2', 'md:order-none')
    expect(screen.getByRole('button', { name: 'Phụ đề bật' }).parentElement).toHaveClass('order-3', 'md:order-none')
  })

  it('rate pill offers "Tốc độ 0.75" at rate 1, with 🐇 marked as the speed playing now', () => {
    render(<PlayerControls {...baseProps} rate={1} />)
    const btn = screen.getByRole('button', { name: 'Tốc độ 0.75' })
    expect(btn).toHaveTextContent('🐢')
    expect(screen.getByText('🐇')).toHaveClass('bg-coral-50')
  })

  it('rate pill offers "Tốc độ 1" at rate 0.75, with 🐢 marked as the speed playing now', () => {
    render(<PlayerControls {...baseProps} rate={0.75} />)
    const btn = screen.getByRole('button', { name: 'Tốc độ 1' })
    expect(btn).toHaveTextContent('🐇')
    expect(screen.getByText('🐢')).toHaveClass('bg-coral-50')
  })

  it('subtitles button reflects on/off state in its label', () => {
    render(<PlayerControls {...baseProps} subtitles={false} />)
    expect(screen.getByRole('button', { name: 'Phụ đề tắt' })).toBeInTheDocument()
  })

  it('renders sceneCount dots with exactly one active', () => {
    render(<PlayerControls {...baseProps} sceneIndex={1} sceneCount={3} />)
    const dots = screen.getAllByTestId('scene-dot')
    expect(dots).toHaveLength(3)
    const active = dots.filter(d => d.getAttribute('data-active') === 'true')
    expect(active).toHaveLength(1)
    expect(dots[1]).toHaveAttribute('data-active', 'true')
  })

  it('hides its dots when the screen draws them over the picture', () => {
    render(<PlayerControls {...baseProps} dots={false} />)
    expect(screen.queryAllByTestId('scene-dot')).toHaveLength(0)
  })

  it('calls each handler when its button is tapped', () => {
    render(<PlayerControls {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cảnh trước' })); expect(baseProps.onPrev).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Phát' })); expect(baseProps.onToggle).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cảnh sau' })); expect(baseProps.onNext).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tốc độ 0.75' })); expect(baseProps.onRate).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Phụ đề bật' })); expect(baseProps.onSubtitles).toHaveBeenCalled()
  })
})
