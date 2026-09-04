import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Profile } from '../cloud/profileState'

const cloud = vi.hoisted(() => ({ configured: true }))
vi.mock('../cloud/supabase', () => ({
  isCloudConfigured: () => cloud.configured,
}))

type AuthOk = { ok: true; userId: string | null }
type AuthFail = { ok: false; error: string }
const auth = vi.hoisted(() => ({
  currentAccessToken: vi.fn<() => Promise<string | null>>(async () => 'token-abc'),
  currentEmail: vi.fn<() => Promise<string | null>>(async () => null),
  currentUserId: vi.fn<() => Promise<string | null>>(async () => 'u1'),
  ensureRecoveryCode: vi.fn<() => Promise<string | null>>(async () => null),
  startAnonymousSession: vi.fn(async () => undefined),
  signInWithEmail: vi.fn<(email: string, options?: { abandonAnonymous?: boolean }) => Promise<AuthOk | AuthFail>>(async () => ({ ok: true, userId: 'u1' })),
  verifyEmailOtp: vi.fn<(email: string, token: string) => Promise<AuthOk | AuthFail>>(async () => ({ ok: true, userId: 'u1' })),
}))
vi.mock('../cloud/auth', () => auth)

/**
 * **`profileState` is the REAL module here** — only the two functions that would talk to a server
 * or reload the document are replaced.
 *
 * The whole-module mock this file used to carry (`adoptProfiles: remote => remote`) made two of
 * this screen's rules untestable at once: the ordering constraint (`adoptProfiles` must COMPLETE
 * before `pullProfile` is called, or `rescueOrphanNamespaces` folds the pulled keys into the wrong
 * child) passed with the calls inverted, and the "which profiles are restorable" filter was a
 * no-op because the mock returned whatever it was handed. Both defects were invisible to fifteen
 * green tests. The real roster — real localStorage, real UUID validation — is what makes them
 * visible, which is why the ids below are real UUIDs.
 */
const profileState = vi.hoisted(() => ({
  fetchRemoteProfiles: vi.fn<() => Promise<Profile[] | null>>(async () => []),
  switchProfile: vi.fn(() => true),
}))
vi.mock('../cloud/profileState', async importOriginal => ({
  ...(await importOriginal<typeof import('../cloud/profileState')>()),
  fetchRemoteProfiles: profileState.fetchRemoteProfiles,
  switchProfile: profileState.switchProfile,
}))

const sync = vi.hoisted(() => ({
  pullProfile: vi.fn(async (_id: string) => true),
  hasMirroredData: vi.fn((_id: string) => false),
}))
vi.mock('../cloud/sync', () => sync)

import { listProfiles } from '../cloud/profileState'
import { logActivity } from '../progress/activity'
import { setStars } from '../progress/store'
import { CloudStart, describeAuthError, describeRecoverError } from './CloudStart'

/** Real UUIDs, because the real roster refuses anything else (`isProfileId`). */
const MINTED = '11111111-2222-4333-8444-555555555555'
const SOC = '22222222-3333-4444-8555-666666666666'
const CAO = '33333333-4444-4555-8666-777777777777'
const GAU = '44444444-5555-4666-8777-888888888888'

/** Bare aliases for the two mocks Task 9's own failing tests (brief §Step 1) call by these short
 * names — same `vi.fn()` instances as `profileState.fetchRemoteProfiles` / `sync.pullProfile`. */
const { fetchRemoteProfiles } = profileState
const { pullProfile } = sync

/** The 61-character email `shoot.mjs` also uses for the abandon screenshot — long enough that it
 * used to make the abandon button three screens wide (R11 / quyết định 23). */
const EMAIL61 = 'nguyenhoangbaongocanhthu.phuhuynh.speakup2026@examplemail.com'

function renderStart() {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<CloudStart />} />
        <Route path="/" element={<p>trang chủ</p>} />
        <Route path="/parent" element={<p>góc phụ huynh</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const profile = (id: string, name = 'Bé', avatar = '🦊', created = 0): Profile => ({ id, name, avatar, created })

/** A device as `ensureLocalProfile()` would have left it: one profile in the roster, and active. */
function bootDevice(id = MINTED) {
  localStorage.setItem('speakup.profiles', JSON.stringify([profile(id)]))
  localStorage.setItem('speakup.profile', id)
}

/** The math question is `a × b` with both in 3..9; `Math.random() === 0` makes it 3 × 3. */
function answerTheQuestion() {
  fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '9' } })
  fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
}

function openEmailDoor() {
  fireEvent.click(screen.getByText('Tôi có email đã liên kết'))
  answerTheQuestion()
}

function openCodeDoor() {
  renderStart()
  fireEvent.click(screen.getByText('Tôi có mã khôi phục'))
  answerTheQuestion()
}

async function typeCode(value: string) {
  fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value } })
}

async function submitRecover() {
  await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
}

/** Reaches the OTP field via the email door, with nothing sent yet. */
async function reachOtp() {
  renderStart()
  openEmailDoor()
  fireEvent.change(screen.getByLabelText('Email của bố mẹ'), { target: { value: 'bome@example.com' } })
  await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố mẹ').closest('form')!) })
}

/** `reachOtp`, then a successful OTP submit — carries the screen wherever `afterAuthenticated`
 * sends it (menu, `'result'`, straight to a restore, or the multi-candidate picker). */
async function passOtp(token = '123456') {
  await reachOtp()
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: token } })
    fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
  })
}

/** The account owns exactly one restorable profile, so `afterAuthenticated` auto-restores it —
 * no picker ever shows, which is exactly what makes a failed pull here land on `'result'` rather
 * than next to a still-open picker. */
async function pickOneProfile() {
  fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc')])
  await passOtp()
}

