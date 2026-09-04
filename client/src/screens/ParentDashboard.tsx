import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
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
  NAME_MAX,
  activeProfileId,
  addProfile,
  ensureRemoteProfiles,
  fetchRemoteProfiles,
  listProfiles,
  renameProfile,
  renameRemoteProfile,
  shortName,
  switchProfile,
} from '../cloud/profileState'
import { flush, hasPendingReset, resetRemoteProgress, subscribeSyncStatus, syncStatus } from '../cloud/sync'
import type { SyncStatus } from '../cloud/sync'
import { fetchRemoteStats } from '../cloud/remote'
import type { RemoteStats } from '../cloud/remote'
import { isCloudConfigured } from '../cloud/supabase'
import { ProfilePicker } from '../components/ProfilePicker'
import { AccountCardSkeleton, BackButton, Button, Card, EmptyState, Notice, RemoteRowSkeleton, SyncPill } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { Panel, PanelGrid } from '../components/adult'
import { useDialog } from '../components/ui/useDialog'

/**
 * Phone styles sit at the default breakpoint and `md:` (768) puts the tablet/iPad value back — the
 * phase-10 idiom written out in full in `screens/SoundPractice.tsx`.
 *
 * This screen is the one place the app's 64 px tap floor does not apply, and the design says so
 * outright (§12 M8c, and — round 4, R3 — as a deliberate **reversal** of an earlier reading of that
 * same rule): it is an **adult** interface, reached through a gate no child gets past, and the
 * ruling for the whole screen is now a single one: visible controls sit at 28/32/36/44 px, the tap
 * target is never smaller than 44 px (a hit band widens a small box instead of growing it visibly),
 * and nothing here is sized for a child's finger any more — not even the recordings disclosure,
 * which used to be held to the child's 64 px floor by name (spec decision 2) and lost that
 * exception in this same pass.
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

/** The `no-session` notice's copy, split at its first sentence (title) from the rest (sub) per the
 * Phase 12 task 11 ruling — same two Vietnamese messages as before, just no longer one run-on `<p>`. */
function noSessionNotice(): { title: string; sub: string } {
  return online()
    ? {
        title: 'Máy này chưa kết nối được với tài khoản nào.',
        sub: 'Thử mở lại trang này sau một chút nhé. Tiến độ của bé vẫn đang được lưu trên máy này.',
      }
    : {
        title: 'Đang ngoại tuyến nên chưa tạo được tài khoản cho máy này.',
        sub: 'Có mạng trở lại, mở lại trang này để liên kết email nhé. Tiến độ của bé vẫn đang được lưu trên máy này.',
      }
}

function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

