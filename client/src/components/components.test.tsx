import { render, screen, fireEvent } from '@testing-library/react'
import { MicButton } from './speak/MicButton'; import { Stars } from './Stars'
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
it('ScoredWords renders non-interactive WordChips tinted by tone', () => {
  render(<ScoredWords words={[{ word: 'three', tone: 'fix' }, { word: 'cats', tone: 'good' }]} />)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  const fix = screen.getByText(/three/).closest('[data-testid="word-chip"]')!
  expect(fix).toHaveClass('bg-fix-50', 'border-fix-300', 'h-10', 'rounded-r12')
  expect(fix).toHaveAttribute('aria-label', 'three cần sửa')
})
it('HintCard shows word and tip in the compact card', () => {
  render(<HintCard hint={{ word: 'three', phoneme: 'th', tip: 'Đặt lưỡi giữa răng.' }} />)
  expect(screen.getByText(/Sửa từ này/)).toHaveTextContent('Sửa từ này: three (âm "th") — Đặt lưỡi giữa răng.')
})
it('ScoreBars draws one bar per pronunciation dimension', () => {
  render(<ScoreBars result={{ overall: 80, accuracy: 90, fluency: 70, completeness: 100, prosody: 55, words: [], engine: 'azure' }} />)
  const bars = screen.getAllByTestId('score-bar')
  expect(bars).toHaveLength(4)
  expect(bars.map(b => b.style.width)).toEqual(['90%', '70%', '100%', '55%'])
  expect(screen.getByText('Trôi chảy')).toBeInTheDocument()
})

/**
 * Brief §15 lists a 2×2 `ScoreBars` grid on the iPad as one of the ten things that break
 * 1194×834: it doubles the block's height and pushes "Tiếp theo" off the bottom — a bug this app
 * has already fixed once. So the grid is always the 2×2 arrangement, at every width.
 */
it('ScoreBars is always a 2×2 grid, never the landscape row', () => {
  render(<ScoreBars result={{ overall: 80, accuracy: 90, fluency: 70, completeness: 100, prosody: 55, words: [], engine: 'azure' }} />)
  const box = screen.getByTestId('score-bars')
  expect(box).toHaveClass('grid', 'grid-cols-2')
  expect(box.className).not.toMatch(/md:flex/)
  // The bar track: full-width, 10 px, at every width.
  const track = screen.getAllByTestId('score-bar')[0].parentElement!
  expect(track).toHaveClass('h-2.5', 'w-full', 'rounded-r10', 'bg-track')
  expect(screen.getAllByTestId('score-bar')[0]).toHaveClass('bg-good-300')
})

/** An unmeasured prosody must never be dressed up as accuracy: the bar stays empty and says so,
 * or it silently contradicts the "Chưa chấm được ngữ điệu" chip standing right above it. */
it('ScoreBars leaves the prosody bar empty when the engine did not measure it', () => {
  render(<ScoreBars result={{ overall: 80, accuracy: 90, fluency: 70, completeness: 100, words: [], engine: 'webspeech' }} />)
  const bars = screen.getAllByTestId('score-bar')
  expect(bars).toHaveLength(4)
  expect(bars[3].style.width).toBe('0%')
  expect(bars[3]).toHaveAttribute('data-value', 'none')
  expect(bars[3]).toHaveAttribute('aria-label', expect.stringContaining('chưa chấm được'))
  // The three measured bars are untouched.
  expect(bars.slice(0, 3).map(b => b.style.width)).toEqual(['90%', '70%', '100%'])
})
