import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PageShell, PageHeader, PageBody, PageFooter } from './index'
import { BackButton } from '../BackButton'
import { Button } from '../Button'

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
    expect(body).toHaveClass('ipad:flex-row', 'ipad:gap-6', 'ipad:overflow-visible')
    expect(screen.getByText('làm').parentElement).toHaveClass('md:min-h-[300px]', 'md:shrink-0', 'ipad:h-auto', 'ipad:max-h-full', 'ipad:w-[440px]', 'ipad:shrink-0')
  })

  /** Fix round 2: below `md` neither split column may shrink below its own content — a shrunk
   * column's overflow isn't clipped by its own box, so it visually lands on top of the other
   * column (confirmed via `shots/short/practice-idle.png`: the act column's Foxy bubble drawn
   * over the teach column's button row). Page-body's own `overflow-y-auto` handles content that
   * doesn't fit on a phone; `md:`/`ipad:` restore the shrink-with-internal-scroll pairing once
   * there is room for two columns (side by side on `ipad`, stacked-with-space at plain `md`). */
  it('neither split column may shrink below its own content on a phone; both shrink with their own scroll from md up', () => {
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
    const teachOuter = screen.getByText('dạy').parentElement!.parentElement!
    expect(teachOuter).toHaveClass('flex-[1_0_auto]', 'md:min-h-0', 'md:flex-1', 'md:overflow-y-auto')
    // The old unprefixed `min-h-0` (live on a phone too) is exactly what let the teach column
    // shrink past its content there — gone from the base class list, `md:min-h-0` only.
    expect(teachOuter.className.split(/\s+/)).not.toContain('min-h-0')
    // `flex-1` is `flex: 1 1 0%` — the shrink this rule exists to forbid. `toHaveClass` is a subset
    // check, so it must be denied explicitly, exactly like `min-h-0` above.
    expect(teachOuter.className.split(/\s+/)).not.toContain('flex-1')

    const act = screen.getByText('làm').parentElement!
    expect(act).toHaveClass('shrink-0')
  })

  it('both split columns scroll independently on ipad (the outer body stays overflow-visible)', () => {
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
    // `dạy` sits inside PageBody's own `my-auto` centring wrapper (see below), one level under
    // the scrolling column itself.
    expect(screen.getByText('dạy').parentElement!.parentElement).toHaveClass('ipad:min-h-0', 'ipad:overflow-y-auto')
    expect(screen.getByText('làm').parentElement).toHaveClass('ipad:min-h-0', 'ipad:overflow-y-auto')
  })

  /** Fix round 2: `justify-center` on the scrolling teach column clips the *top* of its content
   * once that content no longer fits (a shrunk portrait column, once the act row below it has
   * grown past its 300px floor — see the act-row test below) — centred-but-overflowing content is
   * pushed above the box's own top edge, past where page-body's scroll can ever reach it. `my-auto`
   * on an inner wrapper centres the same way when there is slack, but collapses to 0 (ordinary
   * top-aligned flow) the moment there isn't, so the overflow is always at the bottom instead. */
  it('centres the teach column with margin instead of justify-content, so overflow never clips the top', () => {
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
    const outer = screen.getByText('dạy').parentElement!.parentElement!
    expect(outer.className).not.toMatch(/\bjustify-center\b/)
    expect(screen.getByText('dạy').parentElement).toHaveClass('my-auto')
  })

  it('collapsed split body shows the strip on a phone/portrait and keeps the teach column CSS-visible on iPad landscape', () => {
    const onExpand = vi.fn()
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p>, collapsed: { emoji: '😊', label: 'I love my dog!', onExpand } }} /></PageShell>)
    // Both the strip and the teach column render — CSS (not JS) decides which one shows, since a
    // screen has no way to detect the compound `ipad` landscape variant at runtime.
    expect(screen.getByText('dạy').parentElement!.parentElement).toHaveClass('hidden', 'ipad:flex')
    const strip = screen.getByRole('button', { name: /mở/ })
    expect(strip).toHaveClass('h-8', 'text-[15px]', 'text-[#D9C9AE]', 'md:h-16', 'md:bg-white', 'ipad:hidden')
    fireEvent.click(strip)
    expect(onExpand).toHaveBeenCalled()
  })

  it('act column is a row on iPad portrait and a column on landscape', () => {
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
    expect(screen.getByText('làm').parentElement).toHaveClass('md:flex-row', 'md:gap-10', 'ipad:flex-col')
  })

  /** Fix round 1: on iPad portrait an error banner (`md:order-first`, SpeakError.tsx) needs to
   * wrap onto its own row above the prompt+mic rather than squeezing them sideways — landscape
   * (`ipad:`) stays a non-wrapping row so the three sit side by side as before. */
  it('act row wraps on iPad portrait and stays a single line on iPad landscape', () => {
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
    expect(screen.getByText('làm').parentElement).toHaveClass('md:flex-wrap', 'ipad:flex-nowrap')
  })

  it('actGrow swaps the 300px-floor act column for one that fills the remaining height', () => {
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
    expect(screen.getByText('làm').parentElement).toHaveClass('md:min-h-[300px]', 'md:shrink-0')
    expect(screen.getByText('làm').parentElement).not.toHaveClass('md:flex-1')

    wrap(<PageShell><PageBody actGrow split={{ teach: <p>dạy 2</p>, act: <p>làm 2</p> }} /></PageShell>)
    const grownAct = screen.getByText('làm 2').parentElement!
    expect(grownAct).toHaveClass('md:flex-1', 'md:min-h-0')
    expect(grownAct.className).not.toMatch(/md:min-h-\[300px\]/)
  })
})

describe('PageHeader dimmed', () => {
  it('dimmed header fades and disables back and right cells', () => {
    wrap(<PageShell><PageHeader dimmed back={<BackButton to="/" label="Về nhà" />}>x</PageHeader><PageBody>y</PageBody></PageShell>)
    expect(screen.getByRole('link', { name: 'Về nhà' }).parentElement).toHaveClass('opacity-40', 'pointer-events-none')
    expect(screen.getByTestId('header-right')).toHaveClass('opacity-40', 'pointer-events-none')
  })
})

describe('LessonChip in the header', () => {
  it('renders in the header\'s right cell by default', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null)
    wrap(<PageShell><PageHeader back={<BackButton to="/" />}>x</PageHeader><PageBody>y</PageBody></PageShell>)
    // With no lesson the chip renders nothing, but the header cell still exists:
    expect(screen.getByTestId('header-right')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
