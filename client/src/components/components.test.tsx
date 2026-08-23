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
  render(<ScoreBars result={{ overall: 80, accuracy: 90, fluency: 70, completeness: 100, words: [], engine: 'azure' }} />)
  const bars = screen.getAllByTestId('score-bar')
  expect(bars).toHaveLength(4)
  expect(bars.map(b => b.style.width)).toEqual(['90%', '70%', '100%', '90%']) // prosody falls back to accuracy
  expect(screen.getByText('Ngữ điệu')).toBeInTheDocument()
})
