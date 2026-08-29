import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '../cloud/profileState'
import { ProfilePicker } from './ProfilePicker'

const profiles: Profile[] = [
  { id: 'p1', name: 'Sóc', avatar: '🐿️', created: 0 },
  { id: 'p2', name: 'Cáo', avatar: '🦊', created: 1 },
]

describe('ProfilePicker', () => {
  it('lists every profile at a 64 px tap floor and marks the active one', () => {
    render(<ProfilePicker profiles={profiles} activeId="p2" onSelect={() => undefined} />)

    const socButton = screen.getByRole('button', { name: /Sóc/ })
    const caoButton = screen.getByRole('button', { name: /Cáo/ })
    expect(socButton).toHaveClass('min-h-[64px]')
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
    render(<ProfilePicker profiles={profiles} onSelect={() => undefined} busy />)

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('says nothing extra when the names already tell the children apart', () => {
    render(<ProfilePicker profiles={profiles} onSelect={() => undefined} />)

    expect(screen.queryByText(/^Tạo /)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Mã /)).not.toBeInTheDocument()
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
        onSelect={() => undefined}
      />)

      expect(screen.getByText('Tạo 04/03/2026')).toBeInTheDocument()
      expect(screen.getByText('Tạo 19/07/2026')).toBeInTheDocument()
    })

    it('steps up to the time when both were made the same day', () => {
      render(<ProfilePicker
        profiles={[same('a', new Date('2026-03-04T09:12:00').getTime()), same('b', new Date('2026-03-04T18:40:00').getTime())]}
        onSelect={() => undefined}
      />)

      expect(screen.getByText('Tạo 04/03 09:12')).toBeInTheDocument()
      expect(screen.getByText('Tạo 04/03 18:40')).toBeInTheDocument()
    })

    it('falls back to something that cannot collide when there is no usable date', () => {
      // A whole UUID block, not four characters: four is 16 bits, which collides once in 65536 —
      // rare enough to never see in testing and common enough to happen to somebody.
      render(<ProfilePicker
        profiles={[same('a1b2c3d4-1111-4111-8111-111111111111', 0), same('e5f6a7b8-2222-4222-8222-222222222222', 0)]}
        onSelect={() => undefined}
      />)

      expect(screen.getByText('Mã a1b2c3d4')).toBeInTheDocument()
      expect(screen.getByText('Mã e5f6a7b8')).toBeInTheDocument()
    })

    it('never leaves two rows reading the same', () => {
      const stamp = new Date('2026-03-04T09:12:00').getTime()
      render(<ProfilePicker
        profiles={[same('a1b2c3d4-1111-4111-8111-111111111111', stamp), same('e5f6a7b8-2222-4222-8222-222222222222', stamp)]}
        onSelect={() => undefined}
      />)

      const rows = screen.getAllByRole('button').map(b => b.textContent)
      expect(new Set(rows).size).toBe(rows.length)
    })
  })
})
