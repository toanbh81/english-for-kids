import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getActivity, minutesPerDay, averageScoreByKind, weakPhonemes, clearActivity } from '../progress/activity'
import { clearBand, getBand, setBandAuto, setBandValue } from '../progress/band'
import type { Band } from '../progress/band'
import { clearLeitner } from '../progress/leitner'
import { LESSON_LENGTHS, clearLessons, getLessonLength, setLessonLength } from '../progress/lesson'
import type { LessonLength } from '../progress/lesson'
import { listRecordings, clearRecordings } from '../progress/recordings'
import type { Recording } from '../progress/recordings'
import { clearStars } from '../progress/store'
import { getLimitMinutes, setLimitMinutes } from '../progress/limit'
import { PHONEME_TIPS } from '../scoring/feedback'
import { playBlob } from '../audio/player'
import {
  currentEmail,
  currentUserId,
  ensureRecoveryCode,
  isAnonymous,
  linkEmail,
  signOut,
  verifyEmailOtp,
} from '../cloud/auth'
import type { Profile } from '../cloud/profileState'
import {
  activeProfileId,
  addProfile,
  ensureRemoteProfiles,
  listProfiles,
  renameProfile,
  renameRemoteProfile,
  switchProfile,
} from '../cloud/profileState'
import { hasPendingReset, resetRemoteProgress, subscribeSyncStatus, syncStatus } from '../cloud/sync'
import type { SyncStatus } from '../cloud/sync'
import { isCloudConfigured } from '../cloud/supabase'
import { ProfilePicker } from '../components/ProfilePicker'
import { Button, Card, PAGE_SHELL } from '../components/ui'

/**
 * Phone styles sit at the default breakpoint and `md:` (768) puts the tablet/iPad value back — the
 * phase-10 idiom written out in full in `screens/SoundPractice.tsx`. `max-md:` appears only where a
 * shared primitive (`Button`) writes the class being overridden for itself.
 *
 * This screen is the one place the app's 64 px tap floor does not apply, and the design says so
 * outright (§12 M8c): it is an **adult** interface — "chữ 12–14px, vùng chạm 36–48px (không cần
 * 64), mật độ cao hơn" — reached through a gate no child gets past. So the phone sizes below are
 * 44 px controls and 12–14 px text, not the child screens' 64 px and 19 px. The one control still
 * held to the child floor is the recordings disclosure's summary row, which spec decision 2 asks
 * for by name.
 */
const KIND_LABEL = { speak: 'Nói', word: 'Từ vựng', sentence: 'Ghép câu' } as const
const LIMIT_CHIPS = [15, 20, 30] as const
/** How many of the chart's fourteen days a phone draws (design §12 M8c). */
const PHONE_DAYS = 7
const BAND_VALUES = [1, 2, 3, 4, 5] as const satisfies readonly Band[]
/**
 * What the parent is told when the mirror's half of a reset has not happened.
 *
 * The device is genuinely clear; the server copy is not, and the engine will finish it before it
 * pulls anything back. Saying nothing was the old behaviour, and it is how a parent came back to a
 * child whose stars had returned overnight with no explanation available anywhere.
 */
const PENDING_RESET_NOTICE =
  'Đã xoá xong trên máy này. Bản lưu trên tài khoản thì chưa xoá được (có thể do mất mạng) — '
  + 'máy sẽ tự xoá nốt khi có mạng trở lại, trước khi tải bất cứ thứ gì về.'

const LENGTH_LABEL: Record<LessonLength, string> = {
  short: 'Ngắn ~8 phút',
  medium: 'Vừa ~12 phút',
  long: 'Dài ~18 phút',
}

/**
 * Vietnamese copy for an `AuthResult`'s error code.
 *
 * `invalid-email`, `invalid-token`, `cloud-unconfigured` and `anonymous-session-in-use` are this
 * app's own codes (`cloud/auth.ts` never guesses at Supabase's wording for those). Everything else
 * is a raw Supabase message — never shown verbatim to a Vietnamese parent, and a wrong or expired
 * OTP is exactly the shape that lands here (Supabase's own wording for both is some variant of
 * "invalid/expired token").
 */
