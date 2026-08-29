import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { currentAccessToken, currentEmail, signInWithEmail, verifyEmailOtp } from '../cloud/auth'
import type { Profile } from '../cloud/profileState'
import { activeProfileId, adoptProfiles, fetchRemoteProfiles, listProfiles, switchProfile } from '../cloud/profileState'
import { hasMirroredData, pullProfile } from '../cloud/sync'
import { isCloudConfigured } from '../cloud/supabase'
import { hasAnyHistory, profileHistory, sumHistory } from '../progress/history'
import { ProfilePicker } from '../components/ProfilePicker'
import { ParentQuestion } from '../components/ParentQuestion'
import { Button, Card, PAGE_SHELL } from '../components/ui'

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

type Stage = 'menu' | 'gate' | 'email' | 'email-otp' | 'code' | 'abandon'
type Door = 'email' | 'code'

/** What the ACCOUNT on this device would be left holding, unreachably, after signing in elsewhere. */
type Stranding = { profiles: number; stars: number; events: number; mirrored: boolean }

function describeAuthError(code: string): string {
  const lower = code.toLowerCase()
  if (code === 'invalid-email') return 'Email chưa đúng định dạng.'
  if (code === 'cloud-unconfigured') return 'Chưa thể kết nối lúc này, thử lại sau nhé.'
  // Never "thử lại": a retry reproduces this exactly. The way out is the parent screen, where the
  // email is linked to the account this device already has instead of replacing it.
  if (code === 'anonymous-session-in-use') {
    return 'Máy này đang có hồ sơ của một bé chưa liên kết email. Hãy vào Góc phụ huynh để liên kết email cho hồ sơ đó, thay vì đăng nhập bằng tài khoản khác.'
  }
  // The honest answer to "Tôi có email đã liên kết" when it turns out this one is not linked. It
  // must never read as a network hiccup: the parent has to try their other address, or the
  // recovery code, rather than the same email again.
  if (code === 'email-not-linked') {
    return 'Email này chưa liên kết với hồ sơ nào. Kiểm tra lại địa chỉ, hoặc dùng mã khôi phục nhé.'
  }
  if (code === 'invalid-token' || /invalid|expired|not\s*found/.test(lower)) {
    return 'Mã chưa đúng hoặc đã hết hạn, thử lại nhé.'
  }
  if (/network|fetch/.test(lower)) return 'Không có kết nối mạng, thử lại nhé.'
  return 'Có lỗi xảy ra, thử lại nhé.'
}

function describeRecoverError(status: number): string {
  if (status === 400) return 'Mã khôi phục gồm 8 ký tự, kiểm tra lại nhé.'
  if (status === 401) return 'Phiên làm việc có vấn đề, thử tải lại trang.'
  if (status === 403) return 'Mã này thuộc tài khoản đã liên kết email — dùng email để khôi phục nhé.'
  if (status === 404) return 'Không tìm thấy mã này, kiểm tra lại nhé.'
  if (status === 409) return 'Mã này vừa được dùng rồi.'
  if (status === 429) return 'Thử quá nhiều lần, đợi một chút rồi thử lại nhé.'
  return 'Có lỗi ở máy chủ, thử lại sau nhé.'
}

/**
 * What signing in as another account would strand — or null if there is genuinely nothing.
 *
 * **The question is what the ACCOUNT loses, not what the device loses**, and the difference is a
 * whole child. Every profile on this iPad belongs to the same anonymous owner, so the first version
 * of this — `totalStars()`, `getActivity()`, `hasMirroredData(activeProfileId())`, all three
 * resolving through the ACTIVE namespace — was blind to a sibling. That is not a corner: flow 6's
 * picker makes "hand the iPad to the other child" a one-tap everyday action, and the empty child's
 * Home is where the restore link appears. Parent taps it in good faith with their real linked
 * address, this returns null, the screen abandons the account by itself, and the first child's
 * months of progress belong to an owner nothing can reach again.
 *
 * So the scan is every id this device knows about AND every id the account actually owns — the
 * second read `fetchRemoteProfiles()`, which answers rather than infers, and catches a child whose
 * roster entry this device has lost (its rows are still up there, still about to be orphaned).
 *
 * A device whose parent has ALREADY linked an email is not at risk — signing in there is the same
 * account or a deliberate second one, and the guard in `auth.ts` never fires for it either.
 */
