import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { DialogProvider } from '../components/ui/DialogProvider'
import type { ActivityEvent } from '../progress/activity'
import { getBand } from '../progress/band'
import { getLessonLength } from '../progress/lesson'
import type { Recording } from '../progress/recordings'

// The recordings store round-trips Blobs through IndexedDB via structuredClone, which jsdom's
// Blob implementation does not survive (see recordings.test.ts, which runs under the node
// environment for that reason). ParentDashboard needs jsdom for React rendering, so the
// recordings module is mocked here instead of seeding real IndexedDB data.
const playerMock = vi.hoisted(() => ({ playBlob: vi.fn(() => Promise.resolve()) }))
vi.mock('../audio/player', () => playerMock)

const recordingsMock = vi.hoisted(() => ({
  listRecordings: vi.fn<() => Promise<Recording[]>>(() => Promise.resolve([])),
  clearRecordings: vi.fn(() => Promise.resolve()),
}))
vi.mock('../progress/recordings', () => recordingsMock)

// Every test in this file predates Phase 11 and expects the byte-identical, no-cloud dashboard —
// `client/.env` in this sandbox carries real (public-by-design) project keys, so mocking the whole
// module family, defaulted to "unconfigured", is what keeps these tests hermetic regardless of
// what is on disk. Only the "Tài khoản" describe block below flips `cloud.configured` on.
const cloud = vi.hoisted(() => ({ configured: false }))
vi.mock('../cloud/supabase', () => ({ isCloudConfigured: () => cloud.configured }))

type AuthOk = { ok: true; userId: string | null }
type AuthFail = { ok: false; error: string }
const authMock = vi.hoisted(() => ({
  currentEmail: vi.fn<() => Promise<string | null>>(async () => null),
  currentUserId: vi.fn<() => Promise<string | null>>(async () => 'u1'),
  isAnonymous: vi.fn<() => Promise<boolean>>(async () => true),
  ensureRecoveryCode: vi.fn<() => Promise<string | null>>(async () => null),
  linkEmail: vi.fn<(email: string) => Promise<AuthOk | AuthFail>>(async () => ({ ok: true, userId: 'u1' })),
  verifyEmailOtp: vi.fn<(email: string, token: string) => Promise<AuthOk | AuthFail>>(async () => ({ ok: true, userId: 'u1' })),
  signOut: vi.fn<() => Promise<AuthOk | AuthFail>>(async () => ({ ok: true, userId: null })),
}))
vi.mock('../cloud/auth', () => authMock)

type MockProfile = { id: string; name: string; avatar: string; created: number }
const ACTIVE_PROFILE: MockProfile = { id: 'p1', name: 'Bé', avatar: '🦊', created: 0 }
const profileStateMock = vi.hoisted(() => ({
  NAME_MAX: 40,
  shortName: (name: string) => name.trim().split(/\s+/).slice(-2).join(' '),
  listProfiles: vi.fn<() => MockProfile[]>(),
  activeProfileId: vi.fn<() => string | null>(),
  addProfile: vi.fn<(name?: string) => MockProfile | null>(),
  renameProfile: vi.fn<(id: string, name: string) => MockProfile[]>(),
  renameRemoteProfile: vi.fn<() => Promise<boolean>>(async () => true),
  switchProfile: vi.fn<(id: string) => boolean>(() => true),
  ensureRemoteProfiles: vi.fn<() => Promise<string[]>>(async () => []),
  fetchRemoteProfiles: vi.fn<() => Promise<MockProfile[] | null>>(async () => []),
}))
vi.mock('../cloud/profileState', () => profileStateMock)

type MockRemoteStats = {
  streak: number
  weekMinutes: number
  averages: { story: number | null; speak: number | null; word: number | null; sentence: number | null }
  weak: { phoneme: string; avg: number; count: number }[]
  eventCount: number
}
const remoteMock = vi.hoisted(() => ({
  fetchRemoteStats: vi.fn<(id: string) => Promise<MockRemoteStats | null>>(async () => null),
}))
vi.mock('../cloud/remote', () => remoteMock)

type MockSyncStatus = {
  state: 'off' | 'offline' | 'pending' | 'synced'
  pending: number
  lastSyncedAt: number | null
  lastError: string | null
  syncing: boolean
}
const syncMock = vi.hoisted(() => ({
  syncStatus: vi.fn<() => MockSyncStatus>(() => ({ state: 'off', pending: 0, lastSyncedAt: null, lastError: null, syncing: false })),
  subscribeSyncStatus: vi.fn<(fn: (s: MockSyncStatus) => void) => () => void>(() => () => undefined),
  resetRemoteProgress: vi.fn<() => Promise<boolean>>(async () => true),
  hasPendingReset: vi.fn<(id: string) => boolean>(() => false),
  flush: vi.fn<() => Promise<void>>(async () => undefined),
}))
vi.mock('../cloud/sync', () => syncMock)

import { ParentGate } from './ParentGate'
import { ParentDashboard } from './ParentDashboard'

const FLAG_KEY = 'speakup.parent'

/** Every screen that renders `ParentDashboard` now reaches `useDialog()` — real `<Dialog>`s
 * replaced the browser's native confirm/prompt globals (Phase 12 task 12) — so this wraps every
 * render in a `DialogProvider`, once, rather than editing each of this file's many `render` calls
 * by hand. */
function renderWithDialogs(ui: ReactElement) {
  return render(<MemoryRouter><DialogProvider>{ui}</DialogProvider></MemoryRouter>)
}

/** Flush the microtask queue (e.g. the mocked listRecordings promise) inside act so the
 * resulting state update doesn't trigger an "update not wrapped in act" warning later. */
async function flush() {
  await act(async () => { await Promise.resolve() })
}

