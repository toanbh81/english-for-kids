import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { CloudStart } from './CloudStart'

/** Real UUIDs, because the real roster refuses anything else (`isProfileId`). */
const MINTED = '11111111-2222-4333-8444-555555555555'
const SOC = '22222222-3333-4444-8555-666666666666'
const CAO = '33333333-4444-4555-8666-777777777777'

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
    expect(screen.queryByLabelText('Email của bố/mẹ')).not.toBeInTheDocument()
    expect(screen.getByText('3 × 3 = ?')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(screen.getByText('Chưa đúng, thử lại')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email của bố/mẹ')).not.toBeInTheDocument()

    answerTheQuestion()
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText('Email của bố/mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố/mẹ').closest('form')!) })
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
    expect(screen.getByText(/đang giữ tiến độ của 1 hồ sơ/)).toBeInTheDocument()
    // Named, in numbers read off this account — not a vague warning.
    expect(screen.getByText(/3 sao và 2 lượt luyện/)).toBeInTheDocument()
    expect(screen.getByText(/sẽ không mở lại được nữa/)).toBeInTheDocument()
    // …and the way to keep it.
    expect(screen.getByRole('link', { name: 'Góc phụ huynh' })).toHaveAttribute('href', '/parent')
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
    expect(screen.getByText(/đang giữ tiến độ của 1 hồ sơ/)).toBeInTheDocument()
    expect(screen.getByText(/5 sao và 40 lượt luyện/)).toBeInTheDocument()
    expect(screen.getByText(/kể cả hồ sơ của bé khác trên máy này/)).toBeInTheDocument()
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
    expect(screen.getByText(/8 sao và 200 lượt luyện/)).toBeInTheDocument()
  })

  it('sees a child the account owns that this roster has forgotten', async () => {
    // Nothing local for them at all — the roster entry is gone. Their rows are still up there under
    // the owner about to be abandoned, which is exactly why they count.
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(MINTED), profile(SOC, 'Sóc')])
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    // Nothing local to count, so the dialog says where the progress IS rather than counting it.
    expect(screen.getByText(/đang nằm trên máy chủ/)).toBeInTheDocument()
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
    expect(screen.getByText(/đang giữ tiến độ của 1 hồ sơ/)).toBeInTheDocument()
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
    expect(screen.getByText('Chưa kiểm tra được tài khoản trên máy này')).toBeInTheDocument()
    // …and it does not dress the unknown up as a finding, in either direction.
    expect(screen.getByText(/không có nghĩa là không có gì/)).toBeInTheDocument()
    // The parent may still go ahead — knowing that nobody checked.
    expect(screen.getByText(/Vẫn tiếp tục với bome@example.com/)).toBeInTheDocument()
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
    })

    expect(screen.queryByText(/chưa có hồ sơ nào/)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa xem được danh sách hồ sơ')
    expect(sync.pullProfile).not.toHaveBeenCalled()
  })

  it('counts rows that only exist on the server as something to lose', async () => {
    // Nothing on disk (a trimmed cache) but rows mirrored under the anonymous user id: those are
    // exactly what becomes unreachable, and they used to be nobody's business.
    sync.hasMirroredData.mockReturnValue(true)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    expect(screen.getByText(/đang nằm trên máy chủ/)).toBeInTheDocument()
  })

  /**
   * The dialog must never argue against its own warning. In the case round 3 exists for the
   * evidence is a row on the server, so every local sum is zero — and "0 sao và 0 lượt luyện"
   * printed under "sẽ không mở lại được nữa" is a reason to press on, handed to a parent who is
   * already looking for one.
   */
  it('never prints a zero count next to the warning', async () => {
    sync.hasMirroredData.mockReturnValue(true)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })

    await goToEmail()

    const dialog = screen.getByText(/đang giữ tiến độ của/).closest('div')!
    expect(dialog.textContent).not.toMatch(/(^|[^0-9])0 (sao|lượt)/)
    // …and the irreversibility line is still the one thing it cannot lose.
    expect(dialog.textContent).toMatch(/không mở lại được nữa/)
  })

  it('passes the flag only after the parent says so in as many words', async () => {
    setStars('sword:cat', 3)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })
    await goToEmail()

    auth.signInWithEmail.mockResolvedValue({ ok: true, userId: 'u2' })
    await act(async () => { fireEvent.click(screen.getByText(/Vẫn tiếp tục với bome@example.com/)) })

    expect(auth.signInWithEmail).toHaveBeenLastCalledWith('bome@example.com', { abandonAnonymous: true })
    expect(screen.getByText(/Nhập mã 6 số vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('lets the parent back out of abandoning without sending anything', async () => {
    setStars('sword:cat', 3)
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'anonymous-session-in-use' })
    await goToEmail()

    fireEvent.click(screen.getByText('← Quay lại'))

    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
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

    expect(screen.getByRole('alert')).toHaveTextContent('Email này chưa liên kết với hồ sơ nào')
    expect(screen.getByRole('alert')).toHaveTextContent('mã khôi phục')
    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1)
    expect(auth.signInWithEmail).not.toHaveBeenCalledWith('bome@example.com', { abandonAnonymous: true })
    // Still on the email form, ready for the other address.
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
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
    await act(async () => { fireEvent.click(screen.getByText(/Vẫn tiếp tục với bome@example.com/)) })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Góc phụ huynh')
    expect(alert.textContent).not.toMatch(/thử lại/)
  })

  it('shows a Vietnamese error and lets the parent retry on an offline failure', async () => {
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'Failed to fetch' })
    await goToEmail()
    expect(screen.getByRole('alert')).toHaveTextContent('Không có kết nối mạng')
    // still on the email form, ready to retry
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
  })

  it('reports a wrong or expired OTP without losing the typed email', async () => {
    await goToEmail()
    auth.verifyEmailOtp.mockResolvedValue({ ok: false, error: 'Token has expired or is invalid' })
    fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '000000' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!) })
    expect(screen.getByRole('alert')).toHaveTextContent('hết hạn')
    expect(screen.getByText(/vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('lets the parent go back and correct a typo\'d email', async () => {
    await goToEmail()
    fireEvent.click(screen.getByText('Sửa lại email'))
    const input = screen.getByLabelText('Email của bố/mẹ') as HTMLInputElement
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
    })
    await act(async () => { fireEvent.click(await screen.findByText('Soc')) })

    expect(listProfiles().map(p => p.id).sort()).toEqual([MINTED, SOC].sort())
  })

  it('restores straight to the one profile the account owns', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc')])
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
        fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
        fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
      })
    }

    it('does not switch into a child whose progress never arrived', async () => {
      await restoreWithFailedPull()

      expect(sync.pullProfile).toHaveBeenCalledWith(SOC)
      expect(profileState.switchProfile).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('chưa tải được tiến độ')
      // …and says where the device actually stands, which is: nowhere new.
      expect(screen.getByRole('alert')).toHaveTextContent('vẫn đang ở hồ sơ cũ')
    })

    it('offers the same child again rather than the menu', async () => {
      await restoreWithFailedPull()

      sync.pullProfile.mockResolvedValue(true)
      await act(async () => { fireEvent.click(screen.getByText('Thử tải lại')) })

      expect(sync.pullProfile).toHaveBeenLastCalledWith(SOC)
      expect(profileState.switchProfile).toHaveBeenCalledWith(SOC)
    })

    it('says it next to the picker when there was a choice to make', async () => {
      sync.pullProfile.mockResolvedValue(false)
      profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc'), profile(CAO, 'Cáo')])
      await goToEmail()
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
        fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
      })
      await act(async () => { fireEvent.click(await screen.findByText('Cáo')) })

      expect(profileState.switchProfile).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('chưa tải được tiến độ')
      // The picker is still up: tapping the same face again IS the retry.
      expect(screen.getByText('Cáo')).toBeInTheDocument()
    })
  })

  it('shows a picker when the account owns more than one profile', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile(SOC, 'Sóc'), profile(CAO, 'Cáo')])
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
    })

    expect(await screen.findByText('Tạo 04/03/2026')).toBeInTheDocument()
    expect(screen.getByText('Tạo 19/07/2026')).toBeInTheDocument()
  })

  it('is honest when the account has no profiles at all', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([])
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
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
    expect(screen.getByRole('alert')).toHaveTextContent('Mã của bạn vẫn còn nguyên')
    expect(sync.pullProfile).not.toHaveBeenCalled()
    // and the damaged bytes are still on disk for whoever can read them
    expect(localStorage.getItem('speakup.profiles')).toBe('[{"id":"11111111-2222-4333-8444-5555')
  })

  it('shows the honest reason an already-linked account\'s code is refused', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(403, { error: 'Code belongs to a linked account' }))
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(screen.getByRole('alert')).toHaveTextContent('đã liên kết email')
    expect(sync.pullProfile).not.toHaveBeenCalled()
  })

  it('reports an unknown code without pulling anything', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(404, { error: 'Unknown code' }))
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ZZZZZZZZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy mã này')
  })

  it('is honest about a dropped connection rather than blaming the code', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'))
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(screen.getByRole('alert')).toHaveTextContent('Không có kết nối mạng')
  })

  it('refuses to call the API at all with no session token to present', async () => {
    auth.currentAccessToken.mockResolvedValue(null)
    goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
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
  expect(screen.getByLabelText('Email của bố/mẹ').className).toContain('min-h-[64px]')
})
