import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { DialogProvider } from '../components/ui/DialogProvider'
import type { ActivityEvent } from '../progress/activity'
import { getBand } from '../progress/band'
import { getLessonLength } from '../progress/lesson'
import { setLimitMinutes } from '../progress/limit'
import type { Recording } from '../progress/recordings'

// Task 13: `handleLimitStep` calls the real `setLimitMinutes` (clamp + localStorage write, same
// as before) — this only wraps it in a spy so a test can assert the CALL without duplicating
// `progress/limit.ts`'s own clamp tests here. `progress/limit.ts` itself stays byte-identical.
vi.mock('../progress/limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../progress/limit')>()
  return { ...actual, setLimitMinutes: vi.fn(actual.setLimitMinutes) }
})

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
  connectCloud: vi.fn<() => Promise<void>>(async () => undefined),
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

function renderGate() {
  return renderWithDialogs(<ParentGate />)
}

/** A single session spanning `total` minutes, starting "now" — gaps of at most 10 minutes so
 * `sessionMinutes` (progress/activity.ts) folds every event into one session instead of several
 * 1-minute ones. Task 13's `minutesToday` opt below is the only caller. */
function minutesTodayEvents(total: number): ActivityEvent[] {
  const now = Date.now()
  const events: ActivityEvent[] = [{ ts: now, kind: 'speak', id: 'm0', score: 80 }]
  let elapsed = 0
  let i = 1
  while (elapsed < total) {
    elapsed += Math.min(10, total - elapsed)
    events.push({ ts: now + elapsed * 60_000, kind: 'speak', id: `m${i}`, score: 80 })
    i++
  }
  return events
}

/** Task 10's own shorthand for the shell tests below: cloud on by default (most of the ten panels
 * only exist with it), and one scored event this week by default so the header's summary line has
 * something to say — pass `events: []` explicitly for the genuinely-empty-week scenario. `events`
 * always seeds `speakup.activity` before the render so a caller can drive the header's weekly
 * summary or the chart without reaching for `localStorage.setItem` by hand. Task 11 adds `profiles`:
 * a count that seeds that many mock profiles (`listProfiles`/`activeProfileId`, active = the first)
 * for the "Hồ sơ" column's worst case — 8 rows — without every call site building the array by hand.
 * Task 13 adds `limit`/`band` (seeded straight into `progress/limit.ts`/`progress/band.ts`'s own
 * legacy-namespace keys — no active profile in these tests, so `storageKey()` resolves to
 * `speakup.limit.minutes`/`speakup.band`) and `minutesToday` (seeds a session totalling that many
 * minutes instead of the default one-event/one-minute seed, for panel C's "Hôm nay: N/limit'" line). */
function renderDashboard(opts: {
  events?: ActivityEvent[]
  cloud?: boolean
  profiles?: number
  limit?: number
  band?: { mode: 'auto' | 'manual'; value: 1 | 2 | 3 | 4 | 5 }
  minutesToday?: number
} = {}) {
  cloud.configured = opts.cloud ?? true
  const events = opts.events
    ?? (opts.minutesToday != null ? minutesTodayEvents(opts.minutesToday) : [{ ts: Date.now(), kind: 'speak', id: 'seed', score: 80 }])
  localStorage.setItem('speakup.activity', JSON.stringify(events))
  if (opts.limit != null) localStorage.setItem('speakup.limit.minutes', String(opts.limit))
  if (opts.band) localStorage.setItem('speakup.band', JSON.stringify(opts.band))
  if (opts.profiles) {
    const roster: MockProfile[] = Array.from({ length: opts.profiles }, (_, i) => ({
      id: `p${i + 1}`,
      name: i === 0 ? 'Bé' : `Bé ${i + 1}`,
      avatar: '🦊',
      created: i,
    }))
    profileStateMock.listProfiles.mockReturnValue(roster)
    profileStateMock.activeProfileId.mockReturnValue(roster[0].id)
  }
  return renderWithDialogs(<ParentDashboard />)
}

/** Reads whatever product this render's `ParentQuestion` is currently asking (no `Math.random`
 * mock needed) and submits it. */
function answerCorrectly() {
  const equation = screen.getByText(/× \d+ =/)
  const [a, b] = equation.textContent!.match(/\d+/g)!.map(Number)
  fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: String(a * b) } })
  fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
}

/** Flush the microtask queue (e.g. the mocked listRecordings promise) inside act so the
 * resulting state update doesn't trigger an "update not wrapped in act" warning later. */
async function flush() {
  await act(async () => { await Promise.resolve() })
}

/** Task 11's own name for the same wait — the brief's failing tests spell it `settle()`. */
const settle = flush

/** Task 12's stub for `window.matchMedia` (jsdom has none — `window.matchMedia` is `undefined`
 * there, and the app code's own `window.matchMedia?.(query).matches` reads that as "narrow" via
 * optional chaining). `chartRange`'s mount-time read and the weak-chip tip's `isWide` both ask the
 * same `(min-width: 768px)` query, so one boolean is all any test here needs. Cleared by
 * `vi.unstubAllGlobals()` in the `afterEach` below. */
function matchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
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
  vi.mocked(setLimitMinutes).mockClear()
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
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('ParentGate', () => {
  it('rejects a wrong product and accepts the right one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithDialogs(<ParentGate />)

    expect(screen.getByText((_, el) => el?.children.length === 0 && el?.textContent?.replace(/\s+/g, ' ').trim() === '3 × 3 =')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(screen.getByTestId('question-error')).toHaveTextContent('⛔ Chưa đúng — câu hỏi đã đổi, thử lại nhé.')

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))

    await screen.findByText(/Phút luyện/)
    expect(Number(sessionStorage.getItem(FLAG_KEY))).toBeGreaterThan(Date.now() - 1000)
  })

  it('submits and opens the dashboard when Enter is pressed with the right answer', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithDialogs(<ParentGate />)

    const input = screen.getByLabelText('Đáp án')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.submit(input.closest('form')!)

    await screen.findByText(/Phút luyện/)
    expect(Number(sessionStorage.getItem(FLAG_KEY))).toBeGreaterThan(Date.now() - 1000)
  })

  it('skips the gate and shows the dashboard when the session flag is fresh', async () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    renderWithDialogs(<ParentGate />)

    await screen.findByText(/Phút luyện/)
    expect(screen.queryByLabelText('Đáp án')).not.toBeInTheDocument()
  })

  it('asks the question again when the session flag is older than 10 minutes', () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now() - 10 * 60 * 1000 - 1))
    renderWithDialogs(<ParentGate />)

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
    expect(screen.queryByText(/Phút luyện/)).not.toBeInTheDocument()
  })

  it('asks the question again when the session flag is not a timestamp', () => {
    sessionStorage.setItem(FLAG_KEY, '1')
    renderWithDialogs(<ParentGate />)

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
  })

  it('clears the session flag on unmount so leaving /parent re-locks the gate', async () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    const { unmount } = renderWithDialogs(<ParentGate />)
    await screen.findByText(/Phút luyện/)

    unmount()

    expect(sessionStorage.getItem(FLAG_KEY)).toBeNull()
  })

  it('returns to the gate when "Khoá lại" is clicked', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithDialogs(<ParentGate />)

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    await screen.findByText(/Phút luyện/)

    fireEvent.click(screen.getByRole('button', { name: /Khoá lại/ }))

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
    expect(screen.queryByText(/Phút luyện/)).not.toBeInTheDocument()
    expect(sessionStorage.getItem(FLAG_KEY)).toBeNull()
  })

  it('the gate is one 420px left-aligned card centred in the body, with no max-w-md left', () => {
    renderGate()
    const card = screen.getByTestId('gate-card')
    expect(card).toHaveClass('mx-auto', 'w-[min(420px,calc(100%-32px))]', 'p-5', 'gap-3', 'text-left')
    expect(card.className).not.toMatch(/max-w-md|text-center/)
    expect(screen.getByTestId('page-body')).toHaveClass('justify-center')
  })

  it('the header is the adult Back with a landscape-only label, and no LessonChip on the right', () => {
    renderGate()
    // Fix round 1 made the adult pill's VISIBLE label breakpoint-aware (mirroring the child
    // variant's `sr-only` pair, but as real content) instead of always showing `label` alongside a
    // merely visually-hidden `mdLabel`; fix round 2 dropped a static `aria-label` that round 1 had
    // added on top — it kept the announced name pinned to "Về nhà" even on iPad landscape, where
    // the printed text is "Về bản đồ 🏝️", a label-in-name mismatch worse than the problem it
    // solved. A real browser excludes the `display:none` span from the accessible-name computation,
    // so exactly one of the two is ever in it — but jsdom loads no stylesheet, so it cannot tell
    // which span is `display:none` and reports both concatenated ("Về nhàVề bản đồ 🏝️"). A prefix
    // match confirms the un-swapped label leads that jsdom-rendered name; the two spans' own
    // classes (below) are what actually pin down the breakpoint behaviour.
    const back = screen.getByRole('link', { name: /^Về nhà/ })
    expect(back).toHaveClass('h-11', 'rounded-r14')
    expect(within(back).getByText('Về nhà')).toHaveClass('ipad:hidden')
    expect(within(back).getByText('Về nhà').className).not.toMatch(/sr-only/)
    expect(within(back).getByText('Về bản đồ 🏝️')).toHaveClass('hidden', 'ipad:inline')
    expect(within(back).getByText('Về bản đồ 🏝️').className).not.toMatch(/sr-only/)
    expect(screen.getByTestId('header-right')).toBeEmptyDOMElement()
  })

  it('the card carries the title, the sub and the 32px question', () => {
    renderGate()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dành cho phụ huynh')
    expect(screen.getByText('Trả lời phép tính để vào Góc phụ huynh.')).toBeInTheDocument()
    expect(screen.getByText(/× \d+ =/)).toHaveClass('text-[32px]')
  })

  it('an empty submit stays on the gate; the right answer hands over to the dashboard', () => {
    renderGate()
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(screen.getByTestId('gate-card')).toBeInTheDocument()
    answerCorrectly()
    expect(screen.getByRole('heading', { name: /Góc phụ huynh/ })).toBeInTheDocument()
  })

  it('the background blobs are decorative and cannot scroll the body', () => {
    renderGate()
    expect(screen.getByTestId('gate-blobs')).toHaveClass('pointer-events-none', 'absolute', 'inset-0', '-z-10', 'overflow-hidden')
  })
})

