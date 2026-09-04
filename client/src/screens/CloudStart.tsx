import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { currentAccessToken, currentEmail, signInWithEmail, verifyEmailOtp } from '../cloud/auth'
import type { Profile } from '../cloud/profileState'
import { activeProfileId, adoptProfiles, dropProfile, fetchRemoteProfiles, listProfiles, rosterIsReadable, switchProfile } from '../cloud/profileState'
import { hasMirroredData, pullProfile } from '../cloud/sync'
import { isCloudConfigured } from '../cloud/supabase'
import { hasAnyHistory, profileHistory, sumHistory } from '../progress/history'
import { ProfilePicker } from '../components/ProfilePicker'
import { ParentQuestion } from '../components/ParentQuestion'
import { BackButton, Button, GateBlobs, GateCard, LinkText, Notice } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { FieldRow, FIELD_INPUT, FIELD_INPUT_CODE, FIELD_INPUT_ERROR } from '../components/adult'

/**
 * The start screen's other door (spec flows 3 and 4): "Đã dùng Speak Up rồi?" — for a device whose
 * cache was wiped, or that is simply new. Two ways in, both ending the same way: the profiles the
 * account owns are merged into this device's roster, one is chosen, and its data is pulled down.
 *
 * **The menu is readable without the math gate; the two doors are not.** Home only offers this
 * screen on a device with no history at all, but the route is still typeable, and both doors do
 * something a child must never do by accident: the email door can hand this iPad to a different
 * account, and the recovery code re-parents somebody's profiles onto it. So the question sits in
 * front of the forms, not in front of the page (§Rules: child screens never show auth concepts —
 * a menu of two buttons is the least this can be while still being reachable at all).
 *
 * **`{ abandonAnonymous: true }` is never passed on spec.** The contract in `cloud/auth.ts` is that
 * this screen only passes it once the parent has said, in Vietnamese and in as many words, that
 * this iPad's progress is not the progress they are after — so the sign-in is attempted WITHOUT it
 * first and the guard is allowed to answer. What happens next depends on what the ACCOUNT is
 * actually holding, which is read rather than assumed and is read across every child, not just the
 * one using the iPad: nothing anywhere (the empty profile `ensureLocalProfile` minted seconds ago
 * being the only thing under this owner) continues silently, and anything real stops and asks.
 * See `assessStranding` and `handleSendEmail`.
 */

type Stage = 'menu' | 'gate' | 'email' | 'email-otp' | 'code' | 'abandon' | 'result'
type Door = 'email' | 'code'

/**
 * What the ACCOUNT on this device would be left holding, unreachably, after signing in elsewhere.
 *
 * Two shapes, because there are two different reasons to stop and only one of them has numbers.
 * `unchecked` is not "nothing found" — it is "could not find out", and for a one-way action those
 * must never collapse into the same answer.
 */
type Stranding =
  | { kind: 'holding'; profiles: number; stars: number; events: number; mirrored: boolean }
  | { kind: 'unchecked' }

/** Round-4 wording (R10 / brief §2 "14 câu lỗi"). Signature and the seven identifying branches are
 * unchanged from before this pass — only the sentence each branch returns — so callers and tests
 * that key off the CODE rather than the copy keep working. */
export function describeAuthError(code: string): string {
  const lower = code.toLowerCase()
  if (code === 'invalid-email') return 'Email chưa đúng định dạng.'
  if (code === 'cloud-unconfigured') return 'Tính năng tài khoản chưa bật trên bản này.'
  // Never "thử lại": a retry reproduces this exactly. The way out is the parent screen, where the
  // email is linked to the account this device already has instead of replacing it.
  if (code === 'anonymous-session-in-use') {
    return 'Máy này đang có hồ sơ của tài khoản khác — đăng xuất ở Góc phụ huynh trước.'
  }
  // The honest answer to "Tôi có email đã liên kết" when it turns out this one is not linked. It
  // must never read as a network hiccup: the parent has to try their other address, or the
  // recovery code, rather than the same email again.
  if (code === 'email-not-linked') {
    return 'Email này chưa liên kết với Speak Up — thử mã khôi phục.'
  }
  if (code === 'invalid-token' || /invalid|expired|not\s*found/.test(lower)) {
    return 'Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.'
  }
  if (/network|fetch/.test(lower)) return 'Mất kết nối — kiểm tra mạng rồi thử lại.'
  return 'Có lỗi xảy ra — thử lại sau ít phút.'
}