/** `n` restorable profiles, reached through the ordinary email+OTP flow — the multi-candidate
 * picker (Task 9's `density='compact'` grid), not the single-profile auto-restore above. */
async function reachPicker(n: number) {
  const pool = [SOC, CAO, GAU].slice(0, n)
  fetchRemoteProfiles.mockResolvedValue(pool.map((id, i) => profile(id, `Bé ${i + 1}`)))
  await passOtp()
}

/**
 * Reaches the `'abandon'` stage with a `Stranding` shaped exactly by `opts` — either the literal
 * string `'unchecked'`, or `{ profiles, stars, events, mirrored }` for the `'holding'` kind.
 *
 * `assessStranding` counts a profile through any of three routes (real local history, "the server
 * knows a profile this device doesn't", or `hasMirroredData`) — and the last two ALSO force its
 * `mirrored` flag true, whatever `hasMirroredData` says on its own. So a caller asking for
 * `mirrored: false` can only be built from real local history: `SOC` carries the stars, `CAO`
 * carries the events (each alone is enough to count as "has history"), and neither is offered
 * through `fetchRemoteProfiles`. The zero-count case has no such constraint — `abandonCopy` never
 * reads `mirrored` once stars and events are both zero — so it is simpler to build through
 * `fetchRemoteProfiles` alone (no local data to seed at all).
 */
async function reachAbandon(opts: { profiles: number; stars: number; events: number; mirrored: boolean } | 'unchecked') {
  localStorage.clear()
  bootDevice()
  sync.hasMirroredData.mockReturnValue(false)
  auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

  if (opts === 'unchecked') {
    fetchRemoteProfiles.mockResolvedValue(null)
  } else if (opts.stars === 0 && opts.events === 0) {
    fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc'), profile(CAO, 'Cáo')].slice(0, opts.profiles))
  } else {
    fetchRemoteProfiles.mockResolvedValue([])
    localStorage.setItem('speakup.profiles', JSON.stringify([profile(MINTED), profile(SOC, 'Sóc'), profile(CAO, 'Cáo')]))
    localStorage.setItem('speakup.profile', MINTED)
    localStorage.setItem(`speakup.${SOC}.stars`, JSON.stringify({ 'sword:cat': opts.stars }))
    localStorage.setItem(`speakup.${CAO}.activity`, JSON.stringify(
      Array.from({ length: opts.events }, (_, i) => ({ ts: 1000 + i, kind: 'word', id: `w-${i}` })),
    ))
    if (opts.mirrored) sync.hasMirroredData.mockImplementation((id: string) => id === CAO)
  }

  renderStart()
  openEmailDoor()
  fireEvent.change(screen.getByLabelText('Email của bố mẹ'), { target: { value: EMAIL61 } })
  await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố mẹ').closest('form')!) })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  cloud.configured = true
  auth.currentAccessToken.mockResolvedValue('token-abc')
  auth.currentEmail.mockResolvedValue(null)
  auth.signInWithEmail.mockResolvedValue({ ok: true, userId: 'u1' })
  auth.verifyEmailOtp.mockResolvedValue({ ok: true, userId: 'u1' })
  profileState.fetchRemoteProfiles.mockResolvedValue([])
  sync.pullProfile.mockResolvedValue(true)
  sync.hasMirroredData.mockReturnValue(false)
  bootDevice()
  vi.stubGlobal('fetch', vi.fn())
})

describe('with no cloud configured', () => {
  it('redirects home instead of showing a form that can never succeed', () => {
    cloud.configured = false
    renderStart()
    expect(screen.getByText('trang chủ')).toBeInTheDocument()
  })
})

describe('the menu', () => {
  it('offers both doors and an honest fresh start', () => {
    renderStart()
    expect(screen.getByText('Tôi có email đã liên kết')).toBeInTheDocument()
    expect(screen.getByText('Tôi có mã khôi phục')).toBeInTheDocument()
    expect(screen.getByText('Bắt đầu mới cho bé')).toBeInTheDocument()
  })
})

/**
 * F1d. This route is typeable, and both doors do something a child must never do by accident: the
 * email door can hand the iPad to another account, and the recovery code re-parents profiles onto
 * it. Reading the menu is harmless; the forms are not.
 */
describe('the parent question in front of both doors', () => {
  it('asks before the email form, and only shows it once the answer is right', () => {
    renderStart()

    fireEvent.click(screen.getByText('Tôi có email đã liên kết'))
    expect(screen.queryByLabelText('Email của bố mẹ')).not.toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.children.length === 0 && el?.textContent?.replace(/\s+/g, ' ').trim() === '3 × 3 =')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(screen.getByTestId('question-error')).toHaveTextContent('⛔ Chưa đúng — câu hỏi đã đổi, thử lại nhé.')
    expect(screen.queryByLabelText('Email của bố mẹ')).not.toBeInTheDocument()

    answerTheQuestion()
    expect(screen.getByLabelText('Email của bố mẹ')).toBeInTheDocument()
  })

  it('asks before the recovery-code form too', () => {
    renderStart()

    fireEvent.click(screen.getByText('Tôi có mã khôi phục'))
    expect(screen.queryByLabelText(/Mã khôi phục/)).not.toBeInTheDocument()

    answerTheQuestion()
    expect(screen.getByLabelText(/Mã khôi phục/)).toBeInTheDocument()
  })

  it('asks once per visit, not once per door', () => {
    renderStart()
    openEmailDoor()
    fireEvent.click(screen.getByText('← Chọn cách khác'))

    fireEvent.click(screen.getByText('Tôi có mã khôi phục'))
    expect(screen.getByLabelText(/Mã khôi phục/)).toBeInTheDocument()
  })
})