/** A promise the test controls, standing in for a slow `clearRecordings`/`resetRemoteProgress`/
 * `signOut` — Fix round 1: the reset/sign-out dialogs stay open and busy until their own async
 * work settles, which only shows up in a test that does not let that work resolve immediately. */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  playerMock.playBlob.mockClear()
  recordingsMock.listRecordings.mockReset()
  recordingsMock.listRecordings.mockResolvedValue([])
  recordingsMock.clearRecordings.mockReset()
  recordingsMock.clearRecordings.mockResolvedValue(undefined)

  cloud.configured = false
  authMock.currentEmail.mockReset().mockResolvedValue(null)
  authMock.currentUserId.mockReset().mockResolvedValue('u1')
  authMock.isAnonymous.mockReset().mockResolvedValue(true)
  authMock.ensureRecoveryCode.mockReset().mockResolvedValue(null)
  authMock.linkEmail.mockReset().mockResolvedValue({ ok: true, userId: 'u1' })
  authMock.verifyEmailOtp.mockReset().mockResolvedValue({ ok: true, userId: 'u1' })
  authMock.signOut.mockReset().mockResolvedValue({ ok: true, userId: null })

  profileStateMock.listProfiles.mockReset().mockReturnValue([ACTIVE_PROFILE])
  profileStateMock.activeProfileId.mockReset().mockReturnValue(ACTIVE_PROFILE.id)
  profileStateMock.addProfile.mockReset().mockReturnValue({ id: 'p2', name: 'Bé 2', avatar: '🦊', created: 0 })
  profileStateMock.renameProfile.mockReset().mockImplementation((id, name) => [{ ...ACTIVE_PROFILE, id, name }])
  profileStateMock.renameRemoteProfile.mockReset().mockResolvedValue(true)
  profileStateMock.switchProfile.mockReset().mockReturnValue(true)
  profileStateMock.ensureRemoteProfiles.mockReset().mockResolvedValue([])
  profileStateMock.fetchRemoteProfiles.mockReset().mockResolvedValue([])

  remoteMock.fetchRemoteStats.mockReset().mockResolvedValue(null)

  syncMock.syncStatus.mockReset().mockReturnValue({ state: 'off', pending: 0, lastSyncedAt: null, lastError: null, syncing: false })
  syncMock.subscribeSyncStatus.mockReset().mockReturnValue(() => undefined)
  syncMock.resetRemoteProgress.mockReset().mockResolvedValue(true)
  syncMock.hasPendingReset.mockReset().mockReturnValue(false)
  syncMock.flush.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('ParentGate', () => {
  it('rejects a wrong product and accepts the right one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithDialogs(<ParentGate />)

    expect(screen.getByText('3 × 3 = ?')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(screen.getByText('Chưa đúng, thử lại')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))

    await screen.findByText(/Phút luyện mỗi ngày/)
    expect(Number(sessionStorage.getItem(FLAG_KEY))).toBeGreaterThan(Date.now() - 1000)
  })

  it('submits and opens the dashboard when Enter is pressed with the right answer', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithDialogs(<ParentGate />)

    const input = screen.getByLabelText('Đáp án')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.submit(input.closest('form')!)

    await screen.findByText(/Phút luyện mỗi ngày/)
    expect(Number(sessionStorage.getItem(FLAG_KEY))).toBeGreaterThan(Date.now() - 1000)
  })

  it('skips the gate and shows the dashboard when the session flag is fresh', async () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    renderWithDialogs(<ParentGate />)

    await screen.findByText(/Phút luyện mỗi ngày/)
    expect(screen.queryByLabelText('Đáp án')).not.toBeInTheDocument()
  })

  it('asks the question again when the session flag is older than 10 minutes', () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now() - 10 * 60 * 1000 - 1))
    renderWithDialogs(<ParentGate />)

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
    expect(screen.queryByText(/Phút luyện mỗi ngày/)).not.toBeInTheDocument()
  })

  it('asks the question again when the session flag is not a timestamp', () => {
    sessionStorage.setItem(FLAG_KEY, '1')
    renderWithDialogs(<ParentGate />)

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
  })

  it('clears the session flag on unmount so leaving /parent re-locks the gate', async () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    const { unmount } = renderWithDialogs(<ParentGate />)
    await screen.findByText(/Phút luyện mỗi ngày/)

    unmount()

    expect(sessionStorage.getItem(FLAG_KEY)).toBeNull()
  })

  it('returns to the gate when "Khoá lại" is clicked', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithDialogs(<ParentGate />)

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    await screen.findByText(/Phút luyện mỗi ngày/)

    fireEvent.click(screen.getByRole('button', { name: /Khoá lại/ }))

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
    expect(screen.queryByText(/Phút luyện mỗi ngày/)).not.toBeInTheDocument()
    expect(sessionStorage.getItem(FLAG_KEY)).toBeNull()
  })
})

