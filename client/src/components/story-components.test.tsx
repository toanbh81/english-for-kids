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
    expect(buttons[1]).toHaveClass('text-coral', 'scale-110')
    expect(buttons[0]).toHaveClass('text-slate-400')
    expect(buttons[2]).toHaveClass('text-slate-800')
  })
  it('calls onWordTap with the tapped index', () => {
    const fn = vi.fn()
    render(<Karaoke words={words} activeIndex={1} onWordTap={fn} />)
    fireEvent.click(screen.getAllByRole('button')[2])
    expect(fn).toHaveBeenCalledWith(2)
  })
  it('shows the subtitle line when provided', () => {
    render(<Karaoke words={words} activeIndex={0} onWordTap={() => {}} subtitle="Con mèo chạy." />)
    expect(screen.getByText('Con mèo chạy.')).toHaveClass('text-2xl', 'text-slate-500')
  })
  it('does not render a subtitle line when omitted', () => {
    render(<Karaoke words={words} activeIndex={0} onWordTap={() => {}} />)
    expect(screen.queryByText(/./, { selector: '.text-slate-500' })).not.toBeInTheDocument()
  })
})

describe('PlayerControls', () => {
  const baseProps = {
    playing: false, rate: 1 as 0.75 | 1, musicOn: true, subtitles: true,
    sceneIndex: 1, sceneCount: 3,
    onToggle: vi.fn(), onRate: vi.fn(), onPrev: vi.fn(), onNext: vi.fn(), onMusic: vi.fn(), onSubtitles: vi.fn(),
  }

  it('shows "Phát" when paused and "Tạm dừng" when playing', () => {
    const { rerender } = render(<PlayerControls {...baseProps} playing={false} />)
    expect(screen.getByRole('button', { name: 'Phát' })).toBeInTheDocument()
    rerender(<PlayerControls {...baseProps} playing={true} />)
    expect(screen.getByRole('button', { name: 'Tạm dừng' })).toBeInTheDocument()
  })

  it('play button is 96px (w-24 h-24)', () => {
    render(<PlayerControls {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Phát' })).toHaveClass('w-24', 'h-24', 'rounded-full', 'bg-coral', 'text-white', 'text-5xl')
  })

  it('rate button shows 🐢 (slow down) at rate 1 and is labeled "Tốc độ 0.75"', () => {
    render(<PlayerControls {...baseProps} rate={1} />)
    const btn = screen.getByRole('button', { name: 'Tốc độ 0.75' })
    expect(btn).toHaveTextContent('🐢')
  })

  it('rate button shows 🐇 at rate 0.75 and is labeled "Tốc độ 1"', () => {
    render(<PlayerControls {...baseProps} rate={0.75} />)
    const btn = screen.getByRole('button', { name: 'Tốc độ 1' })
    expect(btn).toHaveTextContent('🐇')
  })

  it('music and subtitles buttons reflect on/off state in their labels', () => {
    render(<PlayerControls {...baseProps} musicOn={true} subtitles={false} />)
    expect(screen.getByRole('button', { name: 'Nhạc nền bật' })).toBeInTheDocument()
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

  it('calls each handler when its button is tapped', () => {
    render(<PlayerControls {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cảnh trước' })); expect(baseProps.onPrev).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Phát' })); expect(baseProps.onToggle).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cảnh sau' })); expect(baseProps.onNext).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tốc độ 0.75' })); expect(baseProps.onRate).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nhạc nền bật' })); expect(baseProps.onMusic).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Phụ đề bật' })); expect(baseProps.onSubtitles).toHaveBeenCalled()
  })
})
