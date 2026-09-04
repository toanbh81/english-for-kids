import { fireEvent, render, screen } from '@testing-library/react'
import { MinutesChart } from './MinutesChart'
import { RecordingRow } from './RecordingRow'
import { RemoteRow } from './RemoteRow'

// 14 consecutive days ending "today". Minutes are picked so the last four bars exercise all four
// colour bands: [10]=0 (line-200), [11]=8 (sun, >0 <20), [12]=25 (teal, >=20), [13]=today (coral,
// regardless of minutes).
function makeDays14() {
  const base = new Date('2026-08-21T00:00:00')
  const minutes = [5, 12, 0, 30, 4, 18, 0, 22, 6, 0, 0, 8, 25, 15]
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return { day: `${yyyy}-${mm}-${dd}`, minutes: minutes[i] }
  })
}
const DAYS14 = makeDays14()

const TS = new Date(2026, 8, 2, 9, 41).getTime() // 02/09 09:41
const LONG_61 = 'This is a sentence exactly sixty one characters long for truncation.'

describe('MinutesChart', () => {
  it('draws four bar colours, a 4% floor and 26px capped bars', () => {
    render(<MinutesChart days={DAYS14} limitMinutes={20} range={14} todayKey={DAYS14[13].day} />)
    const bars = screen.getAllByTestId('minute-bar')
    expect(bars).toHaveLength(14)
    expect(bars[13]).toHaveClass('bg-coral-500') // hôm nay
    expect(bars[12]).toHaveClass('bg-teal-500') // ≥20
    expect(bars[11]).toHaveClass('bg-sun-400') // >0
    expect(bars[10]).toHaveClass('bg-line-200', 'h-1') // 0 → cao 4
    expect(bars[0].parentElement).toHaveClass('flex-1', 'max-w-[26px]')
    expect(bars[0]).toHaveClass('rounded-[7px]')
    expect(screen.getByTestId('minutes-plot')).toHaveClass('h-[86px]', 'gap-[9px]', 'md:h-[120px]', 'md:gap-1.5')
  })

  it('labels three milestones, not fourteen, and names the target line', () => {
    render(<MinutesChart days={DAYS14} limitMinutes={20} range={14} todayKey={DAYS14[13].day} />)
    expect(screen.getAllByTestId('day-label')).toHaveLength(3)
    expect(screen.getByText('hôm nay')).toHaveClass('text-coral-text')
    expect(screen.getByText("mục tiêu 20'")).toHaveClass('text-[10px]', 'text-sun-700')
    expect(screen.getByTestId('target-line')).toHaveClass('border-t-2', 'border-dashed', 'border-sun-400')
  })

  it('range 7 draws seven bars and hides the range switch on the phone', () => {
    render(<MinutesChart days={DAYS14} limitMinutes={20} range={7} todayKey={DAYS14[13].day} onRangeChange={() => {}} />)
    expect(screen.getAllByTestId('minute-bar')).toHaveLength(7)
    expect(screen.getByTestId('range-switch')).toHaveClass('hidden', 'md:inline-flex')
    fireEvent.click(screen.getByRole('button', { name: '14' }))
  })

  it('with no history is the dashed empty box, never fourteen 2% bars', () => {
    render(<MinutesChart days={[]} limitMinutes={20} range={14} todayKey="" />)
    expect(screen.getByTestId('empty-state')).toHaveClass('min-h-[120px]', 'border-dashed')
    expect(screen.queryByTestId('minute-bar')).toBeNull()
  })
})