describe('ParentDashboard', () => {
  const NOW = new Date('2026-08-23T10:00:00').getTime()

  function seedActivity(events: ActivityEvent[]) {
    localStorage.setItem('speakup.activity', JSON.stringify(events))
  }

  it('renders exactly 14 minute bars and lists the weakest phoneme first', async () => {
    vi.useFakeTimers({ now: NOW })
    seedActivity([
      { ts: NOW, kind: 'speak', id: 'w1', score: 80, phonemes: [{ phoneme: 'th', score: 30 }] },
      { ts: NOW, kind: 'speak', id: 'w2', score: 80, phonemes: [{ phoneme: 'th', score: 40 }] },
      { ts: NOW, kind: 'speak', id: 'w3', score: 80, phonemes: [{ phoneme: 'r', score: 70 }] },
      { ts: NOW, kind: 'speak', id: 'w4', score: 80, phonemes: [{ phoneme: 'r', score: 80 }] },
    ])

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getAllByTestId('minute-bar')).toHaveLength(14)

    const phonemeRows = screen.getAllByText(/— trung bình/)
    expect(phonemeRows[0]).toHaveTextContent('/th/')
    expect(phonemeRows[0]).toHaveTextContent('trung bình 35 (2 lần)')
  })

  it('shows the "chưa đủ dữ liệu" empty state when there is no phoneme data', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Chưa đủ dữ liệu')).toBeInTheDocument()
  })

  it('renders the weekly summary line from minutesPerDay(7) and averageScoreByKind', async () => {
    vi.useFakeTimers({ now: NOW })
    seedActivity([{ ts: NOW, kind: 'speak', id: 'w1', score: 80 }])

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Tuần này: 1 phút luyện · điểm phát âm trung bình 80/100')).toBeInTheDocument()
  })

  it('shows a dash for the average score in the summary line when there is no data', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Tuần này: 0 phút luyện · điểm phát âm trung bình —/100')).toBeInTheDocument()
  })

  it('shows the target line label at the current daily limit', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Mục tiêu 20 phút/ngày')).toBeInTheDocument()
  })

  it('persists a limit chip click', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '30 phút' }))

    expect(localStorage.getItem('speakup.limit.minutes')).toBe('30')
    expect(screen.getByText('Mục tiêu 30 phút/ngày')).toBeInTheDocument()
  })

  it('a recording row plays through the mocked playBlob when tapped', async () => {
    const blob = new Blob(['x'])
    recordingsMock.listRecordings.mockResolvedValue([
      { id: 'r1', ts: new Date('2026-08-20T09:05:00').getTime(), text: 'apple', blob },
    ])

    renderWithDialogs(<ParentDashboard />)

    const playButton = await screen.findByRole('button', { name: 'Phát' })
    fireEvent.click(playButton)

    expect(playerMock.playBlob).toHaveBeenCalledWith(blob)
  })

  it('persists a daily limit change to localStorage, clamped to the 5-60 range', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '999' } })

    expect(localStorage.getItem('speakup.limit.minutes')).toBe('60')
  })

  it('re-syncs the displayed limit to the clamped stored value on blur', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '999' } })
    expect(input).toHaveValue(999)

    fireEvent.blur(input)
    expect(input).toHaveValue(60)
  })

  it('resets progress and clears speakup.stars after the confirm dialog is accepted', async () => {
    localStorage.setItem('speakup.stars', JSON.stringify({ a: 3 }))
    localStorage.setItem('speakup.activity', JSON.stringify([{ ts: NOW, kind: 'speak', id: 'w1', score: 80 }]))

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))

    await waitFor(() => expect(localStorage.getItem('speakup.stars')).toBeNull())
    expect(localStorage.getItem('speakup.activity')).toBeNull()
    expect(recordingsMock.clearRecordings).toHaveBeenCalled()
  })

  /**
   * Fix round 1, finding 1: the reset dialog now carries the actual work as `onConfirm`, so it
   * stays open and busy — and the "Đặt lại tiến trình" trigger underneath stays disabled — for as
   * long as `clearRecordings`/`resetRemoteProgress` take. Before this fix the dialog closed the
   * instant the button was clicked and the trigger was clickable again immediately, which is how
   * a double-tap mid-reset could open a second dialog and start a second concurrent reset.
   */
  it('disables the reset trigger and keeps the dialog busy until the reset settles, cloud copy included', async () => {
    cloud.configured = true
    const work = deferred<void>()
    recordingsMock.clearRecordings.mockReturnValue(work.promise)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    const trigger = screen.getByRole('button', { name: 'Đặt lại tiến trình' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
    await flush()

    expect(trigger).toBeDisabled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '…' })).toBeDisabled()
    expect(syncMock.resetRemoteProgress).not.toHaveBeenCalled()

    await act(async () => { work.resolve(); await Promise.resolve() })
    await waitFor(() => expect(syncMock.resetRemoteProgress).toHaveBeenCalledWith('p1'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).not.toBeDisabled()
  })

  it('clears the lesson and band stores too, so nothing survives the reset', async () => {
    localStorage.setItem('speakup.lesson.2026-08-23', JSON.stringify({ v: 1, day: '2026-08-23', created: NOW, band: 4, items: [] }))
    localStorage.setItem('speakup.lesson.length', 'long')
    localStorage.setItem('speakup.band', JSON.stringify({ value: 4, mode: 'manual' }))

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))

    // `handleReset` clears `speakup.band` synchronously, before its `await clearRecordings()` —
    // so a waitFor keyed on that key resolves on its very first (immediate) poll, before the
    // setState calls that come AFTER the await (setBand/setLength/setSnapshot) have necessarily
    // committed. That raced the DOM assertions below against React's own re-render, ~1/10 runs.
    // Waiting on the DOM condition those setState calls actually drive makes the wait mean
    // something: by the time this resolves, the post-await state update has landed for real.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bậc 1' })).toHaveAttribute('aria-pressed', 'true')
    })
    // …and the card shows what the next read will find, without writing the keys back.
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vừa ~12 phút' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('speakup.band')).toBeNull()
    expect(localStorage.getItem('speakup.lesson.2026-08-23')).toBeNull()
    expect(localStorage.getItem('speakup.lesson.length')).toBeNull()
  })

  it('does not reset progress when the confirm dialog is dismissed', async () => {
    localStorage.setItem('speakup.stars', JSON.stringify({ a: 3 }))

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
    await flush()

    expect(localStorage.getItem('speakup.stars')).not.toBeNull()
    expect(recordingsMock.clearRecordings).not.toHaveBeenCalled()
  })

  it('renders the current band and lesson length highlighted on mount', async () => {
    localStorage.setItem('speakup.band', JSON.stringify({ value: 3, mode: 'manual' }))
    localStorage.setItem('speakup.lesson.length', 'long')

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByRole('button', { name: 'Bậc 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bậc 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Dài ~18 phút' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vừa ~12 phút' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('pressing a band button persists the value and switches to manual mode', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Bậc 4' }))

    expect(getBand()).toEqual({ value: 4, mode: 'manual' })
    expect(screen.getByRole('button', { name: 'Bậc 4' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggling "Tự động" back on resumes auto mode from the current band value', async () => {
    localStorage.setItem('speakup.band', JSON.stringify({ value: 2, mode: 'manual' }))

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Tự động' }))

    expect(getBand()).toEqual({ value: 2, mode: 'auto' })
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bậc 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('says when a difficulty or length change takes effect', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Áp dụng từ bài học ngày mai.')).toBeInTheDocument()
  })

  /* ---- Phase 10, design §12 M8c: the dense phone layout ---- */

  /**
   * Spec decision 2: the design drops this card on a phone and we do not. It collapses into a
   * disclosure instead — and jsdom's `matchMedia` reports every query unmatched, so what these
   * tests see is exactly the phone state: closed, with the list still in the DOM behind a 64 px
   * summary row (the one control on this adult screen held to the child tap floor).
   */
  it('keeps the recordings card on a phone, collapsed into a closed disclosure', async () => {
    recordingsMock.listRecordings.mockResolvedValue([
      { id: 'r1', ts: NOW, text: 'apple', blob: new Blob(['x']) },
    ])

    renderWithDialogs(<ParentDashboard />)
    const heading = await screen.findByText('Bản ghi gần đây')

    const summary = heading.closest('summary')!
    expect(summary).toHaveClass('min-h-[64px]')
    // Closed below 768…
    expect(summary.closest('details')).not.toHaveAttribute('open')
    // …but never gone: the recording and its play button are still there to be disclosed.
    // findBy*, not getBy*: the heading renders synchronously while the row waits on
    // listRecordings, so a bare get here races the promise and fails under a loaded suite.
    expect(await screen.findByRole('button', { name: 'Phát' })).toBeInTheDocument()
    expect(screen.getByText('apple')).toBeInTheDocument()
  })

  /**
   * The design calls this screen an adult interface outright — "vùng chạm 36–48px (không cần 64)" —
   * so it is the one screen in the app whose phone controls sit below the child floor. The iPad's
   * 64 px is restored at `md`, which is what these class pairs pin.
   */
  it('uses adult 44 px controls on a phone and the 64 px ones from md up', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    for (const name of ['Bậc 3', 'Tự động', '30 phút', 'Vừa ~12 phút']) {
      expect(screen.getByRole('button', { name }), name).toHaveClass('min-h-[44px]', 'md:min-h-[64px]')
    }
    expect(screen.getByRole('spinbutton')).toHaveClass('h-11', 'md:h-16')
    // `max-md:` on the reset button, because `min-h-[64px] px-8` are `Button`'s own classes.
    expect(screen.getByRole('button', { name: 'Đặt lại tiến trình' })).toHaveClass('max-md:min-h-[48px]')
    expect(screen.getByRole('main')).toHaveClass('px-[18px]', 'md:px-6')
  })

  /** Fourteen days of data at every width; a phone draws the last seven, and each hidden bar takes
   * its own date label with it so the two can never come apart. */
  it('draws the last seven of the fourteen bars on a phone', async () => {
    // The chart shows an empty state in place of the bars with no activity at all — seed one
    // event so this test exercises the bars, which is what it is actually about.
    seedActivity([{ ts: Date.now(), kind: 'speak', id: 'w1', score: 80 }])
    renderWithDialogs(<ParentDashboard />)
    await flush()

    const cells = screen.getAllByTestId('minute-bar').map(bar => bar.parentElement!)
    expect(cells).toHaveLength(14)
    expect(cells.slice(0, 7).every(c => c.classList.contains('hidden'))).toBe(true)
    expect(cells.slice(7).every(c => c.classList.contains('flex') && !c.classList.contains('hidden'))).toBe(true)
    expect(cells[0]).toHaveClass('md:flex')
    // The heading counts what is drawn at each width rather than claiming fourteen at both.
    expect(screen.getByText('(7 ngày)')).toHaveClass('md:hidden')
    expect(screen.getByText('(14 ngày)')).toHaveClass('hidden', 'md:inline')
  })

  it('shows the empty state for the whole chart region — bars, date labels and total — when there is no activity at all', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Chưa có lịch sử luyện')).toBeInTheDocument()
    expect(screen.queryByTestId('minute-bar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Tổng:/)).not.toBeInTheDocument()
    // The card's own heading and target line are not part of the chart region, so they stay.
    expect(screen.getByText('Mục tiêu 20 phút/ngày')).toBeInTheDocument()
  })

  it('pressing a length chip persists the lesson length', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Ngắn ~8 phút' }))

    expect(getLessonLength()).toBe('short')
    expect(screen.getByRole('button', { name: 'Ngắn ~8 phút' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Phase 11: "Tài khoản"', () => {
  it('is entirely absent with no cloud configured', async () => {
    cloud.configured = false
    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.queryByTestId('account-card')).not.toBeInTheDocument()
  })

  it('shows the consent line, the link form and the recovery code while still anonymous', async () => {
    cloud.configured = true
    authMock.ensureRecoveryCode.mockResolvedValue('ABC23XYZ')

    renderWithDialogs(<ParentDashboard />)
    await flush()

    // The positive twin of the "is entirely absent with no cloud configured" test below, which only
    // ever checks that this id is ABSENT — a `queryByTestId` that never fires is not a passing test,
    // it is an untested assertion, so this confirms the same id actually renders when it should.
    expect(screen.getByTestId('account-card')).toBeInTheDocument()
    expect(screen.getByText(/Tiến độ học của bé sẽ được lưu trên tài khoản của bạn/)).toBeInTheDocument()
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
    expect(await screen.findByText('ABC23XYZ')).toBeInTheDocument()
    expect(screen.getByText(/chụp màn hình lại nhé/)).toBeInTheDocument()
  })

  it('never shows a recovery code once the account is linked — that is correct, not a bug', async () => {
    cloud.configured = true
    authMock.isAnonymous.mockResolvedValue(false)
    authMock.currentEmail.mockResolvedValue('bome@example.com')

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(authMock.ensureRecoveryCode).not.toHaveBeenCalled()
    expect(screen.queryByText(/chụp màn hình lại nhé/)).not.toBeInTheDocument()
    expect(screen.getByText('bome@example.com')).toBeInTheDocument()
  })

  it('shows the honest one-line sync status and nothing more', async () => {
    cloud.configured = true
    syncMock.syncStatus.mockReturnValue({ state: 'pending', pending: 3, lastSyncedAt: null, lastError: null, syncing: false })

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByTestId('sync-status')).toHaveTextContent(/Chưa đồng bộ 3 mục/)
  })

  it('subscribes to sync status only on this screen, and unsubscribes on unmount', async () => {
    cloud.configured = true
    const unsubscribe = vi.fn()
    syncMock.subscribeSyncStatus.mockReturnValue(unsubscribe)

    const { unmount } = renderWithDialogs(<ParentDashboard />)
    await flush()
    expect(syncMock.subscribeSyncStatus).toHaveBeenCalledTimes(1)

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('links an email end to end: OTP sent, verified, then shows the signed-in state', async () => {
    cloud.configured = true
    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.change(screen.getByLabelText('Email của bố/mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Email của bố/mẹ').closest('form')!)
    })
    expect(authMock.linkEmail).toHaveBeenCalledWith('bome@example.com')
    expect(screen.getByText(/Nhập mã 6 số vừa gửi tới bome@example.com/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
    })
    expect(authMock.verifyEmailOtp).toHaveBeenCalledWith('bome@example.com', '123456')
    expect(screen.getByText('bome@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
    // The standing ruling: linking just dropped the code server-side, so it must vanish here too.
    expect(screen.queryByText(/chụp màn hình lại nhé/)).not.toBeInTheDocument()
  })

  it('reports a wrong or expired OTP without losing the typed email', async () => {
    cloud.configured = true
    authMock.verifyEmailOtp.mockResolvedValue({ ok: false, error: 'Token has expired or is invalid' })

    renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.change(screen.getByLabelText('Email của bố/mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố/mẹ').closest('form')!) })

    fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '000000' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!) })

    expect(screen.getByRole('alert')).toHaveTextContent('hết hạn')
    expect(screen.getByText(/vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('is honest about a dropped connection while linking', async () => {
    cloud.configured = true
    authMock.linkEmail.mockResolvedValue({ ok: false, error: 'Failed to fetch' })

    renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.change(screen.getByLabelText('Email của bố/mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố/mẹ').closest('form')!) })

    expect(screen.getByRole('alert')).toHaveTextContent('Không có kết nối mạng')
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
  })

  it('lets the parent correct a typo\'d email before it is verified', async () => {
    cloud.configured = true
    renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.change(screen.getByLabelText('Email của bố/mẹ'), { target: { value: 'typo@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố/mẹ').closest('form')!) })

    fireEvent.click(screen.getByText('Sửa lại email'))
    const input = screen.getByLabelText('Email của bố/mẹ') as HTMLInputElement
    expect(input.value).toBe('typo@example.com')
    fireEvent.change(input, { target: { value: 'fixed@example.com' } })
    await act(async () => { fireEvent.submit(input.closest('form')!) })

    expect(authMock.linkEmail).toHaveBeenLastCalledWith('fixed@example.com')
  })

  it('signs out only after the confirm dialog is accepted, and says the device now has no account', async () => {
    cloud.configured = true
    authMock.isAnonymous.mockResolvedValue(false)
    authMock.currentEmail.mockResolvedValue('bome@example.com')

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    // The trigger button underneath and the dialog's own confirm button share the same label, so
    // the click has to be scoped to the dialog.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đăng xuất' }))
    await flush()

    expect(authMock.signOut).toHaveBeenCalled()
    // Signing out leaves NO session, and a link form would call `updateUser` on a user that no
    // longer exists. The screen says where the device stands instead.
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument()
    expect(screen.getByTestId('no-session')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email của bố/mẹ')).not.toBeInTheDocument()
  })

  /** Fix round 1, finding 1: the sign-out dialog carries `signOut()` as `onConfirm`, so it stays
   * open and busy — buttons disabled, confirm label "…" — until it settles, rather than closing
   * the instant the button is clicked. */
  it('keeps the sign-out dialog open and busy until signOut settles', async () => {
    cloud.configured = true
    authMock.isAnonymous.mockResolvedValue(false)
    authMock.currentEmail.mockResolvedValue('bome@example.com')
    const work = deferred<{ ok: true; userId: null }>()
    authMock.signOut.mockReturnValue(work.promise)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đăng xuất' }))
    await flush()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '…' })).toBeDisabled()
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Huỷ' })).toBeDisabled()
    // Not yet reflected: the callback hasn't settled.
    expect(screen.queryByTestId('no-session')).not.toBeInTheDocument()

    await act(async () => { work.resolve({ ok: true, userId: null }); await Promise.resolve() })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('no-session')).toBeInTheDocument()
  })

  it('adds a profile and registers it with the server', async () => {
    cloud.configured = true
    profileStateMock.listProfiles.mockReturnValueOnce([ACTIVE_PROFILE]).mockReturnValue([ACTIVE_PROFILE, { id: 'p2', name: 'Bé 2', avatar: '🦊', created: 1 }])

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hồ sơ' }))
    fireEvent.change(screen.getByLabelText('Tên của bé'), { target: { value: 'Bé 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await flush()

    expect(profileStateMock.addProfile).toHaveBeenCalledWith('Bé 2')
    expect(profileStateMock.ensureRemoteProfiles).toHaveBeenCalled()
  })

  /**
   * `addProfile` answers `null` when the child did not reach disk — an unreadable roster this app
   * must not write over, or a store that refused. Re-reading the roster alone would simply show
   * nothing, and a button that appears to do nothing is one a parent taps again.
   */
  it('says so when the new child could not be saved', async () => {
    cloud.configured = true
    profileStateMock.addProfile.mockReturnValue(null)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hồ sơ' }))
    fireEvent.change(screen.getByLabelText('Tên của bé'), { target: { value: 'Bé 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await flush()

    expect(screen.getByTestId('profile-notice')).toHaveTextContent('Chưa lưu được hồ sơ mới')
    // The child is not announced to the server either — there is no child.
    expect(profileStateMock.ensureRemoteProfiles).not.toHaveBeenCalled()
  })

  /**
   * R2/R1. With an unreadable roster `listProfiles()` is empty, and with no active profile at all
   * the device is on the legacy namespace. Both rendered as an empty string right beside
   * "+ Thêm hồ sơ" — the worst possible pairing, because that button is the one that writes the
   * roster and a parent who sees a blank name is exactly the parent who taps it.
   */
  it('never renders a blank profile name beside the add button', async () => {
    cloud.configured = true
    profileStateMock.listProfiles.mockReturnValue([])
    profileStateMock.activeProfileId.mockReturnValue('p1')

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByTestId('profile-unreadable')).toHaveTextContent('Chưa đọc được danh sách hồ sơ')
    expect(screen.getByTestId('profile-unreadable')).toHaveTextContent('vẫn đang được lưu bình thường')
    // Nothing to rename when nothing can be read.
    expect(screen.queryByRole('button', { name: 'Đổi tên' })).not.toBeInTheDocument()
  })

  it('says the same thing on a device that has no active profile at all', async () => {
    cloud.configured = true
    profileStateMock.listProfiles.mockReturnValue([ACTIVE_PROFILE])
    profileStateMock.activeProfileId.mockReturnValue(null)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByTestId('profile-unreadable')).toBeInTheDocument()
  })

  it('shows the name normally when the roster reads fine', async () => {
    cloud.configured = true

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.queryByTestId('profile-unreadable')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đổi tên' })).toBeInTheDocument()
  })

  it('does not add a profile when the prompt is dismissed', async () => {
    cloud.configured = true

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hồ sơ' }))
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
    await flush()

    expect(profileStateMock.addProfile).not.toHaveBeenCalled()
  })

  it('renames the active profile locally and on the server with .update, never an upsert', async () => {
    cloud.configured = true

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên' }))
    fireEvent.change(screen.getByLabelText('Tên của bé'), { target: { value: 'Sóc con' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await flush()

    expect(profileStateMock.renameProfile).toHaveBeenCalledWith('p1', 'Sóc con')
    expect(profileStateMock.renameRemoteProfile).toHaveBeenCalledWith('p1', 'Sóc con')
  })

  it('shows the profile picker only when there is more than one child on this device', async () => {
    cloud.configured = true
    profileStateMock.listProfiles.mockReturnValue([ACTIVE_PROFILE])

    renderWithDialogs(<ParentDashboard />)
    await flush()
    expect(screen.queryByRole('button', { name: 'Sóc' })).not.toBeInTheDocument()
  })

  it('switches the active profile from the picker when more than one exists', async () => {
    cloud.configured = true
    profileStateMock.listProfiles.mockReturnValue([ACTIVE_PROFILE, { id: 'p2', name: 'Sóc', avatar: '🐿️', created: 1 }])

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: /Sóc/ }))
    expect(profileStateMock.switchProfile).toHaveBeenCalledWith('p2')
  })

  it('resets the mirror from this screen when resetting progress, never a hidden-tab flush', async () => {
    cloud.configured = true

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
    await waitFor(() => expect(syncMock.resetRemoteProgress).toHaveBeenCalledWith('p1'))
  })

  /**
   * F2. `isAnonymous()` answers false with no session at all, so the screen used to render the
   * signed-in branch for an account that does not exist: an empty email line and a "Đăng xuất"
   * button, with no link form and no recovery code — on a device that has been offline since
   * install, or has just signed out. That is exactly the window in which nothing is backed up.
   * The three states are checked separately here because only the third one was ever wrong.
   */
  describe('the three account states', () => {
    it('linked: shows the email and the way out, and no link form', async () => {
      cloud.configured = true
      authMock.isAnonymous.mockResolvedValue(false)
      authMock.currentEmail.mockResolvedValue('bome@example.com')
      authMock.currentUserId.mockResolvedValue('u1')

      renderWithDialogs(<ParentDashboard />)
      await flush()

      expect(screen.getByText('bome@example.com')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
      expect(screen.queryByLabelText('Email của bố/mẹ')).not.toBeInTheDocument()
      expect(screen.queryByTestId('no-session')).not.toBeInTheDocument()
    })

    it('anonymous: shows the link form and the recovery code', async () => {
      cloud.configured = true
      authMock.isAnonymous.mockResolvedValue(true)
      authMock.currentEmail.mockResolvedValue(null)
      authMock.currentUserId.mockResolvedValue('u1')
      authMock.ensureRecoveryCode.mockResolvedValue('ABC23XYZ')

      renderWithDialogs(<ParentDashboard />)
      await flush()

      expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
      expect(await screen.findByText('ABC23XYZ')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('no-session')).not.toBeInTheDocument()
    })

    it('no session at all: never the signed-in branch, and says why in Vietnamese', async () => {
      cloud.configured = true
      // The exact combination that was never tested: not anonymous, and no email either.
      authMock.isAnonymous.mockResolvedValue(false)
      authMock.currentEmail.mockResolvedValue(null)
      authMock.currentUserId.mockResolvedValue(null)

      renderWithDialogs(<ParentDashboard />)
      await flush()

      expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument()
      expect(screen.getByTestId('no-session')).toHaveTextContent('vẫn đang được lưu trên máy này')
      // No dead form: `linkEmail` would call `updateUser` on a user that does not exist.
      expect(screen.queryByLabelText('Email của bố/mẹ')).not.toBeInTheDocument()
    })

    it('blames the network when that is the reason there is no account', async () => {
      cloud.configured = true
      authMock.isAnonymous.mockResolvedValue(false)
      authMock.currentEmail.mockResolvedValue(null)
      authMock.currentUserId.mockResolvedValue(null)
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      renderWithDialogs(<ParentDashboard />)
      await flush()

      expect(screen.getByTestId('no-session')).toHaveTextContent('Đang ngoại tuyến')
    })
  })

  /**
   * F3. The boolean `resetRemoteProgress` returns was discarded, so a reset that never reached the
   * server looked exactly like one that did — and the sync engine then put every deleted row back
   * on the next launch. The engine's half is fixed in cloud/sync.ts; this is the half the parent
   * can see.
   */
  it('says so, in Vietnamese, when the mirror half of a reset did not go through', async () => {
    cloud.configured = true
    syncMock.resetRemoteProgress.mockResolvedValue(false)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))

    const notice = await screen.findByTestId('reset-notice')
    expect(notice).toHaveTextContent('Đã xoá xong trên máy này')
    expect(notice).toHaveTextContent('chưa xoá được')
  })

  it('still says it on the next visit, while the reset is still owed', async () => {
    cloud.configured = true
    syncMock.hasPendingReset.mockReturnValue(true)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    // The parent left the screen and came back: a reset the engine has not carried out yet is
    // still true, and a screen that looked normal would be the same silence as before.
    expect(screen.getByTestId('reset-notice')).toHaveTextContent('chưa xoá được')
    expect(syncMock.hasPendingReset).toHaveBeenCalledWith('p1')
  })

  it('stays quiet when the mirror half of a reset succeeded', async () => {
    cloud.configured = true
    syncMock.resetRemoteProgress.mockResolvedValue(true)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
    await waitFor(() => expect(syncMock.resetRemoteProgress).toHaveBeenCalled())
    await flush()

    expect(screen.queryByTestId('reset-notice')).not.toBeInTheDocument()
  })

  /**
   * Fix round 1 (task 11 review, finding 2): `handleRetryReset` — the reset-notice's own "Thử xoá
   * lại" action — had zero coverage. It calls the same `resetRemoteProgress(activeId)` the reset
   * button itself calls, without repeating the local wipe, and only clears the notice once that
   * actually succeeds.
   */
  it('clears the reset notice when "Thử xoá lại" succeeds', async () => {
    cloud.configured = true
    syncMock.hasPendingReset.mockReturnValue(true)
    syncMock.resetRemoteProgress.mockResolvedValue(true)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByTestId('reset-notice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử xoá lại' }))
    await waitFor(() => expect(syncMock.resetRemoteProgress).toHaveBeenCalledWith('p1'))
    await flush()

    expect(screen.queryByTestId('reset-notice')).not.toBeInTheDocument()
  })

  it('keeps the reset notice up when "Thử xoá lại" fails again', async () => {
    cloud.configured = true
    syncMock.hasPendingReset.mockReturnValue(true)
    syncMock.resetRemoteProgress.mockResolvedValue(false)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Thử xoá lại' }))
    await waitFor(() => expect(syncMock.resetRemoteProgress).toHaveBeenCalledWith('p1'))
    await flush()

    expect(screen.getByTestId('reset-notice')).toHaveTextContent('chưa xoá được')
  })

  /** F7: the confirm dialog was unchanged from the local-only era, and this button now deletes the
   * child's cloud copy as well. It has to say so before the parent taps OK. */
  it('warns that the reset deletes the cloud copy too, and only when there is one', async () => {
    cloud.configured = true

    const { unmount } = renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/trên tài khoản/)
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
    await flush()
    unmount()

    cloud.configured = false
    renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/tài khoản/)
  })

  /** F7: "an toàn trên mọi thiết bị" sat on the same screen as "Bản ghi gần đây", and recordings
   * never sync. The consent line the spec asks for stays; the promise around it gets honest. */
  it('promises only what actually travels', async () => {
    cloud.configured = true

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.queryByText(/trên mọi thiết bị/)).not.toBeInTheDocument()
    expect(screen.getByText(/bản ghi giọng nói chỉ nằm trên máy này/)).toBeInTheDocument()
    expect(screen.getByText(/Tiến độ học của bé sẽ được lưu trên tài khoản của bạn/)).toBeInTheDocument()
  })

  it('does not touch the mirror on reset with no cloud configured', async () => {
    cloud.configured = false

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
    await flush()
    expect(syncMock.resetRemoteProgress).not.toHaveBeenCalled()
  })
})