describe('the email door', () => {
  async function goToEmail() {
    renderStart()
    openEmailDoor()
    fireEvent.change(screen.getByLabelText('Email của bố mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố mẹ').closest('form')!) })
  }

  /**
   * F1b. The flag used to be passed on every send, in violation of the contract quoted in
   * `cloud/auth.ts` — which made the `anonymous-session-in-use` guard dead code and the Vietnamese
   * written for it unreachable. It is never on the first attempt now.
   */
  it('never asks to abandon the anonymous account on the first attempt', async () => {
    await goToEmail()
    expect(auth.signInWithEmail).toHaveBeenCalledWith('bome@example.com', {})
    expect(screen.getByText(/Nhập mã 6 số vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('continues by itself on a device with nothing to leave behind', async () => {
    // The guard fires — this device has a profile and an anonymous session — but the profile is the
    // empty one the app mints on every launch, so there is provably nothing to strand.
    auth.signInWithEmail
      .mockResolvedValueOnce({ ok: false, error: 'anonymous-session-in-use' })
      .mockResolvedValueOnce({ ok: true, userId: 'u1' })

    await goToEmail()

    expect(auth.signInWithEmail).toHaveBeenNthCalledWith(2, 'bome@example.com', { abandonAnonymous: true })
    expect(screen.getByText(/Nhập mã 6 số vừa gửi tới bome@example.com/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('stops and names what would be lost when this device is holding real progress', async () => {
    setStars('sword:cat', 3)
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    logActivity({ ts: 2000, kind: 'speak', id: 'sz-1', score: 80 })
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    // One attempt, without the flag, and it stopped there.
    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    expect(auth.signInWithEmail).toHaveBeenCalledWith('bome@example.com', {})
    // Named, in numbers read off this account — not a vague warning.
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('1 hồ sơ, 3 sao và 2 lượt luyện trên máy này sẽ bị thay.')
    // …and the way to keep it.
    expect(screen.getByRole('link', { name: 'Sao lưu trước ở Góc phụ huynh' })).toHaveAttribute('href', '/parent')
  })

  /**
   * The whole chain, through ordinary UI, with the parent acting in good faith and no typed URL:
   * a two-child family, the iPad handed to the newly added (empty) sibling by flow 6's picker, the
   * restore link on that child's Home, the math question answered by the adult, and their real
   * linked address in the box. Every step is intended behaviour. Asking the ACTIVE namespace what
   * would be lost answers "nothing" — and the first child's months of progress end up under an
   * owner that nothing can reach again.
   *
   * The question is what the ACCOUNT loses. Every profile on this iPad has the same owner.
   */
  it('sees the sibling whose namespace is not the active one', async () => {
    localStorage.setItem('speakup.profiles', JSON.stringify([profile(MINTED), profile(SOC, 'Sóc')]))
    localStorage.setItem('speakup.profile', MINTED) // the empty child is the one using the iPad
    // Child A's months of progress, one namespace away.
    localStorage.setItem(`speakup.${SOC}.stars`, JSON.stringify({ 'sword:cat': 3, 'sword:dog': 2 }))
    localStorage.setItem(`speakup.${SOC}.activity`, JSON.stringify(
      Array.from({ length: 40 }, (_, i) => ({ ts: 1000 + i, kind: 'word', id: `w-${i}` })),
    ))
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    // Not abandoned by itself: one attempt, no flag, and a confirmation naming the sibling's work.
    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    expect(auth.signInWithEmail).toHaveBeenCalledWith('bome@example.com', {})
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('1 hồ sơ, 5 sao và 40 lượt luyện trên máy này sẽ bị thay.')
  })

  /**
   * Roster written, `speakup.profile` NOT written — `ensureLocalProfile()` returns early when that
   * `setItem` fails, deliberately, so the app carries on reading the pre-Phase-11 keys rather than
   * a namespace nothing migrated into. Every star and every event on such a device is under the
   * bare `speakup.*` keys, and reading them only when the roster was ALSO empty missed exactly this
   * device: a full history, and a check that said "nothing here".
   */
  it('reads the legacy keys even when the roster is not empty', async () => {
    localStorage.setItem('speakup.profiles', JSON.stringify([profile(MINTED), profile(SOC, 'Sóc')]))
    localStorage.removeItem('speakup.profile') // the write that failed
    localStorage.setItem('speakup.stars', JSON.stringify({ 'sword:cat': 3, 'sword:dog': 3, 'sword:fox': 2 }))
    localStorage.setItem('speakup.activity', JSON.stringify(
      Array.from({ length: 200 }, (_, i) => ({ ts: 1000 + i, kind: 'word', id: `w-${i}` })),
    ))
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    expect(auth.signInWithEmail).not.toHaveBeenCalledWith('bome@example.com', { abandonAnonymous: true })
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('1 hồ sơ, 8 sao và 200 lượt luyện trên máy này sẽ bị thay.')
  })

  it('sees a child the account owns that this roster has forgotten', async () => {
    // Nothing local for them at all — the roster entry is gone. Their rows are still up there under
    // the owner about to be abandoned, which is exactly why they count.
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED), profile(SOC, 'Sóc')])
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    // Nothing local to count — the zero-count sentence, not "0 sao và 0 lượt" under a warning.
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('Máy này có 1 hồ sơ nhưng chưa học gì — thay được ngay.')
  })

  /**
   * C1. An owned profile that IS in the roster but has no local trace.
   *
   * Reached by an ordinary sequence, every step of it intended: a recovery-code restore adopts the
   * child into the roster, the pull fails on a network blip, the parent sees an empty child, backs
   * out and tries the email door instead. Local history: none. Local `mirrored` meta: none. The
   * only surviving fact about that child is the row the account owns — so the row is the evidence,
   * and it is the one that cannot be lost.
   */
  it('counts a profile the account owns even with nothing local to show for it', async () => {
    localStorage.setItem('speakup.profiles', JSON.stringify([profile(MINTED), profile(SOC, 'Sóc')]))
    localStorage.setItem('speakup.profile', MINTED)
    // Nothing seeded for SOC: no stars, no activity, no mirrored meta. Only the account owns them.
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED), profile(SOC, 'Sóc')])
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    expect(auth.signInWithEmail).not.toHaveBeenCalledWith('bome@example.com', { abandonAnonymous: true })
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('Máy này có 1 hồ sơ nhưng chưa học gì — thay được ngay.')
  })

  it('still continues by itself when the only row the account owns is the empty one', async () => {
    // The other side of that rule, and the one flow 3 depends on: a genuinely wiped device owns
    // exactly the profile it minted on launch, and the server said so.
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED)])
    auth.signInWithEmail
      .mockResolvedValueOnce({ ok: false, error: 'anonymous-session-in-use' })
      .mockResolvedValueOnce({ ok: true, userId: 'u1' })

    await goToEmail()

    expect(auth.signInWithEmail).toHaveBeenNthCalledWith(2, 'bome@example.com', { abandonAnonymous: true })
    expect(screen.getByText(/Nhập mã 6 số/)).toBeInTheDocument()
  })

  /**
   * C2. The read failing and the account being empty were the same value.
   *
   * Offline is self-limiting (the OTP send fails first), but a transient 500 or a slow query on a
   * live network is not — and it authorised the one thing in this app that cannot be undone.
   */
  it('stops and says so when it could not check the account at all', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue(null)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    expect(auth.signInWithEmail).not.toHaveBeenCalledWith('bome@example.com', { abandonAnonymous: true })
    // …and it does not dress the unknown up as a finding, in either direction.
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('Không đọc được dữ liệu trên máy này. Vẫn tiếp tục?')
    // The parent may still go ahead — knowing that nobody checked.
    expect(screen.getByRole('button', { name: 'Vẫn tiếp tục với email này' })).toBeInTheDocument()
  })

  /**
   * The roster this device would join the restored children onto is unreadable, so `adoptProfiles`
   * writes nothing and says `null`. Reporting "this account has no profiles" there would be a false
   * sentence about the family's data — in front of a parent who came to this screen precisely
   * because something had already gone missing once.
   */
  it('says it could not join the children on rather than that there are none', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Soc')])
    // The real `adoptProfiles` (this file mocks only the two functions that would hit the network
    // or reload the document), refusing a roster it cannot read: bytes on disk, none of them a
    // child. Written after the render so the screen's own mount-time reads are unaffected.
    localStorage.setItem('speakup.profiles', '[{"id":"11111111-2222-4333-8444-5555')

    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Chưa đọc được danh sách hồ sơ trên máy này')
    expect(screen.queryByText(/chưa có hồ sơ nào/)).not.toBeInTheDocument()
    expect(sync.pullProfile).not.toHaveBeenCalled()
    expect(profileState.switchProfile).not.toHaveBeenCalled()
  })

  it('never announces an unchecked account as an empty one after signing in', async () => {
    // The same conflation one screen later: this sentence tells a parent their child is gone.
    profileState.fetchRemoteProfiles.mockResolvedValue(null)
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })

    expect(screen.queryByText(/chưa có hồ sơ nào/)).not.toBeInTheDocument()
    // R10 / quyết định 22: this is one of the four merged system failures now.
    expect(screen.getByRole('alert')).toHaveTextContent('Không kết nối được máy chủ')
    expect(sync.pullProfile).not.toHaveBeenCalled()
  })

  it('counts rows that only exist on the server as something to lose', async () => {
    // Nothing on disk (a trimmed cache) but rows mirrored under the anonymous user id: those are
    // exactly what becomes unreachable, and they used to be nobody's business.
    sync.hasMirroredData.mockReturnValue(true)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    // Nothing local to count — the zero-count sentence, not "0 sao và 0 lượt" under a warning.
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('Máy này có 1 hồ sơ nhưng chưa học gì — thay được ngay.')
  })

  /**
   * The dialog must never argue against its own warning. In the case round 3 exists for the
   * evidence is a row on the server, so every local sum is zero — and the zero-count sentence
   * (R11 / quyết định 23) says so plainly rather than printing "0 sao và 0 lượt luyện".
   */
  it('never prints a zero count next to the warning', async () => {
    sync.hasMirroredData.mockReturnValue(true)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    const copy = screen.getByTestId('abandon-copy')
    expect(copy.textContent).not.toMatch(/(^|[^0-9])0 (sao|lượt)/)
    expect(copy).toHaveTextContent('chưa học gì — thay được ngay')
  })

  it('passes the flag only after the parent says so in as many words', async () => {
    setStars('sword:cat', 3)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })
    await goToEmail()

    auth.signInWithEmail.mockResolvedValue({ ok: true, userId: 'u2' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Vẫn tiếp tục với email này' })) })

    expect(auth.signInWithEmail).toHaveBeenLastCalledWith('bome@example.com', { abandonAnonymous: true })
    expect(screen.getByText(/Nhập mã 6 số vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('lets the parent back out of abandoning without sending anything', async () => {
    setStars('sword:cat', 3)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })
    await goToEmail()

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))

    expect(screen.getByLabelText('Email của bố mẹ')).toBeInTheDocument()
    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
  })

  /**
   * F1c. `shouldCreateUser: true` under a button labelled "Tôi có email đã liên kết" is what turned
   * a mistyped address into a brand-new empty account, with the family's real one abandoned in the
   * same breath and no way back. `cloud/auth.ts` refuses to create one now; this screen has to say
   * why, without ever suggesting the same email again.
   */
  it('is honest when the email was never linked, and abandons nothing', async () => {
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'email-not-linked' })

    await goToEmail()

    // The 'email' stage owns its own field now — the error lands in the FieldRow gutter, not the
    // top-of-card alert (R9 / decision 17).
    expect(screen.getByTestId('field-error')).toHaveTextContent(describeAuthError('email-not-linked'))
    expect(screen.getByTestId('field-error')).toHaveTextContent('mã khôi phục')
    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    expect(auth.signInWithEmail).not.toHaveBeenCalledWith('bome@example.com', { abandonAnonymous: true })
    // Still on the email form, ready for the other address.
    expect(screen.getByLabelText('Email của bố mẹ')).toBeInTheDocument()
  })

  it('says the same thing on the form itself, before the parent types', async () => {
    renderStart()
    openEmailDoor()
    expect(screen.getByText(/Chỉ dùng được email đã liên kết/)).toBeInTheDocument()
  })

  it('never advises a retry for a guard that a retry reproduces', async () => {
    // The abandonment path answered "anonymous-session-in-use" a second time: the copy the parent
    // then reads must point at the parent screen, not at the button that just failed.
    setStars('sword:cat', 3)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })
    await goToEmail()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Vẫn tiếp tục với email này' })) })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Góc phụ huynh')
    expect(alert.textContent).not.toMatch(/thử lại/)
  })

  it('shows a Vietnamese error and lets the parent retry on an offline failure', async () => {
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'Failed to fetch' })
    await goToEmail()
    expect(screen.getByTestId('field-error')).toHaveTextContent(describeAuthError('Failed to fetch'))
    // still on the email form, ready to retry
    expect(screen.getByLabelText('Email của bố mẹ')).toBeInTheDocument()
  })

  it('reports a wrong or expired OTP without losing the typed email', async () => {
    await goToEmail()
    auth.verifyEmailOtp.mockResolvedValue({ ok: false, error: 'Token has expired or is invalid' })
    fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '000000' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!) })
    expect(screen.getByTestId('field-error')).toHaveTextContent('hết hạn')
    expect(screen.getByText(/vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('lets the parent go back and correct a typo\'d email', async () => {
    await goToEmail()
    fireEvent.click(screen.getByText('Sửa lại email'))
    const input = screen.getByLabelText('Email của bố mẹ') as HTMLInputElement
    expect(input.value).toBe('bome@example.com')
    fireEvent.change(input, { target: { value: 'fixed@example.com' } })
    await act(async () => { fireEvent.submit(input.closest('form')!) })
    expect(auth.signInWithEmail).toHaveBeenLastCalledWith('fixed@example.com', {})
  })

  /**
   * M1. The placeholder this device minted on launch must not outlive the restore.
   *
   * Nothing here is corrupt and nothing races: site data cleared, launch mints the empty profile M
   * and gives it a server row, the parent restores the real child C, and the roster is left holding
   * both. That was reasoned about once and called harmless - before flow 6 wired the app-start
   * picker, which is the moment the roster stopped being bookkeeping and became a screen the CHILD
   * reads. Two identical foxes every launch, and half the time the child lands in M: no stars, no
   * streak, an empty Leitner set that teaches every word as new, all of it mirrored up under M's
   * own row where nothing merges it back.
   */
  it('leaves one child on the roster after a restore, not two', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED), profile(SOC, 'Soc')])

    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })
    await waitFor(() => expect(profileState.switchProfile).toHaveBeenCalledWith(SOC))

    // The real roster, read through the real module: one child, and it is the restored one. That
    // is also the read-out that ProfileGate shows no picker - it asks `listProfiles().length < 2`.
    expect(listProfiles().map(p => p.id)).toEqual([SOC])
  })

  it('drops the placeholder only once the pull has actually landed', async () => {
    sync.pullProfile.mockResolvedValue(false)
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED), profile(SOC, 'Soc')])

    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })

    // The restore failed, so the device is still on the placeholder - removing it would leave the
    // child on a profile the roster no longer names.
    expect(listProfiles().map(p => p.id).sort()).toEqual([MINTED, SOC].sort())
  })

  it('keeps a local profile that is not the empty placeholder', async () => {
    // Same shape, except this device's own child has progress: `mintedId` is null, and nobody is
    // dropped on the strength of an inference about an empty namespace.
    setStars('sword:cat', 3)
    auth.currentEmail.mockResolvedValue('bome@example.com')
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED), profile(SOC, 'Soc')])

    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })
    await act(async () => { fireEvent.click(await screen.findByText('Soc')) })

    expect(listProfiles().map(p => p.id).sort()).toEqual([MINTED, SOC].sort())
  })

  it('restores straight to the one profile the account owns', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc')])
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })
    await waitFor(() => expect(sync.pullProfile).toHaveBeenCalledWith(SOC))
    expect(profileState.switchProfile).toHaveBeenCalledWith(SOC)
  })

  /**
   * F5. The ordering `pullProfile` refuses to work without — and the one the old whole-module mock
   * could not see. Inverting the two calls in `afterAuthenticated` makes this fail: the roster does
   * not know the id yet at the moment of the pull, which is precisely the window in which
   * `rescueOrphanNamespaces` folds the pulled keys into the wrong child.
   */
  it('has the profile in the real roster BEFORE it pulls into it', async () => {
    let rosterAtPull: string[] = []
    sync.pullProfile.mockImplementation(async () => {
      rosterAtPull = listProfiles().map(p => p.id)
      return true
    })
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc')])

    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })

    await waitFor(() => expect(sync.pullProfile).toHaveBeenCalled())
    expect(rosterAtPull).toContain(SOC)
  })

  /**
   * F4. `connectCloud()` gave the freshly minted local profile a row under this very account, so
   * "the account owns it" cannot tell the two apart — and both render as the identical "🦊 Bé".
   * A parent picking the wrong one lands in an empty profile and concludes the restore failed.
   */
  it('never offers the empty profile this device just minted as a restore target', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED), profile(SOC, 'Sóc')])

    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })

    // One real candidate left, so there is no picker at all — and the pull is the child's.
    await waitFor(() => expect(sync.pullProfile).toHaveBeenCalledWith(SOC))
    expect(sync.pullProfile).not.toHaveBeenCalledWith(MINTED)
  })

  it('keeps offering the local profile when it is not empty', async () => {
    // Not a decoy: this device's own child, with progress, listed by the account it belongs to.
    setStars('sword:cat', 3)
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED), profile(SOC, 'Sóc')])
    auth.currentEmail.mockResolvedValue('bome@example.com') // already linked: no abandon prompt

    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })

    expect(await screen.findByText('Sóc')).toBeInTheDocument()
    expect(screen.getAllByRole('button').some(b => b.textContent?.includes('Bé'))).toBe(true)
  })

  /**
   * A pull that failed used to end in `switchProfile` anyway: the parent landed in a profile with
   * the right name and none of the progress, concluded the restore had failed, and went looking for
   * another way in — which is the first step of the sequence that abandons the account holding the
   * real data. A restore that could not restore has to say so.
   */
  describe('when the pull does not come down', () => {
    async function restoreWithFailedPull() {
      sync.pullProfile.mockResolvedValue(false)
      profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc')])
      await goToEmail()
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
        fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
      })
    }

    it('does not switch into a child whose progress never arrived', async () => {
      await restoreWithFailedPull()

      expect(sync.pullProfile).toHaveBeenCalledWith(SOC)
      expect(profileState.switchProfile).not.toHaveBeenCalled()
      // Task 9 / R8: the one restorable candidate auto-restores with no picker on screen to
      // report next to, so its failure lands on the screen-level `'result'` stage now, not the
      // 'email-otp' FieldRow gutter.
      expect(screen.getByRole('status')).toHaveTextContent('Tài khoản này chưa có hồ sơ nào để khôi phục')
    })

    it('offers the same child again rather than the menu, through the result stage', async () => {
      await restoreWithFailedPull()

      // Exactly one retry control, and it is the `'result'` stage's own "Thử tải lại" — not the
      // FieldRow's short "Thử lại" (there is no field left mounted to own one).
      expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
      expect(screen.getAllByRole('button', { name: 'Thử tải lại' })).toHaveLength(1)

      sync.pullProfile.mockResolvedValue(true)
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' })) })

      expect(sync.pullProfile).toHaveBeenLastCalledWith(SOC)
      expect(profileState.switchProfile).toHaveBeenCalledWith(SOC)
    })

    it('says it next to the picker when there was a choice to make', async () => {
      sync.pullProfile.mockResolvedValue(false)
      profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc'), profile(CAO, 'Cáo')])
      await goToEmail()
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
        fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
      })
      await act(async () => { fireEvent.click(await screen.findByText('Cáo')) })

      expect(profileState.switchProfile).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Không kết nối được máy chủ')
      // The picker is still up: tapping the same face again IS the retry.
      expect(screen.getByText('Cáo')).toBeInTheDocument()
    })
  })

  it('shows a picker when the account owns more than one profile', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc'), profile(CAO, 'Cáo')])
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })
    expect(await screen.findByText('Sóc')).toBeInTheDocument()
    expect(screen.getByText('Cáo')).toBeInTheDocument()
    expect(sync.pullProfile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Cáo'))
    await waitFor(() => expect(sync.pullProfile).toHaveBeenCalledWith(CAO))
    expect(profileState.switchProfile).toHaveBeenCalledWith(CAO)
  })

  /** F4's other half: two rows that would otherwise be identical are told apart by something real. */
  it('disambiguates two profiles that look exactly alike', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([
      profile(SOC, 'Bé', '🦊', new Date('2026-03-04T09:00:00').getTime()),
      profile(CAO, 'Bé', '🦊', new Date('2026-07-19T09:00:00').getTime()),
    ])
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })

    expect(await screen.findByText('Tạo 04/03/2026')).toBeInTheDocument()
    expect(screen.getByText('Tạo 19/07/2026')).toBeInTheDocument()
  })

  it('is honest when the account has no profiles at all', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([])
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã 6 số').closest('form')!)
    })
    expect(await screen.findByText(/chưa có hồ sơ nào/)).toBeInTheDocument()
    expect(sync.pullProfile).not.toHaveBeenCalled()
  })
})

