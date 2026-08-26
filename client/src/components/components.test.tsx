import { render, screen, fireEvent } from '@testing-library/react'
import { MicButton } from './MicButton'; import { Stars } from './Stars'
import { ScoredWords } from './ScoredWords'; import { HintCard } from './HintCard'
import { ScoreBars } from './ScoreBars'

it('MicButton calls onPress and is disabled when disabled', () => {
  const fn = vi.fn()
  const { rerender } = render(<MicButton state="idle" level={0} onPress={fn} />)
  fireEvent.click(screen.getByRole('button', { name: /nói/i })); expect(fn).toHaveBeenCalled()
  rerender(<MicButton state="disabled" level={0} onPress={fn} />)
  expect(screen.getByRole('button')).toBeDisabled()
})
it('Stars renders 3 stars with filled count', () => {
  render(<Stars value={2} />)
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getAllByTestId('star-empty')).toHaveLength(1)
})
it('ScoredWords applies tone classes and names the tone on the button', () => {
  render(<ScoredWords words={[{ word: 'three', tone: 'fix' }, { word: 'cats', tone: 'good' }]} />)
  expect(screen.getByText('three')).toHaveClass('text-fix-700')
  const fix = screen.getByRole('button', { name: /cần sửa/ })
  expect(fix).toHaveAccessibleName('three cần sửa')
  expect(fix).toHaveClass('min-h-[64px]', 'bg-fix-50', 'border-fix-300') // 64px tap target for small fingers
})
it('HintCard shows word and tip', () => {
  render(<HintCard hint={{ word: 'three', phoneme: 'th', tip: 'Đặt lưỡi giữa răng.' }} />)
  expect(screen.getByText(/three/)).toBeInTheDocument(); expect(screen.getByText('Đặt lưỡi giữa răng.')).toBeInTheDocument()
})
it('ScoreBars draws one bar per pronunciation dimension', () => {
  render(<ScoreBars result={{ overall: 80, accuracy: 90, fluency: 70, completeness: 100, prosody: 55, words: [], engine: 'azure' }} />)
  const bars = screen.getAllByTestId('score-bar')
  expect(bars).toHaveLength(4)
  expect(bars.map(b => b.style.width)).toEqual(['90%', '70%', '100%', '55%'])
  expect(screen.getByText('Ngữ điệu')).toBeInTheDocument()
})

/**
 * Brief §15 lists a 2×2 `ScoreBars` grid on the iPad as one of the ten things that break
 * 1194×834: it doubles the block's height and pushes "Tiếp theo" off the bottom — a bug this app
 * has already fixed once. So the grid is the phone arrangement and 768 hands the wide row back.
 * Colours and the teal fill do not change across breakpoints; only the arrangement does.
 */
it('ScoreBars is a 2×2 grid on a phone and the landscape row from `md` up', () => {
  render(<ScoreBars result={{ overall: 80, accuracy: 90, fluency: 70, completeness: 100, prosody: 55, words: [], engine: 'azure' }} />)
  const box = screen.getAllByTestId('score-bar')[0].parentElement!.parentElement!.parentElement!
  expect(box).toHaveClass('grid', 'grid-cols-2')
  expect(box).toHaveClass('md:flex', 'md:flex-wrap', 'md:gap-6')
  // The bar itself: full-width and 10 px on a phone, the fixed 130×12 of the landscape row above.
  const track = screen.getAllByTestId('score-bar')[0].parentElement!
  expect(track).toHaveClass('h-2.5', 'w-full', 'md:h-3', 'md:w-[130px]')
  expect(screen.getAllByTestId('score-bar')[0]).toHaveClass('bg-teal-500')
})

/** An unmeasured prosody must never be dressed up as accuracy: the bar stays empty and says so,
 * or it silently contradicts the "Chưa chấm được ngữ điệu" chip standing right above it. */
it('ScoreBars leaves the prosody bar empty when the engine did not measure it', () => {
  render(<ScoreBars result={{ overall: 80, accuracy: 90, fluency: 70, completeness: 100, words: [], engine: 'webspeech' }} />)
  const bars = screen.getAllByTestId('score-bar')
  expect(bars).toHaveLength(4)
  expect(bars[3].style.width).toBe('0%')
  expect(bars[3]).toHaveAttribute('data-value', 'none')
  expect(screen.getByText('Ngữ điệu —')).toBeInTheDocument()
  expect(screen.queryByText('Ngữ điệu')).not.toBeInTheDocument()
  // The three measured bars are untouched.
  expect(bars.slice(0, 3).map(b => b.style.width)).toEqual(['90%', '70%', '100%'])
})
