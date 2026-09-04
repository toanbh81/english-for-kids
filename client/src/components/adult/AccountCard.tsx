import type { SyncStatus } from '../../cloud/sync'
import { AccountCardSkeleton, Button, Notice, SyncPill } from '../ui'
import { FIELD_INPUT, FIELD_INPUT_ERROR, FieldRow } from './FieldRow'

/**
 * Fix round 1 — the OTP box's own input style, built from scratch rather than layered on
 * `FIELD_INPUT_CODE` (`FieldRow.tsx:7`). That constant bakes in `text-[22px]` for A2's code/
 * recovery boxes; brief §2's Account-card row ⑥ explicitly wants **20px**, not 22 ("ô 22 là của
 * A2"). Stacking `text-[20px]` after `FIELD_INPUT_CODE` left two same-property utility classes in
 * one `className` string — which one wins is stylesheet-generation order, not JSX order — so the
 * size was never guaranteed. This string carries the size exactly once.
 */
const OTP_INPUT = 'h-11 w-full truncate rounded-r12 border-2 border-sand-edge px-3 text-center font-display text-[20px] font-extrabold tracking-[6px] text-ink-900 outline-none border-teal-500'

/**
 * Task 4 (brief §2 "Thẻ Tài khoản — 11 trạng thái") — a PRESENTATIONAL extraction of
 * `ParentDashboard.tsx:542-660`. Every async handler (send OTP, verify OTP, sign out, retry
 * connect, retry sync…) stays on the screen — this component only renders the eleven shapes that
 * state can take and reports taps back through the handler props. Task 11 wires it in, drops it
 * into `Panel`'s `right` slot for the pill, and deletes the screen's own markup + `noSessionNotice()`.
 */
export type AccountState =
  | { kind: 'loading' }                                             // ①
  | { kind: 'noSession'; online: boolean }                          // ② + ③ (tách theo `online`)
  | { kind: 'link'; email: string; busy?: boolean; error?: string } // ④ + ⑤
  | { kind: 'otp'; email: string; otp: string; busy?: boolean; error?: string } // ⑥ + ⑦
  | { kind: 'linked'; email: string; signingOut?: boolean; pending?: number }   // ⑨ + ⑪
  | { kind: 'syncError'; email: string | null; pending: number }    // ⑩

type Props = {
  state: AccountState
  sync: SyncStatus
  hasSession: boolean
  /** ⑧ — rides alongside any of the ④–⑦ forms; a linked account never has one (`ensureRecoveryCode`
   * is a no-op once there is an email), so this is only ever non-null on the anonymous branch. */
  recoveryCode: string | null
  onEmailChange: (v: string) => void
  onOtpChange: (v: string) => void
  onSendOtp: () => void
  onVerifyOtp: () => void
  onEditEmail: () => void
  onSignOut: () => void
  onRetryConnect: () => void
  onRetrySync: () => void
}

/** The submit button's busy face — same spinner markup for both the email-link and OTP forms. */
function SubmitFace({ busy, label }: { busy?: boolean; label: string }) {
  if (!busy) return <>{label}</>
  return (
    <>
      Đang gửi…
      <span
        data-testid="button-spinner"
        aria-hidden
        className="h-4 w-4 animate-[spin_1.2s_linear_infinite] rounded-full border-2 border-white/40 border-t-white"
      />
    </>
  )
}

