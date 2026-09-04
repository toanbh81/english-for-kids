import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '../cloud/profileState'
import { ProfilePicker } from './ProfilePicker'

const noop = () => undefined

const profiles: Profile[] = [
  { id: 'p1', name: 'Sóc', avatar: '🐿️', created: 0 },
  { id: 'p2', name: 'Cáo', avatar: '🦊', created: 1 },
]

const p: Profile = { id: 'p1', name: 'Bé', avatar: '🦊', created: 0 }

const three: Profile[] = [
  { id: 'a', name: 'Sóc', avatar: '🐿️', created: 0 },
  { id: 'b', name: 'Cáo', avatar: '🦊', created: 1 },
  { id: 'c', name: 'Gấu', avatar: '🐻', created: 2 },
]

const eight: Profile[] = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i}`,
  name: `Bé ${i}`,
  avatar: '🦊',
  created: i,
}))

describe('ProfilePicker', () => {
  it('marks the active profile', () => {
    render(<ProfilePicker profiles={profiles} activeId="p2" onSelect={noop} />)

    const socButton = screen.getByRole('button', { name: /Sóc/ })
    const caoButton = screen.getByRole('button', { name: /Cáo/ })
    expect(caoButton).toHaveAttribute('aria-pressed', 'true')
    expect(socButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSelect with the tapped profile\'s id', () => {
    const onSelect = vi.fn()
    render(<ProfilePicker profiles={profiles} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /Sóc/ }))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('disables every button while busy', () => {
    render(<ProfilePicker profiles={profiles} onSelect={noop} busy />)

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('says nothing extra when the names already tell the children apart', () => {
    render(<ProfilePicker profiles={profiles} onSelect={noop} />)

    expect(screen.queryByText(/^Tạo /)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Mã /)).not.toBeInTheDocument()
  })

  it('2–3 profiles are one row of 96px cells; 4–8 are an 88px grid 2/4 with a scroller and a footer', () => {
    const { rerender } = render(<ProfilePicker profiles={three} onSelect={noop} />)
    expect(screen.getByTestId('picker')).toHaveClass('flex', 'gap-2')
    expect(screen.getAllByRole('button')[0]).toHaveClass('h-24', 'flex-1', 'min-w-0')

    rerender(<ProfilePicker profiles={eight} onSelect={noop} />)
    expect(screen.getByTestId('picker')).toHaveClass('grid', 'grid-cols-2', 'gap-2', 'md:grid-cols-4')
    expect(screen.getByTestId('picker').className).not.toMatch(/\bsm:|\blg:/)
    expect(screen.getAllByRole('button')[0]).toHaveClass('h-[88px]')
    expect(screen.getByTestId('picker-scroll')).toHaveClass('max-h-[380px]', 'overflow-y-auto')
    expect(screen.getByText('8 hồ sơ · cuộn xem thêm')).toHaveClass('text-[12px]', 'text-ink-300')
  })

  it('density="compact" is CloudStart\'s 72px cell and never shows a footer', () => {
    render(<ProfilePicker profiles={three} density="compact" onSelect={noop} />)
    expect(screen.getAllByRole('button')[0]).toHaveClass('h-[72px]')
    expect(screen.queryByText(/cuộn xem thêm/)).toBeNull()
  })

  it('a long name wraps to two clamped lines and keeps the full name in the title attribute', () => {
    render(<ProfilePicker profiles={[{ ...p, name: 'Nguyễn Hoàng Bảo Ngọc Anh Thư' }]} onSelect={noop} />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Nguyễn Hoàng Bảo Ngọc Anh Thư')
    expect(screen.getByText('Nguyễn Hoàng Bảo Ngọc Anh Thư')).toHaveClass('line-clamp-2', 'text-[14px]', 'leading-[1.2]')
  })

  it('the active cell is teal with a ✓; a pending cell spins and the rest of the grid dims', () => {
    render(<ProfilePicker profiles={eight} activeId={eight[0].id} pendingId={eight[3].id} onSelect={noop} />)
    expect(screen.getAllByRole('button')[0]).toHaveClass('border-teal-500')
    expect(within(screen.getAllByRole('button')[0]).getByText('✓')).toBeInTheDocument()
    expect(screen.getByTestId('picker')).toHaveClass('opacity-50')
    expect(within(screen.getAllByRole('button')[3]).getByTestId('cell-spinner')).toBeInTheDocument()
    expect(within(screen.getAllByRole('button')[0]).queryByTestId('cell-spinner')).toBeNull()
  })

  it('no cell is a 64px child target any more', () => {
    render(<ProfilePicker profiles={eight} onSelect={noop} />)
    for (const b of screen.getAllByRole('button')) expect(b.className).not.toMatch(/min-h-\[64px\]/)
  })

  /**
   * Every profile this app mints is "🦊 Bé", so two of them are two identical buttons — and in a
   * restore picker, tapping the wrong one lands the parent in an empty profile that reads as a
   * failed restore. Whatever is added has to be a fact about the profile AND has to actually
   * differ, which a date alone does not for two profiles made the same afternoon.
   */
  describe('two children who look exactly alike', () => {
    const same = (id: string, created: number): Profile => ({ id, name: 'Bé', avatar: '🦊', created })

    it('dates them when the dates differ', () => {
      render(<ProfilePicker
        profiles={[same('a', new Date('2026-03-04T09:00:00').getTime()), same('b', new Date('2026-07-19T15:00:00').getTime())]}
        onSelect={noop}
      />)

      expect(screen.getByText('Tạo 04/03/2026')).toBeInTheDocument()
      expect(screen.getByText('Tạo 19/07/2026')).toBeInTheDocument()
    })

    it('steps up to the time when both were made the same day', () => {
      render(<ProfilePicker
        profiles={[same('a', new Date('2026-03-04T09:12:00').getTime()), same('b', new Date('2026-03-04T18:40:00').getTime())]}
        onSelect={noop}
      />)

      expect(screen.getByText('Tạo 04/03 09:12')).toBeInTheDocument()
      expect(screen.getByText('Tạo 04/03 18:40')).toBeInTheDocument()
    })

    it('falls back to something that cannot collide when there is no usable date', () => {
      // A whole UUID block, not four characters: four is 16 bits, which collides once in 65536 —
      // rare enough to never see in testing and common enough to happen to somebody.
      render(<ProfilePicker
        profiles={[same('a1b2c3d4-1111-4111-8111-111111111111', 0), same('e5f6a7b8-2222-4222-8222-222222222222', 0)]}
        onSelect={noop}
      />)

      expect(screen.getByText('Mã a1b2c3d4')).toBeInTheDocument()
      expect(screen.getByText('Mã e5f6a7b8')).toBeInTheDocument()
    })

    it('never leaves two rows reading the same', () => {
      const stamp = new Date('2026-03-04T09:12:00').getTime()
      render(<ProfilePicker
        profiles={[same('a1b2c3d4-1111-4111-8111-111111111111', stamp), same('e5f6a7b8-2222-4222-8222-222222222222', stamp)]}
        onSelect={noop}
      />)

      const rows = screen.getAllByRole('button').map(b => b.textContent)
      expect(new Set(rows).size).toBe(rows.length)
    })
  })
})