describe('ParentDashboard', () => {
  const NOW = new Date('2026-08-23T10:00:00').getTime()

  function seedActivity(events: ActivityEvent[]) {
    localStorage.setItem('speakup.activity', JSON.stringify(events))
  }

  it('renders exactly 14 minute bars and lists the weakest phoneme first', async () => {
    vi.useFakeTimers({ now: NOW })
    matchMedia(true) // md/ipad width: chartRange defaults to 14
    seedActivity([
      { ts: NOW, kind: 'speak', id: 'w1', score: 80, phonemes: [{ phoneme: 'th', score: 30 }] },
      { ts: NOW, kind: 'speak', id: 'w2', score: 80, phonemes: [{ phoneme: 'th', score: 40 }] },
      { ts: NOW, kind: 'speak', id: 'w3', score: 80, phonemes: [{ phoneme: 'r', score: 70 }] },
      { ts: NOW, kind: 'speak', id: 'w4', score: 80, phonemes: [{ phoneme: 'r', score: 80 }] },
    ])

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getAllByTestId('minute-bar')).toHaveLength(14)

    const chips = screen.getAllByTestId('weak-chip')
    expect(chips[0]).toHaveTextContent('/th/ · 35 (2 lần)')
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

    expect(screen.getByText('Tuần này: 1 phút · điểm TB 80/100')).toBeInTheDocument()
  })

  /** Task 10: with genuinely no activity this week the header says so instead of "0 phút" — see
   * the "an empty week says so instead of printing zeros" test below. A dash for the average score
   * is still reachable, though: an event with no `score` field still counts a minute (any event
   * that day does) without counting toward any kind's average. */
  it('shows a dash for the average score when the week has minutes but no scored event', async () => {
    vi.useFakeTimers({ now: NOW })
    seedActivity([{ ts: NOW, kind: 'speak', id: 'w1' }])

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Tuần này: 1 phút · điểm TB —/100')).toBeInTheDocument()
  })

  it('shows the target line label at the current daily limit', async () => {
    // `MinutesChart` draws the dashed empty box instead of a target line with no activity at
    // all — seed one event so the chart it is actually about is on screen.
    seedActivity([{ ts: Date.now(), kind: 'speak', id: 'w1', score: 80 }])
    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText("mục tiêu 20'")).toBeInTheDocument()
  })

  it('persists a limit chip click', async () => {
    seedActivity([{ ts: Date.now(), kind: 'speak', id: 'w1', score: 80 }])
    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: "30'" }))

    expect(localStorage.getItem('speakup.limit.minutes')).toBe('30')
    expect(screen.getByText("mục tiêu 30'")).toBeInTheDocument()
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

  /* ---- Task 13: panel C — the limit SegRow + Stepper, no number input any more ---- */

  it('the limit panel is four segs, the fourth lighting up only for a custom value', () => {
    renderDashboard({ limit: 25 })
    const segs = within(screen.getByTestId('limit-panel')).getAllByTestId('seg')
    expect(segs.map(s => s.textContent)).toEqual(["15'", "20'", "30'", "Tuỳ chỉnh 25'"])
    expect(segs[3]).toHaveAttribute('data-tone', 'on')
    expect(segs.slice(0, 3).every(s => s.dataset.tone === 'off')).toBe(true)

    cleanup()
    renderDashboard({ limit: 20 })
    const s2 = within(screen.getByTestId('limit-panel')).getAllByTestId('seg')
    expect(s2[1]).toHaveAttribute('data-tone', 'on')
    expect(s2[3]).toHaveTextContent('Tuỳ chỉnh') // no digit — the value is a preset
    expect(s2[3]).toHaveAttribute('data-tone', 'off')
  })

  it('the limit panel prints today against the limit in its title row and steps by 5', () => {
    renderDashboard({ limit: 25, minutesToday: 12 })
    // `Panel`'s `right` slot renders twice — once in the phone-only fold row, once in the `md:flex`
    // desktop row — both carry the same node, so this checks both rather than picking one.
    for (const el of screen.getAllByText("Hôm nay: 12/25'")) {
      expect(el).toHaveClass('text-[12px]', 'text-teal-600')
    }

    fireEvent.click(screen.getByRole('button', { name: 'Tăng' }))
    expect(setLimitMinutes).toHaveBeenCalledWith(30)
    // The only number input left is `Stepper`'s own a11y-only one — `sr-only`, never a visible field.
    expect(screen.getByRole('spinbutton')).toHaveClass('sr-only')
  })

  it('resets progress and clears speakup.stars after the confirm dialog is accepted', async () => {
    localStorage.setItem('speakup.stars', JSON.stringify({ a: 3 }))
    localStorage.setItem('speakup.activity', JSON.stringify([{ ts: NOW, kind: 'speak', id: 'w1', score: 80 }]))

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
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

    const trigger = screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' })
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

    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))

    // `handleReset` clears `speakup.band` synchronously, before its `await clearRecordings()` —
    // so a waitFor keyed on that key resolves on its very first (immediate) poll, before the
    // setState calls that come AFTER the await (setBand/setLength/setSnapshot) have necessarily
    // committed. That raced the DOM assertions below against React's own re-render, ~1/10 runs.
    // Waiting on the DOM condition those setState calls actually drive makes the wait mean
    // something: by the time this resolves, the post-await state update has landed for real.
    await waitFor(() => {
      // R24: reset leaves the band in `auto` mode, so the reset-to-1 seg reads `dim` (a result),
      // never `on` — `aria-pressed` only follows `on` now, so that is the DOM condition to wait on.
      expect(screen.getByRole('button', { name: 'Bậc 1' })).toHaveAttribute('data-tone', 'dim')
    })
    // …and the card shows what the next read will find, without writing the keys back.
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: "Vừa ~12'" })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('speakup.band')).toBeNull()
    expect(localStorage.getItem('speakup.lesson.2026-08-23')).toBeNull()
    expect(localStorage.getItem('speakup.lesson.length')).toBeNull()
  })

  it('does not reset progress when the confirm dialog is dismissed', async () => {
    localStorage.setItem('speakup.stars', JSON.stringify({ a: 3 }))

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
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
    expect(screen.getByRole('button', { name: "Dài ~18'" })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: "Vừa ~12'" })).toHaveAttribute('aria-pressed', 'false')
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
    // R24: auto picking up the current band is a RESULT, not a choice — `dim`, never `on` next to
    // "Tự động" (that would read as two things both being "chosen" at once).
    expect(screen.getByRole('button', { name: 'Bậc 2' })).toHaveAttribute('data-tone', 'dim')
    expect(screen.getByRole('button', { name: 'Bậc 2' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Tự động đang chọn → bậc hiện tại ⭐ 2')).toBeInTheDocument()
  })

  it('the lesson panel is six segs on one row; auto on leaves the current band dim, not lit', () => {
    renderDashboard({ band: { mode: 'auto', value: 2 } })
    const segs = within(screen.getByTestId('lesson-panel')).getAllByTestId('seg').slice(0, 6)
    expect(segs.map(s => s.textContent)).toEqual(['Tự động', '1', '2', '3', '4', '5'])
    expect(segs[0]).toHaveAttribute('data-tone', 'on')
    expect(segs[2]).toHaveAttribute('data-tone', 'dim')
    expect(segs.filter(s => s.dataset.tone === 'on')).toHaveLength(1)
    expect(screen.getByText('Tự động đang chọn → bậc hiện tại ⭐ 2')).toHaveClass('text-[11px]')
  })

  it('picking a band by hand lights exactly that seg and drops the auto line', () => {
    renderDashboard({ band: { mode: 'manual', value: 3 } })
    const segs = within(screen.getByTestId('lesson-panel')).getAllByTestId('seg').slice(0, 6)
    expect(segs[0]).toHaveAttribute('data-tone', 'off')
    expect(segs[3]).toHaveAttribute('data-tone', 'on')
    expect(screen.queryByText(/Tự động đang chọn/)).toBeNull()
  })

  it('the length row is renamed and shortened, and the tomorrow line stays', () => {
    renderDashboard()
    expect(screen.getByText('Độ dài nhiệm vụ')).toBeInTheDocument()
    expect(screen.queryByText('Thời lượng')).toBeNull()
    expect(screen.getAllByTestId('seg').map(s => s.textContent))
      .toEqual(expect.arrayContaining(["Ngắn ~8'", "Vừa ~12'", "Dài ~18'"]))
    expect(screen.getByText('Áp dụng từ bài học ngày mai.')).toBeInTheDocument()
  })

  it('both panels collapse to a 56px row on a phone, open from md up', () => {
    renderDashboard()
    const limitRow = screen.getByRole('button', { name: /Giới hạn mỗi ngày/ })
    const lessonRow = screen.getByRole('button', { name: /Bài học/ })
    expect(limitRow).toHaveClass('min-h-[56px]', 'md:hidden')
    expect(lessonRow).toHaveClass('min-h-[56px]', 'md:hidden')
    // The `right` slot (today-vs-limit) rides along in the phone summary row too.
    expect(within(limitRow).getByText(/Hôm nay:/)).toBeInTheDocument()

    // `Panel` folds its body under a plain Tailwind `hidden` class rather than the `hidden`
    // attribute or an inline style — jsdom applies neither of those without a real stylesheet, so
    // `toBeVisible()` cannot tell open from closed here; the class itself is the real assertion.
    const lengthLabel = screen.getByText('Độ dài nhiệm vụ')
    expect(lengthLabel.parentElement).toHaveClass('hidden', 'md:block')
    fireEvent.click(lessonRow)
    expect(lengthLabel.parentElement).not.toHaveClass('hidden')
  })

  it('says when a difficulty or length change takes effect', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Áp dụng từ bài học ngày mai.')).toBeInTheDocument()
  })

  /* ---- Phase 10, design §12 M8c: the dense phone layout ---- */

  /**
   * Spec decision 2: the design drops this card on a phone and we do not — the last 20 recordings
   * stay a working feature, not a layout. Task 10 dropped the ad-hoc `<details>` disclosure that
   * used to fold it on a phone (its 64 px summary row was the one control on this adult screen
   * still held to the child tap floor — round 4's R3 ruling reversed that): the panel is plain and
   * always open for now, and Task 14 restores a proper collapse using `Panel`'s own `collapsible`
   * prop, this time at the adult 44 px convention throughout.
   */
  it('renders the recordings panel plainly — data-testid intact for Task 14 to build the collapse on', async () => {
    recordingsMock.listRecordings.mockResolvedValue([
      { id: 'r1', ts: NOW, text: 'apple', blob: new Blob(['x']) },
    ])

    renderWithDialogs(<ParentDashboard />)
    const heading = await screen.findByText('Bản ghi gần đây')

    expect(heading.closest('[data-testid="panel"]')).toBeInTheDocument()
    // findBy*, not getBy*: the heading renders synchronously while the row waits on
    // listRecordings, so a bare get here races the promise and fails under a loaded suite.
    expect(await screen.findByRole('button', { name: 'Phát' })).toBeInTheDocument()
    expect(screen.getByText('apple')).toBeInTheDocument()
  })

  /**
   * The design calls this screen an adult interface outright — "vùng chạm 36–48px (không cần 64)",
   * and round 4's R3 ruling made that the whole screen's rule with no exception left: visible
   * controls 28–44 px, tap target never below 44, nothing sized for a child's finger any more.
   * `size="adult"` `Button`s were already a fixed 44 at every width since Phase 12 task 15; Task 10
   * brought the screen's own raw chip buttons (band, length, limit) in line with them by dropping
   * their `md:min-h-[64px]` pair. Task 13 replaces the number input outright with `SegRow` (44px
   * segs, no `md:` variant at all) and `Stepper` (visible 36px ±, a 44px hit band via `after:-inset-1`
   * — never `md:h-16`/`md:min-h-[64px]`).
   */
  it('uses adult 28/32/36/44 px controls with no 56/64 leftovers on the screen\'s own buttons', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    for (const name of ['Bậc 3', 'Tự động', "30'", "Vừa ~12'"]) {
      const btn = screen.getByRole('button', { name })
      expect(btn, name).toHaveClass('h-11')
      expect(btn.className, name).not.toMatch(/md:min-h-\[64px\]|md:h-16/)
    }
    const stepUp = screen.getByRole('button', { name: 'Tăng' })
    expect(stepUp).toHaveClass('h-9', 'w-9', 'relative', 'after:absolute', 'after:-inset-1')
    expect(stepUp.className).not.toMatch(/md:h-16|min-h-\[64px\]/)
    // `size="adult"`: fixed 44 px, no `md:` override.
    expect(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }).className).not.toMatch(/md:min-h/)
    expect(screen.getByRole('main')).toHaveClass('px-6', 'md:px-6')
  })

  /* ---- Task 12: MinutesChart panel, four average tiles, tappable weak-sound chips ---- */

  it('the chart panel renders MinutesChart with 7 days on a phone and 14 from md up', () => {
    matchMedia(false)
    renderDashboard()
    expect(screen.getAllByTestId('minute-bar')).toHaveLength(7)

    cleanup()
    matchMedia(true)
    renderDashboard()
    expect(screen.getAllByTestId('minute-bar')).toHaveLength(14)

    fireEvent.click(screen.getByRole('button', { name: '7' }))
    expect(screen.getAllByTestId('minute-bar')).toHaveLength(7)
  })

  it('an empty log draws the dashed box, never fourteen zero-minute bars', () => {
    // "Âm hay sai" and the recordings panel (still empty before its own fetch resolves) also
    // render an `EmptyState` with no activity at all — only the chart's own is `variant="dashed"`.
    renderDashboard({ events: [] })
    const dashed = screen.getAllByTestId('empty-state').find(el => el.classList.contains('border-dashed'))
    expect(dashed).toHaveClass('border-dashed', 'min-h-[120px]')
    expect(screen.queryByTestId('minute-bar')).toBeNull()
  })

  it('the averages panel has four tiles and Truyện reads "—" because a story event carries no score', () => {
    renderDashboard()
    const panel = screen.getByTestId('averages-panel')
    expect(within(panel).getByTestId('averages-grid')).toHaveClass('grid-cols-4')
    expect(within(panel).getAllByTestId('average-tile')).toHaveLength(4)
    expect(within(panel).getByText('Truyện').nextSibling).toHaveTextContent('—')
    expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent('Điểm trung bình')
  })

  // Two phonemes, each said twice, so `weakPhonemes` (which needs at least two samples per
  // phoneme) keeps both — one under 50 (fix tone) and one in 50–70 (sun tone). `renderDashboard`
  // seeds `localStorage` itself from `opts.events`, so these go in that way rather than through
  // `seedActivity` (which a bare `renderDashboard()` call right after would just overwrite).
  const WEAK_EVENTS: ActivityEvent[] = [
    { ts: Date.now(), kind: 'speak', id: 'w1', score: 80, phonemes: [{ phoneme: 'th', score: 44 }] },
    { ts: Date.now(), kind: 'speak', id: 'w2', score: 80, phonemes: [{ phoneme: 'th', score: 48 }] },
    { ts: Date.now(), kind: 'speak', id: 'w3', score: 80, phonemes: [{ phoneme: 'r', score: 60 }] },
    { ts: Date.now(), kind: 'speak', id: 'w4', score: 80, phonemes: [{ phoneme: 'r', score: 64 }] },
  ]

  it('a weak-sound chip is one nowrap 36px pill, toned by score', () => {
    renderDashboard({ events: WEAK_EVENTS })
    const chips = screen.getAllByTestId('weak-chip')
    expect(chips[0]).toHaveClass('h-9', 'rounded-r12', 'whitespace-nowrap', 'text-[13px]', 'bg-fix-50', 'text-fix-700')
    expect(chips[0]).toHaveTextContent(/^\/[^/]+\/ · \d+ \(\d+ lần\)$/)
    expect(chips.find(c => c.className.includes('bg-ok-50'))).toBeTruthy() // 50–70 → sun
  })

  it('on a phone the chip is a button that opens its tip; the tip is not hidden away', () => {
    matchMedia(false)
    renderDashboard({ events: WEAK_EVENTS })
    expect(screen.queryByTestId('weak-tip')).toBeNull()

    fireEvent.click(screen.getAllByTestId('weak-chip')[0])
    expect(screen.getByTestId('weak-tip')).toHaveClass('rounded-r10', 'bg-[#FFF6E0]', 'text-[12px]', 'text-sun-700')

    fireEvent.click(screen.getAllByTestId('weak-chip')[0])
    expect(screen.queryByTestId('weak-tip')).toBeNull()
  })

  it('from md up the tip of the first chip is shown without asking', () => {
    matchMedia(true)
    renderDashboard({ events: WEAK_EVENTS })
    expect(screen.getByTestId('weak-tip')).toBeInTheDocument()
  })

  it('five weak sounds and a three-line tip still fit the panel without a horizontal scroll', () => {
    const FIVE_EVENTS: ActivityEvent[] = [
      { ts: Date.now(), kind: 'speak', id: 'a1', score: 80, phonemes: [{ phoneme: 'th', score: 30 }] },
      { ts: Date.now(), kind: 'speak', id: 'a2', score: 80, phonemes: [{ phoneme: 'th', score: 34 }] },
      { ts: Date.now(), kind: 'speak', id: 'b1', score: 80, phonemes: [{ phoneme: 'dh', score: 40 }] },
      { ts: Date.now(), kind: 'speak', id: 'b2', score: 80, phonemes: [{ phoneme: 'dh', score: 44 }] },
      { ts: Date.now(), kind: 'speak', id: 'c1', score: 80, phonemes: [{ phoneme: 'v', score: 50 }] },
      { ts: Date.now(), kind: 'speak', id: 'c2', score: 80, phonemes: [{ phoneme: 'v', score: 54 }] },
      { ts: Date.now(), kind: 'speak', id: 'd1', score: 80, phonemes: [{ phoneme: 'f', score: 60 }] },
      { ts: Date.now(), kind: 'speak', id: 'd2', score: 80, phonemes: [{ phoneme: 'f', score: 64 }] },
      { ts: Date.now(), kind: 'speak', id: 'e1', score: 80, phonemes: [{ phoneme: 'z', score: 68 }] },
      { ts: Date.now(), kind: 'speak', id: 'e2', score: 80, phonemes: [{ phoneme: 'z', score: 70 }] },
    ]
    renderDashboard({ events: FIVE_EVENTS })
    expect(screen.getAllByTestId('weak-chip')).toHaveLength(5)
    expect(screen.getByTestId('weak-list')).toHaveClass('flex-wrap', 'gap-1.5')
  })

  it('pressing a length chip persists the lesson length', async () => {
    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: "Ngắn ~8'" }))

    expect(getLessonLength()).toBe('short')
    expect(screen.getByRole('button', { name: "Ngắn ~8'" })).toHaveAttribute('aria-pressed', 'true')
  })

  /* ---- Task 10: the dashboard shell — one-row header, PanelGrid 1/2/3, danger reset row ---- */

  it('the header is one left-aligned row: H1 20/24, the summary line as its sub, a 44px lock button', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-[22px]', 'md:text-[28px]')
    expect(screen.getByText(/Tuần này: \d+ phút · điểm TB/)).toHaveClass('truncate', 'text-[13px]', 'md:text-[15px]')
    const lock = screen.getByRole('button', { name: 'Khoá lại' })
    expect(lock).toHaveClass('h-11', 'rounded-r12', 'bg-sand', 'text-sand-text')
    expect(lock.className).not.toMatch(/border-teal-line|bg-white/) // không còn `variant="outline"`
    expect(within(lock).getByText('🔐 Khoá lại')).toHaveClass('hidden', 'md:inline')
  })

  it('an empty week says so instead of printing zeros', () => {
    renderDashboard({ events: [] })
    expect(screen.getByText('Chưa có buổi luyện nào tuần này')).toBeInTheDocument()
  })

  it('all ten panels live inside one grid, in phone order, and the grid is 1/2/3', () => {
    renderDashboard()
    const grid = screen.getByTestId('panel-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'ipad:grid-cols-3')
    // Task 13: `collapsible` panels (limit, lesson) render their own `<h2>` twice — once inside the
    // phone-only fold button, once in the `md:flex` desktop row — so titles are de-duplicated
    // (order-preserving) before comparing against the one-per-panel list.
    const titles = within(grid).getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect([...new Set(titles)]).toEqual([
      'Tài khoản', 'Phút luyện · 7 ngày', 'Điểm trung bình', 'Âm hay sai',
      '⏰ Giới hạn mỗi ngày', 'Bài học', 'Bản ghi gần đây', 'Tiến độ từ xa',
    ])
    expect(screen.queryByTestId('account-card')).toBe(within(grid).getByTestId('account-card'))
  })

  it('the account panel and the remote panel are full-width; remote is the last panel', () => {
    renderDashboard()
    expect(screen.getByTestId('account-card')).toHaveClass('md:col-span-2', 'ipad:col-span-3')
    const panels = screen.getAllByTestId('panel')
    expect(panels[panels.length - 1]).toHaveTextContent('Tiến độ từ xa')
    expect(panels[panels.length - 1]).toHaveClass('md:col-span-2', 'ipad:col-span-3')
  })

  it('the reset row is the last thing on the screen: a description left, a danger button right', () => {
    renderDashboard()
    const row = screen.getByTestId('reset-row')
    expect(row).toHaveClass('mt-6', 'flex', 'items-center', 'justify-between', 'gap-3')
    expect(within(row).getByText(/Xoá sao, chuỗi ngày và bản ghi trên máy này/)).toHaveClass('text-[12px]', 'text-ink-300')
    const btn = within(row).getByRole('button', { name: '↺ Đặt lại tiến trình…' })
    expect(btn).toHaveClass('bg-white', 'text-fix-700', 'border-fix-300', 'min-h-[44px]')
    expect(row.compareDocumentPosition(screen.getByTestId('panel-grid')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('a build with no cloud renders six panels and no account/profile/remote anywhere', () => {
    renderDashboard({ cloud: false })
    expect(screen.queryByTestId('account-card')).toBeNull()
    expect(screen.queryByText('Tiến độ từ xa')).toBeNull()
    expect(screen.queryByText('Hồ sơ')).toBeNull()
    // The averages panel carries its own `averages-panel` testid (Task 12), and Task 13's limit/
    // lesson panels carry `limit-panel`/`lesson-panel` (so a `within(...).getByTestId('limit-panel')`
    // lookup elsewhere never has to disambiguate against the other nine) — all four count as
    // "a panel" here alongside the generic `panel` every plain panel keeps.
    const grid = screen.getByTestId('panel-grid')
    const panels = [
      ...within(grid).queryAllByTestId('panel'),
      ...within(grid).queryAllByTestId('averages-panel'),
      ...within(grid).queryAllByTestId('limit-panel'),
      ...within(grid).queryAllByTestId('lesson-panel'),
    ]
    expect(panels).toHaveLength(6)
    expect(screen.getByTestId('panel-grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'ipad:grid-cols-3')
  })

  it('no control on the screen is a 56/64 child target any more, apart from Panel\'s own fold row', () => {
    renderDashboard()
    for (const el of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]) {
      // Task 13 (decision 29): `Panel`'s own phone-only collapse row (`min-h-[56px] ... md:hidden`,
      // `client/src/components/adult/Panel.tsx`) is a structural fold affordance, not a
      // child-sized control — it is `Panel`'s call, not this screen's, and it is already covered by
      // `components/adult/adult.test.tsx`. Every other 56/64 pattern here still fails this check.
      if (el.className.includes('min-h-[56px]') && el.className.includes('md:hidden')) continue
      expect(el.className).not.toMatch(/min-h-\[56px\]|min-h-\[64px\]|md:min-h-\[64px\]|md:h-16/)
    }
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
    expect(screen.getByText('Liên kết email để giữ tiến độ và xem trên máy khác.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email của bố mẹ')).toBeInTheDocument()
    expect(await screen.findByText('ABC23XYZ')).toBeInTheDocument()
    expect(screen.getByText(/chụp màn hình lại/)).toBeInTheDocument()
  })

  it('never shows a recovery code once the account is linked — that is correct, not a bug', async () => {
    cloud.configured = true
    authMock.isAnonymous.mockResolvedValue(false)
    authMock.currentEmail.mockResolvedValue('bome@example.com')

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(authMock.ensureRecoveryCode).not.toHaveBeenCalled()
    expect(screen.queryByText(/chụp màn hình lại/)).not.toBeInTheDocument()
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

    fireEvent.change(screen.getByLabelText('Email của bố mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Email của bố mẹ').closest('form')!)
    })
    expect(authMock.linkEmail).toHaveBeenCalledWith('bome@example.com')
    expect(screen.getByText(/Nhập mã 6 số vừa gửi tới bome@example.com/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })
    expect(authMock.verifyEmailOtp).toHaveBeenCalledWith('bome@example.com', '123456')
    expect(screen.getByText('bome@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
    // The standing ruling: linking just dropped the code server-side, so it must vanish here too.
    expect(screen.queryByText(/chụp màn hình lại/)).not.toBeInTheDocument()
  })

  it('reports a wrong or expired OTP without losing the typed email', async () => {
    cloud.configured = true
    authMock.verifyEmailOtp.mockResolvedValue({ ok: false, error: 'Token has expired or is invalid' })

    renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.change(screen.getByLabelText('Email của bố mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố mẹ').closest('form')!) })

    fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '000000' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!) })

    expect(screen.getByTestId('field-error')).toHaveTextContent('hết hạn')
    expect(screen.getByText(/vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('is honest about a dropped connection while linking', async () => {
    cloud.configured = true
    authMock.linkEmail.mockResolvedValue({ ok: false, error: 'Failed to fetch' })

    renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.change(screen.getByLabelText('Email của bố mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố mẹ').closest('form')!) })

    expect(screen.getByTestId('field-error')).toHaveTextContent('Không có kết nối mạng')
    expect(screen.getByLabelText('Email của bố mẹ')).toBeInTheDocument()
  })

  it('lets the parent correct a typo\'d email before it is verified', async () => {
    cloud.configured = true
    renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.change(screen.getByLabelText('Email của bố mẹ'), { target: { value: 'typo@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố mẹ').closest('form')!) })

    fireEvent.click(screen.getByText('Sửa lại email'))
    const input = screen.getByLabelText('Email của bố mẹ') as HTMLInputElement
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
    expect(screen.queryByLabelText('Email của bố mẹ')).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
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
      expect(screen.queryByLabelText('Email của bố mẹ')).not.toBeInTheDocument()
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

      expect(screen.getByLabelText('Email của bố mẹ')).toBeInTheDocument()
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
      // `AccountCard`'s ② copy (Task 4) — see `docs/design/2026-09-04-round4-parent-zone-brief.md` §2.
      expect(screen.getByTestId('no-session')).toHaveTextContent('Bé vẫn học bình thường, tiến độ lưu trên máy.')
      // No dead form: `linkEmail` would call `updateUser` on a user that does not exist.
      expect(screen.queryByLabelText('Email của bố mẹ')).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
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

    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
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
    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(/trên tài khoản/)
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
    await flush()
    unmount()

    cloud.configured = false
    renderWithDialogs(<ParentDashboard />)
    await flush()
    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/tài khoản/)
  })

  /** F7: "an toàn trên mọi thiết bị" sat on the same screen as "Bản ghi gần đây", and recordings
   * never sync. The consent line the spec asks for stays; the promise around it gets honest. */
  /* Task 11 note: this consent line moved into `AccountCard` (Task 4) — a single sentence with no
   * claim about recordings syncing either way, so the over-promise this test used to guard against
   * ("an toàn trên mọi thiết bị") simply has nowhere left to sneak back in. */
  it('promises only what actually travels', async () => {
    cloud.configured = true

    renderWithDialogs(<ParentDashboard />)
    await flush()

    expect(screen.queryByText(/trên mọi thiết bị/)).not.toBeInTheDocument()
    expect(screen.getByText('Liên kết email để giữ tiến độ và xem trên máy khác.')).toBeInTheDocument()
  })

  it('does not touch the mirror on reset with no cloud configured', async () => {
    cloud.configured = false

    renderWithDialogs(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
    await flush()
    expect(syncMock.resetRemoteProgress).not.toHaveBeenCalled()
  })
})