export function describeRecoverError(status: number): string {
  if (status === 400) return 'Mã phải đủ 8 chữ và số.'
  if (status === 401) return 'Mã không đúng — kiểm tra lại chữ O và số 0.'
  if (status === 403) return 'Mã này thuộc tài khoản khác đang dùng máy này.'
  if (status === 404) return 'Không tìm thấy mã — có thể đã được thay mã mới.'
  if (status === 409) return 'Mã đã dùng trên máy khác — tạo mã mới ở máy đó.'
  if (status === 429) return 'Thử quá nhiều lần — đợi 5 phút rồi thử lại.'
  return 'Không kết nối được máy chủ — thử lại sau.'
}

/** R10 / quyết định 22. Bốn nguồn khác nhau, một hậu quả: chưa nói chuyện được với máy chủ và
 * KHÔNG có gì bị tiêu — `afterAuthenticated` (fetchRemoteProfiles null), `finishRestore` (pull
 * hỏng), `attemptRecover` (chưa có token / fetch ném). Một câu + một nút "Thử lại" trong dải lỗi là
 * đủ; bốn câu khác nhau cho cùng một hành động chỉ làm phụ huynh đoán xem cái nào là lỗi của họ.
 * KHÔNG gộp hai câu "roster không đọc được" (`afterAuthenticated`'s `merged === null`,
 * `attemptRecover`'s `!rosterIsReadable()`): đó là hậu quả khác hẳn — mã/hồ sơ KHÔNG được dùng, và
 * câu phải nói ra điều đó. Gộp 4, không gộp 6. */
const SYSTEM_ERROR = 'Không kết nối được máy chủ — thử lại sau'

/** R11 / quyết định 23. Four sentences, one per `Stranding` shape — shortened from the three-`<p>`
 * essay this used to be, and the email moves out of the button label into this line instead (see
 * the abandon stage body). The zero-count sentence never mentions `mirrored`: whichever path got a
 * profile counted with nothing local to show for it, the parent only needs to know there is
 * nothing to lose by replacing it right now. */
function abandonCopy(s: Stranding): string {
  if (s.kind === 'unchecked') return 'Không đọc được dữ liệu trên máy này. Vẫn tiếp tục?'
  if (s.stars === 0 && s.events === 0) return `Máy này có ${s.profiles} hồ sơ nhưng chưa học gì — thay được ngay.`
  const base = `${s.profiles} hồ sơ, ${s.stars} sao và ${s.events} lượt luyện trên máy này sẽ bị thay`
  return s.mirrored ? `${base} — một phần đã lưu lên máy chủ, có thể lấy lại sau.` : `${base}.`
}

/**
 * What signing in as another account would strand — or null ONLY when that has been established.
 *
 * **The question is what the ACCOUNT loses, not what the device loses**, and the difference is a
 * whole child. Every profile on this iPad belongs to the same anonymous owner, so the first version
 * of this — `totalStars()`, `getActivity()`, `hasMirroredData(activeProfileId())`, all three
 * resolving through the ACTIVE namespace — was blind to a sibling. That is not a corner: flow 6's
 * picker makes "hand the iPad to the other child" a one-tap everyday action, and the empty child's
 * Home is where the restore link appears.
 *
 * **A profile the account owns is evidence by itself.** Local history and local `mirrored` meta are
 * both things this device happens to remember, and neither survives the ordinary sequence that gets
 * a family here: a recovery restores a child into the roster, the pull fails on a blip, the parent
 * backs out and tries the email door instead. That child has rows on the server, a row in the
 * roster, and nothing else — invisible to any check that asks the device what it remembers. The row
 * itself is the fact that cannot be lost, so the row is what is counted. The one exception is the
 * empty profile this device minted seconds ago, which is what flow 3 exists to replace.
 *
 * **And an answer that could not be obtained is not an empty answer.** `fetchRemoteProfiles()`
 * returns null when the read failed, which on a live session means stop and ask — the parent can
 * still say yes, but they say it knowing nobody checked. Three rounds of review found this same
 * class of narrowing three times, always in the same direction: a silent "I could not see it"
 * reported as "there is nothing there".
 *
 * A device whose parent has ALREADY linked an email is not at risk — signing in there is the same
 * account or a deliberate second one, and the guard in `auth.ts` never fires for it either.
 */
