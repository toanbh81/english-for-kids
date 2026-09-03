import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MicButton, Countdown, LevelBars, ResultCard, SpeakError, SpeakPrompt, WordChip } from './index'
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
  it('lets a screen override the disabled caption (SentenceBuilder\'s pre-correct mic)', () => {
    render(<MicButton state="disabled" level={0} onPress={() => {}} caption="Xếp đúng câu trước nhé" />)
    expect(screen.getByText('Xếp đúng câu trước nhé')).toBeInTheDocument()
    expect(screen.queryByText('Đang chuẩn bị máy chấm…')).not.toBeInTheDocument()
  })
  it('locked is disabled with the moon caption', () => {
    render(<MicButton state="locked" level={0} onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Hôm nay đã hết giờ' })).toBeDisabled()
  })
  it('lays the level bars and countdown in one row by default, column when asked', () => {
    const { rerender } = render(<MicButton state="recording" level={0.5} onPress={() => {}} secondsLeft={13} />)
    expect(screen.getByTestId('countdown-row')).toHaveClass('flex-row', 'gap-3.5')
    expect(screen.getByTestId('countdown')).toHaveClass('min-w-[56px]', 'md:min-w-[70px]')
    rerender(<MicButton state="recording" level={0.5} onPress={() => {}} secondsLeft={13} countdownLayout="column" />)
    expect(screen.getByTestId('countdown-row')).toHaveClass('flex-col')
  })
})

describe('Countdown', () => {
  it('is a badge; two digits tighten the letter-spacing', () => {
    const { rerender } = render(<Countdown seconds={6} />)
    const el = screen.getByTestId('countdown')
    expect(el).toHaveClass('min-w-[56px]', 'text-[44px]', 'bg-peach-50', 'md:min-w-[70px]', 'md:text-[56px]')
    expect(el).toHaveAttribute('aria-live', 'polite')
    rerender(<Countdown seconds={13} />)
    expect(screen.getByTestId('countdown')).toHaveClass('tracking-[-2px]')
  })
})

describe('SpeakPrompt', () => {
  it('shows Foxy and the seconds in coral', () => {
    render(<SpeakPrompt mood="idle" say="Đọc cả đoạn thật có hồn nhé!" seconds={13} />)
    expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'idle')
    expect(screen.getByText('13 giây')).toHaveClass('text-coral-text')
  })

  /** Fix round 1: the bubble was breaking one word per line once it had to share a wrapped
   * iPad-portrait row with the error banner. Capping its own width (rather than the row
   * squeezing it) keeps it wrapping at word boundaries across two lines instead of one word each;
   * the outer row stays `shrink-0` so the row-level flex-wrap (PageBody's act container) is what
   * gives way, not this component. */
  it('caps the bubble width and refuses to shrink the row below it', () => {
    render(<SpeakPrompt mood="idle" say="Đọc cả đoạn thật có hồn nhé!" seconds={13} />)
    const bubble = screen.getByText(/Đọc cả đoạn/).closest('div')!
    expect(bubble).toHaveClass('max-w-[240px]', 'md:max-w-[300px]')
    expect(bubble.parentElement).toHaveClass('shrink-0')
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
    const listenBtn = screen.getByRole('button', { name: '🎧 Nghe mình' })
    expect(listenBtn).toBeInTheDocument()
    expect(listenBtn).toHaveClass('h-12', 'relative')
    expect(listenBtn.className).toMatch(/after:-inset-2\b/)
    expect(listenBtn.className).toMatch(/after:content-\[['"]{2}\]/)
  })
  it('shows the hint below 2 stars and drops "Nghe mình" without a blob', () => {
    render(<MemoryRouter><ResultCard {...base} stars={1} praise="Thử lại nào!" hint={{ word: 'friend', tip: 'x' }} canReplay={false} onSample={() => {}} /></MemoryRouter>)
    expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '🎧 Nghe mình' })).toBeNull()
    const sampleBtn = screen.getByRole('button', { name: '🔊 Nghe mẫu' })
    expect(sampleBtn).toHaveClass('flex-1', 'h-12', 'relative')
    expect(sampleBtn.className).toMatch(/after:-inset-2\b/)
    expect(sampleBtn.className).toMatch(/after:content-\[['"]{2}\]/)
  })
  it('prosody pill reads the engine', () => {
    render(<MemoryRouter><ResultCard {...base} prosody={{ score: null, engine: 'webspeech' }} /></MemoryRouter>)
    expect(screen.getByTestId('prosody-chip')).toHaveTextContent('— ngữ điệu')
  })
  it('fox row sits after the listen row; compact keeps only head, hint and cta; forceHint shows the hint at 2 stars', () => {
    render(<MemoryRouter><ResultCard stars={2} praise="x" hint={{ word: 'w', tip: 't' }} forceHint fox={{ mood: 'cheer', say: 'Giọng vui thật đấy!' }} onSample={() => {}} onRetry={() => {}} /></MemoryRouter>)
    const rows = Array.from(screen.getByTestId('result-card').children).map(c => c.getAttribute('data-row'))
    expect(rows).toEqual(['head', 'hint', 'listen', 'fox', 'cta'])
    render(<MemoryRouter><ResultCard compact stars={1} praise="y" words={[{ word: 'a', tone: 'fix' }]} bars={{ accuracy: 1, fluency: 1, completeness: 1 } as never} hint={{ word: 'w', tip: 't' }} onRetry={() => {}} /></MemoryRouter>)
    const rows2 = Array.from(screen.getAllByTestId('result-card')[1].children).map(c => c.getAttribute('data-row'))
    expect(rows2).toEqual(['head', 'hint', 'cta'])
  })
})

describe('SpeakError', () => {
  it('renders the copy for the kind and forwards the action', () => {
    const onAction = vi.fn()
    render(<SpeakError error={{ kind: 'limit' }} onAction={onAction} onDismiss={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Hôm nay bé học đủ rồi! Mai gặp lại nhé')
    const actionBtn = screen.getByRole('button', { name: 'Về nhà' })
    expect(actionBtn).toHaveClass('relative', 'min-h-[44px]', 'min-w-[44px]')
    expect(actionBtn.className).toMatch(/after:-inset-2\.5\b/)
    expect(actionBtn.className).toMatch(/after:content-\[['"]{2}\]/)
    fireEvent.click(actionBtn)
    expect(onAction).toHaveBeenCalledWith('limit')
  })

  /** Fix round 1: on iPad portrait (`md:` without `ipad:`) the banner reorders ahead of the
   * prompt/mic instead of squeezing them onto one line; real iPad landscape (`ipad:`) and phone
   * (unprefixed) keep document order — prompt → error → mic. Fix round 2: `ipad:order-none` needs
   * no `!important` any more — the `ipad` variant itself now compiles to `:is(&)` (see
   * tailwind.config.ts), which outranks any single-class `md:` rule on specificity alone, so a
   * plain `ipad:order-none` beats `md:order-first` on a real iPad landscape without help here. */
  it('reorders ahead of the rest on iPad portrait, and stays in place on landscape', () => {
    render(<SpeakError error={{ kind: 'limit' }} onAction={() => {}} onDismiss={() => {}} />)
    expect(screen.getByRole('alert')).toHaveClass('md:order-first', 'md:mx-auto', 'ipad:order-none')
    // The max width from before is untouched — only centred, never widened past it.
    expect(screen.getByRole('alert')).toHaveClass('w-full', 'max-w-[440px]')
  })
})
