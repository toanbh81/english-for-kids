import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
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
  listProfiles: vi.fn<() => MockProfile[]>(),
  activeProfileId: vi.fn<() => string | null>(),
  addProfile: vi.fn<(name?: string) => MockProfile>(),
  renameProfile: vi.fn<(id: string, name: string) => MockProfile[]>(),
  renameRemoteProfile: vi.fn<() => Promise<boolean>>(async () => true),
  switchProfile: vi.fn<(id: string) => boolean>(() => true),
  ensureRemoteProfiles: vi.fn<() => Promise<string[]>>(async () => []),
}))
vi.mock('../cloud/profileState', () => profileStateMock)

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
}))
vi.mock('../cloud/sync', () => syncMock)

import { ParentGate } from './ParentGate'
import { ParentDashboard } from './ParentDashboard'

const FLAG_KEY = 'speakup.parent'

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

/** Flush the microtask queue (e.g. the mocked listRecordings promise) inside act so the
 * resulting state update doesn't trigger an "update not wrapped in act" warning later. */
async function flush() {
  await act(async () => { await Promise.resolve() })
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

  syncMock.syncStatus.mockReset().mockReturnValue({ state: 'off', pending: 0, lastSyncedAt: null, lastError: null, syncing: false })
  syncMock.subscribeSyncStatus.mockReset().mockReturnValue(() => undefined)
  syncMock.resetRemoteProgress.mockReset().mockResolvedValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('ParentGate', () => {
  it('rejects a wrong product and accepts the right one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithRouter(<ParentGate />)

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
    renderWithRouter(<ParentGate />)

    const input = screen.getByLabelText('Đáp án')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.submit(input.closest('form')!)

    await screen.findByText(/Phút luyện mỗi ngày/)
    expect(Number(sessionStorage.getItem(FLAG_KEY))).toBeGreaterThan(Date.now() - 1000)
  })

  it('skips the gate and shows the dashboard when the session flag is fresh', async () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    renderWithRouter(<ParentGate />)

    await screen.findByText(/Phút luyện mỗi ngày/)
    expect(screen.queryByLabelText('Đáp án')).not.toBeInTheDocument()
  })

  it('asks the question again when the session flag is older than 10 minutes', () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now() - 10 * 60 * 1000 - 1))
    renderWithRouter(<ParentGate />)

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
    expect(screen.queryByText(/Phút luyện mỗi ngày/)).not.toBeInTheDocument()
  })

  it('asks the question again when the session flag is not a timestamp', () => {
    sessionStorage.setItem(FLAG_KEY, '1')
    renderWithRouter(<ParentGate />)

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
  })

  it('clears the session flag on unmount so leaving /parent re-locks the gate', async () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    const { unmount } = renderWithRouter(<ParentGate />)
    await screen.findByText(/Phút luyện mỗi ngày/)

    unmount()

    expect(sessionStorage.getItem(FLAG_KEY)).toBeNull()
  })

  it('returns to the gate when "Khoá lại" is clicked', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithRouter(<ParentGate />)

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

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getAllByTestId('minute-bar')).toHaveLength(14)

    const phonemeRows = screen.getAllByText(/— trung bình/)
    expect(phonemeRows[0]).toHaveTextContent('/th/')
    expect(phonemeRows[0]).toHaveTextContent('trung bình 35 (2 lần)')
  })

  it('shows the "chưa đủ dữ liệu" empty state when there is no phoneme data', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Chưa đủ dữ liệu')).toBeInTheDocument()
  })

  it('renders the weekly summary line from minutesPerDay(7) and averageScoreByKind', async () => {
    vi.useFakeTimers({ now: NOW })
    seedActivity([{ ts: NOW, kind: 'speak', id: 'w1', score: 80 }])

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Tuần này: 1 phút luyện · điểm phát âm trung bình 80/100')).toBeInTheDocument()
  })

  it('shows a dash for the average score in the summary line when there is no data', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Tuần này: 0 phút luyện · điểm phát âm trung bình —/100')).toBeInTheDocument()
  })

  it('shows the target line label at the current daily limit', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Mục tiêu 20 phút/ngày')).toBeInTheDocument()
  })

  it('persists a limit chip click', async () => {
    renderWithRouter(<ParentDashboard />)
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

    renderWithRouter(<ParentDashboard />)

    const playButton = await screen.findByRole('button', { name: 'Phát' })
    fireEvent.click(playButton)

    expect(playerMock.playBlob).toHaveBeenCalledWith(blob)
  })

  it('persists a daily limit change to localStorage, clamped to the 5-60 range', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '999' } })

    expect(localStorage.getItem('speakup.limit.minutes')).toBe('60')
  })

  it('re-syncs the displayed limit to the clamped stored value on blur', async () => {
    renderWithRouter(<ParentDashboard />)
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))

    await waitFor(() => expect(localStorage.getItem('speakup.stars')).toBeNull())
    expect(localStorage.getItem('speakup.activity')).toBeNull()
    expect(recordingsMock.clearRecordings).toHaveBeenCalled()
  })

  it('clears the lesson and band stores too, so nothing survives the reset', async () => {
    localStorage.setItem('speakup.lesson.2026-08-23', JSON.stringify({ v: 1, day: '2026-08-23', created: NOW, band: 4, items: [] }))
    localStorage.setItem('speakup.lesson.length', 'long')
    localStorage.setItem('speakup.band', JSON.stringify({ value: 4, mode: 'manual' }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))

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
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))

    expect(localStorage.getItem('speakup.stars')).not.toBeNull()
    expect(recordingsMock.clearRecordings).not.toHaveBeenCalled()
  })

  it('renders the current band and lesson length highlighted on mount', async () => {
    localStorage.setItem('speakup.band', JSON.stringify({ value: 3, mode: 'manual' }))
    localStorage.setItem('speakup.lesson.length', 'long')

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByRole('button', { name: 'Bậc 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bậc 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Dài ~18 phút' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vừa ~12 phút' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('pressing a band button persists the value and switches to manual mode', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Bậc 4' }))

    expect(getBand()).toEqual({ value: 4, mode: 'manual' })
    expect(screen.getByRole('button', { name: 'Bậc 4' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggling "Tự động" back on resumes auto mode from the current band value', async () => {
    localStorage.setItem('speakup.band', JSON.stringify({ value: 2, mode: 'manual' }))

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Tự động' }))

    expect(getBand()).toEqual({ value: 2, mode: 'auto' })
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bậc 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('says when a difficulty or length change takes effect', async () => {
    renderWithRouter(<ParentDashboard />)
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

    renderWithRouter(<ParentDashboard />)
    const heading = await screen.findByText('Bản ghi gần đây')

    const summary = heading.closest('summary')!
    expect(summary).toHaveClass('min-h-[64px]')
    // Closed below 768…
    expect(summary.closest('details')).not.toHaveAttribute('open')
    // …but never gone: the recording and its play button are still there to be disclosed.
    expect(screen.getByRole('button', { name: 'Phát' })).toBeInTheDocument()
    expect(screen.getByText('apple')).toBeInTheDocument()
  })

  /**
   * The design calls this screen an adult interface outright — "vùng chạm 36–48px (không cần 64)" —
   * so it is the one screen in the app whose phone controls sit below the child floor. The iPad's
   * 64 px is restored at `md`, which is what these class pairs pin.
   */
  it('uses adult 44 px controls on a phone and the 64 px ones from md up', async () => {
    renderWithRouter(<ParentDashboard />)
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
    renderWithRouter(<ParentDashboard />)
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

  it('pressing a length chip persists the lesson length', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Ngắn ~8 phút' }))

    expect(getLessonLength()).toBe('short')
    expect(screen.getByRole('button', { name: 'Ngắn ~8 phút' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Phase 11: "Tài khoản"', () => {
  it('is entirely absent with no cloud configured', async () => {
    cloud.configured = false
    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.queryByTestId('account-card')).not.toBeInTheDocument()
  })

  it('shows the consent line, the link form and the recovery code while still anonymous', async () => {
    cloud.configured = true
    authMock.ensureRecoveryCode.mockResolvedValue('ABC23XYZ')

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText(/Tiến độ học của bé sẽ được lưu trên tài khoản của bạn/)).toBeInTheDocument()
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
    expect(await screen.findByText('ABC23XYZ')).toBeInTheDocument()
    expect(screen.getByText(/chụp màn hình lại nhé/)).toBeInTheDocument()
  })

  it('never shows a recovery code once the account is linked — that is correct, not a bug', async () => {
    cloud.configured = true
    authMock.isAnonymous.mockResolvedValue(false)
    authMock.currentEmail.mockResolvedValue('bome@example.com')

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(authMock.ensureRecoveryCode).not.toHaveBeenCalled()
    expect(screen.queryByText(/chụp màn hình lại nhé/)).not.toBeInTheDocument()
    expect(screen.getByText('bome@example.com')).toBeInTheDocument()
  })

  it('shows the honest one-line sync status and nothing more', async () => {
    cloud.configured = true
    syncMock.syncStatus.mockReturnValue({ state: 'pending', pending: 3, lastSyncedAt: null, lastError: null, syncing: false })

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByTestId('sync-status')).toHaveTextContent('Chưa đồng bộ 3 mục')
  })

  it('subscribes to sync status only on this screen, and unsubscribes on unmount', async () => {
    cloud.configured = true
    const unsubscribe = vi.fn()
    syncMock.subscribeSyncStatus.mockReturnValue(unsubscribe)

    const { unmount } = renderWithRouter(<ParentDashboard />)
    await flush()
    expect(syncMock.subscribeSyncStatus).toHaveBeenCalledTimes(1)

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('links an email end to end: OTP sent, verified, then shows the signed-in state', async () => {
    cloud.configured = true
    renderWithRouter(<ParentDashboard />)
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

    renderWithRouter(<ParentDashboard />)
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

    renderWithRouter(<ParentDashboard />)
    await flush()
    fireEvent.change(screen.getByLabelText('Email của bố/mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố/mẹ').closest('form')!) })

    expect(screen.getByRole('alert')).toHaveTextContent('Không có kết nối mạng')
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
  })

  it('lets the parent correct a typo\'d email before it is verified', async () => {
    cloud.configured = true
    renderWithRouter(<ParentDashboard />)
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

  it('signs out only after the confirm dialog is accepted, and returns to the anonymous state', async () => {
    cloud.configured = true
    authMock.isAnonymous.mockResolvedValue(false)
    authMock.currentEmail.mockResolvedValue('bome@example.com')
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    await flush()

    expect(authMock.signOut).toHaveBeenCalled()
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
  })

  it('adds a profile and registers it with the server', async () => {
    cloud.configured = true
    vi.spyOn(window, 'prompt').mockReturnValue('Bé 2')
    profileStateMock.listProfiles.mockReturnValueOnce([ACTIVE_PROFILE]).mockReturnValue([ACTIVE_PROFILE, { id: 'p2', name: 'Bé 2', avatar: '🦊', created: 1 }])

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hồ sơ' }))

    expect(profileStateMock.addProfile).toHaveBeenCalledWith('Bé 2')
    expect(profileStateMock.ensureRemoteProfiles).toHaveBeenCalled()
  })

  it('does not add a profile when the prompt is dismissed', async () => {
    cloud.configured = true
    vi.spyOn(window, 'prompt').mockReturnValue(null)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '+ Thêm hồ sơ' }))

    expect(profileStateMock.addProfile).not.toHaveBeenCalled()
  })

  it('renames the active profile locally and on the server with .update, never an upsert', async () => {
    cloud.configured = true
    vi.spyOn(window, 'prompt').mockReturnValue('Sóc con')

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên' }))

    expect(profileStateMock.renameProfile).toHaveBeenCalledWith('p1', 'Sóc con')
    expect(profileStateMock.renameRemoteProfile).toHaveBeenCalledWith('p1', 'Sóc con')
  })

  it('shows the profile picker only when there is more than one child on this device', async () => {
    cloud.configured = true
    profileStateMock.listProfiles.mockReturnValue([ACTIVE_PROFILE])

    renderWithRouter(<ParentDashboard />)
    await flush()
    expect(screen.queryByRole('button', { name: 'Sóc' })).not.toBeInTheDocument()
  })

  it('switches the active profile from the picker when more than one exists', async () => {
    cloud.configured = true
    profileStateMock.listProfiles.mockReturnValue([ACTIVE_PROFILE, { id: 'p2', name: 'Sóc', avatar: '🐿️', created: 1 }])

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: /Sóc/ }))
    expect(profileStateMock.switchProfile).toHaveBeenCalledWith('p2')
  })

  it('resets the mirror from this screen when resetting progress, never a hidden-tab flush', async () => {
    cloud.configured = true
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    await waitFor(() => expect(syncMock.resetRemoteProgress).toHaveBeenCalledWith('p1'))
  })

  it('does not touch the mirror on reset with no cloud configured', async () => {
    cloud.configured = false
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))
    await flush()
    expect(syncMock.resetRemoteProgress).not.toHaveBeenCalled()
  })
})
