import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MicButton, Countdown, LevelBars, ResultCard, SpeakError, WordChip } from './index'
import { ScoredWords } from '../ScoredWords'
import { ScoreBars } from '../ScoreBars'

describe('MicButton', () => {
  it('idle is 124 on a phone and 150 from md, with the mic shadow', () => {
    render(<MicButton state="idle" level={0} onPress={() => {}} />)
    const b = screen.getByRole('button', { name: 'Bấm để nói' })
    expect(b).toHaveClass('h-[124px]', 'w-[124px]', 'md:h-[150px]', 'md:w-[150px]', 'shadow-mic')
    expect(screen.getByText('Chạm để nói nào!')).toBeInTheDocument()
  })
  it('recording grows to 150/190, shows two halos, level bars and the countdown instead of the caption', () => {
    render(<MicButton state="recording" level={0.5} onPress={() => {}} secondsLeft={13} />)
    const b = screen.getByRole('button', { name: 'Dừng' })
    expect(b).toHaveClass('h-[150px]', 'md:h-[190px]')
    expect(screen.getAllByTestId('mic-halo')).toHaveLength(2)
    expect(screen.getAllByTestId('level-bar')).toHaveLength(7)
    expect(screen.getByTestId('countdown')).toHaveTextContent('13')
    expect(screen.queryByText('Chạm để nói nào!')).toBeNull()
  })
  it('disabled shows the dashed spinner and the preparing caption; processing the hourglass', () => {
    const { rerender } = render(<MicButton state="disabled" level={0} onPress={() => {}} />)
    expect(screen.getByTestId('mic-spinner')).toHaveClass('animate-spin', 'border-dashed')
    expect(screen.getByText('Đang chuẩn bị máy chấm…')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    rerender(<MicButton state="processing" level={0} onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Đang chấm…' })).toHaveTextContent('⏳')
    expect(screen.getByText('Foxy đang chấm…')).toBeInTheDocument()
  })
  it('locked is disabled with the moon caption', () => {
    render(<MicButton state="locked" level={0} onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Hôm nay đã hết giờ' })).toBeDisabled()
  })
})

describe('Countdown', () => {
  it('is a 96px disc; two digits tighten the letter-spacing', () => {
    const { rerender } = render(<Countdown seconds={6} />)
    expect(screen.getByTestId('countdown')).toHaveClass('h-24', 'w-24', 'text-[44px]', 'bg-peach-50')
    rerender(<Countdown seconds={13} />)
    expect(screen.getByTestId('countdown')).toHaveClass('tracking-[-2px]')
  })
})

describe('LevelBars', () => {
  it('scales its seven bars with the level', () => {
    render(<LevelBars level={1} />)
    const bars = screen.getAllByTestId('level-bar')
    expect(bars[2]).toHaveStyle({ height: '28px' })
  })
})

describe('WordChip / ScoredWords', () => {
  it('is a 40px non-interactive chip with the tone glyph', () => {
    render(<ScoredWords words={[{ word: 'cat', tone: 'good' }, { word: 'dog', tone: 'fix' }]} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    const chip = screen.getByText(/cat/).closest('[data-testid="word-chip"]')!
    expect(chip).toHaveClass('h-10', 'rounded-r12', 'text-[15px]', 'border-[3px]', 'bg-good-50', 'border-good-300')
    expect(chip).toHaveTextContent('✓ cat')
  })
  it('unknown tone is the white question chip', () => {
    render(<WordChip word="/θ/" tone="unknown" />)
    expect(screen.getByTestId('word-chip')).toHaveTextContent('? /θ/')
    expect(screen.getByTestId('word-chip')).toHaveClass('bg-white', 'border-sand-edge')
  })
})

describe('ScoreBars', () => {
  it('is always a 2×2 grid with the three fill colours', () => {
    render(<ScoreBars result={{ accuracy: 88, fluency: 60, completeness: 40, prosody: null } as never} />)
    expect(screen.getByTestId('score-bars')).toHaveClass('grid-cols-2')
    expect(screen.getByTestId('score-bars').className).not.toMatch(/md:flex/)
    const bars = screen.getAllByTestId('score-bar')
    expect(bars[0]).toHaveClass('bg-good-300'); expect(bars[1]).toHaveClass('bg-sun-400'); expect(bars[2]).toHaveClass('bg-bar-low')
    expect(bars[3]).toHaveAttribute('data-value', 'none')
  })
})

describe('ResultCard', () => {
  const base = { stars: 3 as const, praise: 'Đọc có hồn quá! 🎉', score: 86, sub: '2 từ cần sửa', onRetry: () => {}, primary: { label: 'Tiếp theo →', onClick: () => {} } }
  it('lays the six rows in order and hides the hint at 2+ stars', () => {
    render(<MemoryRouter><ResultCard {...base} words={[{ word: 'I', tone: 'good' }]} bars={{ accuracy: 88, fluency: 81, completeness: 100, prosody: 84 } as never} hint={{ word: 'friend', tip: 'x' }} canReplay onReplay={() => {}} onSample={() => {}} /></MemoryRouter>)
    const ids = Array.from(screen.getByTestId('result-card').children).map(c => c.getAttribute('data-row'))
    expect(ids).toEqual(['head', 'words', 'bars', 'listen', 'cta'])
    expect(screen.getByRole('button', { name: '🎧 Nghe mình' })).toBeInTheDocument()
  })
  it('shows the hint below 2 stars and drops "Nghe mình" without a blob', () => {
    render(<MemoryRouter><ResultCard {...base} stars={1} praise="Thử lại nào!" hint={{ word: 'friend', tip: 'x' }} canReplay={false} onSample={() => {}} /></MemoryRouter>)
    expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '🎧 Nghe mình' })).toBeNull()
    expect(screen.getByRole('button', { name: '🔊 Nghe mẫu' })).toHaveClass('flex-1')
  })
  it('prosody pill reads the engine', () => {
    render(<MemoryRouter><ResultCard {...base} prosody={{ score: null, engine: 'webspeech' }} /></MemoryRouter>)
    expect(screen.getByTestId('prosody-chip')).toHaveTextContent('— ngữ điệu')
  })
})

describe('SpeakError', () => {
  it('renders the copy for the kind and forwards the action', () => {
    const onAction = vi.fn()
    render(<SpeakError error={{ kind: 'limit' }} onAction={onAction} onDismiss={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Hôm nay bé học đủ rồi! Mai gặp lại nhé')
    fireEvent.click(screen.getByRole('button', { name: 'Về nhà' }))
    expect(onAction).toHaveBeenCalledWith('limit')
  })
})