function describeAuthError(code: string): string {
  const lower = code.toLowerCase()
  if (code === 'invalid-email') return 'Email chưa đúng định dạng.'
  if (code === 'cloud-unconfigured') return 'Chưa thể kết nối lúc này, thử lại sau nhé.'
  if (code === 'anonymous-session-in-use') return 'Máy này đang có hồ sơ khác, thử lại nhé.'
  if (code === 'invalid-token' || /invalid|expired|not\s*found/.test(lower)) {
    return 'Mã chưa đúng hoặc đã hết hạn, thử lại nhé.'
  }
  if (/network|fetch/.test(lower)) return 'Không có kết nối mạng, thử lại nhé.'
  return 'Có lỗi xảy ra, thử lại nhé.'
}

/**
 * `navigator.onLine === false` is the reliable half of that flag — it really does mean no network,
 * while true only ever meant an interface is up. Used here to say WHY there is no account yet, so
 * an offline device gets an explanation instead of a form that cannot work.
 */
const online = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false

function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${min}`
}

type Props = {
  /** Clears the parent-gate flag and hands control back to ParentGate, which owns the
   * unlocked/locked state. Optional so the component still renders standalone in tests. */
  onLock?: () => void
}

export function ParentDashboard({ onLock }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  // One read of the activity log per mount (and per reset), shared by every query below; the
  // snapshot doubles as the reload key for the recordings list.
  const [snapshot, setSnapshot] = useState(() => ({ events: getActivity(), now: Date.now() }))
  const [limit, setLimit] = useState<string>(() => String(getLimitMinutes()))
  const [band, setBand] = useState(() => getBand())
  const [length, setLength] = useState<LessonLength>(() => getLessonLength())
  /**
   * Spec decision 2: the design drops "Bản ghi gần đây" on a phone and we do not — the last 20
   * recordings are a working feature, not a layout. It collapses into a disclosure there instead,
   * closed, so the two cards under it are not twenty rows away.
   *
   * `open` is an attribute, not a class, so it cannot follow a breakpoint: it is decided once, on
   * mount, by the same 768 px query the classes use. Once, deliberately — the value never changes,
   * so React never re-applies the attribute and so never fights a parent's own tap on the summary.
   * (A tablet rotated below 768 after mount keeps the state it opened with; re-entering the screen
   * re-reads it, and the phone the design is aimed at has nothing to rotate into.)
   */
  const [recordingsOpen] = useState(() => window.matchMedia?.('(min-width: 768px)').matches ?? false)

  // A build with no cloud env vars renders none of what follows — read once, synchronously, so
  // this screen never even asks whether it is signed in (constraint: byte-identical without them).
  const [cloudAvailable] = useState(isCloudConfigured)

  // Constraint #1: `syncStatus()` parses the activity log on every store write once a subscriber
  // exists. This is the ONE screen allowed to subscribe, and there is no timer here — only the
  // write-driven notifications the sync engine already fires.
  const [sync, setSync] = useState<SyncStatus>(() => (cloudAvailable ? syncStatus() : {
    state: 'off', pending: 0, lastSyncedAt: null, lastError: null, syncing: false,
  }))
  useEffect(() => {
    if (!cloudAvailable) return undefined
    return subscribeSyncStatus(setSync)
  }, [cloudAvailable])

  /**
   * Three states, not two — and the third one is the dangerous one.
   *
   * `isAnonymous()` answers **false** when there is no session at all, so asking it alone put this
   * screen into the signed-in branch on a device that has never reached the network: an empty email
   * line and a "Đăng xuất" button for an account that does not exist, with no link form and no
   * recovery code anywhere. That is precisely the window in which nothing is backed up, on the one
   * screen that exists to get out of it. So "no session" is treated as "not linked", which is what
   * it is, and the reason is said out loud rather than left as a dead form.
   */
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState(true)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const linked = email !== null
  useEffect(() => {
    if (!cloudAvailable) return undefined
    let cancelled = false
    void (async () => {
      const [em, anon, userId] = await Promise.all([currentEmail(), isAnonymous(), currentUserId()])
      if (cancelled) return
      setEmail(em)
      setHasSession(userId !== null)
      setAuthReady(true)
      // The standing ruling: a LINKED account has no recovery code at all, on purpose (a trigger
      // drops it the moment the account gains an email) — so this is only ever asked while
      // anonymous, and `ensureRecoveryCode` is itself a no-op for a linked one regardless.
      if (anon) {
        const code = await ensureRecoveryCode()
        if (!cancelled) setRecoveryCode(code)
      }
    })()
    return () => { cancelled = true }
  }, [cloudAvailable])

  const [linkStage, setLinkStage] = useState<'idle' | 'otp'>('idle')
  const [linkEmailValue, setLinkEmailValue] = useState('')
  const [linkOtp, setLinkOtp] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<Profile[]>(() => listProfiles())
  const activeId = activeProfileId()
  /**
   * Set when the mirror's half of a reset did not go through — and it survives leaving the screen:
   * a reset the sync engine still owes is still true tomorrow, so a parent coming back to check
   * reads the same sentence rather than a screen that looks as if nothing happened.
   */
  const [resetNotice, setResetNotice] = useState<string | null>(
    () => (cloudAvailable && activeId && hasPendingReset(activeId) ? PENDING_RESET_NOTICE : null),
  )

  const { events, now } = snapshot
  const days = minutesPerDay(14, now, events)
  const todayKey = days[days.length - 1]?.day
  const limitMinutes = getLimitMinutes()
  const scaleMax = Math.max(1, limitMinutes, ...days.map(d => d.minutes))
  const targetTopPct = Math.min(100, Math.max(0, 100 - (limitMinutes / scaleMax) * 100))
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0)
  const weekMinutes = minutesPerDay(7, now, events).reduce((sum, d) => sum + d.minutes, 0)
  const averages = averageScoreByKind(events)
  const kindAverages = Object.values(averages).filter((v): v is number => v != null)
  const avgScoreLabel = kindAverages.length
    ? String(Math.round(kindAverages.reduce((sum, v) => sum + v, 0) / kindAverages.length))
    : '—'
  const weak = weakPhonemes(5, events)

  useEffect(() => {
    let cancelled = false
    listRecordings().then(list => {
      if (!cancelled) setRecordings(list)
    })
    return () => { cancelled = true }
  }, [snapshot])

  function handleLimitChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setLimit(raw)
    setLimitMinutes(Number(raw))
  }

  function handleLimitBlur() {
    setLimit(String(getLimitMinutes()))
  }

  function handleLimitChip(n: number) {
    setLimit(String(setLimitMinutes(n)))
  }

  function handleBandClick(value: Band) {
    setBandValue(value)
    setBand(getBand())
  }

  function handleBandAuto() {
    setBandAuto()
    setBand(getBand())
  }

  function handleLengthClick(value: LessonLength) {
    setLessonLength(value)
    setLength(getLessonLength())
  }

  async function handleReset() {
    // The old wording was from the local-only era and stopped being true the moment this button
    // also emptied the mirror: the cloud copy of this child goes with it, and no device gets it
    // back. A parent may not find that out afterwards.
    const question = cloudAvailable && activeId
      ? 'Xoá toàn bộ sao, lịch sử và bản ghi của bé trên máy này, và xoá luôn bản đã lưu trên tài khoản? Máy khác sẽ không tải lại được nữa.'
      : 'Xoá toàn bộ sao, lịch sử và bản ghi?'
    if (!window.confirm(question)) return
    setResetNotice(null)
    clearStars()
    clearActivity()
    clearLeitner()
    // The Phase 7 stores go too: a lesson kept from before the reset would still be pinned to the
    // old band and still tick items off against an event log that no longer exists.
    clearLessons()
    clearBand()
    await clearRecordings()
    setLimit(String(getLimitMinutes()))
    // Written out rather than re-read: `getBand()` and the lesson store both persist on first read,
    // which would put back the keys this reset just removed. With no stars left, band 1 / auto and
    // the default length are exactly what the next read will derive anyway.
    setBand({ value: 1, mode: 'auto' })
    setLength(getLessonLength())
    setSnapshot({ events: getActivity(), now: Date.now() })
    // Constraint #3: reset is two halves, and this is the mirror's — called from here, the visible
    // foreground screen, so it can never race the hidden-tab flush trigger.
    if (!cloudAvailable || !activeId) return
    // …and the answer is not thrown away. Offline, or on any DELETE error, the server still holds
    // every row: the sync engine has written down that the reset is owed and will finish it before
    // it pulls anything, but the parent is told plainly rather than left to discover it — either
    // now (nothing looks wrong) or, worse, in a week when it does not.
    if (!(await resetRemoteProgress(activeId))) setResetNotice(PENDING_RESET_NOTICE)
  }

  // ---------------------------------------------------------------------------------------------
  // Tài khoản: link email, sign out, recovery code, add/rename/switch profiles.
  // ---------------------------------------------------------------------------------------------

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault()
    setLinkBusy(true)
    setLinkError(null)
    const result = await linkEmail(linkEmailValue)
    setLinkBusy(false)
    if (!result.ok) { setLinkError(describeAuthError(result.error)); return }
    setLinkStage('otp')
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    setLinkBusy(true)
    setLinkError(null)
    const result = await verifyEmailOtp(linkEmailValue, linkOtp)
    if (!result.ok) { setLinkBusy(false); setLinkError(describeAuthError(result.error)); return }
    setEmail(linkEmailValue)
    setHasSession(true)
    // The standing ruling, the other side of it: linking just dropped the recovery code server
    // side, so this screen must stop showing one rather than hold onto a stale value.
    setRecoveryCode(null)
    setLinkStage('idle')
    setLinkOtp('')
    setLinkEmailValue('')
    setLinkBusy(false)
  }

  function handleEditLinkEmail() {
    setLinkStage('idle')
    setLinkOtp('')
    setLinkError(null)
  }

  async function handleSignOut() {
    if (!window.confirm('Đăng xuất khỏi tài khoản này?')) return
    const result = await signOut()
    // Signing out leaves this device with NO session, which is the third state above — not an
    // anonymous one. Saying otherwise is what drew a link form that could not work.
    if (result.ok) { setEmail(null); setHasSession(false) }
  }

  function handleAddProfile() {
    const name = window.prompt('Tên của bé:')
    if (name === null) return
    addProfile(name)
    setProfiles(listProfiles())
    // Fire-and-forget: the new row reaches the server on the next launch regardless (`connectCloud`
    // calls the same function), this only saves the wait for a child who taps in the next minute.
    if (cloudAvailable) void ensureRemoteProfiles()
  }

  function handleRenameActiveProfile() {
    const current = profiles.find(p => p.id === activeId)
    if (!current) return
    const name = window.prompt('Đổi tên hồ sơ:', current.name)
    if (name === null || !name.trim()) return
    setProfiles(renameProfile(current.id, name))
    if (cloudAvailable) void renameRemoteProfile(current.id, name)
  }

  function handleSwitchProfile(id: string) {
    if (id === activeId) return
    switchProfile(id)
  }

  return (
    // 18 px of side frame on a phone — the densest of the design's five frame paddings (§1), for the
    // one screen it draws for a grown-up — and the 24 px this screen has always had from 768 up.
    <main className={`h-full overflow-y-auto bg-cream-50 px-[18px] ${PAGE_SHELL} text-sm text-ink-500 md:px-6 md:text-base`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 md:gap-6">
        <Link
          to="/"
          className="inline-flex min-h-[48px] items-center gap-2 self-start rounded-full bg-white px-4 font-display text-base font-extrabold text-ink-900 shadow-card-sm active:translate-y-[2px] md:min-h-[64px] md:px-6 md:text-xl"
        >
          ← Về nhà
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[21px] font-extrabold text-ink-900 md:text-[36px]">Góc phụ huynh</h1>
            <p className="mt-1 text-xs font-semibold text-ink-500 md:text-base">
              Tuần này: {weekMinutes} phút luyện · điểm phát âm trung bình {avgScoreLabel}/100
            </p>
          </div>

          <button
            type="button"
            onClick={() => onLock?.()}
            className="flex min-h-[44px] items-center gap-2 rounded-xl2 border border-line-200 bg-white px-3 text-xs font-semibold text-ink-500 active:translate-y-[2px] md:min-h-[64px] md:px-5 md:text-base"
          >
            <span>🔐 Đã mở khoá bằng câu hỏi ·</span>
            <span className="font-display font-extrabold text-ink-900">Khoá lại</span>
          </button>
        </header>

        {cloudAvailable && (
          <Card data-testid="account-card" className="px-4 py-3.5 md:p-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-extrabold text-ink-900 md:text-xl">Tài khoản</h2>
              {sync.state !== 'off' && (
                <span data-testid="sync-status" className="text-xs font-semibold text-ink-500 md:text-sm">
                  {sync.state === 'offline' && 'Ngoại tuyến'}
                  {sync.state === 'pending' && `Chưa đồng bộ ${sync.pending} mục`}
                  {sync.state === 'synced' && 'Đã đồng bộ ✓'}
                </span>
              )}
            </div>

            {!authReady ? (
              <p className="text-sm text-ink-500">Đang tải…</p>
            ) : !linked ? (
              <div className="flex flex-col gap-3">
                {/* No session at all — offline since install, or just signed out. The account this
                  * screen would talk about does not exist yet, so it says so instead of offering a
                  * form that cannot possibly reach anyone. */}
                {!hasSession && (
                  <p data-testid="no-session" className="rounded-xl2 bg-sun-50 p-3 text-xs font-semibold text-sun-700 md:text-sm">
                    {online()
                      ? 'Máy này chưa kết nối được với tài khoản nào. Thử mở lại trang này sau một chút nhé.'
                      : 'Đang ngoại tuyến nên chưa tạo được tài khoản cho máy này. Có mạng trở lại, mở lại trang này để liên kết email nhé.'}
                    {' '}Tiến độ của bé vẫn đang được lưu trên máy này.
                  </p>
                )}
                {/* With no session there is nothing to link an email TO — `linkEmail` calls
                  * `updateUser` on a user that does not exist — so neither form is drawn. */}
                {!hasSession ? null : linkStage === 'idle' ? (
                  <form onSubmit={handleSendOtp} className="flex flex-col gap-2">
                    {/* What actually travels, and only that: stars, history and lessons. The
                      * recordings card is on this same screen and its blobs never leave the
                      * device — "an toàn trên mọi thiết bị" promised the parent otherwise. */}
                    <p className="text-xs font-semibold text-ink-500 md:text-sm">
                      Liên kết email để mở lại sao, lịch sử luyện tập và bài học của bé trên máy khác
                      (bản ghi giọng nói chỉ nằm trên máy này). Tiến độ học của bé sẽ được lưu trên
                      tài khoản của bạn.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="email"
                        required
                        aria-label="Email của bố/mẹ"
                        placeholder="email@vidu.com"
                        value={linkEmailValue}
                        onChange={e => setLinkEmailValue(e.target.value)}
                        className="h-11 min-w-0 flex-1 rounded-xl2 border-2 border-line-200 px-3 text-sm font-semibold text-ink-900"
                      />
                      <Button type="submit" disabled={linkBusy} className="max-md:min-h-[44px] max-md:px-4 max-md:text-sm">
                        Liên kết
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-ink-500 md:text-sm">
                      Nhập mã 6 số vừa gửi tới {linkEmailValue}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        inputMode="numeric"
                        required
                        aria-label="Mã xác nhận"
                        value={linkOtp}
                        onChange={e => setLinkOtp(e.target.value)}
                        className="h-11 w-32 rounded-xl2 border-2 border-line-200 px-3 text-center text-sm font-semibold text-ink-900"
                      />
                      <Button type="submit" disabled={linkBusy} className="max-md:min-h-[44px] max-md:px-4 max-md:text-sm">
                        Xác nhận
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={handleEditLinkEmail}
                      className="min-h-[36px] self-start text-xs font-bold text-ink-500 underline"
                    >
                      Sửa lại email
                    </button>
                  </form>
                )}

                {linkError && <p role="alert" className="text-xs font-semibold text-fix-700">{linkError}</p>}

                {recoveryCode && (
                  <div className="rounded-xl2 bg-sun-50 p-3">
                    <p className="text-xs font-bold text-sun-700">Mã khôi phục — chụp màn hình lại nhé</p>
                    <p className="mt-1 font-display text-lg font-extrabold tracking-widest text-sun-700">{recoveryCode}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">{email}</p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[44px] rounded-xl2 border border-line-200 px-3 text-xs font-semibold text-ink-500"
                >
                  Đăng xuất
                </button>
              </div>
            )}

            <div className="mt-4 border-t border-line-200 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold text-ink-500 md:text-sm">Hồ sơ</h3>
                <button
                  type="button"
                  onClick={handleAddProfile}
                  className="min-h-[36px] rounded-xl2 bg-teal-50 px-3 text-xs font-bold text-teal-700"
                >
                  + Thêm hồ sơ
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">
                  {profiles.find(p => p.id === activeId)?.avatar} {profiles.find(p => p.id === activeId)?.name}
                </p>
                <button type="button" onClick={handleRenameActiveProfile} className="min-h-[36px] text-xs font-bold text-ink-500 underline">
                  Đổi tên
                </button>
              </div>
              {profiles.length > 1 && (
                <div className="mt-2">
                  <ProfilePicker profiles={profiles} activeId={activeId} onSelect={handleSwitchProfile} />
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 md:gap-6 ipad:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-3 md:gap-6">
            <Card className="px-4 py-3.5 md:p-6">
              {/* The chart holds the same fourteen days at every width; a phone draws the last seven
                  of them (design §12 M8c). Fourteen date labels cannot share 300 px — at 320 they
                  made the card wider than the screen — and `hidden` drops a day's column and its
                  label together, so a bar and its date can never come apart. */}
              <h2 className="font-display text-base font-extrabold text-ink-900 md:text-xl">
                Phút luyện mỗi ngày <span className="md:hidden">(7 ngày)</span><span className="hidden md:inline">(14 ngày)</span>
              </h2>
              <p className="mb-3 mt-1 text-xs font-semibold text-ink-500 md:mb-4 md:text-sm">Mục tiêu {limitMinutes} phút/ngày</p>

              <div className="relative h-24 md:h-40">
                <div className="absolute inset-x-0 border-t-2 border-dashed border-ink-300" style={{ top: `${targetTopPct}%` }} />
                <div className="absolute inset-0 flex items-end gap-1">
                  {days.map((d, i) => (
                    <div key={d.day} className={`h-full flex-1 items-end ${i < days.length - PHONE_DAYS ? 'hidden md:flex' : 'flex'}`}>
                      <div
                        data-testid="minute-bar"
                        data-minutes={d.minutes}
                        className={`w-full rounded-t ${d.day === todayKey ? 'bg-coral-500' : 'bg-teal-500'}`}
                        style={{ height: `${Math.max(2, (d.minutes / scaleMax) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                {days.map((d, i) => (
                  <span
                    key={d.day}
                    className={`flex-1 text-center text-[10px] font-bold text-ink-300 ${i < days.length - PHONE_DAYS ? 'hidden md:block' : 'block'}`}
                  >
                    {formatDayLabel(d.day)}
                  </span>
                ))}
              </div>
              {/* The total counts what the chart shows, so it follows the same seven/fourteen split.
                  `weekMinutes` is the last seven days already — the summary line at the top of the
                  screen is built from it. */}
              <p className="mt-2 text-xs font-semibold text-ink-500 md:mt-3 md:text-sm">
                Tổng: <span className="md:hidden">{weekMinutes}</span><span className="hidden md:inline">{totalMinutes}</span> phút
              </p>
            </Card>

            <div>
              <h2 className="mb-2 font-display text-base font-extrabold text-ink-900 md:mb-3 md:text-xl">Điểm trung bình</h2>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {(['speak', 'word', 'sentence'] as const).map(kind => (
                  <Card key={kind} className="flex flex-col items-center gap-1 p-3 text-center md:p-5">
                    <span className="text-xs font-bold text-ink-500 md:text-sm">{KIND_LABEL[kind]}</span>
                    <span className="font-display text-[26px] font-extrabold text-ink-900 md:text-[40px]">
                      {averages[kind] != null ? Math.round(averages[kind]!) : '—'}
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:gap-6">
            <Card className="px-4 py-3.5 md:p-6">
              <h2 className="mb-2 font-display text-base font-extrabold text-ink-900 md:mb-3 md:text-xl">Âm hay sai</h2>
              {weak.length === 0 ? (
                <p>Chưa đủ dữ liệu</p>
              ) : (
                <ul className="flex flex-col gap-2 md:gap-3">
                  {weak.map(w => (
                    <li key={w.phoneme} className="flex flex-col gap-2">
                      <p className="inline-flex w-fit items-center rounded-full bg-fix-50 px-3 py-1.5 font-display text-sm font-extrabold text-fix-700 md:px-4 md:py-2 md:text-lg">
                        /{w.phoneme}/ — trung bình {Math.round(w.avg)} ({w.count} lần)
                      </p>
                      {/* The design keeps the chips and drops the coaching paragraph on a phone: the
                          chip carries the number already, and the tip is a paragraph of reading in a
                          card that has to leave room for the three below it. Back from 768 up. */}
                      {PHONEME_TIPS[w.phoneme] && (
                        <p className="hidden rounded-xl2 bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-700 md:block">{PHONEME_TIPS[w.phoneme]}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="px-4 py-3.5 md:p-6">
              {/* The disclosure of spec decision 2. The heading lives inside the `<summary>`, so the
                  card is titled at both sizes; `list-none` and the webkit marker rule drop the
                  triangle, and the 64 px row is the child floor this one control is held to. From
                  768 up the summary is a plain heading line again (block, no minimum height, no
                  chevron) and the details is open, which is the card exactly as it was. */}
              <details open={recordingsOpen || undefined}>
                <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-2 md:block md:min-h-0 md:cursor-default [&::-webkit-details-marker]:hidden">
                  <h2 className="font-display text-base font-extrabold text-ink-900 md:text-xl">Bản ghi gần đây</h2>
                  <span aria-hidden="true" className="font-display text-lg text-ink-300 md:hidden">▾</span>
                </summary>
                <div className="mt-2 md:mt-3">
                  {recordings.length === 0 ? (
                    <p>Chưa có bản ghi</p>
                  ) : (
                    <ul className="flex flex-col gap-2 md:gap-3">
                      {recordings.map(r => (
                        <li key={r.id} className="flex items-center gap-3 rounded-xl2 border border-line-200 p-2 md:p-3">
                          <button
                            type="button"
                            aria-label="Phát"
                            onClick={() => { playBlob(r.blob).catch(() => { /* ignore: playback unavailable */ }) }}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500 text-lg text-white shadow-chunky-teal active:translate-y-[2px] md:h-16 md:w-16 md:text-2xl"
                          >
                            ▶
                          </button>
                          <div>
                            <p className="text-xs font-bold text-ink-300">{formatTs(r.ts)}</p>
                            <p className="font-semibold text-ink-900">{r.text}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            </Card>

            <Card className="px-4 py-3.5 md:p-6">
              <h2 className="mb-2 font-display text-base font-extrabold text-ink-900 md:mb-3 md:text-xl">Giới hạn mỗi ngày</h2>
              <div className="flex gap-2">
                {LIMIT_CHIPS.map(n => {
                  const active = Number(limit) === n
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleLimitChip(n)}
                      className={`min-h-[44px] flex-1 rounded-xl2 font-display text-sm font-extrabold active:translate-y-[2px] md:min-h-[64px] md:text-base ${
                        active ? 'bg-coral-500 text-white shadow-chunky-coral' : 'border-2 border-line-200 bg-cream-50 text-ink-500'
                      }`}
                    >
                      {n} phút
                    </button>
                  )
                })}
              </div>
              <label className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={60}
                  step={5}
                  value={limit}
                  onChange={handleLimitChange}
                  onBlur={handleLimitBlur}
                  className="h-11 w-20 rounded-xl2 border-2 border-line-200 px-3 text-center font-display text-base font-extrabold text-ink-900 md:h-16 md:w-24 md:text-lg"
                />
                <span className="font-semibold text-ink-500">phút / ngày</span>
              </label>
            </Card>

            <Card className="px-4 py-3.5 md:p-6">
              <h2 className="mb-2 font-display text-base font-extrabold text-ink-900 md:mb-3 md:text-xl">Bài học</h2>

              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-ink-500 md:text-sm">Độ khó</span>
                <button
                  type="button"
                  onClick={handleBandAuto}
                  aria-pressed={band.mode === 'auto'}
                  className={`min-h-[44px] rounded-xl2 px-4 font-display text-sm font-extrabold active:translate-y-[2px] md:min-h-[64px] ${
                    band.mode === 'auto' ? 'bg-teal-500 text-white shadow-chunky-teal' : 'border-2 border-line-200 bg-cream-50 text-ink-500'
                  }`}
                >
                  Tự động
                </button>
              </div>
              <div className="mb-4 flex gap-2">
                {BAND_VALUES.map(n => {
                  const active = band.value === n
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleBandClick(n)}
                      aria-pressed={active}
                      aria-label={`Bậc ${n}`}
                      className={`min-h-[44px] flex-1 rounded-xl2 font-display text-base font-extrabold active:translate-y-[2px] md:min-h-[64px] ${
                        active ? 'bg-coral-500 text-white shadow-chunky-coral' : 'border-2 border-line-200 bg-cream-50 text-ink-500'
                      }`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>

              <span className="mb-2 block text-xs font-bold text-ink-500 md:text-sm">Thời lượng</span>
              <div className="flex gap-2">
                {LESSON_LENGTHS.map(value => {
                  const active = length === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleLengthClick(value)}
                      aria-pressed={active}
                      className={`min-h-[44px] flex-1 rounded-xl2 font-display text-xs font-extrabold active:translate-y-[2px] md:min-h-[64px] md:text-sm ${
                        active ? 'bg-coral-500 text-white shadow-chunky-coral' : 'border-2 border-line-200 bg-cream-50 text-ink-500'
                      }`}
                    >
                      {LENGTH_LABEL[value]}
                    </button>
                  )
                })}
              </div>

              {/* Today's lesson is generated once and then frozen, so a change made now shows up
                * tomorrow — without this line the buttons look broken. */}
              <p className="mt-3 text-xs font-semibold text-ink-500 md:text-sm">Áp dụng từ bài học ngày mai.</p>
            </Card>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2">
          {/* `max-md:`, because `min-h-[64px] px-8 text-[22px]` are `Button`'s own classes. */}
          <Button variant="outline" onClick={handleReset} className="self-start max-md:min-h-[48px] max-md:px-4 max-md:text-base">
            Đặt lại tiến trình
          </Button>
          {resetNotice && (
            <p role="status" data-testid="reset-notice" className="rounded-xl2 bg-sun-50 p-3 text-xs font-semibold text-sun-700 md:text-sm">
              {resetNotice}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