describe('RecordingRow', () => {
  it('is a 44px row: 36px teal play in a 44 hit, 11px date, one-line sentence, banded score', () => {
    render(<RecordingRow ts={TS} text={LONG_61} score={86} onPlay={() => {}} />)
    expect(screen.getByTestId('recording-row')).toHaveClass('flex', 'h-11', 'items-center', 'gap-2.5', 'border-b', 'border-line-200')
    const play = screen.getByRole('button', { name: 'Phát' })
    expect(play).toHaveClass('h-9', 'w-9', 'rounded-full', 'bg-teal-500', 'after:-inset-1')
    expect(play.className).not.toMatch(/md:h-16|h-11 w-11/)
    expect(screen.getByText('02/09 09:41')).toHaveClass('text-[11px]', 'font-extrabold', 'text-ink-300')
    expect(screen.getByText(LONG_61)).toHaveClass('truncate', 'text-[13px]')
    expect(screen.getByText('86')).toHaveClass('text-[11px]', 'text-good-700')
  })

  it('scores band at 80 and 50, and an absent score shows nothing at all', () => {
    const { rerender } = render(<RecordingRow ts={TS} text="hi" score={72} onPlay={() => {}} />)
    expect(screen.getByText('72')).toHaveClass('text-sun-700')
    rerender(<RecordingRow ts={TS} text="hi" score={48} onPlay={() => {}} />)
    expect(screen.getByText('48')).toHaveClass('text-fix-700')
    rerender(<RecordingRow ts={TS} text="hi" onPlay={() => {}} />)
    expect(screen.queryByTestId('recording-score')).toBeNull()
  })

  it('playing swaps ▶ for ❚❚ and draws a 3px bar; a failed play turns the row red', () => {
    const { rerender } = render(<RecordingRow ts={TS} text="hi" playing onPlay={() => {}} />)
    expect(screen.getByRole('button', { name: 'Dừng' })).toHaveTextContent('❚❚')
    expect(screen.getByTestId('recording-progress')).toHaveClass('h-[3px]', 'bg-teal-500')
    rerender(<RecordingRow ts={TS} text="hi" error onPlay={() => {}} />)
    expect(screen.getByTestId('recording-row')).toHaveClass('bg-fix-50')
    expect(screen.getByText('Không phát được')).toHaveClass('text-[11px]', 'text-fix-700')
  })
})

describe('RemoteRow', () => {
  it('squeezes every number into one ellipsised 11px line with a 36px row button', () => {
    render(<RemoteRow name="Nguyễn Hoàng Bảo Ngọc Anh Thư" sub="🔥 4 ngày · 58'/tuần · Nói 79 · Từ 77 · Câu 70 · Âm sai /θ/ 46" state="data" onAction={() => {}} />)
    expect(screen.getByTestId('remote-row')).toHaveClass('flex', 'min-h-[56px]', 'items-center', 'gap-2.5', 'border-b', 'border-line-200')
    expect(screen.getByText(/Nguyễn Hoàng/)).toHaveClass('truncate', 'text-[13px]', 'font-extrabold')
    expect(screen.getByText(/58'\/tuần/)).toHaveClass('truncate', 'text-[11px]', 'font-bold')
    expect(screen.getByRole('button', { name: 'Chi tiết' })).toHaveClass('h-9', 'rounded-r10', 'border-2', 'border-sand-edge', 'text-[12px]')
  })

  it('error offers a retry, thisDevice appends "· máy này", stale and empty have no button', () => {
    const { rerender } = render(<RemoteRow name="Bé · máy này" sub="Không tải được — kiểm tra mạng." state="error" onAction={() => {}} />)
    expect(screen.getByText(/Không tải được/)).toHaveClass('text-fix-700')
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
    rerender(<RemoteRow name="Minh" sub="Cập nhật 12 ngày trước · 🔥 0 · 0'/tuần" state="stale" onAction={() => {}} />)
    expect(screen.getByText(/12 ngày trước/)).toHaveClass('text-ink-300')
    rerender(<RemoteRow name="Bé" sub="Chưa có dữ liệu trên máy chủ." state="empty" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('loading renders the Phase-12 skeleton instead of the row', () => {
    render(<RemoteRow name="Bé" sub="…" state="loading" />)
    expect(screen.queryByTestId('remote-row')).toBeNull()
  })
})