describe('the recovery-code door', () => {
  function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }

  function goToCode() {
    renderStart()
    fireEvent.click(screen.getByText('Tôi có mã khôi phục'))
    answerTheQuestion()
  }

  it('sends the current device\'s own bearer token, never a stored email', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(200, { profiles: 1 }))
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc')])
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'abc23xyz' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.authorization).toBe('Bearer token-abc')
    expect(JSON.parse(init.body)).toEqual({ code: 'ABC23XYZ' })
    await waitFor(() => expect(sync.pullProfile).toHaveBeenCalledWith(SOC))
  })

  it('will not spend the code into a roster that cannot receive it', async () => {
    // The recovery code is a one-shot key: /api/recover burns it and re-parents the profiles in
    // one server-side step. If the roster is unreadable the result has nowhere to land, the retry
    // answers 404, and nothing on the device repairs a damaged roster — so the door must refuse
    // BEFORE the call, and say plainly that the code is still good.
    localStorage.setItem('speakup.profiles', '[{"id":"11111111-2222-4333-8444-5555')
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(fetch).not.toHaveBeenCalled()
    // The roster failure keeps its own sentence — the FieldRow gutter, not the top-of-card alert,
    // now that stage 'code' owns a field of its own (R9/R10).
    expect(screen.getByTestId('field-error')).toHaveTextContent('Mã của bạn vẫn còn nguyên')
    expect(sync.pullProfile).not.toHaveBeenCalled()
    // and the damaged bytes are still on disk for whoever can read them
    expect(localStorage.getItem('speakup.profiles')).toBe('[{"id":"11111111-2222-4333-8444-5555')
  })

  it('shows the honest reason an already-linked account\'s code is refused', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(403, { error: 'Code belongs to a linked account' }))
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(screen.getByTestId('field-error')).toHaveTextContent(describeRecoverError(403))
    expect(sync.pullProfile).not.toHaveBeenCalled()
  })

  it('reports an unknown code without pulling anything', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(404, { error: 'Unknown code' }))
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ZZZZZZZZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(screen.getByTestId('field-error')).toHaveTextContent(describeRecoverError(404))
  })

  it('is honest about a dropped connection rather than blaming the code', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'))
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    // R10 / quyết định 22: a thrown fetch is one of the four merged system errors now.
    expect(screen.getByTestId('field-error')).toHaveTextContent('Không kết nối được máy chủ')
  })

  it('refuses to call the API at all with no session token to present', async () => {
    auth.currentAccessToken.mockResolvedValue(null)
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByTestId('field-error')).toHaveTextContent('Không kết nối được máy chủ')
  })

  it('goes back to the menu', () => {
    goToCode()
    fireEvent.click(screen.getByText('← Chọn cách khác'))
    expect(screen.getByText('Tôi có email đã liên kết')).toBeInTheDocument()
  })
})

