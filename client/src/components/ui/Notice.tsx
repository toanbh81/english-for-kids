/**
 * Phase 12 §2.7: the one banner/strip primitive for every "something to tell a parent or child"
 * moment in the app — replacing the ad-hoc `bg-sun-50 p-3` / `bg-fix-50 p-3` divs each screen used
 * to hand-roll. `role="status"` by default (a polite, non-interrupting announcement); `role="alert"`
 * is opt-in via the `role` prop for the one place (CloudStart's error strip) whose existing tests
 * expect `getByRole('alert')`.
 */
export type NoticeKind = 'info' | 'warn' | 'error' | 'success' | 'credential' | 'pending'

const KIND: Record<NoticeKind, { cls: string; icon: string }> = {
  info: { cls: 'bg-teal-50 border-teal-line text-teal-600', icon: 'ℹ️' },
  warn: { cls: 'bg-sun-50 border-[#FFDF9E] text-sun-700', icon: '⚠️' },
  error: { cls: 'bg-fix-50 border-fix-300 text-fix-700', icon: '⛔' },
  success: { cls: 'bg-good-50 border-good-300 text-good-700', icon: '✅' },
  credential: { cls: 'bg-white border-teal-500 text-ink-900', icon: '🔑' },
  pending: { cls: 'bg-sand border-sand-edge text-[#6B5B4D]', icon: '⏳' },
}

export type NoticeProps = {
  kind: NoticeKind
  title: string
  sub?: string
  action?: { label: string; onClick: () => void }
  onClose?: () => void
  code?: string
  testId?: string
  /** Defaults to `status`. Pass `alert` where the existing screen already relied on the assertive
   * announcement (and tests query `getByRole('alert')`) — see CloudStart's error strip. */
  role?: 'status' | 'alert'
  /**
   * Defaults to `false` — a CHILD screen. Every button (`action`, `onClose`, the credential's
   * "Chép mã") is `min-h-[44px] min-w-[44px]` regardless, but on a child screen that 44 px box
   * also gets an invisible `after:-inset-2.5` hit band around it — the same trick `Button` uses —
   * so the tap area reaches the ≥64 px child floor without growing the visible control. Pass
   * `adult` on the parent-only screens (ParentDashboard, CloudStart), where 44 px is this app's
   * own adult convention and no band is added.
   */
  adult?: boolean
}

/** The invisible hit band: a 10 px inset on every side turns a 44 px box into a 64 px tap target
 * (44 + 10 + 10) without touching layout — `Button`'s `HIT` constant, restated here because that
 * one is keyed to a fixed top/bottom band for a full-width control, not a small square icon
 * button. */
const CHILD_HIT_BAND = "relative after:absolute after:-inset-2.5 after:content-['']"

export function Notice({ kind, title, sub, action, onClose, code, testId, role = 'status', adult = false }: NoticeProps) {
  const k = KIND[kind]
  const btn = (cls: string) => `min-h-[44px] min-w-[44px] ${cls} ${adult ? '' : CHILD_HIT_BAND}`
  return (
    <div role={role} data-testid={testId} className={`flex items-start gap-3 rounded-r16 border-[3px] py-2.5 pl-3.5 pr-2.5 ${k.cls}`}>
      <span aria-hidden="true" className="mt-px text-[20px] leading-none">{k.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-extrabold leading-snug">{title}</div>
        {sub && <div className="mt-0.5 text-[12px] font-bold leading-snug opacity-85 [overflow-wrap:anywhere]">{sub}</div>}
        {code && (
          <div className="mt-2 flex items-center gap-2.5">
            <div className="rounded-r10 bg-white px-3 py-1.5 font-display text-[24px] font-extrabold tracking-[4px]">{code}</div>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(code) }} className={btn('rounded-r12 bg-teal-500 px-3.5 text-[13px] font-extrabold text-white')}>Chép mã</button>
          </div>
        )}
      </div>
      {action && <button type="button" onClick={action.onClick} className={btn('shrink-0 rounded-r12 bg-white/70 px-3 text-[13px] font-extrabold')}>{action.label}</button>}
      {onClose && <button type="button" aria-label="Đóng" onClick={onClose} className={btn('flex shrink-0 items-center justify-center rounded-r12 text-[18px] opacity-60')}>✕</button>}
    </div>
  )
}