const formatAvg = (n: number | null): string => (n == null ? '—' : String(Math.round(n)))

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
  const dialog = useDialog()
  const [recordings, setRecordings] = useState<Recording[]>([])
  // Disables the "Đặt lại tiến trình"/"Đăng xuất" triggers for the whole span their own
  // confirm dialog is open AND busy (see `Dialog`'s `onConfirm`). `DialogProvider` itself now
  // refuses to replace a busy dialog (fix round 2), so this is belt-and-braces rather than the
  // only guard — but it is the one thing that keeps a BACKGROUND trigger from even reaching
  // `open()` in the first place, e.g. Tab escaping the disabled dialog while its own action is
  // still in flight.
  const [resetBusy, setResetBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  // One read of the activity log per mount (and per reset), shared by every query below; the
  // snapshot doubles as the reload key for the recordings list.
  const [snapshot, setSnapshot] = useState(() => ({ events: getActivity(), now: Date.now() }))
  const [limit, setLimit] = useState<string>(() => String(getLimitMinutes()))
  const [band, setBand] = useState(() => getBand())
  const [length, setLength] = useState<LessonLength>(() => getLessonLength())

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

  // ---------------------------------------------------------------------------------------------
  // Flow 5: read-only progress from another device.
  //
  // `fetchRemoteProfiles()` needs a live session to mean anything (constraint: it answers `[]` for
  // "no session" too, which is NOT "this account owns nothing" — see the trap called out in its own
  // doc comment). So this is gated on `hasSession`, not merely `cloudAvailable`, and it is not even
  // attempted until `authReady` says which is true. `'unknown'` is a first-class state precisely so
  // a failed fetch can say so instead of silently rendering as "no remote profiles".
  // ---------------------------------------------------------------------------------------------
  type RemoteProfilesState = { status: 'idle' } | { status: 'unknown' } | { status: 'ready'; profiles: Profile[] }
  const [remoteProfilesState, setRemoteProfilesState] = useState<RemoteProfilesState>({ status: 'idle' })
  // The manual "Xem từ xa" toggle — off by default, the section still appears on its own the moment
  // the account holds a profile this device's active one is not (a sibling, or simply a different
  // device's child), which is the "differs" half of the brief's condition; the toggle is the other
  // half, for comparing THIS device's own child against what the server holds for them.
  const [remoteViewOn, setRemoteViewOn] = useState(false)
  const [remoteStats, setRemoteStats] = useState<Record<string, RemoteStats | null>>({})
  // Ids already asked for, so a re-render (the sync status line updates often) does not re-fetch a
  // profile whose stats already came back — success OR failure both count as "asked".
  const fetchedRemoteIds = useRef(new Set<string>())
  /**
   * Whether THIS COMPONENT INSTANCE is still mounted — set once, for the component's whole
   * lifetime, never per effect run. The stats-fetch effect below used to guard its `setRemoteStats`
   * call with a `cancelled` flag scoped to a single effect run instead, and that was a real,
   * deterministic bug: two profiles shown, a sibling's fetch still in flight, the parent presses
   * "Xem từ xa" — `remoteShowKey` changes, the OLD effect's cleanup sets ITS `cancelled` to true, the
   * NEW effect run sees the sibling's id already in `fetchedRemoteIds` and does not re-fetch it, and
   * the original promise then resolves against the stale `cancelled` and drops its own update. The
   * id stays marked "asked" forever with no answer ever recorded for it — a card stuck on
   * "Đang tải…" with no retry short of a reload. A fetch is requested once per id (still true here)
   * and its result is applied whenever it lands, regardless of how many times this effect has
   * re-run since — the only thing that should ever suppress an update is the component being gone.
   */
  const remoteStatsMounted = useRef(true)
  useEffect(() => () => { remoteStatsMounted.current = false }, [])

  useEffect(() => {
    if (!cloudAvailable || !authReady || !hasSession) return undefined
    let cancelled = false
    void (async () => {
      const remote = await fetchRemoteProfiles()
      if (cancelled) return
      setRemoteProfilesState(remote === null ? { status: 'unknown' } : { status: 'ready', profiles: remote })
    })()
    return () => { cancelled = true }
  }, [cloudAvailable, authReady, hasSession])
  // `hasSession` going false (a sign-out) must hide whatever the state above still remembers from
  // before — but resetting it with another `setState` inside the effect above only chases that
  // render with a second one. Deriving it here instead is the fix the lint rule itself names:
  // "derive the value during render" rather than synchronizing it via an extra effect-driven write.
  const remoteProfiles: RemoteProfilesState = hasSession ? remoteProfilesState : { status: 'idle' }

  const [linkStage, setLinkStage] = useState<'idle' | 'otp'>('idle')
  const [linkEmailValue, setLinkEmailValue] = useState('')
  const [linkOtp, setLinkOtp] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<Profile[]>(() => listProfiles())
  const activeId = activeProfileId()

  const remoteProfilesToShow = remoteProfiles.status === 'ready'
    ? remoteProfiles.profiles.filter(p => remoteViewOn || p.id !== activeId)
    : []
  // A stable string, not the array itself: the array is a fresh reference every render (it is
  // rebuilt above), and an effect keyed on a fresh reference every time would re-run — and tear
  // down — on every render, which is exactly the shape of the race described above.
  const remoteShowKey = remoteProfilesToShow.map(p => p.id).join(',')

  useEffect(() => {
    if (!remoteShowKey) return
    for (const id of remoteShowKey.split(',')) {
      if (fetchedRemoteIds.current.has(id)) continue
      fetchedRemoteIds.current.add(id)
      void fetchRemoteStats(id).then(stats => {
        // Gated on the component's whole lifetime, not on this effect run — see `remoteStatsMounted`.
        if (remoteStatsMounted.current) setRemoteStats(prev => ({ ...prev, [id]: stats }))
      })
    }
  }, [remoteShowKey])

  /**
   * `undefined` when the roster is unreadable, and when no profile is active at all (the device is
   * reading the legacy namespace). Either way there is no name to print — see the "Hồ sơ" block.
   */
  const activeProfileEntry = profiles.find(p => p.id === activeId)

  /** Set when a roster write did not happen — see `handleAddProfile`. */
  const [profileNotice, setProfileNotice] = useState<string | null>(null)

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
    // Defensive, not load-bearing on its own: the trigger button below is also `disabled` while
    // this is true, which is what actually stops a double-tap from reaching this function twice.
    if (resetBusy) return
    // The old wording was from the local-only era and stopped being true the moment this button
    // also emptied the mirror: the cloud copy of this child goes with it, and no device gets it
    // back. A parent may not find that out afterwards.
    const body = cloudAvailable && activeId
      ? 'Sao, chuỗi ngày và bản ghi trên máy này sẽ mất. Bản lưu trên tài khoản cũng bị xoá. Không khôi phục được.'
      : 'Sao, chuỗi ngày và bản ghi trên máy này sẽ mất. Không khôi phục được.'
    setResetBusy(true)
    // The clearing and the mirror call both live inside `onConfirm`: the dialog stays open and
    // busy (buttons disabled, confirm label "…", scrim/Escape ignored) for exactly as long as
    // this callback runs, and only resolves — closing itself — once it settles. Nothing here
    // depends on the dialog's own resolved value; if the parent cancels, `onConfirm` never runs
    // and none of this fires, which is the whole of the "dismissed" behaviour.
    await dialog.destructive({
      title: 'Xoá toàn bộ tiến trình của bé?',
      body,
      confirmLabel: 'Xoá tiến trình',
      onConfirm: async () => {
        setResetNotice(null)
        clearStars()
        clearActivity()
        clearLeitner()
        // The Phase 7 stores go too: a lesson kept from before the reset would still be pinned to
        // the old band and still tick items off against an event log that no longer exists.
        clearLessons()
        clearBand()
        await clearRecordings()
        setLimit(String(getLimitMinutes()))
        // Written out rather than re-read: `getBand()` and the lesson store both persist on first
        // read, which would put back the keys this reset just removed. With no stars left, band 1
        // / auto and the default length are exactly what the next read will derive anyway.
        setBand({ value: 1, mode: 'auto' })
        setLength(getLessonLength())
        setSnapshot({ events: getActivity(), now: Date.now() })
        // Constraint #3: reset is two halves, and this is the mirror's — called from here, the
        // visible foreground screen, so it can never race the hidden-tab flush trigger.
        if (!cloudAvailable || !activeId) return
        // …and the answer is not thrown away. Offline, or on any DELETE error, the server still
        // holds every row: the sync engine has written down that the reset is owed and will
        // finish it before it pulls anything, but the parent is told plainly rather than left to
        // discover it — either now (nothing looks wrong) or, worse, in a week when it does not.
        if (!(await resetRemoteProgress(activeId))) setResetNotice(PENDING_RESET_NOTICE)
      },
    })
    setResetBusy(false)
  }

  /** The reset-notice's "Thử xoá lại" action: the same mirror-side call `handleReset` makes,
   * without repeating the local wipe (that half already succeeded — this notice only exists
   * because the SERVER side did not). Clears the notice once the retry actually lands. */
  async function handleRetryReset() {
    if (!cloudAvailable || !activeId) return
    if (await resetRemoteProgress(activeId)) setResetNotice(null)
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
    if (signOutBusy) return
    setSignOutBusy(true)
    // Same shape as `handleReset`: the actual work is `onConfirm`, so the dialog stays open and
    // busy for exactly as long as `signOut()` takes, and closes itself once it settles.
    await dialog.confirm({
      title: 'Đăng xuất khỏi tài khoản này?',
      body: 'Bé vẫn học được, tiến độ sẽ không đồng bộ.',
      confirmLabel: 'Đăng xuất',
      onConfirm: async () => {
        const result = await signOut()
        // Signing out leaves this device with NO session, which is the third state above — not
        // an anonymous one. Saying otherwise is what drew a link form that could not work.
        if (result.ok) { setEmail(null); setHasSession(false) }
      },
    })
    setSignOutBusy(false)
  }

  async function handleAddProfile() {
    const name = await dialog.prompt({ title: 'Thêm hồ sơ', label: 'Tên của bé', maxLength: NAME_MAX })
    if (name === null) return
    setProfileNotice(null)
    // `null` means the child is not on disk — an unreadable roster this must not write over, or a
    // store that refused the write. Re-reading `listProfiles()` alone would simply show nothing and
    // leave the parent tapping a button that does nothing, which is how they come to tap it twice.
    if (!addProfile(name)) {
      setProfileNotice('Chưa lưu được hồ sơ mới trên máy này. Tiến độ của bé vẫn an toàn — mở lại ứng dụng rồi thử lại nhé.')
      return
    }
    setProfiles(listProfiles())
    // Fire-and-forget: the new row reaches the server on the next launch regardless (`connectCloud`
    // calls the same function), this only saves the wait for a child who taps in the next minute.
    if (cloudAvailable) void ensureRemoteProfiles()
  }

  async function handleRenameActiveProfile() {
    const current = profiles.find(p => p.id === activeId)
    if (!current) return
    const name = await dialog.prompt({ title: 'Đổi tên hồ sơ', label: 'Tên của bé', initial: current.name, maxLength: NAME_MAX })
    if (name === null || !name.trim()) return
    setProfiles(renameProfile(current.id, name))
    if (cloudAvailable) void renameRemoteProfile(current.id, name)
  }

  function handleSwitchProfile(id: string) {
    if (id === activeId) return
    switchProfile(id)
  }

  return (
    <PageShell gutter="24">
      <PageHeader
        back={<BackButton to="/" label="Về nhà" mdLabel="Về bản đồ 🏝️" variant="adult" />}
        right={
          // `Button` has no sand-background variant, and this is the one control on the whole
          // screen that needs `#F3EADA`/`#A79781` — not worth a fifth `Button` variant for a
          // single call-site (R25 / decision 25), so it draws its own 44 px pill instead.
          <button
            type="button"
            onClick={() => onLock?.()}
            aria-label="Khoá lại"
            className="flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-r12 bg-sand px-3 font-display text-[13px] font-extrabold text-sand-text"
          >
            <span aria-hidden="true" className="md:hidden">🔐</span>
            <span className="hidden md:inline">🔐 Khoá lại</span>
          </button>
        }
        title="Góc phụ huynh"
        sub={weekMinutes > 0 ? `Tuần này: ${weekMinutes} phút · điểm TB ${avgScoreLabel}/100` : 'Chưa có buổi luyện nào tuần này'}
      />
      <PageBody className="text-sm text-ink-500 md:text-base">
      <div className="flex flex-col">
        <PanelGrid>
        {cloudAvailable && (
          <Panel
            title="Tài khoản"
            col="full"
            testId="account-card"
            right={<SyncPill status={sync} onRetry={() => void flush()} />}
          >
            {!authReady ? (
              <AccountCardSkeleton />
            ) : !linked ? (
              <div className="flex flex-col gap-3">
                {/* No session at all — offline since install, or just signed out. The account this
                  * screen would talk about does not exist yet, so it says so instead of offering a
                  * form that cannot possibly reach anyone. */}
                {!hasSession && (
                  <Notice kind="warn" testId="no-session" adult {...noSessionNotice()} />
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
                      <Button type="submit" size="adult" disabled={linkBusy}>
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
                      <Button type="submit" size="adult" disabled={linkBusy}>
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
                  <Notice
                    kind="credential"
                    adult
                    title="Mã khôi phục — chụp màn hình lại nhé"
                    sub="Dùng mã này để lấy lại tiến độ trên máy khác."
                    code={recoveryCode}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">{email}</p>
                <button
                  type="button"
                  onClick={() => { void handleSignOut() }}
                  disabled={signOutBusy}
                  className="min-h-[44px] rounded-xl2 border border-line-200 px-3 text-xs font-semibold text-ink-500 disabled:opacity-50"
                >
                  Đăng xuất
                </button>
              </div>
            )}

            <div className="mt-4 border-t border-line-200 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold text-ink-500 md:text-sm">Hồ sơ</h3>
                <Button size="adult" variant="outline" onClick={() => { void handleAddProfile() }}>
                  + Thêm hồ sơ
                </Button>
              </div>
              {/* The roster can be unreadable — a half-written value this app now refuses to write
                * over — and `speakup.profile` can be unset, in which case the device is reading the
                * legacy namespace. Both used to render as an empty string directly beside
                * "+ Thêm hồ sơ", which is the worst possible pairing: a parent who sees a blank
                * name taps the button, and that button is the one that writes the roster. */}
              {activeProfileEntry ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900" title={activeProfileEntry.name}>
                    {activeProfileEntry.avatar} {shortName(activeProfileEntry.name)}
                  </p>
                  <Button size="adult" variant="outline" onClick={() => { void handleRenameActiveProfile() }}>
                    Đổi tên
                  </Button>
                </div>
              ) : (
                <Notice
                  kind="warn"
                  adult
                  testId="profile-unreadable"
                  title="Chưa đọc được danh sách hồ sơ trên máy này. Tiến độ của bé vẫn đang được lưu bình thường — mở lại ứng dụng để kiểm tra, và tạm thời đừng thêm hồ sơ mới."
                />
              )}
              {profileNotice && (
                <div className="mt-2">
                  <Notice kind="error" adult testId="profile-notice" title={profileNotice} />
                </div>
              )}
              {profiles.length > 1 && (
                <div className="mt-2">
                  <ProfilePicker profiles={profiles} activeId={activeId} onSelect={handleSwitchProfile} />
                </div>
              )}
              {/* Flow 5's manual door. Shown whenever the account is known to hold at least one
                * profile — even when it is only the one already active here — so the affordance is
                * discoverable regardless of whether the section below is currently visible on its
                * own (it appears without this being pressed once a DIFFERENT profile is on the
                * account; pressing it adds this device's own child, for comparing the two). */}
              {remoteProfiles.status === 'ready' && remoteProfiles.profiles.length > 0 && (
                <Button
                  size="adult"
                  variant="outline"
                  onClick={() => setRemoteViewOn(v => !v)}
                  aria-pressed={remoteViewOn}
                  data-testid="remote-view-toggle"
                  className="mt-2"
                >
                  Xem từ xa
                </Button>
              )}
            </div>
          </Panel>
        )}

        <Panel
          title="Phút luyện mỗi ngày"
          right={
            // The chart holds the same fourteen days at every width; a phone draws the last seven
            // of them (design §12 M8c). Fourteen date labels cannot share 300 px — at 320 they
            // made the card wider than the screen — and `hidden` drops a day's column and its
            // label together, so a bar and its date can never come apart.
            <>
              <span className="md:hidden">(7 ngày)</span>
              <span className="hidden md:inline">(14 ngày)</span>
            </>
          }
        >
              <p className="mb-3 mt-1 text-xs font-semibold text-ink-500 md:mb-4 md:text-sm">Mục tiêu {limitMinutes} phút/ngày</p>

              {events.length === 0 ? (
                <EmptyState
                  adult
                  emoji="📈"
                  title="Chưa có lịch sử luyện"
                  sub="Biểu đồ sẽ hiện từ ngày học đầu tiên."
                />
              ) : (
                <>
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
                </>
              )}
        </Panel>

        <Panel title="Điểm trung bình">
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
        </Panel>

        <Panel title="Âm hay sai">
          {weak.length === 0 ? (
            <EmptyState
              adult
              emoji="🔤"
              title="Chưa đủ dữ liệu"
              sub="Âm hay sai hiện ra sau vài lần bé luyện nói."
            />
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
        </Panel>

        <Panel title="⏰ Giới hạn mỗi ngày">
          <div className="flex gap-2">
            {LIMIT_CHIPS.map(n => {
              const active = Number(limit) === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleLimitChip(n)}
                  className={`min-h-[44px] flex-1 rounded-xl2 font-display text-sm font-extrabold active:translate-y-[2px] md:text-base ${
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
        </Panel>

        <Panel title="Bài học">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-ink-500 md:text-sm">Độ khó</span>
            <button
              type="button"
              onClick={handleBandAuto}
              aria-pressed={band.mode === 'auto'}
              className={`min-h-[44px] rounded-xl2 px-4 font-display text-sm font-extrabold active:translate-y-[2px] ${
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
                  className={`min-h-[44px] flex-1 rounded-xl2 font-display text-base font-extrabold active:translate-y-[2px] ${
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
                  className={`min-h-[44px] flex-1 rounded-xl2 font-display text-xs font-extrabold active:translate-y-[2px] md:text-sm ${
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
        </Panel>

        <Panel title="Bản ghi gần đây">
          {recordings.length === 0 ? (
            <EmptyState
              adult
              emoji="🎙️"
              title="Chưa có bản ghi nào"
              sub="Bản ghi xuất hiện sau khi bé luyện nói."
            />
          ) : (
            <ul className="flex flex-col gap-2 md:gap-3">
              {recordings.map(r => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl2 border border-line-200 p-2 md:p-3">
                  <button
                    type="button"
                    aria-label="Phát"
                    onClick={() => { playBlob(r.blob).catch(() => { /* ignore: playback unavailable */ }) }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500 text-lg text-white shadow-chunky-teal active:translate-y-[2px]"
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
        </Panel>

        {/* Flow 5: read-only progress from another device, computed with the same queries
          * (`progress/activity.ts`) the numbers above use on local data. This panel is always in
          * the grid whenever the account is; which of the three bodies below shows is the only
          * thing that varies — an unread server ("unknown") must never look like "no remote
          * profiles" (the whole reason it is its own branch), and an idle read (no profile to
          * compare against yet) prints nothing more than the title. */}
        {cloudAvailable && (
          <Panel title="Tiến độ từ xa" col="full">
            {remoteProfiles.status === 'unknown' && (
              <p data-testid="remote-progress-unknown" className="text-xs font-semibold text-ink-500 md:text-sm">
                Chưa xem được tiến độ từ xa lúc này (máy chủ chưa trả lời). Thử tải lại trang sau nhé.
              </p>
            )}
            {remoteProfilesToShow.length > 0 && (
              <div data-testid="remote-progress-card">
                <p className="mb-2 text-xs font-semibold text-ink-500 md:text-sm">
                  Lấy từ máy chủ — có thể khác số trên chính máy này (máy có thể đã tự xoá bớt lịch sử cũ).
                </p>
                <ul className="flex flex-col gap-3">
                  {remoteProfilesToShow.map(p => {
                    const loaded = p.id in remoteStats
                    const entry = remoteStats[p.id]
                    // While the stats haven't loaded, the skeleton IS the row — no bordered/padded
                    // `<li>` around a real name line sat above a second, separately-framed skeleton
                    // box (that read as two stacked cards, not one loading row).
                    if (!loaded) {
                      return (
                        <li key={p.id} data-testid="remote-profile" className="overflow-hidden rounded-r16">
                          <RemoteRowSkeleton />
                        </li>
                      )
                    }
                    return (
                      <li key={p.id} data-testid="remote-profile" className="rounded-xl2 border border-line-200 p-3">
                        <p className="font-semibold text-ink-900">
                          {p.avatar} {p.name}
                          {p.id === activeId && <span className="font-normal text-ink-500"> · đang dùng trên máy này</span>}
                        </p>
                        {entry === null ? (
                          <p className="mt-1 text-xs font-semibold text-fix-700">Không tải được tiến độ của bé lúc này.</p>
                        ) : (
                          <div className="mt-1 flex flex-col gap-1 text-xs font-semibold text-ink-500 md:text-sm">
                            {/* A profile the server holds nothing for gets a sentence, not a
                              * measurement: "Chuỗi ngày: 0 · Tuần này: 0 phút" reads as a confident
                              * statement about a child who has been idle, and it is exactly what an
                              * empty placeholder row produces. Hiding such a profile instead would hide
                              * a real child a parent added on another device and is checking arrived —
                              * the same error class, pointing the other way. */}
                            {entry.eventCount === 0 ? (
                              <p data-testid="remote-empty">Chưa có dữ liệu nào trên máy chủ</p>
                            ) : (
                              <>
                                <p>Chuỗi ngày: {entry.streak} · Tuần này: {entry.weekMinutes} phút</p>
                                <p>
                                  Điểm trung bình — Nói {formatAvg(entry.averages.speak)} · Từ vựng {formatAvg(entry.averages.word)} · Ghép câu {formatAvg(entry.averages.sentence)}
                                </p>
                                {entry.weak.length === 0 ? (
                                  <p>Chưa đủ dữ liệu về âm sai</p>
                                ) : (
                                  <p>Âm hay sai: {entry.weak.map(w => `/${w.phoneme}/ (${Math.round(w.avg)})`).join(', ')}</p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        <p className="mt-1 text-xs font-semibold text-ink-300">
                          Bản ghi giọng nói của bé không đồng bộ — chỉ nghe được trên máy đã ghi.
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </Panel>
        )}
        </PanelGrid>

        <div data-testid="reset-row" className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[12px] font-bold leading-snug text-ink-300">
            Xoá sao, chuỗi ngày và bản ghi trên máy này (và trên tài khoản nếu đã liên kết).
          </p>
          <Button size="adult" variant="danger" disabled={resetBusy} onClick={() => { void handleReset() }} className="shrink-0">
            ↺ Đặt lại tiến trình…
          </Button>
        </div>
        {resetNotice && (
          <Notice
            kind="pending"
            adult
            testId="reset-notice"
            title={resetNotice}
            action={{ label: 'Thử xoá lại', onClick: () => { void handleRetryReset() } }}
          />
        )}
      </div>
      </PageBody>
    </PageShell>
  )
}