async function assessStranding(): Promise<Stranding | null> {
  if (await currentEmail()) return null

  const ids = new Set<string | null>(listProfiles().map(p => p.id))
  const active = activeProfileId()
  if (active) ids.add(active)
  // A device that never got a namespace (storage refused the migration) keeps its progress under
  // the legacy keys, and `profileHistory(null)` is how those are read.
  if (!ids.size) ids.add(null)

  const owned = await fetchRemoteProfiles()
  // A child the account owns but this roster does not name. There is nothing local left to count
  // for them, and that is exactly why they matter: only the server still has them.
  const forgotten = owned.filter(p => !ids.has(p.id)).length
  for (const p of owned) ids.add(p.id)

  let profiles = 0
  let mirrored = forgotten > 0
  for (const id of ids) {
    const history = profileHistory(id)
    const mirroredHere = id !== null && hasMirroredData(id)
    if (hasAnyHistory(history) || mirroredHere) profiles++
    mirrored ||= mirroredHere
  }
  profiles += forgotten

  const { stars, events } = sumHistory([...ids])
  return profiles > 0 || mirrored ? { profiles, stars, events, mirrored } : null
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
  const [info, setInfo] = useState<string | null>(null)
  const [stranding, setStranding] = useState<Stranding | null>(null)
  const [candidates, setCandidates] = useState<Profile[] | null>(null)

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
    setOtp('')
    setCode('')
    setStranding(null)
  }

  function openDoor(which: Door) {
    setError(null)
    setInfo(null)
    setDoor(which)
    setStage(passedGate ? which : 'gate')
  }

  /** After either door finishes: the account's profiles are ready to be joined into this roster. */
  async function afterAuthenticated() {
    const remote = await fetchRemoteProfiles()
    // Adopted BEFORE anything is pulled, and this order is a rule, not a preference: until the
    // roster names an id, `rescueOrphanNamespaces` reads the keys a pull writes as abandoned and
    // folds them into the active child. `pullProfile` refuses an id that is not in the roster.
    const merged = adoptProfiles(remote)
    const remoteIds = new Set(remote.map(p => p.id))
    // The account's own profiles, minus the empty one this device minted moments ago: it IS owned
    // by this account (see `mintedId`), so ownership alone cannot tell them apart, and offering it
    // means offering a decoy that looks exactly like the child the parent came here to get back.
    const restorable = merged.filter(p => remoteIds.has(p.id) && p.id !== mintedId)

    if (restorable.length === 0) {
      setInfo('Tài khoản này chưa có hồ sơ nào trên máy chủ. Bắt đầu mới cho bé nhé.')
      setCandidates(null)
      setStage('menu')
      return
    }
    if (restorable.length === 1) {
      await finishRestore(restorable[0].id)
      return
    }
    setCandidates(restorable)
  }

  async function finishRestore(id: string) {
    setBusy(true)
    await pullProfile(id)
    setBusy(false)
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
    setBusy(true)
    const result = await signInWithEmail(email, abandonAnonymous ? { abandonAnonymous } : {})
    if (result.ok) { setBusy(false); setStranding(null); setStage('email-otp'); return }
    if (result.error !== 'anonymous-session-in-use' || abandonAnonymous) {
      setBusy(false)
      setError(describeAuthError(result.error))
      return
    }

    const risk = await assessStranding()
    if (risk) {
      setBusy(false)
      setStranding(risk)
      setStage('abandon')
      return
    }
    // Nothing on this device and nothing of ours on the server: the empty profile the app mints on
    // every launch is the only thing being left behind, and it is what this screen exists to
    // replace. This is the ONE place the flag may be passed without asking, and it is passed
    // knowing that — not assuming it.
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
    setBusy(true)
    const result = await verifyEmailOtp(email, otp)
    if (!result.ok) { setBusy(false); setError(describeAuthError(result.error)); return }
    await afterAuthenticated()
    setBusy(false)
  }

  async function handleRecover(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const token = await currentAccessToken()
    if (!token) { setBusy(false); setError('Chưa có kết nối, thử lại khi có mạng nhé.'); return }
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
      setError('Không có kết nối mạng, thử lại nhé.')
      return
    }
    await afterAuthenticated()
    setBusy(false)
  }

  if (candidates) {
    return (
      <main className={`flex h-full flex-col items-center gap-6 overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
        <Card className="flex w-full max-w-md flex-col gap-4 p-6 text-center">
          <h1 className="font-display text-xl font-extrabold text-ink-900">Chọn hồ sơ của bé</h1>
          <p className="text-sm font-semibold text-ink-500">Tài khoản này có {candidates.length} hồ sơ. Chọn một để khôi phục lên máy này.</p>
          <ProfilePicker profiles={candidates} onSelect={finishRestore} busy={busy} />
        </Card>
      </main>
    )
  }

  return (
    <main className={`flex h-full flex-col items-center gap-6 overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
      <Link
        to="/"
        className="inline-flex min-h-[64px] items-center gap-2 self-start rounded-full bg-white px-6 font-display text-xl font-extrabold text-ink-900 shadow-card-sm active:translate-y-[2px]"
      >
        ← Về nhà
      </Link>

      <Card className="flex w-full max-w-md flex-col gap-5 p-6 text-center">
        <div>
          <h1 className="font-display text-xl font-extrabold text-ink-900">Đã dùng Speak Up rồi?</h1>
          <p className="mt-1 text-sm font-semibold text-ink-500">Khôi phục tiến độ của bé trên máy này.</p>
        </div>

        {info && <p className="rounded-xl2 bg-sun-50 p-3 text-sm font-semibold text-sun-700">{info}</p>}
        {error && <p role="alert" className="rounded-xl2 bg-fix-50 p-3 text-sm font-semibold text-fix-700">{error}</p>}

        {stage === 'menu' && (
          <div className="flex flex-col gap-3">
            <Button onClick={() => openDoor('email')} className="w-full">
              Tôi có email đã liên kết
            </Button>
            <Button variant="outline" onClick={() => openDoor('code')} className="w-full">
              Tôi có mã khôi phục
            </Button>
            <Link to="/" className="mt-2 inline-flex min-h-[64px] items-center justify-center text-sm font-bold text-ink-500 underline">
              Bắt đầu mới cho bé
            </Link>
          </div>
        )}

        {stage === 'gate' && (
          <div className="flex flex-col items-center gap-6">
            <ParentQuestion
              title="Câu hỏi dành cho bố/mẹ"
              onPass={() => { setPassedGate(true); setStage(door) }}
            />
            <button type="button" onClick={backToMenu} className="min-h-[64px] text-sm font-bold text-ink-500 underline">
              ← Chọn cách khác
            </button>
          </div>
        )}

        {stage === 'email' && (
          <form onSubmit={handleSendEmail} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-left">
              <span className="text-sm font-bold text-ink-500">Email của bố/mẹ</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="min-h-[64px] rounded-xl2 border-2 border-line-200 px-4 text-base font-semibold text-ink-900"
              />
            </label>
            {/* The button that led here says "email đã liên kết", and now the code means it:
              * `signInWithEmail` cannot create an account any more. Saying so up front is cheaper
              * than the parent discovering it from an error. */}
            <p className="text-xs font-semibold text-ink-300">
              Chỉ dùng được email đã liên kết với Speak Up từ trước. Chưa liên kết bao giờ thì dùng mã khôi phục nhé.
            </p>
            <Button type="submit" disabled={busy} className="w-full">Gửi mã xác nhận</Button>
            <button type="button" onClick={backToMenu} className="min-h-[64px] text-sm font-bold text-ink-500 underline">
              ← Chọn cách khác
            </button>
          </form>
        )}

        {/* The confirmation the auth contract asks for, in as many words: what is on this device,
          * what happens to it, and the way to keep it instead. It is only ever reached when there
          * is something real to lose — the numbers below are read off this device, not guessed. */}
        {stage === 'abandon' && stranding && (
          <div className="flex flex-col gap-3 text-left">
            {/* "hồ sơ", counted — the account can be holding a child who is not the one using the
              * iPad right now, and a parent reading "một bé" would picture the wrong one. */}
            <h2 className="font-display text-base font-extrabold text-ink-900">
              Tài khoản trên máy này đang giữ tiến độ của {stranding.profiles} hồ sơ
            </h2>
            <p className="text-sm font-semibold text-ink-500">
              Tổng cộng {stranding.stars} sao và {stranding.events} lượt luyện, thuộc một tài khoản chưa liên kết email —
              kể cả hồ sơ của bé khác trên máy này.
              {stranding.mirrored && ' Một phần đã được lưu lên máy chủ dưới tài khoản đó.'}
            </p>
            <p className="rounded-xl2 bg-fix-50 p-3 text-sm font-semibold text-fix-700">
              Nếu đăng nhập bằng {email}, máy này sẽ chuyển sang tài khoản đó và phần tiến độ trên sẽ không mở lại được nữa.
            </p>
            <p className="text-sm font-semibold text-ink-500">
              Muốn giữ tiến độ này? Vào <Link to="/parent" className="underline">Góc phụ huynh</Link> và liên kết email cho chính tài khoản đang có.
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => { void sendOtp(true) }}
              className="w-full"
            >
              Vẫn tiếp tục với {email}
            </Button>
            <button
              type="button"
              onClick={() => { setStranding(null); setStage('email') }}
              className="min-h-[64px] text-sm font-bold text-ink-500 underline"
            >
              ← Quay lại
            </button>
          </div>
        )}

        {stage === 'email-otp' && (
          <form onSubmit={handleVerifyEmail} className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-ink-500">Nhập mã 6 số vừa gửi tới {email}</p>
            <label className="flex flex-col gap-1 text-left">
              <span className="text-sm font-bold text-ink-500">Mã xác nhận</span>
              <input
                inputMode="numeric"
                required
                autoFocus
                value={otp}
                onChange={e => setOtp(e.target.value)}
                className="min-h-[64px] rounded-xl2 border-2 border-line-200 px-4 text-center font-display text-2xl font-extrabold text-ink-900"
              />
            </label>
            <Button type="submit" disabled={busy} className="w-full">Xác nhận</Button>
            <button
              type="button"
              onClick={() => { setStage('email'); setOtp(''); setError(null) }}
              className="min-h-[64px] text-sm font-bold text-ink-500 underline"
            >
              Sửa lại email
            </button>
          </form>
        )}

        {stage === 'code' && (
          <form onSubmit={handleRecover} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-left">
              <span className="text-sm font-bold text-ink-500">Mã khôi phục (8 ký tự)</span>
              <input
                required
                autoFocus
                maxLength={8}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="min-h-[64px] rounded-xl2 border-2 border-line-200 px-4 text-center font-display text-2xl font-extrabold uppercase tracking-widest text-ink-900"
              />
            </label>
            <p className="text-xs font-semibold text-ink-300">Mã do màn hình phụ huynh cấp lúc tạo tài khoản.</p>
            <Button type="submit" disabled={busy} className="w-full">Khôi phục</Button>
            <button type="button" onClick={backToMenu} className="min-h-[64px] text-sm font-bold text-ink-500 underline">
              ← Chọn cách khác
            </button>
          </form>
        )}
      </Card>
    </main>
  )
}
