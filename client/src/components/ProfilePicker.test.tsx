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
})
