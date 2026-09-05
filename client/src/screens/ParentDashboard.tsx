import { useEffect, useRef, useState } from 'react'
import { getActivity, minutesPerDay, minutesToday, averageScoreByKind, weakPhonemes, clearActivity } from '../progress/activity'
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
  connectCloud,
  ensureRemoteProfiles,
  fetchRemoteProfiles,
  listProfiles,
  renameProfile,
  renameRemoteProfile,
  switchProfile,
} from '../cloud/profileState'
import { flush, hasPendingReset, resetRemoteProgress, subscribeSyncStatus, syncStatus } from '../cloud/sync'
import type { SyncStatus } from '../cloud/sync'
import { fetchRemoteStats } from '../cloud/remote'
import type { RemoteStats } from '../cloud/remote'
import { isCloudConfigured } from '../cloud/supabase'
import { ProfilePicker } from '../components/ProfilePicker'
import { BackButton, Button, EmptyState, Notice, RemoteRowSkeleton, SyncPill } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { AccountCard, MinutesChart, Panel, PanelGrid, RecordingRow, RemoteRow, SegRow, Stepper } from '../components/adult'
import type { AccountState, RemoteRowState, Seg } from '../components/adult'
import { useDialog } from '../components/ui/useDialog'
// Final wave / I6: ONE `describeAuthError` for the whole adult zone — this screen used to carry its
// own, older, diverging sentences for the very same `AuthResult` codes and the very same OTP flow.
import { describeAuthError } from './authErrorCopy'

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
const KIND_LABEL = { speak: 'Nói', word: 'Từ vựng', sentence: 'Ghép câu', story: 'Truyện' } as const
const LIMIT_CHIPS = [15, 20, 30] as const
/** R21 — a weak-sound chip's tone by its average score: under 50 reads as something to fix,
 * everything else (the design only ever draws 50–70) as a soft nudge. */
const CHIP = (avg: number) => (avg < 50 ? 'bg-fix-50 text-fix-700' : 'bg-ok-50 text-ok-700')
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
  short: "Ngắn ~8'",
  medium: "Vừa ~12'",
  long: "Dài ~18'",
}

/**
 * `navigator.onLine === false` is the reliable half of that flag — it really does mean no network,
 * while true only ever meant an interface is up. Used here to say WHY there is no account yet, so
 * an offline device gets an explanation instead of a form that cannot work.
 */
const online = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false

const formatAvg = (n: number | null): string => (n == null ? '—' : String(Math.round(n)))

const DAY_MS = 24 * 3600e3

/** R18 — the 2–3 free-standing `<p>` lines the old remote card drew, squeezed into the ONE string
 * `RemoteRow` truncates rather than wraps. */
function composeRemoteSub(entry: RemoteStats): string {
  const a = entry.averages
  const first = entry.weak[0]
  return `🔥 ${entry.streak} ngày · ${entry.weekMinutes}'/tuần · Nói ${formatAvg(a.speak)} · Từ ${formatAvg(a.word)} · Câu ${formatAvg(a.sentence)}`
    + (first ? ` · Âm sai /${first.phoneme}/ ${Math.round(first.avg)}` : '')
}

/** decision 30/31: a stale row leads with WHEN, not with the numbers a parent already stopped
 * trusting. `now` is the caller's own render-stable clock (`snapshot.now`), not a fresh
 * `Date.now()` read mid-render. */
function composeStaleSub(entry: RemoteStats, now: number, updatedAt: number): string {
  const daysAgo = Math.floor((now - updatedAt) / DAY_MS)
  return `Cập nhật ${daysAgo} ngày trước · 🔥 ${entry.streak} · ${entry.weekMinutes}'/tuần`
}

/**
 * "Chi tiết" → the numbers the row's own one-line `sub` had no room for.
 *
 * I5: joined with " · " on ONE line, not with `'\n'`. `Dialog`'s body is a plain `<p>` with no
 * `whitespace-pre-line`, and `Dialog` may not gain anything but `placeholder?` this phase
 * (decision 16), so the newlines collapsed and the parent read "Chuỗi ngày: 4Tuần này: 58 phút…"
 * as one run-on block. The separator has to live on the caller, and the first two entries are
 * shortened to the row's own shorthand so the single line stays readable.
 */
