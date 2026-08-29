import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Spec flow 6's app-start picker.
 *
 * Without it, `bootstrapProfiles()` hands the iPad to whichever child `speakup.profile` happens to
 * name — and the only two things that ever change that sit behind the parent gate. So the second
 * child lands in their sibling's profile and writes to it: the sibling's stars and streak inflate,
 * their Leitner boxes take in words they have never seen (which decides what the app teaches them
 * next), and the outbox mirrors the merged pair everywhere. There is no undo once it is logged.
 *
 * `profileState` is the real module here — the roster is real localStorage — with only
 * `switchProfile` replaced, since the real one reloads the document.
 */
const profileState = vi.hoisted(() => ({ switchProfile: vi.fn(() => true) }))
vi.mock('../cloud/profileState', async importOriginal => ({
  ...(await importOriginal<typeof import('../cloud/profileState')>()),
  switchProfile: profileState.switchProfile,
}))

import { ProfileGate } from './ProfileGate'

const SOC = '11111111-2222-4333-8444-555555555555'
const CAO = '22222222-3333-4444-8555-666666666666'

function seedRoster(ids: { id: string; name: string }[], active: string) {
  localStorage.setItem('speakup.profiles', JSON.stringify(
    ids.map(p => ({ ...p, avatar: '🦊', created: 1 })),
  ))
  localStorage.setItem('speakup.profile', active)
}

function renderGate() {
  return render(<ProfileGate><p>màn hình chính</p></ProfileGate>)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
})

describe('one child on the iPad', () => {
  it('renders the app straight away — no picker, no extra tap', () => {
    seedRoster([{ id: SOC, name: 'Sóc' }], SOC)

    renderGate()

    expect(screen.getByText('màn hình chính')).toBeInTheDocument()
    expect(screen.queryByText(/Ai đang học nào/)).not.toBeInTheDocument()
  })

  it('does not flash the picker for a single-profile family', () => {
    seedRoster([{ id: SOC, name: 'Sóc' }], SOC)

    // The decision is taken in the `useState` initialiser, so the very first commit already has the
    // app in it: there is no render in which the picker existed.
    const { container } = renderGate()

    expect(container.querySelector('main')).toBeNull()
  })

  it('renders the app on a device that has no roster at all yet', () => {
    renderGate()

    expect(screen.getByText('màn hình chính')).toBeInTheDocument()
  })
})

describe('two children, one iPad', () => {
  beforeEach(() => {
    seedRoster([{ id: SOC, name: 'Sóc' }, { id: CAO, name: 'Cáo' }], SOC)
  })

  it('asks whose turn it is before any screen reads a star', () => {
    renderGate()

    expect(screen.getByText(/Ai đang học nào/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sóc/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cáo/ })).toBeInTheDocument()
    // The app is not rendered behind it: nothing may read the wrong child's namespace.
    expect(screen.queryByText('màn hình chính')).not.toBeInTheDocument()
  })

  it('asks with no password and no math question — the spec settled that', () => {
    renderGate()

    expect(screen.queryByLabelText('Đáp án')).not.toBeInTheDocument()
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  it('switches to the other child, which reloads into their namespace', () => {
    renderGate()

    fireEvent.click(screen.getByRole('button', { name: /Cáo/ }))

    expect(profileState.switchProfile).toHaveBeenCalledWith(CAO)
    expect(sessionStorage.getItem('speakup.profileChosen')).toBe(CAO)
  })

  it('lets the child already using the iPad through without a reload', () => {
    renderGate()

    fireEvent.click(screen.getByRole('button', { name: /Sóc/ }))

    expect(profileState.switchProfile).not.toHaveBeenCalled()
    expect(screen.getByText('màn hình chính')).toBeInTheDocument()
  })

  it('does not ask again after the reload its own answer caused', () => {
    // What `switchProfile` leaves behind: the new active profile, and the mark from before it.
    sessionStorage.setItem('speakup.profileChosen', CAO)
    localStorage.setItem('speakup.profile', CAO)

    renderGate()

    expect(screen.getByText('màn hình chính')).toBeInTheDocument()
  })

  it('asks again on the next app start, when the mark is for a different child', () => {
    sessionStorage.setItem('speakup.profileChosen', CAO)
    // …but the device is pointed at Sóc: a stale mark must never wave the wrong child through.
    localStorage.setItem('speakup.profile', SOC)

    renderGate()

    expect(screen.getByText(/Ai đang học nào/)).toBeInTheDocument()
  })
})