/**
 * Phase 12 task 15: this screen moved to the app's adult-door convention (behind the same
 * `ParentQuestion` gate as the parent area) — its buttons are `size="adult"` (44 px) and its
 * secondary text actions are `LinkText` (also a 44 px target), not the child 64 px floor.
 */
it('holds every control to the 44 px adult tap floor', () => {
  renderStart()
  openEmailDoor()

  for (const label of ['← Chọn cách khác']) {
    expect(screen.getByText(label).className, label).toContain('min-h-[44px]')
  }
  // R9 / decision 17: the field is a 44 px `FieldRow` input now, not the old 64 px child control.
  expect(screen.getByLabelText('Email của bố mẹ').className).toContain('h-11')
  expect(screen.getByLabelText('Email của bố mẹ').className).not.toMatch(/min-h-\[64px\]/)
})

/**
 * Task 8 (brief §2 A2, R9/R10, decisions 17/21/22/35) — `GateCard` + `FieldRow` at the adult 44 px
 * floor, the fourteen round-4 error sentences keyed by CODE rather than copy, and the four scattered
 * system failures merged into one sentence with a retry that does not spend the code/token again.
 */
describe('the round-4 GateCard frame', () => {
  it('every auth code maps to the round-4 sentence', () => {
    expect(describeAuthError('invalid-email')).toBe('Email chưa đúng định dạng.')
    expect(describeAuthError('cloud-unconfigured')).toBe('Tính năng tài khoản chưa bật trên bản này.')
    expect(describeAuthError('anonymous-session-in-use')).toBe('Máy này đang có hồ sơ của tài khoản khác — đăng xuất ở Góc phụ huynh trước.')
    expect(describeAuthError('email-not-linked')).toBe('Email này chưa liên kết với Speak Up — thử mã khôi phục.')
    expect(describeAuthError('invalid-token')).toBe('Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.')
    expect(describeAuthError('network error')).toBe('Mất kết nối — kiểm tra mạng rồi thử lại.')
    expect(describeAuthError('whatever')).toBe('Có lỗi xảy ra — thử lại sau ít phút.')
  })

  it('every recover status maps to the round-4 sentence', () => {
    expect(describeRecoverError(400)).toBe('Mã phải đủ 8 chữ và số.')
    expect(describeRecoverError(401)).toBe('Mã không đúng — kiểm tra lại chữ O và số 0.')
    expect(describeRecoverError(403)).toBe('Mã này thuộc tài khoản khác đang dùng máy này.')
    expect(describeRecoverError(404)).toBe('Không tìm thấy mã — có thể đã được thay mã mới.')
    expect(describeRecoverError(409)).toBe('Mã đã dùng trên máy khác — tạo mã mới ở máy đó.')
    expect(describeRecoverError(429)).toBe('Thử quá nhiều lần — đợi 5 phút rồi thử lại.')
    expect(describeRecoverError(500)).toBe('Không kết nối được máy chủ — thử lại sau.')
  })

  it('the four system failures share one sentence and a retry that does not burn the code', async () => {
    const okRecover = { ok: true, status: 200, json: async () => ({ profiles: 0 }) }
    auth.currentAccessToken.mockResolvedValue(null)
    openCodeDoor()
    await typeCode('QZQJ7MFC')
    await submitRecover()

    expect(screen.getByTestId('field-error')).toHaveTextContent('Không kết nối được máy chủ — thử lại sau')
    // the code is still there — nothing was spent
    expect(screen.getByDisplayValue('QZQJ7MFC')).toBeInTheDocument()

    auth.currentAccessToken.mockResolvedValue('tok');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okRecover)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })

  it('the unreadable-roster failure keeps its own sentence — the consequence is different', async () => {
    // A damaged roster (kept separate from the four merged system errors: R10 says gộp 4, không 6).
    openCodeDoor()
    localStorage.setItem('speakup.profiles', '[{"id":"11111111-2222-4333-8444-5555')
    await typeCode('QZQJ7MFC')
    await submitRecover()

    expect(screen.getByTestId('field-error')).toHaveTextContent('Mã của bạn vẫn còn nguyên')
    expect(screen.getByTestId('field-error')).not.toHaveTextContent('Không kết nối được máy chủ')
  })

  it('every stage is a 420px GateCard with a 44px field, a label above it and an 18px gutter', async () => {
    renderStart()
    openEmailDoor()

    expect(screen.getByTestId('gate-card')).toHaveClass('w-[min(420px,calc(100%-32px))]', 'p-5')
    const input = screen.getByLabelText('Email của bố mẹ')
    expect(input).toHaveClass('h-11', 'rounded-r12', 'border-2', 'border-sand-edge')
    expect(input.className).not.toMatch(/min-h-\[64px\]|text-base/)
    expect(screen.getByTestId('field-error')).toHaveClass('min-h-[18px]')
    expect(screen.getByText(/Không gửi quảng cáo/)).toHaveClass('text-[11px]')
  })

  it('the OTP and the recovery code are the 22px tracked boxes', async () => {
    await reachOtp()
    expect(screen.getByLabelText('Mã 6 số')).toHaveClass('text-center', 'font-display', 'text-[22px]', 'tracking-[6px]')

    cleanup()
    openCodeDoor()
    expect(screen.getByLabelText('Mã khôi phục (8 ký tự)')).toHaveClass('text-[22px]', 'tracking-[6px]', 'uppercase')
  })

  it('the header carries the adult Back with the landscape label, and the gate stage its own sub', async () => {
    renderStart()
    const back = screen.getByRole('link', { name: /^Về nhà/ })
    expect(within(back).getByText('Về bản đồ 🏝️')).toHaveClass('ipad:inline')

    fireEvent.click(screen.getByRole('button', { name: 'Tôi có email đã liên kết' }))
    expect(screen.getByText('Câu hỏi dành cho bố mẹ trước khi khôi phục.')).toBeInTheDocument()
  })

  it('no field or button in this screen is a 64px child control any more', async () => {
    for (const open of [
      () => { renderStart(); openEmailDoor() },
      () => { openCodeDoor() },
      reachOtp,
    ]) {
      cleanup()
      await open()
      for (const el of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('textbox')]) {
        expect(el.className).not.toMatch(/min-h-\[64px\]|md:min-h-\[64px\]|md:h-16/)
      }
    }
  })
})