function remoteDetailBody(entry: RemoteStats): string {
  const a = entry.averages
  return [
    `🔥 ${entry.streak} ngày`,
    `${entry.weekMinutes}'/tuần`,
    `Điểm TB — Nói ${formatAvg(a.speak)} · Từ vựng ${formatAvg(a.word)} · Ghép câu ${formatAvg(a.sentence)}`,
    entry.weak.length === 0
      ? 'Chưa đủ dữ liệu về âm sai'
      : `Âm hay sai: ${entry.weak.map(w => `/${w.phoneme}/ (${Math.round(w.avg)})`).join(', ')}`,
  ].join(' · ')
}

type Props = {
  /** Clears the parent-gate flag and hands control back to ParentGate, which owns the
   * unlocked/locked state. Optional so the component still renders standalone in tests. */
  onLock?: () => void
}

export function ParentDashboard({ onLock }: Props) {
  const dialog = useDialog()
  const [recordings, setRecordings] = useState<Recording[]>([])
  // Task 14 (decision 30): the panel shows 5 rows by default and expands IN PLACE, never a dialog.
  const [recordingsExpanded, setRecordingsExpanded] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playErrorId, setPlayErrorId] = useState<string | null>(null)
  // Disables the "Đặt lại tiến trình"/"Đăng xuất" triggers for the whole span their own
  // confirm dialog is open AND busy (see `Dialog`'s `onConfirm`). `DialogProvider` itself now
  // refuses to replace a busy dialog (fix round 2), so this is belt-and-braces rather than the
  // only guard — but it is the one thing that keeps a BACKGROUND trigger from even reaching
  // `open()` in the first place, e.g. Tab escaping the disabled dialog while its own action is
  // still in flight.
  const [resetBusy, setResetBusy] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  // M1 — the SECOND flag, and the only one the card reads. `signOutBusy` is the trigger guard and
  // goes up the moment the button is tapped, i.e. while the confirm dialog is still asking; driving
  // the card's ⑪ face off it made "Đang lưu N mục còn lại trước khi đăng xuất…" appear behind the
  // scrim before the parent had answered, and un-appear if they cancelled. This one is set inside
  // `onConfirm`, so ⑪ describes work that is actually happening.
  const [signingOut, setSigningOut] = useState(false)
  // One read of the activity log per mount (and per reset), shared by every query below; the
  // snapshot doubles as the reload key for the recordings list.
  const [snapshot, setSnapshot] = useState(() => ({ events: getActivity(), now: Date.now() }))
  // The value itself is never read — `limitMinutes` below reads `getLimitMinutes()` fresh on every
  // render — this setter exists purely to force that re-render after a write (chip, Stepper, reset).
  const [, setLimit] = useState<string>(() => String(getLimitMinutes()))
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
  useEffect(() => {
    // Task 14 fix: StrictMode's dev-only mount→cleanup→remount cycle used to run just the
    // cleanup below on its first pass, latching `.current` to `false` for the component's real,
    // lasting mount too — silently dropping every `setRemoteStats` call forever (confirmed live:
    // the panel's fetches all resolve, correctly, over the real network, and the DOM simply never
    // updates). Setting it back to `true` here — the standard fix for exactly this StrictMode
    // shape — is what makes the SECOND (real) mount's cleanup the one that actually matters.
    remoteStatsMounted.current = true
    return () => { remoteStatsMounted.current = false }
  }, [])

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

  /** R19/decision 27 — read once at mount, the same test `recordingsOpen` used before it: 14 days
   * from `md:`/`ipad:` up, 7 on a phone. The chart's own "7 · 14" switch (`md:` up only) can move
   * it either way after that; this is only ever the starting point. */
  const [chartRange, setChartRange] = useState<7 | 14>(
    () => (window.matchMedia?.('(min-width: 768px)').matches ? 14 : 7),
  )
  /** decision 28 — which weak-sound chip's tip is pinned open on a phone; `null` until a chip is
   * tapped. From `md:` up the first chip's tip shows regardless of this (see `isWide` below). */
  const [openTip, setOpenTip] = useState<string | null>(null)
  /** Task 14 — the recordings panel's own `defaultOpen`, read once at mount exactly like
   * `chartRange` above: open from `md:`/`ipad:` up, folded on a phone. `Panel`'s own toggle owns
   * everything after that; this is only ever the starting point. */
  const [recordingsOpen] = useState(() => window.matchMedia?.('(min-width: 768px)').matches ?? false)

  const { events, now } = snapshot
  const days = minutesPerDay(14, now, events)
  const todayKey = days[days.length - 1]?.day
  const limitMinutes = getLimitMinutes()
  // R23 — a value the three presets don't cover must still read as CHOSEN, not as if the parent's
  // limit went unheard: the fourth seg lights up instead of leaving all four dark.
  const isCustom = !(LIMIT_CHIPS as readonly number[]).includes(limitMinutes)
  const limitSegs: Seg[] = [
    ...LIMIT_CHIPS.map(n => ({
      key: String(n), label: `${n}'`, tone: limitMinutes === n ? 'on' : 'off',
      onClick: () => handleLimitStep(n),
    }) as const),
    {
      key: 'custom',
      label: isCustom ? `Tuỳ chỉnh ${limitMinutes}'` : 'Tuỳ chỉnh',
      tone: isCustom ? 'on' : 'off',
      onClick: () => handleLimitStep(limitMinutes),
    },
  ]
  const bandAuto = band.mode === 'auto'
  // R24 — auto picking the current band is a RESULT the parent reads, not a choice they made: it
  // gets its own third tone (`dim`), never `on` alongside "Tự động" (decision 34).
  const lessonSegs: Seg[] = [
    { key: 'auto', label: 'Tự động', tone: bandAuto ? 'on' : 'off', onClick: handleBandAuto },
    ...BAND_VALUES.map(n => ({
      key: String(n),
      label: String(n),
      ariaLabel: `Bậc ${n}`,
      tone: bandAuto ? (band.value === n ? 'dim' : 'off') : (band.value === n ? 'on' : 'off'),
      onClick: () => handleBandClick(n),
    }) as const),
  ]
  const lengthSegs: Seg[] = LESSON_LENGTHS.map(value => ({
    key: value,
    label: LENGTH_LABEL[value],
    tone: length === value ? 'on' : 'off',
    onClick: () => handleLengthClick(value),
  }) as const)
  const weekMinutes = minutesPerDay(7, now, events).reduce((sum, d) => sum + d.minutes, 0)
  const averages = averageScoreByKind(events)
  const kindAverages = Object.values(averages).filter((v): v is number => v != null)
  const avgScoreLabel = kindAverages.length
    ? String(Math.round(kindAverages.reduce((sum, v) => sum + v, 0) / kindAverages.length))
    : '—'
  const weak = weakPhonemes(5, events)
  // `MinutesChart` reads "empty" from an empty `days` array, not from every entry reading zero —
  // `minutesPerDay` always hands back `chartRange` zero-filled rows, so a genuinely empty log has
  // to be spelled `[]` here, or the chart would draw fourteen 4%-floor bars instead of its dashed
  // empty box.
  const chartDays = events.length === 0 ? [] : days
  const rangeDays = days.slice(-chartRange)
  const avgPerDay = rangeDays.length
    ? (rangeDays.reduce((sum, d) => sum + d.minutes, 0) / rangeDays.length).toFixed(1).replace('.', ',')
    : '0'
  // Same question `chartRange`'s own mount-time read answers ("is this a phone"), but re-read on
  // every render rather than pinned to a third state — a parent toggling the chart's 7/14 switch
  // must not silently hide the first chip's tip underneath it.
  const isWide = window.matchMedia?.('(min-width: 768px)').matches ?? false

  useEffect(() => {
    let cancelled = false
    listRecordings().then(list => {
      if (!cancelled) setRecordings(list)
    })
    return () => { cancelled = true }
  }, [snapshot])

  /**
   * R22 — the old `playBlob(...).catch(() => {})` swallowed every failure: a parent tapped ▶ and
   * nothing happened, with no sentence anywhere saying why. A failed play is now a red row with
   * words, not silence.
   */
  function handlePlay(r: Recording) {
    setPlayErrorId(null)
    setPlayingId(r.id)
    playBlob(r.blob).then(() => setPlayingId(null)).catch(() => { setPlayingId(null); setPlayErrorId(r.id) })
  }

  /** The "Thử lại" action on an errored remote row — a fresh fetch for just that one profile,
   * without touching `fetchedRemoteIds` (that bookkeeping only guards the mount-time effect
   * against re-fetching an id it already asked for; a parent's own retry bypasses it directly).
   * Clearing the entry first drops the row back to its loading skeleton for the span of the retry. */
  function handleRetryRemote(id: string) {
    setRemoteStats(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    void fetchRemoteStats(id).then(stats => {
      if (remoteStatsMounted.current) setRemoteStats(prev => ({ ...prev, [id]: stats }))
    })
  }

  /** "Chi tiết" — the numbers a squeezed one-line `sub` had no room for, in the one dialog surface
   * this screen already has (decision 31: no new surface for this). */
  function handleRemoteDetail(p: Profile, entry: RemoteStats) {
    void dialog.confirm({
      title: p.name,
      body: remoteDetailBody(entry),
      // M2 — the two buttons had the SAME name ("Đóng"/"Đóng"), which reads as a choice that is not
      // one and gives a screen reader two identically-named controls. This dialog has nothing to
      // confirm: "Xong" closes it, "Đóng" closes it, and `Dialog` may not lose its cancel button
      // (decision 16 — it gains `placeholder?` and nothing else).
      confirmLabel: 'Xong',
      cancelLabel: 'Đóng',
    })
  }

  /** R23 / decision 6 — the one write path left for the daily limit now that the number input is
   * gone: every preset chip, the fourth "Tuỳ chỉnh" seg (re-applying the current value, a no-op),
   * and `Stepper`'s ±5 all funnel through here. */
  function handleLimitStep(n: number) {
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
    // R27 / decision 33: TWO titles, not one title with two bodies. The old wording asked "Xoá
    // toàn bộ tiến trình của bé?" even when there was no other backup to lose — a question bigger
    // than the actual deed. An account not actually linked has nothing remote to lose either way,
    // so it gets the smaller question and the smaller answer.
    const unlinked = !(cloudAvailable && activeId && linked)
    setResetBusy(true)
    // The clearing and the mirror call both live inside `onConfirm`: the dialog stays open and
    // busy (buttons disabled, confirm label "…", scrim/Escape ignored) for exactly as long as
    // this callback runs, and only resolves — closing itself — once it settles. Nothing here
    // depends on the dialog's own resolved value; if the parent cancels, `onConfirm` never runs
    // and none of this fires, which is the whole of the "dismissed" behaviour.
    await dialog.destructive({
      title: unlinked ? 'Xoá tiến trình trên máy này?' : 'Xoá toàn bộ tiến trình của bé?',
      body: unlinked
        ? 'Sao, chuỗi ngày và bản ghi trên máy này sẽ mất. Tài khoản chưa liên kết nên không có bản lưu nào khác.'
        : 'Xoá trên máy này VÀ trên tài khoản đã liên kết. Không khôi phục được — kể cả bằng mã khôi phục.',
      confirmLabel: unlinked ? 'Xoá trên máy này' : 'Xoá tất cả',
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

  // `AccountCard`'s own forms call `e.preventDefault()` themselves before invoking these — Task 4's
  // contract keeps them presentational, so the event never travels this far.
  async function handleSendOtp() {
    setLinkBusy(true)
    setLinkError(null)
    const result = await linkEmail(linkEmailValue)
    setLinkBusy(false)
    if (!result.ok) { setLinkError(describeAuthError(result.error)); return }
    setLinkStage('otp')
  }

  async function handleVerifyOtp() {
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

  /** ② "Thử kết nối" — re-runs the same bootstrap `main.tsx` fires at launch (idempotent, per its
   * own doc comment), then re-reads the three auth facts exactly as the mount effect above does, so
   * a device that just came back online (or whose first attempt raced the network) can reach a
   * session without a full reload. */
  async function handleRetryConnect() {
    await connectCloud()
    const [em, anon, userId] = await Promise.all([currentEmail(), isAnonymous(), currentUserId()])
    setEmail(em)
    setHasSession(userId !== null)
    setAuthReady(true)
    if (anon) {
      const code = await ensureRecoveryCode()
      setRecoveryCode(code)
    }
  }

  async function handleSignOut() {
    if (signOutBusy) return
    setSignOutBusy(true)
    // Same shape as `handleReset`: the actual work is `onConfirm`, so the dialog stays open and
    // busy for exactly as long as `signOut()` takes, and closes itself once it settles.
    await dialog.confirm({
      title: 'Đăng xuất tài khoản?',
      body: `Bé vẫn học được. Tiến độ mới sẽ chỉ lưu trên máy này cho tới khi liên kết lại.${sync.pending > 0 ? ` ${sync.pending} mục chưa đồng bộ sẽ được gửi trước.` : ''}`,
      confirmLabel: 'Đăng xuất',
      onConfirm: async () => {
        setSigningOut(true)
        const result = await signOut()
        // Signing out leaves this device with NO session, which is the third state above — not
        // an anonymous one. Saying otherwise is what drew a link form that could not work.
        if (result.ok) { setEmail(null); setHasSession(false) }
      },
    })
    setSigningOut(false)
    setSignOutBusy(false)
  }

  async function handleAddProfile() {
    const name = await dialog.prompt({ title: 'Thêm hồ sơ mới', label: 'Tên của bé', placeholder: 'Ví dụ: Bé Su', maxLength: NAME_MAX })
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

  /** Task 11: one row per profile now (not just the active one), so this renames whichever row's
   * "Đổi tên" was tapped — `id`, not `activeId`. */
  async function handleRenameProfile(id: string) {
    const current = profiles.find(p => p.id === id)
    if (!current) return
    const name = await dialog.prompt({ title: 'Đổi tên hồ sơ', label: 'Tên của bé', placeholder: 'Ví dụ: Bé Su', initial: current.name, maxLength: NAME_MAX })
    if (name === null || !name.trim()) return
    setProfiles(renameProfile(current.id, name))
    if (cloudAvailable) void renameRemoteProfile(current.id, name)
  }

  function handleSwitchProfile(id: string) {
    if (id === activeId) return
    switchProfile(id)
  }

  /**
   * `AccountCard`'s eleven states (Task 4), derived here rather than owned by it — the component
   * stays presentational, and every fact it needs already lives in this screen's own state.
   */
  const accountState: AccountState =
    !authReady ? { kind: 'loading' }
    : !hasSession ? { kind: 'noSession', online: online() }
    // M8 — `linkStage !== 'otp'`: a sync error arriving while the parent is typing the code they
    // were just emailed used to replace the whole OTP form with state ⑩, taking the typed digits
    // with it. The error is not lost — the panel header's `SyncPill` shows it throughout — it just
    // no longer evicts a form the parent is mid-way through.
    : sync.lastError && linkStage !== 'otp' ? { kind: 'syncError', email, pending: sync.pending }
    : linked ? { kind: 'linked', email: email!, signingOut, pending: sync.pending }
    : linkStage === 'otp' ? { kind: 'otp', email: linkEmailValue, otp: linkOtp, busy: linkBusy, error: linkError ?? undefined }
    : { kind: 'link', email: linkEmailValue, busy: linkBusy, error: linkError ?? undefined }

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
            right={<SyncPill status={sync} hasSession={hasSession} size="md" onRetry={() => { void flush() }} />}
          >
            {/* Fix round 1 (decision 14): the h32 pill moved to this `Panel`'s header row via
              * `right` above — `AccountCard` no longer draws its own copy (`showPill={false}`), so
              * exactly one `data-testid="sync-status"` renders for this panel, aligned with the
              * "Tài khoản" title instead of sitting on its own row inside the card body. */}
            <div
              data-testid="account-columns"
              className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
            >
              <AccountCard
                state={accountState}
                sync={sync}
                hasSession={hasSession}
                showPill={false}
                recoveryCode={recoveryCode}
                onEmailChange={setLinkEmailValue}
                onOtpChange={setLinkOtp}
                onSendOtp={() => { void handleSendOtp() }}
                onVerifyOtp={() => { void handleVerifyOtp() }}
                onEditEmail={handleEditLinkEmail}
                onSignOut={() => { void handleSignOut() }}
                onRetryConnect={() => { void handleRetryConnect() }}
                onRetrySync={() => { void flush() }}
              />

              <div
                data-testid="profile-column"
                className="flex min-w-0 flex-col gap-1.5 md:border-l-2 md:border-line-200 md:pl-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-extrabold text-ink-900">Hồ sơ · {profiles.length}</h3>
                  <button
                    type="button"
                    onClick={() => { void handleAddProfile() }}
                    className="relative h-8 shrink-0 rounded-r10 bg-teal-50 px-2.5 text-[12px] font-extrabold text-teal-600 after:absolute after:-inset-2 after:content-['']"
                  >
                    + Thêm hồ sơ
                  </button>
                </div>

                {/* The roster can be unreadable — a half-written value this app now refuses to write
                  * over — and `speakup.profile` can be unset, in which case the device is reading the
                  * legacy namespace. Both used to render as an empty string directly beside
                  * "+ Thêm hồ sơ", which is the worst possible pairing: a parent who sees a blank
                  * name taps the button, and that button is the one that writes the roster. */}
                {!activeProfileEntry ? (
                  <Notice
                    kind="warn"
                    adult
                    testId="profile-unreadable"
                    title="Chưa đọc được danh sách hồ sơ trên máy này. Tiến độ của bé vẫn đang được lưu bình thường — mở lại ứng dụng để kiểm tra, và tạm thời đừng thêm hồ sơ mới."
                  />
                ) : (
                  <div className="flex flex-col">
                    {profiles.map(p => (
                      <div
                        key={p.id}
                        data-testid="profile-row"
                        className="flex min-h-[40px] items-center gap-2 border-b border-line-200"
                      >
                        <span aria-hidden className="text-[20px] leading-none">{p.avatar}</span>
                        <span className="flex min-w-0 flex-1 flex-col justify-center">
                          <span
                            className="block truncate text-[13px] font-extrabold text-ink-900"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          {p.id === activeId && (
                            <span className="block truncate text-[11px] text-ink-300">đang dùng máy này</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => { void handleRenameProfile(p.id) }}
                          className="h-8 shrink-0 px-2 text-[12px] font-extrabold text-ink-500 underline relative after:absolute after:-inset-2 after:content-['']"
                        >
                          Đổi tên
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {profileNotice && (
                  <div className="mt-2">
                    <Notice kind="error" adult testId="profile-notice" title={profileNotice} />
                  </div>
                )}
                {profiles.length > 1 && (
                  <div className="mt-2">
                    <ProfilePicker profiles={profiles} activeId={activeId} onSelect={handleSwitchProfile} density="grid" footer={false} />
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
            </div>
          </Panel>
        )}

        <Panel
          title={`Phút luyện · ${chartRange} ngày`}
          right={
            chartDays.length > 0
              ? <span className="text-[11px] font-bold text-ink-300">TB {avgPerDay}'/ngày</span>
              : undefined
          }
        >
          <MinutesChart days={chartDays} limitMinutes={limitMinutes} range={chartRange} onRangeChange={setChartRange} todayKey={todayKey} />
        </Panel>

        <Panel testId="averages-panel" title="Điểm trung bình">
          <div data-testid="averages-grid" className="grid grid-cols-4 gap-1.5 md:gap-2">
            {(['speak', 'word', 'sentence', 'story'] as const).map(kind => (
              <div key={kind} data-testid="average-tile" className="flex flex-col items-center rounded-r12 bg-cream-50 px-1 py-2 md:px-2 md:py-2.5">
                <span className="text-[10px] text-ink-300 md:text-[11px]">{KIND_LABEL[kind]}</span>
                {/* Ô "Truyện" luôn "—": StoryQuiz.tsx:90 ghi event không kèm score (kiểm ở Task 3 Step 0). Artboard vẽ đúng như vậy — không hứa một con số không tồn tại. */}
                <span className="font-display text-[20px] font-extrabold text-ink-900 md:text-[24px]">
                  {averages[kind] != null ? Math.round(averages[kind]!) : '—'}
                </span>
              </div>
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
            <div data-testid="weak-list" className="flex flex-wrap gap-1.5">
              {weak.map((w, i) => (
                <div key={w.phoneme} className="flex flex-col gap-1.5">
                  <button
                    data-testid="weak-chip"
                    type="button"
                    aria-expanded={openTip === w.phoneme}
                    onClick={() => setOpenTip(t => (t === w.phoneme ? null : w.phoneme))}
                    // I3: 36px visible, 44px tapped — `after:-inset-1` is the hit band the adult
                    // rule requires of every control under 44 (same idiom as "+ Thêm hồ sơ",
                    // "Đổi tên", the Stepper and the RemoteRow action).
                    className={`relative inline-flex h-9 items-center whitespace-nowrap rounded-r12 px-3 font-display text-[13px] font-extrabold after:absolute after:-inset-1 after:content-[''] ${CHIP(w.avg)}`}
                  >
                    /{w.phoneme}/ · {Math.round(w.avg)} ({w.count} lần)
                  </button>
                  {/* Phone: the tip stays reachable — a tap on the chip toggles it (decision 28) —
                      instead of vanishing below `md:` the way the old `hidden … md:block` paragraph
                      did. From `md:` up the first chip's tip is shown without asking, same as the
                      artboard. */}
                  {PHONEME_TIPS[w.phoneme] && (openTip === w.phoneme || (i === 0 && isWide)) && (
                    <p data-testid="weak-tip" className="rounded-r10 bg-[#FFF6E0] px-2.5 py-2 text-[12px] font-bold leading-[1.45] text-sun-700">
                      {PHONEME_TIPS[w.phoneme]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          testId="limit-panel"
          title="⏰ Giới hạn mỗi ngày"
          collapsible
          right={
            <span className="text-[12px] font-extrabold text-teal-600">
              Hôm nay: {minutesToday(now, events)}/{limitMinutes}'
            </span>
          }
        >
          <SegRow segs={limitSegs} />
          <Stepper value={limitMinutes} onChange={handleLimitStep} label="Tuỳ chỉnh" />
        </Panel>

        <Panel
          testId="lesson-panel"
          title="Bài học"
          collapsible
          right={
            <span className="text-[12px] font-bold text-ink-500">
              {bandAuto ? 'Tự động' : `Bậc ${band.value}`} · {LENGTH_LABEL[length]}
            </span>
          }
        >
          <span className="mb-2 block text-xs font-bold text-ink-500 md:text-sm">Độ khó</span>
          <SegRow segs={lessonSegs} />
          {/* R24 — auto ON means the current band is a RESULT, not a choice: the dim seg above
            * says which by tone, and this line says it in words too, for the segs it dims. */}
          {bandAuto && (
            <p className="mt-2 text-[11px] font-bold text-ink-300">
              Tự động đang chọn → bậc hiện tại ⭐ {band.value}
            </p>
          )}

          <span className="mb-2 mt-4 block text-xs font-bold text-ink-500 md:text-sm">Độ dài nhiệm vụ</span>
          <SegRow segs={lengthSegs} />

          {/* Today's lesson is generated once and then frozen, so a change made now shows up
            * tomorrow — without this line the buttons look broken. */}
          <p className="mt-3 text-xs font-semibold text-ink-500 md:text-sm">Áp dụng từ bài học ngày mai.</p>
        </Panel>

        <Panel
          testId="recordings-panel"
          title={`Bản ghi gần đây · ${recordings.length}`}
          collapsible
          defaultOpen={recordingsOpen}
        >
          {recordings.length === 0 ? (
            <EmptyState
              adult
              emoji="🎙️"
              title="Chưa có bản ghi nào"
              sub="Bản ghi xuất hiện sau khi bé luyện nói."
            />
          ) : (
            <>
              <div className="flex flex-col">
                {recordings.slice(0, recordingsExpanded ? recordings.length : 5).map(r => (
                  <RecordingRow
                    key={r.id}
                    ts={r.ts}
                    text={r.text}
                    score={r.score}
                    playing={playingId === r.id}
                    error={playErrorId === r.id}
                    onPlay={() => handlePlay(r)}
                  />
                ))}
              </div>
              {/* Q18 (đã chốt: giữ) / decision 30 — 5 hàng mặc định, mở rộng TẠI CHỖ, không dialog. */}
              {recordings.length > 5 && !recordingsExpanded && (
                <button
                  type="button"
                  onClick={() => setRecordingsExpanded(true)}
                  className="h-11 text-[12px] font-extrabold text-teal-600 underline"
                >
                  Xem tất cả {recordings.length} bản ghi ▾
                </button>
              )}
            </>
          )}
        </Panel>

        {/* Flow 5: read-only progress from another device, computed with the same queries
          * (`progress/activity.ts`) the numbers above use on local data. This panel is always in
          * the grid whenever the account is; which of the three bodies below shows is the only
          * thing that varies — an unread server ("unknown") must never look like "no remote
          * profiles" (the whole reason it is its own branch), and an idle read (no profile to
          * compare against yet) prints nothing more than the title. */}
        {cloudAvailable && (
          <Panel
            title="Tiến độ từ xa"
            col="full"
            right={
              remoteViewOn
                ? <span className="h-8 rounded-r10 bg-teal-50 px-2.5 text-[12px] font-extrabold leading-8 text-teal-600">👁 Đang xem</span>
                : undefined
            }
          >
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
                <div className="flex flex-col">
                  {remoteProfilesToShow.map(p => {
                    const loaded = p.id in remoteStats

                    // While the stats haven't loaded, the skeleton IS the row — see R18's own
                    // fix note on the old two-stacked-cards look. `RemoteRow` itself only ever
                    // draws the skeleton for `state === 'loading'` with no `remote-row` wrapper
                    // (there is nothing to click yet), so this one state gets its own — every
                    // OTHER state's wrapper comes from `RemoteRow` itself, below.
                    if (!loaded) {
                      return (
                        <div key={p.id} data-testid="remote-row">
                          <RemoteRowSkeleton />
                        </div>
                      )
                    }
                    // Only reached once `p.id in remoteStats` is true, so this is a real recorded
                    // fetch result — `RemoteStats | null`, never `undefined`, despite the index
                    // signature's own wider type.
                    const entry = remoteStats[p.id]

                    const state: RemoteRowState =
                      entry === null ? 'error'
                      : entry.eventCount === 0 ? 'empty'
                      // decided by the clock, not by a flag — `updatedAt` is `fetchRemoteStats`'s
                      // own newest-event `ts` (`cloud/remote.ts`), `undefined` only when there are
                      // no events, which `eventCount === 0` already caught above.
                      : entry.updatedAt != null && now - entry.updatedAt > 7 * DAY_MS ? 'stale'
                      : p.id === activeId ? 'thisDevice'
                      : 'data'

                    const name = state === 'thisDevice' ? `${p.name} · máy này` : p.name
                    const sub =
                      state === 'error' ? 'Không tải được — kiểm tra mạng.'
                      : state === 'empty' ? 'Chưa có dữ liệu trên máy chủ.'
                      : state === 'stale' ? composeStaleSub(entry!, now, entry!.updatedAt!)
                      : composeRemoteSub(entry!)

                    const onAction =
                      state === 'error' ? () => handleRetryRemote(p.id)
                      : state === 'empty' ? undefined
                      : () => handleRemoteDetail(p, entry!)

                    return <RemoteRow key={p.id} name={name} sub={sub} state={state} onAction={onAction} />
                  })}
                </div>
                {/* R18 — the sync caveat lives here ONCE, never repeated per row. */}
                <p className="mt-2 text-xs font-semibold text-ink-300">
                  Bản ghi giọng nói của bé không đồng bộ — chỉ nghe được trên máy đã ghi.
                </p>
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