/**
 * Task 5, flow 5: a parent on another device reads a child's progress straight from the server.
 *
 * The reviewer's standing rule for this task: "I could not fetch it" must never render as "the
 * child did nothing" — so every negative assertion below ("no remote card") is paired, in this same
 * describe block, with a positive one proving the exact same selector renders when the data says it
 * should (F5's own guidance against a `queryBy*` that can never fail).
 */
describe('Phase 11 task 5: remote progress view', () => {
  const SIBLING: MockProfile = { id: 'p2', name: 'Sóc', avatar: '🐿️', created: 1 }

  const REMOTE_STATS: MockRemoteStats = {
    streak: 3,
    weekMinutes: 42,
    averages: { story: null, speak: 80, word: 70, sentence: null },
    weak: [{ phoneme: 'th', avg: 35, count: 4 }],
    eventCount: 10,
  }

  it('is entirely absent with no cloud configured, even when the account genuinely holds another profile', async () => {
    cloud.configured = false
    profileStateMock.fetchRemoteProfiles.mockResolvedValue([ACTIVE_PROFILE, SIBLING])

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(profileStateMock.fetchRemoteProfiles).not.toHaveBeenCalled()
    expect(screen.queryByTestId('remote-progress-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('remote-view-toggle')).not.toBeInTheDocument()
  })

  it('never calls fetchRemoteProfiles with no live session — [] would read as "owns nothing", which is not true of "no session"', async () => {
    cloud.configured = true
    authMock.currentUserId.mockResolvedValue(null)
    authMock.isAnonymous.mockResolvedValue(false)
    authMock.currentEmail.mockResolvedValue(null)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(profileStateMock.fetchRemoteProfiles).not.toHaveBeenCalled()
    expect(screen.queryByTestId('remote-progress-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('remote-progress-unknown')).not.toBeInTheDocument()
  })

  it('says a remote read failed rather than showing nothing or claiming zero profiles', async () => {
    cloud.configured = true
    profileStateMock.fetchRemoteProfiles.mockResolvedValue(null)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(await screen.findByTestId('remote-progress-unknown')).toHaveTextContent('máy chủ chưa trả lời')
    // Never rendered together: an unknown answer is not "zero remote profiles".
    expect(screen.queryByTestId('remote-progress-card')).not.toBeInTheDocument()
  })

  it('shows a sibling profile\'s remote card automatically — the account differs from the active device profile', async () => {
    cloud.configured = true
    profileStateMock.fetchRemoteProfiles.mockResolvedValue([ACTIVE_PROFILE, SIBLING])
    remoteMock.fetchRemoteStats.mockResolvedValue(REMOTE_STATS)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    const cards = await screen.findAllByTestId('remote-profile')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Sóc')
    expect(remoteMock.fetchRemoteStats).toHaveBeenCalledWith('p2')
    // The active device's own profile is not duplicated here without being asked for.
    expect(remoteMock.fetchRemoteStats).not.toHaveBeenCalledWith('p1')
  })

  /**
   * Review round 2, finding 1 — proved deterministically with a promise this test controls by
   * hand. Reproduces the exact sequence: a sibling's fetch is still in flight when the parent
   * presses "Xem từ xa", which changes which profiles are shown and re-runs the stats effect BEFORE
   * the original promise ever settles. The old code gated its `setRemoteStats` call on a `cancelled`
   * flag scoped to that one effect run; the re-run marked the sibling's id as already "asked" (via
   * `fetchedRemoteIds`) without re-fetching it, so when the original promise finally resolved it
   * updated nothing — the card was stuck on "Đang tải…" forever, with no reload-free way out.
   */
  it('does not get stuck on "Đang tải…" when a sibling\'s fetch resolves only after the toggle changes which profiles are shown', async () => {
    cloud.configured = true
    profileStateMock.fetchRemoteProfiles.mockResolvedValue([ACTIVE_PROFILE, SIBLING])
    let resolveSibling!: (stats: MockRemoteStats | null) => void
    const siblingPromise = new Promise<MockRemoteStats | null>(resolve => { resolveSibling = resolve })
    remoteMock.fetchRemoteStats.mockImplementation(async (id: string) => (id === 'p2' ? siblingPromise : REMOTE_STATS))

    renderWithDialogs(<ParentDashboard />)
    await flush()

    // The sibling's card is up and its fetch is in flight (the toggle is off, so only the sibling —
    // the one profile differing from the active device profile — is shown at all).
    let cards = await screen.findAllByTestId('remote-profile')
    expect(cards).toHaveLength(1)
    // The skeleton (Task 13) replaced the "Đang tải…" text — its presence is the loading signal now.
    expect(within(cards[0]).getAllByTestId('skeleton').length).toBeGreaterThan(0)

    // The parent presses "Xem từ xa" WHILE the sibling's fetch is still unresolved. This changes
    // `remoteShowKey` (now includes the active device profile too) and re-runs the stats effect —
    // the exact moment the old `cancelled`-per-run guard misfired.
    await act(async () => {
      fireEvent.click(screen.getByTestId('remote-view-toggle'))
      await Promise.resolve()
    })

    // Now the ORIGINAL sibling fetch finally settles.
    await act(async () => {
      resolveSibling(REMOTE_STATS)
      await Promise.resolve()
    })

    cards = screen.getAllByTestId('remote-profile')
    const siblingCard = cards.find(c => c.textContent?.includes('Sóc'))
    expect(siblingCard).toBeDefined()
    // The positive assertion this bug made impossible: the card resolves out of the skeleton on its
    // own, with no remount and no page reload.
    expect(within(siblingCard!).queryAllByTestId('skeleton')).toHaveLength(0)
    expect(siblingCard).toHaveTextContent('Chuỗi ngày: 3')
  })

  it('stays quiet when the account holds only the profile already active here, until "Xem từ xa" is pressed', async () => {
    cloud.configured = true
    profileStateMock.fetchRemoteProfiles.mockResolvedValue([ACTIVE_PROFILE])

    renderWithDialogs(<ParentDashboard />)
    await flush()

    // Negative, anchored by the positive assertion right after it: the toggle IS there to be pressed.
    expect(screen.queryByTestId('remote-progress-card')).not.toBeInTheDocument()
    const toggle = screen.getByTestId('remote-view-toggle')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    remoteMock.fetchRemoteStats.mockResolvedValue(REMOTE_STATS)
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const cards = await screen.findAllByTestId('remote-profile')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('đang dùng trên máy này')
    expect(remoteMock.fetchRemoteStats).toHaveBeenCalledWith('p1')
  })

  it('renders streak, weekly minutes, averages and weak phonemes computed from the fetched events, plus the recordings caveat', async () => {
    cloud.configured = true
    profileStateMock.fetchRemoteProfiles.mockResolvedValue([ACTIVE_PROFILE, SIBLING])
    remoteMock.fetchRemoteStats.mockResolvedValue(REMOTE_STATS)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    const card = (await screen.findAllByTestId('remote-profile'))[0]
    expect(card).toHaveTextContent('Chuỗi ngày: 3')
    expect(card).toHaveTextContent('42 phút')
    expect(card).toHaveTextContent('Nói 80')
    expect(card).toHaveTextContent('Từ vựng 70')
    expect(card).toHaveTextContent('/th/ (35)')
    expect(card).toHaveTextContent('không đồng bộ')
  })

  it('reports a per-profile fetch failure honestly, never as zero progress', async () => {
    cloud.configured = true
    profileStateMock.fetchRemoteProfiles.mockResolvedValue([ACTIVE_PROFILE, SIBLING])
    remoteMock.fetchRemoteStats.mockResolvedValue(null)

    renderWithDialogs(<ParentDashboard />)
    await flush()

    const card = (await screen.findAllByTestId('remote-profile'))[0]
    expect(card).toHaveTextContent('Không tải được tiến độ của bé lúc này.')
    // The failure message and a real (possibly zero) streak line must never coexist.
    expect(card).not.toHaveTextContent('Chuỗi ngày:')
  })

  /**
   * A successful fetch that found nothing is still not a measurement of a child.
   *
   * "Chuỗi ngày: 0 · Tuần này: 0 phút" reads as a confident statement about a child who has been
   * idle, and the row that produces it is just as often an empty placeholder profile — a phantom
   * the parent has no way to interpret. The profile stays on screen either way: hiding a row with
   * no events would also hide a real child a parent added on another device and is checking
   * arrived, which is the same error class pointing the other way.
   */
  it('says the server holds nothing rather than measuring a child who is not there', async () => {
    cloud.configured = true
    profileStateMock.fetchRemoteProfiles.mockResolvedValue([ACTIVE_PROFILE, SIBLING])
    remoteMock.fetchRemoteStats.mockResolvedValue({
      streak: 0, weekMinutes: 0, averages: { story: null, speak: null, word: null, sentence: null }, weak: [], eventCount: 0,
    })

    renderWithDialogs(<ParentDashboard />)
    await flush()

    const card = (await screen.findAllByTestId('remote-profile'))[0]
    expect(card).toHaveTextContent('Chưa có dữ liệu nào trên máy chủ')
    expect(card).not.toHaveTextContent('Chuỗi ngày')
    expect(card).not.toHaveTextContent('Tuần này')
    // …and the child is still listed, name and all: a row with nothing on the server may be a
    // phantom, and may equally be the sibling a parent added elsewhere ten minutes ago.
    expect(card).toHaveTextContent(SIBLING.name)
  })

  it('still measures a child the server does have events for', async () => {
    cloud.configured = true
    profileStateMock.fetchRemoteProfiles.mockResolvedValue([ACTIVE_PROFILE, SIBLING])
    remoteMock.fetchRemoteStats.mockResolvedValue({
      streak: 3, weekMinutes: 21, averages: { story: null, speak: 80, word: null, sentence: null }, weak: [], eventCount: 12,
    })

    renderWithDialogs(<ParentDashboard />)
    await flush()

    const card = (await screen.findAllByTestId('remote-profile'))[0]
    expect(card).toHaveTextContent('Chuỗi ngày: 3 · Tuần này: 21 phút')
    expect(card).not.toHaveTextContent('Chưa có dữ liệu nào trên máy chủ')
  })
})