/**
 * Task 9 (brief §2 A2, R8/R11, decisions 21/23) — CloudStart part 2: the `'result'` stage that
 * absorbs the top-of-card `info`/`retryId`, the four-line abandon copy with a fixed button label,
 * and the 72px compact picker.
 */
describe('the result stage, abandon copy, and compact picker (Task 9)', () => {
  it('an account with no restorable profile lands on its own result stage, not back at the menu', async () => {
    fetchRemoteProfiles.mockResolvedValue([])
    await passOtp()

    expect(screen.getByRole('status')).toHaveTextContent('Tài khoản này chưa có hồ sơ nào để khôi phục')
    expect(screen.getByRole('button', { name: 'Thử tải lại' })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('button', { name: 'Bắt đầu mới cho bé' })).toHaveClass('bg-coral-500')
    expect(screen.getByRole('button', { name: '← Về menu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tôi có email đã liên kết' })).toBeNull()
  })

  it('a failed pull shows its retry inside the result stage, never floating on top of every card', async () => {
    pullProfile.mockResolvedValue(false)
    await pickOneProfile()

    const card = screen.getByTestId('gate-card')
    expect(within(card).getByRole('button', { name: 'Thử tải lại' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Về menu' }))
    expect(screen.getByRole('button', { name: 'Tôi có mã khôi phục' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull() // không còn nổi trên menu
  })

  it('abandon prints one of the four sun-tinted copy lines and never the email in the button', async () => {
    await reachAbandon({ profiles: 2, stars: 128, events: 340, mirrored: false })

    expect(screen.getByTestId('abandon-copy')).toHaveClass('rounded-r10', 'bg-sun-50', 'text-[12px]')
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('2 hồ sơ, 128 sao và 340 lượt luyện trên máy này sẽ bị thay.')
    const go = screen.getByRole('button', { name: 'Vẫn tiếp tục với email này' })
    expect(go).not.toHaveTextContent(EMAIL61)
    expect(screen.getByText(EMAIL61)).toBeInTheDocument() // email hiện ở dòng copy
    expect(screen.getByRole('button', { name: 'Huỷ' })).toHaveClass('border-dashed')
    expect(screen.getByRole('link', { name: 'Sao lưu trước ở Góc phụ huynh' })).toHaveAttribute('href', '/parent')
  })

  it('the other three abandon branches keep their own sentence', async () => {
    await reachAbandon({ profiles: 2, stars: 128, events: 340, mirrored: true })
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('một phần đã lưu lên máy chủ, có thể lấy lại sau')

    cleanup()
    await reachAbandon({ profiles: 1, stars: 0, events: 0, mirrored: false })
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('chưa học gì — thay được ngay')

    cleanup()
    await reachAbandon('unchecked')
    expect(screen.getByTestId('abandon-copy')).toHaveTextContent('Không đọc được dữ liệu trên máy này. Vẫn tiếp tục?')
  })

  it('the profile picker stage uses the 72px compact cells and the busy spinner', async () => {
    await reachPicker(3)

    expect(screen.getByText('Tài khoản này có 3 hồ sơ. Chạm để tải về máy.')).toBeInTheDocument()
    expect(screen.getAllByRole('button')[0]).toHaveClass('h-[72px]')
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(screen.getByTestId('cell-spinner')).toBeInTheDocument()
  })
})