/**
 * Task 11: the Account panel's body is now `AccountCard` (Task 4) — a two-column `Panel` with the
 * card on the left and a "Hồ sơ" column on the right (`ipad:`/`md:` from), one row per profile.
 * Fix round 1 (decision 14): the h32 `sync-status` pill moved to the `Panel`'s own header row via
 * `right`; `AccountCard` gets `showPill={false}` so it draws no copy of its own — exactly one pill
 * per panel, now aligned with the "Tài khoản" title. This screen only derives which of `AccountCard`'s
 * eleven states applies and wires the eight handlers through.
 */
describe('Task 11: account panel is AccountCard, with a profile column', () => {
  const EMAIL61 = 'nguyenthiphuongthaonguyenvanphamlethihoangtranminhab@vidu.com'
  const SYNCED: MockSyncStatus = { state: 'synced', pending: 0, lastSyncedAt: null, lastError: null, syncing: false }

  it('the account panel is the AccountCard with the 32px pill in its title row', async () => {
    // The default mock answers `state: 'off'` — SyncPill's own signal for "no cloud" — under which
    // it renders nothing at all, pill included. A pill to assert on needs a real sync state.
    syncMock.syncStatus.mockReturnValue(SYNCED)
    renderDashboard()
    await settle()
    const panel = screen.getByTestId('account-card')
    expect(within(panel).getByTestId('account-card-body')).toBeInTheDocument()
    expect(within(panel).getByTestId('sync-status')).toHaveClass('h-8')
  })

  it('no session drives both the card and the pill from the same fact', async () => {
    syncMock.syncStatus.mockReturnValue(SYNCED)
    authMock.currentUserId.mockResolvedValue(null)
    renderDashboard()
    await settle()
    expect(screen.getByTestId('no-session')).toBeInTheDocument()
    expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Chưa kết nối')
  })

  it('a 61-character email never widens the panel: one ellipsised line, full value in the title', async () => {
    authMock.isAnonymous.mockResolvedValue(false)
    authMock.currentEmail.mockResolvedValue(EMAIL61)
    renderDashboard()
    await settle()
    const box = screen.getByTestId('linked-email')
    expect(box).toHaveClass('min-w-0')
    expect(box).toHaveAttribute('title', EMAIL61)
    // Fix round 1: `truncate` moved off `box` (a flex container — Chromium never paints the
    // ellipsis for a flex container's own direct text-node child) onto a nested non-flex span.
    expect(box.querySelector('span')).toHaveClass('block', 'truncate')
    expect(box.parentElement).toHaveClass('flex', 'min-w-0')
  })

  it('a sync error becomes state ⑩, not a silent pill', async () => {
    syncMock.syncStatus.mockReturnValue({ ...SYNCED, pending: 3, lastError: 'boom' })
    renderDashboard()
    await settle()
    expect(screen.getByText('3 mục chưa lên máy chủ. Sẽ thử lại khi có mạng.')).toBeInTheDocument()
  })

  it('the profile column is the right half on iPad portrait, with a 2px divider', async () => {
    renderDashboard({ profiles: 8 })
    await settle()
    expect(screen.getByTestId('account-columns')).toHaveClass('md:grid', 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', 'md:gap-4')
    expect(screen.getByTestId('profile-column')).toHaveClass('md:border-l-2', 'md:border-line-200', 'md:pl-4')
  })

  /** Fix: the brief's own version of this test queries the "Đổi tên" button at document scope, which
   * throws once there is more than one profile row (each row has its own). Scoped to the first row —
   * the thing the rest of the assertion is already about — the intent (style check) is unchanged. */
  it('a profile row is 40px: name on one ellipsised line and two 32px buttons', async () => {
    renderDashboard({ profiles: 8 })
    await settle()
    const rows = screen.getAllByTestId('profile-row')
    expect(rows).toHaveLength(8)
    expect(rows[0]).toHaveClass('min-h-[40px]', 'border-b', 'border-line-200')
    expect(within(rows[0]).getByText('Bé')).toHaveClass('truncate', 'text-[13px]')
    expect(screen.getByRole('button', { name: '+ Thêm hồ sơ' })).toHaveClass('h-8', 'rounded-r10', 'bg-teal-50', 'text-teal-600', 'text-[12px]')
    expect(within(rows[0]).getByRole('button', { name: 'Đổi tên' })).toHaveClass('h-8', 'underline', 'text-[12px]')
  })

  /** Fix round 1, decision 26: the "· đang dùng máy này" hint is its own 11px sub-line under the
   * 13px name, not folded into the same span — `renderDashboard({ profiles: 8 })`'s roster.p1 is
   * the active profile, so `rows[0]` is the one that carries it. */
  it('the active row has a distinct 11px sub-line under the 13px name', async () => {
    renderDashboard({ profiles: 8 })
    await settle()
    const rows = screen.getAllByTestId('profile-row')
    expect(within(rows[0]).getByText('Bé')).toHaveClass('text-[13px]', 'font-extrabold', 'text-ink-900')
    expect(within(rows[0]).getByText('đang dùng máy này')).toHaveClass('text-[11px]', 'text-ink-300')
  })

  it('an unreadable roster still warns instead of pairing a blank name with "+ Thêm hồ sơ"', async () => {
    profileStateMock.listProfiles.mockReturnValue([])
    renderDashboard()
    await settle()
    expect(screen.getByTestId('profile-unreadable')).toBeInTheDocument()
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
    // Fix round 1: the skeleton IS the row while loading — no real name line drawn above it, and
    // no second, separately-bordered `<li>` around it (the skeleton draws its own outline).
    expect(cards[0]).not.toHaveTextContent(SIBLING.name)
    expect(cards[0].className).not.toMatch(/border-line-200/)

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
