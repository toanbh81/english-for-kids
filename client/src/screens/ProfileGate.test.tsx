import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

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

/** The mark `switchProfile`'s reload leaves behind: who was chosen, and when they were last here. */
function chosenInSession(id: string, at = Date.now()) {
  sessionStorage.setItem('speakup.profileChosen', JSON.stringify({ id, at }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  // The resume tests stub `Date.now` and `document.visibilityState`; neither may survive into the
  // next test, or the failure lands somewhere that has nothing to do with the cause.
  vi.restoreAllMocks()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
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
    expect(JSON.parse(sessionStorage.getItem('speakup.profileChosen')!).id).toBe(CAO)
  })

  it('lets the child already using the iPad through without a reload', () => {
    renderGate()

    fireEvent.click(screen.getByRole('button', { name: /Sóc/ }))

    expect(profileState.switchProfile).not.toHaveBeenCalled()
    expect(screen.getByText('màn hình chính')).toBeInTheDocument()
  })

  it('does not ask again after the reload its own answer caused', () => {
    // What `switchProfile` leaves behind: the new active profile, and the mark from before it.
    chosenInSession(CAO)
    localStorage.setItem('speakup.profile', CAO)

    renderGate()

    expect(screen.getByText('màn hình chính')).toBeInTheDocument()
  })

  /**
   * "App start" on an installed iPad PWA is mostly a RESUME: the child taps the icon, iOS restores
   * the same document, nothing re-mounts. A mount-only gate hands the second child whoever was
   * chosen that morning — the exact failure the picker exists to prevent, in the common case rather
   * than the rare one.
   */
  describe('coming back to a warm iPad', () => {
    function goAway(ms: number) {
      const start = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(start)
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      fireEvent(document, new Event('visibilitychange'))

      vi.spyOn(Date, 'now').mockReturnValue(start + ms)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      fireEvent(document, new Event('visibilitychange'))
    }

    beforeEach(() => {
      // Already answered this session: the mount-time gate is satisfied, which is the state a
      // resume actually finds.
      chosenInSession(SOC)
    })

    it('asks again after the iPad has been put down', () => {
      renderGate()
      expect(screen.queryByTestId('profile-reask')).not.toBeInTheDocument()

      goAway(10 * 60 * 1000)

      expect(screen.getByTestId('profile-reask')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cáo/ })).toBeInTheDocument()
    })

    it('does not interrupt a child who switched apps for a moment', () => {
      renderGate()

      goAway(30 * 1000)

      expect(screen.queryByTestId('profile-reask')).not.toBeInTheDocument()
    })

    it('leaves the lesson underneath mounted, so answering costs nothing', () => {
      renderGate()
      goAway(10 * 60 * 1000)

      // The app is still there behind the overlay…
      expect(screen.getByText('màn hình chính')).toBeInTheDocument()

      // …and the child who was already using it taps their own face and carries on.
      fireEvent.click(screen.getByRole('button', { name: /Sóc/ }))
      expect(screen.queryByTestId('profile-reask')).not.toBeInTheDocument()
      expect(profileState.switchProfile).not.toHaveBeenCalled()
      expect(screen.getByText('màn hình chính')).toBeInTheDocument()
    })

    it('hands over to the sibling from the resume ask', () => {
      renderGate()
      goAway(10 * 60 * 1000)

      fireEvent.click(screen.getByRole('button', { name: /Cáo/ }))

      expect(profileState.switchProfile).toHaveBeenCalledWith(CAO)
      expect(JSON.parse(sessionStorage.getItem('speakup.profileChosen')!).id).toBe(CAO)
    })

    /**
     * The residual the closure timestamp left behind: iOS terminates the app under memory pressure
     * and relaunches it hours later — the ordinary way a PWA comes back — restoring sessionStorage
     * into a brand-new JS context. A `hiddenAt` living in the component died with that context, so
     * the mark alone said "already answered" and nobody was asked. The age travels with the answer.
     */
    it('asks at a cold start when the surviving mark is old', () => {
      chosenInSession(SOC, Date.now() - 30 * 60 * 1000)

      renderGate()

      expect(screen.getByText(/Ai đang học nào/)).toBeInTheDocument()
      // Cold start, so the app is not rendered behind the question at all.
      expect(screen.queryByText('màn hình chính')).not.toBeInTheDocument()
    })

    /**
     * A mark stamped while the clock read LATER than it does now has a negative age, and
     * `age < RE_ASK_AFTER_MS` was true for every negative number — so the gate counted it fresh for
     * ever and never asked again, which is the pre-picker behaviour it exists to end. Reachable by
     * something this codebase already plans for (`clamp_client_ts` exists because children move the
     * iPad's date forward): stamp while the clock is ahead, correct the date, done.
     */
    it('asks when the mark is stamped in the future', () => {
      chosenInSession(SOC, Date.now() + 365 * 24 * 60 * 60 * 1000)

      renderGate()

      expect(screen.getByText(/Ai đang học nào/)).toBeInTheDocument()
    })

    it('asks on a resume whose mark was stamped by a clock running ahead', () => {
      chosenInSession(SOC)
      renderGate()

      // Backgrounded while the date was wrong: the stamp goes into the future…
      const real = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(real + 365 * 24 * 60 * 60 * 1000)
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      fireEvent(document, new Event('visibilitychange'))
      // …the parent corrects the date, and the sibling picks the iPad up later.
      vi.spyOn(Date, 'now').mockReturnValue(real + 20 * 60 * 1000)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      fireEvent(document, new Event('visibilitychange'))

      expect(screen.getByTestId('profile-reask')).toBeInTheDocument()
    })

    it('does not ask at a cold start moments after the answer', () => {
      chosenInSession(SOC, Date.now() - 5 * 1000)

      renderGate()

      expect(screen.getByText('màn hình chính')).toBeInTheDocument()
    })

    it('measures the absence from the moment the iPad was put down', () => {
      renderGate()
      const answeredAt = Date.now()
      // Half an hour of USE, then a two-minute trip out of the app: the child is not interrupted,
      // because what counts is time away, not time since the answer.
      vi.spyOn(Date, 'now').mockReturnValue(answeredAt + 30 * 60 * 1000)
      goAway(2 * 60 * 1000)

      expect(screen.queryByTestId('profile-reask')).not.toBeInTheDocument()
    })

    it('asks on a document restored from the back/forward cache', () => {
      renderGate()

      const start = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(start)
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      fireEvent(document, new Event('visibilitychange'))
      vi.spyOn(Date, 'now').mockReturnValue(start + 10 * 60 * 1000)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      fireEvent(window, Object.assign(new Event('pageshow'), { persisted: true }))

      expect(screen.getByTestId('profile-reask')).toBeInTheDocument()
    })

    it('asks on a pageshow that no visibilitychange preceded', () => {
      // The comment used to claim `pageshow` stood on its own while the age lived in a closure that
      // only `visibilitychange` ever set — so it could not, and quietly never fired. Now it reads
      // the mark, so a restored document asks on its own evidence.
      chosenInSession(SOC, Date.now() - 30 * 60 * 1000)
      render(<ProfileGate><p>màn hình chính</p></ProfileGate>)
      // The cold-start gate already asks for a mark that old; answer it, so what follows is a
      // resume rather than the mount question.
      fireEvent.click(screen.getByRole('button', { name: /Sóc/ }))
      expect(screen.getByText('màn hình chính')).toBeInTheDocument()

      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 30 * 60 * 1000)
      fireEvent(window, Object.assign(new Event('pageshow'), { persisted: true }))

      expect(screen.getByTestId('profile-reask')).toBeInTheDocument()
    })

    it('stays silent for a one-profile family however long they were away', () => {
      seedRoster([{ id: SOC, name: 'Sóc' }], SOC)
      renderGate()

      goAway(60 * 60 * 1000)

      expect(screen.queryByTestId('profile-reask')).not.toBeInTheDocument()
      expect(screen.getByText('màn hình chính')).toBeInTheDocument()
    })

    it('notices a sibling added while the app was in the background', () => {
      // The parent adds the second child from the dashboard, then hands the iPad over: the roster
      // is re-read on resume rather than captured at mount.
      seedRoster([{ id: SOC, name: 'Sóc' }], SOC)
      renderGate()
      seedRoster([{ id: SOC, name: 'Sóc' }, { id: CAO, name: 'Cáo' }], SOC)

      goAway(10 * 60 * 1000)

      expect(screen.getByTestId('profile-reask')).toBeInTheDocument()
    })
  })

  it('asks again on the next app start, when the mark is for a different child', () => {
    chosenInSession(CAO)
    // …but the device is pointed at Sóc: a stale mark must never wave the wrong child through.
    localStorage.setItem('speakup.profile', SOC)

    renderGate()

    expect(screen.getByText(/Ai đang học nào/)).toBeInTheDocument()
  })
})