async function assessStranding(mintedId: string | null): Promise<Stranding | null> {
  if (await currentEmail()) return null

  const owned = await fetchRemoteProfiles()
  // Unknown, on a session that exists: the account may be holding anything at all.
  if (owned === null) return { kind: 'unchecked' }

  const ids = new Set<string | null>(listProfiles().map(p => p.id))
  ids.add(activeProfileId())
  // **Always**, not only when the roster is empty. The legacy, un-namespaced keys are where a
  // device's whole progress sits when `ensureLocalProfile()` wrote the roster and then could not
  // write `speakup.profile` — it returns early there, deliberately, so the app keeps reading the
  // pre-Phase-11 keys rather than a namespace nothing migrated into. Roster present, no active
  // profile, every star under `speakup.*`: gating this read on an empty roster missed exactly that
  // device, and `profileHistory(null)` on a migrated one is two `getItem`s that return zero.
  ids.add(null)
  for (const p of owned) ids.add(p.id)

  const ownedIds = new Set(owned.map(p => p.id))
  let profiles = 0
  let mirrored = false
  for (const id of ids) {
    const ownedRemotely = id !== null && id !== mintedId && ownedIds.has(id)
    const mirroredHere = id !== null && hasMirroredData(id)
    if (hasAnyHistory(profileHistory(id)) || mirroredHere || ownedRemotely) profiles++
    mirrored ||= mirroredHere || ownedRemotely
  }

  const { stars, events } = sumHistory([...ids])
  return profiles > 0 || mirrored ? { kind: 'holding', profiles, stars, events, mirrored } : null
}

