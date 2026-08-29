import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { currentAccessToken, signInWithEmail, verifyEmailOtp } from '../cloud/auth'
import type { Profile } from '../cloud/profileState'
import { adoptProfiles, fetchRemoteProfiles, switchProfile } from '../cloud/profileState'
import { pullProfile } from '../cloud/sync'
import { isCloudConfigured } from '../cloud/supabase'
import { ProfilePicker } from '../components/ProfilePicker'
import { Button, Card, PAGE_SHELL } from '../components/ui'

/**
 * The start screen's other door (spec flows 3 and 4): "Đã dùng Speak Up rồi?" — for a device whose
 * cache was wiped, or that is simply new. Two ways in, both ending the same way: the profiles the
 * account owns are merged into this device's roster, one is chosen, and its data is pulled down.
 *
 * **Reachable with no math gate in front of it** — a wiped device has no progress to protect and
 * no parent flag set yet — so nothing here shows a child anything about accounts or sync; it only
 * ever asks for an email/OTP or an 8-character code, which is adult knowledge either way.
 *
 * Only this screen may pass `{ abandonAnonymous: true }` to `signInWithEmail`: every profile on a
 * device that lands here is either the fresh, empty one `ensureLocalProfile()` just minted (there
 * is nothing local to strand) or already a `pullProfile` target the moment restore finishes.
 */

type Stage = 'menu' | 'email' | 'email-otp' | 'code'

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

function describeRecoverError(status: number): string {
  if (status === 400) return 'Mã khôi phục gồm 8 ký tự, kiểm tra lại nhé.'
  if (status === 401) return 'Phiên làm việc có vấn đề, thử tải lại trang.'
  if (status === 403) return 'Mã này thuộc tài khoản đã liên kết email — dùng email để khôi phục nhé.'
  if (status === 404) return 'Không tìm thấy mã này, kiểm tra lại nhé.'
  if (status === 409) return 'Mã này vừa được dùng rồi.'
  if (status === 429) return 'Thử quá nhiều lần, đợi một chút rồi thử lại nhé.'
  return 'Có lỗi ở máy chủ, thử lại sau nhé.'
}

export function CloudStart() {
  // Every hook below is called on every render, cloud or not — `isCloudConfigured()` cannot change
  // within a session, but the Rules of Hooks apply to the code, not to the value. The early return
  // sits after them instead.
  const [stage, setStage] = useState<Stage>('menu')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Profile[] | null>(null)

  // A build with no cloud has nothing for this screen to do — a direct link (bookmarked, typed by
  // hand) lands back on Home rather than showing a form that can never succeed.
  if (!isCloudConfigured()) return <Navigate to="/" replace />

  function backToMenu() {
    setStage('menu')
    setError(null)
    setOtp('')
    setCode('')
  }

  /** After either door finishes: the account's profiles are ready to be joined into this roster. */
  async function afterAuthenticated() {
    const remote = await fetchRemoteProfiles()
    const merged = adoptProfiles(remote)
    const remoteIds = new Set(remote.map(p => p.id))
    // Only the ones the account actually owns are offered — a fresh, still-empty profile this
    // device minted moments ago (see the module doc) is not a restore target.
    const restorable = merged.filter(p => remoteIds.has(p.id))

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

  async function handleSendEmail(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const result = await signInWithEmail(email, { abandonAnonymous: true })
    setBusy(false)
    if (!result.ok) { setError(describeAuthError(result.error)); return }
    setStage('email-otp')
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
            <Button onClick={() => { setError(null); setStage('email') }} className="w-full">
              Tôi có email đã liên kết
            </Button>
            <Button variant="outline" onClick={() => { setError(null); setStage('code') }} className="w-full">
              Tôi có mã khôi phục
            </Button>
            <Link to="/" className="mt-2 text-sm font-bold text-ink-500 underline">
              Bắt đầu mới cho bé
            </Link>
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
            <Button type="submit" disabled={busy} className="w-full">Gửi mã xác nhận</Button>
            <button type="button" onClick={backToMenu} className="min-h-[44px] text-sm font-bold text-ink-500 underline">
              ← Chọn cách khác
            </button>
          </form>
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
              className="min-h-[44px] text-sm font-bold text-ink-500 underline"
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
            <button type="button" onClick={backToMenu} className="min-h-[44px] text-sm font-bold text-ink-500 underline">
              ← Chọn cách khác
            </button>
          </form>
        )}
      </Card>
    </main>
  )
}
