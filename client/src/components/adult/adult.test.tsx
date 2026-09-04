import { fireEvent, render, screen, within } from '@testing-library/react'
import { FieldRow } from './FieldRow'
import { Panel } from './Panel'
import { PanelGrid } from './PanelGrid'
import { SegRow } from './SegRow'
import { Stepper } from './Stepper'

describe('Panel', () => {
  it('is white r16 with the 13/14px title and the phone/iPad padding pair', () => {
    render(<Panel title="Phút luyện mỗi ngày"><i /></Panel>)
    expect(screen.getByTestId('panel')).toHaveClass('flex', 'flex-col', 'gap-2', 'rounded-r16', 'bg-white', 'px-3.5', 'py-3', 'shadow-card-xs', 'md:gap-2.5', 'md:px-4', 'md:py-3.5')
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('font-display', 'text-[13px]', 'font-extrabold', 'text-ink-900', 'md:text-[14px]')
  })

  it('right slot sits on the title row; col=full spans every frame', () => {
    render(<Panel title="⏰ Giới hạn mỗi ngày" col="full" right={<span>Hôm nay: 12/25'</span>}><i /></Panel>)
    expect(screen.getByText("Hôm nay: 12/25'").parentElement).toHaveClass('flex', 'items-center', 'justify-between', 'gap-2')
    expect(screen.getByTestId('panel')).toHaveClass('md:col-span-2', 'ipad:col-span-3')
  })

  it('a collapsible Panel is a 56px row with a chevron on the phone and open from md up', () => {
    render(<Panel title="Bản ghi gần đây · 20" collapsible><b>row</b></Panel>)
    const summary = screen.getByRole('button', { name: /Bản ghi gần đây/ })
    expect(summary).toHaveClass('flex', 'min-h-[56px]', 'items-center', 'justify-between', 'md:hidden')
    expect(screen.getByText('▸')).toHaveClass('text-[14px]', 'text-ink-300')
    fireEvent.click(summary)
    expect(screen.getByText('▾')).toBeInTheDocument()
    expect(screen.getByText('row')).toBeVisible()
  })

  it('the collapsible summary exposes its open/closed state via aria-expanded', () => {
    render(<Panel title="Bản ghi gần đây · 20" collapsible><b>row</b></Panel>)
    const summary = screen.getByRole('button', { name: /Bản ghi gần đây/ })
    expect(summary).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(summary)
    expect(summary).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(summary)
    expect(summary).toHaveAttribute('aria-expanded', 'false')
  })

  it('a collapsible Panel with a right slot still shows it in the phone summary row', () => {
    render(<Panel title="⏰ Giới hạn mỗi ngày" collapsible right={<span>Hôm nay: 12/25'</span>}><i /></Panel>)
    const summary = screen.getByRole('button', { name: /Giới hạn mỗi ngày/ })
    expect(within(summary).getByText("Hôm nay: 12/25'")).toBeInTheDocument()
  })

  it('a scroll Panel gets the flex-1 scroller and the 40px bottom fade', () => {
    render(<Panel title="Tiến độ từ xa" scroll><i /></Panel>)
    expect(screen.getByTestId('panel-scroll')).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'after:sticky', 'after:bottom-0', 'after:h-10', 'after:to-white')
  })

  it('testId overrides the default data-testid', () => {
    render(<Panel title="Tài khoản" testId="account-panel"><i /></Panel>)
    expect(screen.getByTestId('account-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument()
  })
})

describe('PanelGrid', () => {
  it('is 1/2/3 columns with gap 10/14 and no lg:', () => {
    render(<PanelGrid><i /></PanelGrid>)
    const grid = screen.getByTestId('panel-grid')
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'gap-2.5', 'md:grid-cols-2', 'md:gap-3.5', 'ipad:grid-cols-3')
    expect(grid.className).not.toMatch(/\blg:|\bsm:/)
  })
})

describe('FieldRow', () => {
  it('12px label above, 44px input, an 18px error gutter that is always there, 11px help', () => {
    render(<FieldRow label="Email của bố mẹ" htmlFor="e" input={<input id="e" className="h-11" />} help="Chỉ dùng để gửi mã xác nhận và giữ tiến độ. Không gửi quảng cáo." />)
    expect(screen.getByText('Email của bố mẹ')).toHaveClass('text-[12px]', 'font-extrabold', 'text-ink-500')
    expect(screen.getByTestId('field-error')).toHaveClass('min-h-[18px]', 'text-[12px]', 'font-extrabold', 'text-fix-700')
    expect(screen.getByTestId('field-error')).toBeEmptyDOMElement()
    expect(screen.getByText(/Không gửi quảng cáo/)).toHaveClass('text-[11px]', 'font-bold', 'text-ink-300')
  })

  it('error keeps the layout still and can carry a 44px retry inside the gutter', () => {
    const onClick = vi.fn()
    render(<FieldRow label="Mã 6 số" input={<input />} error="Không kết nối được máy chủ — thử lại sau" action={{ label: 'Thử lại', onClick }} />)
    expect(screen.getByTestId('field-error')).toHaveTextContent('Không kết nối được máy chủ — thử lại sau')
    const retry = screen.getByRole('button', { name: 'Thử lại' })
    expect(retry).toHaveClass('h-11', 'rounded-r12', 'border-2', 'border-sand-edge', 'text-[12px]')
    fireEvent.click(retry); expect(onClick).toHaveBeenCalled()
  })
})

describe('SegRow', () => {
  it('44px segs, three tones, dim is the dashed sand one', () => {
    render(<SegRow segs={[
      { key: 'a', label: 'Tự động', tone: 'on', onClick: () => {} },
      { key: '1', label: '1', tone: 'off', onClick: () => {} },
      { key: '2', label: '2', tone: 'dim', onClick: () => {} },
    ]} />)
    const segs = screen.getAllByTestId('seg')
    expect(segs[0]).toHaveClass('h-11', 'flex-1', 'rounded-r12', 'text-[13px]', 'bg-coral-500', 'text-white')
    expect(segs[1]).toHaveClass('border-2', 'border-line-200', 'bg-cream-50', 'text-ink-500')
    expect(segs[2]).toHaveClass('bg-[#EFE2CC]', 'text-ink-500', 'border-2', 'border-dashed', 'border-[#D9CBB4]')
    expect(segs[2]).toHaveAttribute('data-tone', 'dim')
    expect(segs.every(s => !/min-h-\[64px\]|md:h-16/.test(s.className))).toBe(true)
  })

  it('aria-pressed follows tone — only the on seg reads as pressed', () => {
    render(<SegRow segs={[
      { key: 'a', label: 'Tự động', tone: 'on', onClick: () => {} },
      { key: '1', label: '1', tone: 'off', onClick: () => {} },
      { key: '2', label: '2', tone: 'dim', onClick: () => {} },
    ]} />)
    const segs = screen.getAllByTestId('seg')
    expect(segs[0]).toHaveAttribute('aria-pressed', 'true')
    expect(segs[1]).toHaveAttribute('aria-pressed', 'false')
    expect(segs[2]).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a seg calls its own onClick', () => {
    const onClick = vi.fn()
    render(<SegRow segs={[{ key: 'a', label: '10', tone: 'off', onClick }]} />)
    fireEvent.click(screen.getByText('10'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Stepper', () => {
  it('36px −/+ inside a 44 hit band, a 64×36 teal box, step 5 clamped to 5..60', () => {
    const onChange = vi.fn()
    render(<Stepper value={25} onChange={onChange} label="Tuỳ chỉnh" />)
    const minus = screen.getByRole('button', { name: 'Giảm' })
    expect(minus).toHaveClass('h-9', 'w-9', 'rounded-r10', 'bg-sand', 'relative', 'after:absolute', 'after:-inset-1')
    expect(screen.getByTestId('stepper-value')).toHaveClass('h-9', 'w-16', 'rounded-r10', 'border-2', 'border-teal-500', 'font-display', 'text-[16px]', 'text-teal-600')
    fireEvent.click(screen.getByRole('button', { name: 'Tăng' })); expect(onChange).toHaveBeenCalledWith(30)
    fireEvent.click(minus); expect(onChange).toHaveBeenCalledWith(20)
    expect(screen.getByText('5–60, bước 5')).toHaveClass('text-[11px]')
  })

  it('never emits a number outside 5..60 and keeps a hidden input for a11y, named after the custom label', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Stepper value={60} onChange={onChange} label="Tuỳ chỉnh" />)
    fireEvent.click(screen.getByRole('button', { name: 'Tăng' })); expect(onChange).not.toHaveBeenCalled()
    rerender(<Stepper value={5} onChange={onChange} label="Tuỳ chỉnh" />)
    fireEvent.click(screen.getByRole('button', { name: 'Giảm' })); expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Tuỳ chỉnh')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('Tuỳ chỉnh')).toHaveClass('sr-only')
  })

  it('falls back to "Phút mỗi ngày" as both the visible and hidden-input label when none is given', () => {
    render(<Stepper value={25} onChange={() => {}} />)
    expect(screen.getByText('Phút mỗi ngày')).toBeInTheDocument()
    expect(screen.getByLabelText('Phút mỗi ngày')).toHaveAttribute('type', 'number')
  })

  it('width=56 locks the value box narrow at every width', () => {
    render(<Stepper value={25} onChange={() => {}} label="Tuỳ chỉnh" width={56} />)
    expect(screen.getByTestId('stepper-value')).toHaveClass('w-14')
    expect(screen.getByTestId('stepper-value')).not.toHaveClass('w-16')
  })
})