export function CloudStart() {
  // Every hook below is called on every render, cloud or not — `isCloudConfigured()` cannot change
  // within a session, but the Rules of Hooks apply to the code, not to the value. The early return
  // sits after them instead.
  const [stage, setStage] = useState<Stage>('menu')
  const [door, setDoor] = useState<Door>('email')
  // One question per visit, not one per door: it is there to stop an accidental tap, and a grown-up
  // who has just answered it is still the one holding the iPad.
  const [passedGate, setPassedGate] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The retry for whichever `SYSTEM_ERROR` is currently showing — re-runs the exact step that
   * failed, without spending the code/token again. `null` whenever `error` is not one of the four
   * merged system failures (R10 / quyết định 22). */
  const [errorAction, setErrorAction] = useState<(() => void) | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [stranding, setStranding] = useState<Stranding | null>(null)
  /** The child a failed pull left un-restored, so the parent can try that same one again. */
  const [retryId, setRetryId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Profile[] | null>(null)
  /** The candidate currently being pulled from the picker — its cell spins in place of the fox
   * (`ProfilePicker`'s `pendingId`), separate from `retryId`, which only ever names the single
   * auto-restored child that landed on the `'result'` stage. */
  const [pickingId, setPickingId] = useState<string | null>(null)
  const navigate = useNavigate()

  /**
   * The profile this device minted for itself, if it is still empty (F4).
   *
   * `connectCloud()` has already given that profile a row under the current anonymous user, and
   * `/api/recover` re-parents the restored profiles onto that same user — so the picker below would
   * otherwise offer it as a restore target beside the real child, both rendered as the identical
   * "🦊 Bé". Read once, on mount, before anything is adopted or pulled.
   */
  const [mintedId] = useState<string | null>(() => {
    const id = activeProfileId()
    if (!id) return null
    return hasAnyHistory(profileHistory(id)) ? null : id
  })

  // A build with no cloud has nothing for this screen to do — a direct link (bookmarked, typed by
  // hand) lands back on Home rather than showing a form that can never succeed.
  if (!isCloudConfigured()) return <Navigate to="/" replace />

  function backToMenu() {
    setStage('menu')
    setError(null)
    setErrorAction(null)
    setOtp('')
    setCode('')
    setStranding(null)
    // Task 9: `info`/`retryId` are now read only inside the `'result'` stage's own body, so
    // leaving either set would resurface a stale system message the next time this screen shows
    // one — a card that has moved on must not still be carrying the previous failure.
    setInfo(null)
    setRetryId(null)
  }

  function openDoor(which: Door) {
    setError(null)
    setErrorAction(null)
    setInfo(null)
    setDoor(which)
    setStage(passedGate ? which : 'gate')
  }

  /** After either door finishes: the account's profiles are ready to be joined into this roster. */
  async function afterAuthenticated() {
    const remote = await fetchRemoteProfiles()
    // The same distinction the abandonment check turns on, and it matters just as much here: a read
    // that failed must never be announced as "this account has no profiles", which is the sentence
    // that tells a parent their child is gone.
    if (remote === null) {
      setError(SYSTEM_ERROR)
      setErrorAction(() => afterAuthenticated)
      setCandidates(null)
      setStage('menu')
      return
    }
    // Adopted BEFORE anything is pulled, and this order is a rule, not a preference: until the
    // roster names an id, `rescueOrphanNamespaces` reads the keys a pull writes as abandoned and
    // folds them into the active child. `pullProfile` refuses an id that is not in the roster.
    const merged = adoptProfiles(remote)
    // The same conflation as `fetchRemoteProfiles === null`, one module over: the roster on this
    // device is unreadable, so these children could not be joined onto it. Saying "this account has
    // no profiles" here would be a false sentence about the family's data, in front of a parent who
    // came to this screen because something had already gone missing once.
    if (merged === null) {
      setError('Chưa đọc được danh sách hồ sơ trên máy này, nên chưa ghép được hồ sơ của bé vào. Chưa có gì mất cả — mở lại ứng dụng rồi thử lại nhé.')
      setCandidates(null)
      setStage('menu')
      return
    }
    const remoteIds = new Set(remote.map(p => p.id))
    // The account's own profiles, minus the empty one this device minted moments ago: it IS owned
    // by this account (see `mintedId`), so ownership alone cannot tell them apart, and offering it
    // means offering a decoy that looks exactly like the child the parent came here to get back.
    const restorable = merged.filter(p => remoteIds.has(p.id) && p.id !== mintedId)

    if (restorable.length === 0) {
      // Task 9 / R8: its own `'result'` stage now, not a `Notice` rattling around on top of the
      // menu — the default title in that stage's body already says this.
      setCandidates(null)
      setStage('result')
      return
    }
    if (restorable.length === 1) {
      await finishRestore(restorable[0].id)
      return
    }
    setCandidates(restorable)
  }

  /**
   * Pull the chosen child down, then hand the device to them — **in that order, and only if the
   * pull worked**.
   *
   * The boolean used to be dropped. A pull that failed (a blip, a slow query) therefore ended in
   * `switchProfile`, which reloads into a profile whose namespace is empty: the parent sees the
   * child's name and none of their progress, concludes the restore failed, and goes looking for
   * another way in — which is how the account with the real data comes to be abandoned two screens
   * later. A restore that could not restore must say so and offer to try again, not present itself
   * as finished.
   */
  async function finishRestore(id: string) {
    setBusy(true)
    // Only meaningful for the multi-candidate picker — spins that one cell in place of its fox
    // while every other cell (and this one) is disabled underneath it.
    setPickingId(id)
    setError(null)
    setErrorAction(null)
    const pulled = await pullProfile(id)
    setBusy(false)
    setPickingId(null)
    if (!pulled) {
      setRetryId(id)
      setError(SYSTEM_ERROR)
      setErrorAction(() => () => { void finishRestore(id) })
      // Task 9 / R8: the single auto-restored candidate has no picker still on screen to report
      // next to — its failure gets the same `'result'` stage the "0 profiles" branch uses. A
      // failure from the MULTI-candidate picker below never reaches here: `candidates` stays set,
      // so the short-circuit return above keeps rendering that screen regardless of `stage`.
      setStage('result')
      return
    }
    setRetryId(null)
    // The placeholder this device minted on launch has done its job and must not outlive the
    // restore. Leaving it was reasoned about once and called harmless — before flow 6 wired the
    // app-start picker, which turned the roster from bookkeeping into a screen the CHILD reads:
    // two identical foxes every launch, one of them a namespace with no stars, no streak and an
    // empty Leitner set that teaches every word as new, mirrored up under its own server row where
    // nothing merges it back. A nine-year-old cannot pick a storage namespace by creation date.
    //
    // Safe by construction: `mintedId` is only ever non-null when that namespace has no history AND
    // both of its values were readable (`hasAnyHistory` counts `damaged` as history). Nothing is
    // deleted from disk either — a namespace the roster stops naming is folded into the active
    // child by the next launch's `rescueOrphanNamespaces`, not dropped.
    if (mintedId && mintedId !== id) dropProfile(mintedId)
    // Reloads by default — the one move that guarantees no screen still holds the previous
    // (empty) child's numbers in React state or a module cache. See `switchProfile`.
    switchProfile(id)
  }

  /**
   * Send the OTP — and settle the abandonment question first.
   *
   * The flag is never passed on the first attempt. The guard in `auth.ts` is what says whether this
   * device is holding an unlinked account with a child on it, and it is allowed to say so; only
   * then is the local state read, and only a device with genuinely nothing on it continues without
   * asking. Everything else stops at the confirmation below, which names what is being left behind.
   */
  async function sendOtp(abandonAnonymous: boolean) {
    setError(null)
    setErrorAction(null)
    setBusy(true)
    const result = await signInWithEmail(email, abandonAnonymous ? { abandonAnonymous } : {})
    if (result.ok) { setBusy(false); setStranding(null); setStage('email-otp'); return }
    if (result.error !== 'anonymous-session-in-use' || abandonAnonymous) {
      setBusy(false)
      setError(describeAuthError(result.error))
      return
    }

    const risk = await assessStranding(mintedId)
    if (risk) {
      setBusy(false)
      setStranding(risk)
      setStage('abandon')
      return
    }
    // Established, not assumed: the account owns exactly the empty profile this device minted on
    // launch, holds nothing else, and the server said so rather than failing to answer. That is the
    // ONE case where the flag may be passed without asking, and it is what flow 3 exists for.
    const retry = await signInWithEmail(email, { abandonAnonymous: true })
    setBusy(false)
    if (!retry.ok) { setError(describeAuthError(retry.error)); return }
    setStage('email-otp')
  }

  async function handleSendEmail(e: FormEvent) {
    e.preventDefault()
    await sendOtp(false)
  }

  async function handleVerifyEmail(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setErrorAction(null)
    setBusy(true)
    const result = await verifyEmailOtp(email, otp)
    if (!result.ok) { setBusy(false); setError(describeAuthError(result.error)); return }
    await afterAuthenticated()
    setBusy(false)
  }

  /**
   * The recovery-code submit, factored out from its form's `onSubmit` so the SAME attempt can be
   * re-run by the "Thử lại" action in the error band (R10 / quyết định 22) without spending the
   * code twice or asking the parent to retype it — the code itself is never cleared on failure.
   */
  async function attemptRecover() {
    setError(null)
    setErrorAction(null)
    setBusy(true)
    const token = await currentAccessToken()
    if (!token) {
      setBusy(false)
      setError(SYSTEM_ERROR)
      setErrorAction(() => attemptRecover)
      return
    }
    // Ask before spending: /api/recover burns the code and re-parents the profiles in one
    // server-side step, so a roster that cannot receive the result would cost the family their
    // only key — the retry answers 404, and nothing here repairs a damaged roster.
    if (!rosterIsReadable()) {
      setBusy(false)
      setError('Chưa đọc được danh sách hồ sơ trên máy này, nên chưa dùng mã được. Mã của bạn vẫn còn nguyên — đừng dùng nó ở đâu khác cho tới khi máy này đọc lại được.')
      return
    }
    let status: number
    try {
      const res = await fetch('/api/recover', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      })
      status = res.status
      if (!res.ok) { setBusy(false); setError(describeRecoverError(status)); return }
    } catch {
      setBusy(false)
      setError(SYSTEM_ERROR)
      setErrorAction(() => attemptRecover)
      return
    }
    await afterAuthenticated()
    setBusy(false)
  }

  async function handleRecover(e: FormEvent) {
    e.preventDefault()
    await attemptRecover()
  }

  // `email`/`email-otp`/`code` show their error in their own `FieldRow` gutter (`error` is passed
  // straight to each `FieldRow` below). `retryAction` is also read directly by the top-of-card
  // `Notice` further down, on the two stages (`menu`, `abandon`) that have no field of their own.
  const retryAction = errorAction ? { label: 'Thử lại', onClick: errorAction } : undefined

  if (candidates) {
    return (
      <PageShell>
        <PageBody center>
          <GateCard>
            <div>
              <h1 className="font-display text-[18px] font-extrabold text-ink-900">Chọn hồ sơ của bé</h1>
              <p className="mt-1 text-[13px] font-bold text-ink-500">Tài khoản này có {candidates.length} hồ sơ. Chạm để tải về máy.</p>
            </div>
            {/* A failed pull says so HERE too, next to the picker that is still up — tapping the same
              * face again is the retry. */}
            {error && <Notice kind="error" adult role="alert" title={error} action={retryAction} />}
            <ProfilePicker
              profiles={candidates}
              onSelect={finishRestore}
              busy={busy}
              density="compact"
              pendingId={busy ? pickingId : null}
            />
            <LinkText onClick={() => { setCandidates(null); backToMenu() }}>← Chọn cách khác</LinkText>
          </GateCard>
        </PageBody>
      </PageShell>
    )
  }

  return (
    <PageShell className="relative">
      <GateBlobs />
      <PageHeader right={null} back={<BackButton to="/" label="Về nhà" mdLabel="Về bản đồ 🏝️" variant="adult" />} />
      <PageBody center>
        <GateCard>
          <div>
            <h1 className="font-display text-[18px] font-extrabold text-ink-900">Đã dùng Speak Up rồi?</h1>
            <p className="mt-1 text-[13px] font-bold text-ink-500">Khôi phục tiến độ của bé trên máy này.</p>
          </div>

          {/* Task 9 / R8: `info`/`retryId` are read only inside the `'result'` stage's own body now
            * — this used to rattle a `Notice`/floating "Thử tải lại" on top of every stage. `error`
            * still lands here for the two stages with no field or `Notice` of their own to show it:
            * `menu` (`afterAuthenticated`'s roster/pull-read failures) and `abandon` (the guard
            * firing again on the confirmed retry). NOT `'result'`, which owns its own `Notice` and
            * would otherwise show the retry control twice. */}
          {(stage === 'menu' || stage === 'abandon') && error && <Notice kind="error" adult role="alert" title={error} action={retryAction} />}

          {stage === 'menu' && (
            <div className="flex flex-col gap-3">
              <Button size="adult" onClick={() => openDoor('email')} className="w-full">
                Tôi có email đã liên kết
              </Button>
              <Button size="adult" variant="outline" onClick={() => openDoor('code')} className="w-full">
                Tôi có mã khôi phục
              </Button>
              <LinkText to="/" className="mt-2 self-center">
                Bắt đầu mới cho bé
              </LinkText>
            </div>
          )}

          {stage === 'gate' && (
            <div className="flex flex-col items-center gap-6">
              <ParentQuestion
                sub="Câu hỏi dành cho bố mẹ trước khi khôi phục."
                onPass={() => { setError(null); setErrorAction(null); setPassedGate(true); setStage(door) }}
              />
              <LinkText onClick={backToMenu}>← Chọn cách khác</LinkText>
            </div>
          )}

          {stage === 'email' && (
            <form onSubmit={handleSendEmail} className="flex flex-col gap-4">
              <FieldRow
                label="Email của bố mẹ"
                htmlFor="cloud-start-email"
                error={error ?? undefined}
                action={retryAction}
                help="Chỉ dùng để gửi mã xác nhận và giữ tiến độ. Không gửi quảng cáo."
                input={
                  <input
                    id="cloud-start-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`${FIELD_INPUT} ${error ? FIELD_INPUT_ERROR : ''}`}
                  />
                }
              />
              {/* The button that led here says "email đã liên kết", and now the code means it:
                * `signInWithEmail` cannot create an account any more. Saying so up front is cheaper
                * than the parent discovering it from an error. */}
              <p className="text-xs font-semibold text-ink-300">
                Chỉ dùng được email đã liên kết với Speak Up từ trước. Chưa liên kết bao giờ thì dùng mã khôi phục nhé.
              </p>
              <Button type="submit" size="adult" disabled={busy} className="w-full">Gửi mã xác nhận</Button>
              <LinkText onClick={backToMenu}>← Chọn cách khác</LinkText>
            </form>
          )}

        {/* The confirmation the auth contract asks for, in as many words: what is on this device
          * and the way to keep it instead. Only ever reached when there is something real to lose
          * — the numbers `abandonCopy` prints are read off this device, not guessed.
          *
          * R11 / quyết định 23: one frame for all four `Stranding` shapes now, not a `<h2>` +
          * 2–3 `<p>` that changed shape per branch. The email moves out of the button label
          * ("Vẫn tiếp tục với {email}" used to grow three screens wide at 61 characters) into this
          * copy line instead — never repeated on the button. */}
        {stage === 'abandon' && stranding && (
          <div className="flex flex-col gap-3 text-left">
            <h2 className="font-display text-base font-extrabold text-ink-900">Máy này đang có dữ liệu</h2>
            <p className="text-sm font-semibold text-ink-500">Khôi phục sẽ thay bằng tài khoản của bố mẹ. Dữ liệu hiện tại:</p>
            <p data-testid="abandon-copy" className="rounded-r10 bg-sun-50 px-2.5 py-2 text-[12px] font-bold leading-[1.45] text-sun-700">
              {abandonCopy(stranding)} Tài khoản đăng nhập: <b>{email}</b>.
            </p>
            <Button size="adult" disabled={busy} onClick={() => { void sendOtp(true) }} className="w-full">
              Vẫn tiếp tục với email này
            </Button>
            <Button size="adult" variant="ghost" onClick={() => { setStranding(null); setStage('email') }} className="w-full">
              Huỷ
            </Button>
            <LinkText to="/parent">Sao lưu trước ở Góc phụ huynh</LinkText>
          </div>
        )}

        {stage === 'email-otp' && (
          <form onSubmit={handleVerifyEmail} className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-ink-500">Nhập mã 6 số vừa gửi tới {email}</p>
            <FieldRow
              label="Mã 6 số"
              htmlFor="cloud-start-otp"
              error={error ?? undefined}
              action={retryAction}
              help="Mã hết hạn sau 10 phút."
              input={
                <input
                  id="cloud-start-otp"
                  inputMode="numeric"
                  required
                  autoFocus
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className={`${FIELD_INPUT} ${FIELD_INPUT_CODE} ${error ? FIELD_INPUT_ERROR : ''}`}
                />
              }
            />
            <Button type="submit" size="adult" disabled={busy} className="w-full">Xác nhận</Button>
            <div className="flex items-center justify-between">
              <LinkText onClick={() => { setStage('email'); setOtp(''); setError(null); setErrorAction(null) }}>Sửa lại email</LinkText>
              {/* The countdown the design sketches ("Gửi lại mã (0:42)") has no timer anywhere in
                * this code to drive it — Ruling deferred to Task 16, which owns the remaining A2
                * polish. The resend itself is real: it re-runs the same first-attempt send. */}
              <LinkText onClick={() => { void sendOtp(false) }}>Gửi lại mã</LinkText>
            </div>
          </form>
        )}

        {stage === 'code' && (
          <form onSubmit={handleRecover} className="flex flex-col gap-4">
            <FieldRow
              label="Mã khôi phục (8 ký tự)"
              htmlFor="cloud-start-code"
              error={error ?? undefined}
              action={retryAction}
              help="Mã do máy trước tạo ra trong Góc phụ huynh (chụp màn hình)."
              input={
                <input
                  id="cloud-start-code"
                  required
                  autoFocus
                  maxLength={8}
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className={`${FIELD_INPUT} ${FIELD_INPUT_CODE} uppercase ${error ? FIELD_INPUT_ERROR : ''}`}
                />
              }
            />
            <Button type="submit" size="adult" disabled={busy} className="w-full">Khôi phục</Button>
            <LinkText onClick={backToMenu}>← Chọn cách khác</LinkText>
          </form>
        )}

        {/* R8 / quyết định 21: the screen-level system failures that used to rattle a `Notice` and
          * a floating "Thử tải lại" on top of every stage now land on their own stage instead —
          * reached from `afterAuthenticated`'s "0 restorable profiles" branch and from
          * `finishRestore`'s single-candidate pull failure. Both read as the same generic outcome
          * (the design's own stage ⑧ uses one sentence for either), and "Thử tải lại" re-runs
          * whichever one actually failed: the specific pull when `retryId` names it, the whole
          * fetch-and-adopt round trip otherwise. */}
        {stage === 'result' && (
          <div className="flex flex-col gap-3">
            <Notice
              kind="warn"
              adult
              title={info ?? 'Tài khoản này chưa có hồ sơ nào để khôi phục. Bắt đầu mới cho bé hoặc thử email khác.'}
            />
            {retryId
              ? <Button size="adult" variant="outline" disabled={busy} onClick={() => { void finishRestore(retryId) }} className="w-full">Thử tải lại</Button>
              : <Button size="adult" variant="outline" disabled={busy} onClick={() => { void afterAuthenticated() }} className="w-full">Thử tải lại</Button>}
            <Button size="adult" disabled={busy} onClick={() => navigate('/')} className="w-full">Bắt đầu mới cho bé</Button>
            <LinkText onClick={backToMenu}>← Về menu</LinkText>
          </div>
        )}
        </GateCard>
      </PageBody>
    </PageShell>
  )
}

