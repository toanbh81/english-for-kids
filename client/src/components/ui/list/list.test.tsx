import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ListGrid } from './ListGrid'
import { ListRow } from './ListRow'
import { StickyGroup } from './StickyGroup'
import { Tile } from './Tile'

describe('list frame', () => {
  it('ListGrid sm is 3/5/6 columns, lg is 2/3/4, gap 8 phone / 12 iPad, no lg:', () => {
    const { rerender } = render(<MemoryRouter><ListGrid><i /></ListGrid></MemoryRouter>)
    expect(screen.getByTestId('list-grid')).toHaveClass('grid', 'grid-cols-3', 'gap-2', 'md:grid-cols-5', 'md:gap-3', 'ipad:grid-cols-6')
    rerender(<MemoryRouter><ListGrid size="lg"><i /></ListGrid></MemoryRouter>)
    expect(screen.getByTestId('list-grid')).toHaveClass('grid-cols-2', 'md:grid-cols-3', 'ipad:grid-cols-4')
    expect(screen.getByTestId('list-grid').className).not.toMatch(/\blg:/)
  })

  it('Tile sm: 110/136, emoji 40/56, word 15/19, chip 11, stars 13', () => {
    render(<MemoryRouter><Tile to="/x" emoji="🐘" title="elephant" chip={{ tone: 'sun', label: '🔓' }} stars={2} /></MemoryRouter>)
    const tile = screen.getByTestId('tile')
    expect(tile).toHaveClass('h-[110px]', 'gap-[5px]', 'rounded-r18', 'bg-white', 'shadow-card-sm', 'px-1.5', 'py-2', 'md:h-[136px]')
    expect(screen.getByText('🐘')).toHaveClass('text-[40px]', 'md:text-[56px]')
    expect(screen.getByText('elephant')).toHaveClass('font-display', 'text-[15px]', 'leading-[1.1]', 'md:text-[19px]')
    expect(screen.getByText('🔓')).toHaveClass('rounded-[9px]', 'px-2', 'py-0.5', 'text-[11px]', 'md:text-[13px]')
    expect(screen.getByTestId('stars')).toHaveClass('text-[13px]')
  })

  it('Tile lg: 128/160, title 17/20 two-line clamp, titleSize 15 for A14', () => {
    const { rerender } = render(<MemoryRouter><Tile to="/x" size="lg" title="I have a red ball." sub="Con có quả bóng đỏ." subTone="sand" /></MemoryRouter>)
    expect(screen.getByTestId('tile')).toHaveClass('h-[128px]', 'px-2', 'py-2.5', 'md:h-[160px]')
    expect(screen.getByText('I have a red ball.')).toHaveClass('text-[17px]', 'line-clamp-2', 'leading-[1.2]', 'md:text-[20px]')
    expect(screen.getByText('Con có quả bóng đỏ.')).toHaveClass('text-[12px]', 'text-sand-text', 'md:text-[15px]')
    rerender(<MemoryRouter><Tile to="/x" size="lg" titleSize={15} title="Wow!" /></MemoryRouter>)
    expect(screen.getByText('Wow!')).toHaveClass('text-[15px]', 'md:text-[19px]')
  })

  it('Tile ipa renders the 36px #C08457 glyph and an ink sub', () => {
    // No `title`, so `ariaLabel` is required (task-2 review, Important #2) — matches how A11
    // SoundLevel always calls this shape (task-5 brief).
    render(<MemoryRouter><Tile to="/x" ipa="/θ/" sub="three" ariaLabel="Âm /θ/, ví dụ three" /></MemoryRouter>)
    expect(screen.getByText('/θ/')).toHaveClass('font-display', 'text-[36px]', 'text-[#C08457]', 'md:text-[45px]')
    expect(screen.getByText('three')).toHaveClass('text-[14px]', 'text-ink-500', 'md:text-[17px]')
    expect(screen.getByRole('link', { name: 'Âm /θ/, ví dụ three' })).toBe(screen.getByTestId('tile'))
  })

  it('Tile locked and accent variants', () => {
    const { rerender } = render(<MemoryRouter><Tile to="/x" variant="locked" emoji="🔒" title="Đồ chơi" chip={{ label: 'Chưa mở khoá' }} /></MemoryRouter>)
    expect(screen.getByTestId('tile')).toHaveClass('bg-sand', 'opacity-85', 'shadow-[0_5px_0_#E2D5C0]')
    expect(screen.getByText('Đồ chơi')).toHaveClass('text-sand-text')
    // §1 "Ô nhỏ · khoá": the "Chưa mở khoá" chip is #EFE2CC/#A79781 (`sand` tone), not the
    // default `neutral` — task-2 review, Important #1.
    expect(screen.getByText('Chưa mở khoá')).toHaveClass('bg-line-200', 'text-sand-text')
    rerender(<MemoryRouter><Tile to="/words/review" variant="accent" emoji="📚" title="Ôn tập" chip={{ tone: 'coralSolid', label: '12 từ hôm nay' }} /></MemoryRouter>)
    expect(screen.getByTestId('tile')).toHaveClass('bg-sun-50', 'shadow-[0_5px_0_#EFDDA8]')
    expect(screen.getByText('12 từ hôm nay')).toHaveClass('bg-coral-500', 'text-white')
  })

  it('Tile always has an accessible name — ariaLabel for an emoji-only tile, title text with no leaking star glyphs otherwise', () => {
    const { rerender } = render(<MemoryRouter><Tile to="/sound/th" emoji="🦁" ariaLabel="Tập âm" stars={2} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Tập âm' })).toBe(screen.getByTestId('tile'))
    rerender(<MemoryRouter><Tile to="/x" emoji="🐘" title="elephant" stars={3} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'elephant' })).toBe(screen.getByTestId('tile'))
  })

  it('ListRow 64 truncates one line and pins 13px stars right', () => {
    render(<MemoryRouter><ListRow to="/sentence/s1" h={64} title="Chị của con có một con búp bê em bé." stars={1} /></MemoryRouter>)
    expect(screen.getByTestId('list-row')).toHaveClass('min-h-[64px]', 'rounded-r16', 'px-3.5', 'gap-2.5', 'shadow-card-xs')
    expect(screen.getByText(/búp bê/)).toHaveClass('truncate', 'font-display', 'text-[16px]', 'md:text-[19px]')
    expect(screen.getByTestId('stars')).toHaveClass('text-[13px]')
  })

  it('ListRow 96 draws the 64px disc, name, sub, stars and chevron', () => {
    render(<MemoryRouter><ListRow to="/story/little-fox" h={96} disc={{ emoji: '🦊', bg: 'bg-[#FFE7D2]' }} title="The Little Fox" sub="Chú cáo nhỏ · 4 cảnh" stars={3} chevron /></MemoryRouter>)
    expect(screen.getByTestId('list-row')).toHaveClass('min-h-[96px]', 'rounded-r20', 'px-4', 'gap-3.5', 'shadow-[0_6px_0_#EFE2CC]')
    expect(screen.getByText('🦊')).toHaveClass('h-16', 'w-16', 'rounded-r18', 'text-[38px]', 'bg-[#FFE7D2]')
    expect(screen.getByText('The Little Fox')).toHaveClass('text-[19px]', 'md:text-[23px]')
    expect(screen.getByText('Chú cáo nhỏ · 4 cảnh')).toHaveClass('text-[13px]', 'text-ink-500', 'md:text-[15px]')
    expect(screen.getByText('▸')).toHaveClass('text-[22px]', 'text-ink-300')
    // `title` is required on `ListRow`, so its accessible name always exists — but `Stars`'
    // `★` glyphs must not leak into it (task-2 review, Important #2).
    expect(screen.getByRole('link', { name: /The Little Fox/ })).toBe(screen.getByTestId('list-row'))
    expect(screen.queryByRole('link', { name: /★/ })).toBeNull()
  })

  it('StickyGroup pins its H2 to the top of the scroller, with an optional count tail', () => {
    const { rerender } = render(<StickyGroup emoji="🐘" name="Động vật" count="8 từ"><i /></StickyGroup>)
    const h2 = screen.getByTestId('sticky-group')
    expect(h2).toHaveClass('sticky', 'top-0', 'z-10', 'bg-cream-50', 'text-[15px]', 'px-0.5', 'py-1', 'md:text-[17px]')
    expect(screen.getByText('· 8 từ')).toHaveClass('text-[12px]', 'text-ink-300', 'md:text-[13px]')
    rerender(<StickyGroup emoji="👨‍👩‍👧" name="Gia đình" pad="row"><i /></StickyGroup>)
    expect(screen.getByTestId('sticky-group')).toHaveClass('px-0.5', 'pb-0.5', 'pt-1.5')
    expect(screen.queryByText(/^·/)).toBeNull()
  })
})
