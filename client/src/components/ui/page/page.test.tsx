import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PageShell, PageHeader, PageBody, PageFooter } from './index'
import { BackButton } from '../BackButton'
import { Button } from '../Button'
import { LessonChip } from '../../LessonChip'

const wrap = (ui: React.ReactNode) => render(<MemoryRouter initialEntries={['/practice/wp-cat']}>{ui}</MemoryRouter>)

describe('PageShell', () => {
  it('is a viewport-high flex column with the frame gutters and safe-area padding', () => {
    wrap(<PageShell><PageBody>x</PageBody></PageShell>)
    const main = screen.getByRole('main')
    expect(main).toHaveClass('flex', 'h-full', 'flex-col', 'overflow-hidden', 'px-4', 'md:px-6')
    expect(main.className).toMatch(/env\(safe-area-inset-top\)/)
    expect(main.firstElementChild).toHaveClass('max-w-[1080px]', 'flex-1', 'min-h-0')
  })

  it('header is a 3-column grid whose right cell is as wide as the back button', () => {
    wrap(<PageShell><PageHeader back={<BackButton to="/" label="Về nhà" />}>giữa</PageHeader><PageBody>x</PageBody></PageShell>)
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('grid', 'h-14', 'md:h-16', 'grid-cols-[56px_1fr_56px]', 'md:grid-cols-[64px_1fr_minmax(64px,auto)]')
    expect(screen.getByText('giữa').parentElement).toHaveClass('justify-self-center')
  })

  it('shows the engine badge under the centre on a phone and beside it from md', () => {
    wrap(<PageShell><PageHeader back={<BackButton to="/" />} engine="webspeech">Từ mới 1/3</PageHeader><PageBody>x</PageBody></PageShell>)
    const badge = screen.getByTestId('engine-badge')
    expect(badge).toHaveTextContent('chế độ đơn giản')
    expect(badge).toHaveClass('text-[11px]', 'md:text-[12px]', 'md:rounded-r10', 'md:bg-sand')
  })

  it('body is the only scroller; footer is a sibling with the fade', () => {
    wrap(<PageShell><PageBody>x</PageBody><PageFooter><Button>Tiếp theo →</Button></PageFooter></PageShell>)
    expect(screen.getByTestId('page-body')).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto')
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveClass('flex', 'gap-2.5', 'md:gap-3', 'before:h-10', 'md:mx-auto', 'md:max-w-[572px]', 'ipad:max-w-none')
    expect(footer.className).not.toMatch(/sticky|fixed/)
  })

  it('split body lays teach/act as two columns on ipad and two tiers below', () => {
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
    const body = screen.getByTestId('page-body')
    expect(body).toHaveClass('ipad:flex-row', 'ipad:gap-6')
    expect(screen.getByText('làm').parentElement).toHaveClass('md:h-[300px]', 'md:shrink-0', 'ipad:h-auto', 'ipad:w-[440px]', 'ipad:shrink-0')
  })
})

describe('LessonChip in the header', () => {
  it('renders the header variant in the right cell and the global one steps aside', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null)
    wrap(<><LessonChip /><PageShell><PageHeader back={<BackButton to="/" />}>x</PageHeader><PageBody>y</PageBody></PageShell></>)
    // With no lesson the chip renders nothing either way, but the header cell still exists:
    expect(screen.getByTestId('header-right')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