export function AccountCard({
  state,
  sync,
  hasSession,
  recoveryCode,
  onEmailChange,
  onOtpChange,
  onSendOtp,
  onVerifyOtp,
  onEditEmail,
  onSignOut,
  onRetryConnect,
  onRetrySync,
}: Props) {
  // ① — the skeleton IS the whole 150px body; nothing else renders alongside it.
  if (state.kind === 'loading') {
    return (
      <div data-testid="account-card-body" className="flex min-h-[150px] flex-col gap-2.5">
        <AccountCardSkeleton />
      </div>
    )
  }

  const showRecoveryCode = (state.kind === 'link' || state.kind === 'otp') && recoveryCode !== null

  return (
    <div data-testid="account-card-body" className="flex min-h-[150px] flex-col gap-2.5">
      <div className="flex items-center justify-end">
        <SyncPill status={sync} hasSession={hasSession} size="md" onRetry={onRetrySync} />
      </div>

      {state.kind === 'noSession' && (
        <Notice
          kind={state.online ? 'info' : 'warn'}
          icon={state.online ? undefined : '📡'}
          adult
          testId="no-session"
          title={
            state.online
              ? 'Chưa kết nối được tài khoản. Bé vẫn học bình thường, tiến độ lưu trên máy.'
              : 'Đang ngoại tuyến — sẽ tự kết nối khi có mạng.'
          }
          action={state.online ? { label: 'Thử kết nối', onClick: onRetryConnect } : undefined}
        />
      )}

      {state.kind === 'link' && (
        <form onSubmit={e => { e.preventDefault(); onSendOtp() }} className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-ink-500">
            Liên kết email để giữ tiến độ và xem trên máy khác.
          </p>
          <FieldRow
            label="Email của bố mẹ"
            htmlFor="account-email"
            error={state.error}
            input={
              <input
                id="account-email"
                type="email"
                required
                placeholder="email@vidu.com"
                value={state.email}
                disabled={state.busy}
                onChange={e => onEmailChange(e.target.value)}
                className={`${FIELD_INPUT} ${state.error ? FIELD_INPUT_ERROR : ''}`}
              />
            }
          />
          <Button type="submit" size="adult" disabled={state.busy}>
            <SubmitFace busy={state.busy} label="Liên kết" />
          </Button>
        </form>
      )}

      {state.kind === 'otp' && (
        <form onSubmit={e => { e.preventDefault(); onVerifyOtp() }} className="flex flex-col gap-2">
          <p
            data-testid="otp-sentence"
            title={state.email}
            className="min-w-0 truncate text-[12px] font-bold text-ink-500"
          >
            Nhập mã 6 số vừa gửi tới {state.email}
          </p>
          <FieldRow
            label="Mã 6 số"
            htmlFor="account-otp"
            error={state.error}
            action={state.error ? { label: 'Gửi lại mã', onClick: onSendOtp } : undefined}
            input={
              <input
                id="account-otp"
                inputMode="numeric"
                required
                value={state.otp}
                onChange={e => onOtpChange(e.target.value)}
                className={`${OTP_INPUT} ${state.error ? FIELD_INPUT_ERROR : ''}`}
              />
            }
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEditEmail}
              className="min-h-[44px] flex-1 self-start text-left text-[13px] font-extrabold text-ink-500 underline"
            >
              Sửa lại email
            </button>
            <Button type="submit" size="adult" disabled={state.busy}>
              <SubmitFace busy={state.busy} label="Xác nhận" />
            </Button>
          </div>
        </form>
      )}

      {showRecoveryCode && (
        <Notice
          kind="credential"
          adult
          title="Mã khôi phục — chụp màn hình lại. Chỉ hiện 1 lần."
          sub="Dùng mã này để lấy lại tiến độ trên máy khác."
          code={recoveryCode ?? undefined}
        />
      )}

      {state.kind === 'linked' && (
        <>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div
              data-testid="linked-email"
              title={state.email}
              className="flex h-11 min-w-0 flex-1 items-center truncate rounded-r12 border-2 border-line-200 px-3 text-[13px] font-bold text-ink-900"
            >
              {state.email}
            </div>
            <Button
              size="adult"
              variant="outline"
              disabled={state.signingOut}
              onClick={onSignOut}
            >
              Đăng xuất
            </Button>
          </div>
          {state.signingOut && (
            <p className="text-[12px] font-semibold text-ink-500">
              Đang lưu {state.pending ?? 0} mục còn lại trước khi đăng xuất…
            </p>
          )}
        </>
      )}

      {state.kind === 'syncError' && (
        <div className="flex min-w-0 flex-col gap-2">
          {state.email !== null && (
            <div
              data-testid="linked-email"
              title={state.email}
              className="flex h-11 min-w-0 flex-1 items-center truncate rounded-r12 border-2 border-line-200 px-3 text-[13px] font-bold text-ink-900"
            >
              {state.email}
            </div>
          )}
          <p className="text-[12px] font-extrabold text-fix-700">
            {state.pending} mục chưa lên máy chủ. Sẽ thử lại khi có mạng.
          </p>
        </div>
      )}
    </div>
  )
}
