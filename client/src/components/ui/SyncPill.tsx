import type { SyncStatus } from '../../cloud/sync'

/** `md` (default) is the header panel's chuỗi class hôm nay (unchanged). `sm` is the 28px pill of
 * the narrow panel — a size, not a variant, because every state keeps the same tone/copy at both. */
export type SyncPillSize = 'sm' | 'md'

const SIZE = {
  sm: 'h-7 rounded-lg px-2 text-[11px]',        // 28 · r8 · 11 — trong panel hẹp (bảng 11 trạng thái)
  md: 'h-8 rounded-r10 px-2.5 text-[12px]',     // 32 · r10 · 12 — header panel Tài khoản (chuỗi cũ)
} as const

export function SyncPill({ status, hasSession, size = 'md', onRetry }: { status: SyncStatus; hasSession?: boolean; size?: SyncPillSize; onRetry: () => void }) {
  if (status.state === 'off') return null

  const hhmm = (t: number) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const v = status.lastError
    ? { cls: 'bg-fix-50 text-fix-700', ic: '⚠', t: 'Không đồng bộ được', retry: true }
    : status.syncing
      ? { cls: 'bg-teal-50 text-teal-600', ic: '◌', t: 'Đang đồng bộ…', spin: true }
      : status.state === 'offline'
        ? { cls: 'bg-sand text-ink-500', ic: '⚡', t: 'Ngoại tuyến' }
        // Nhánh thứ 7. Gate bằng `hasSession === false`, KHÔNG bằng `state === 'off'`: hai câu hỏi
        // khác nhau — "máy này có cloud không" (off, đã return null trên kia) và "đã có phiên chưa".
        : hasSession === false
          ? { cls: 'bg-sand text-ink-500', ic: '⚡', t: 'Chưa kết nối' }
          : status.state === 'pending'
            ? { cls: 'bg-sun-50 text-sun-700', ic: '●', t: `Chưa đồng bộ ${status.pending} mục` }
            : status.lastSyncedAt
              ? { cls: 'bg-good-50 text-good-700', ic: '✓', t: `Đã đồng bộ · ${hhmm(status.lastSyncedAt)}` }
              : { cls: 'bg-good-50 text-good-700', ic: '✓', t: 'Đã đồng bộ' }

  return (
    <span className="flex items-center gap-2">
      <span
        data-testid="sync-status"
        className={`inline-flex items-center gap-1.5 whitespace-nowrap font-extrabold ${SIZE[size]} ${v.cls}`}
      >
        <span aria-hidden="true" className={'spin' in v && v.spin ? 'inline-block animate-[spin_1.2s_linear_infinite]' : ''}>
          {v.ic}
        </span>{' '}
        {v.t}
      </span>
      {'retry' in v && v.retry && (
        <button
          type="button"
          onClick={onRetry}
          // I3: BOTH sizes carry a hit band — 28 → 44 needs `-inset-2`, 32 → 44 needs `-inset-1.5`.
          // `md` used to get none at all, which left a 32px tap target on an adult screen whose
          // own rule is "visible 28/32/36/44, never tapped below 44".
          className={`${size === 'sm' ? 'h-7' : 'h-8'} relative rounded-r10 border-2 border-sand-edge px-2.5 text-[12px] font-extrabold text-ink-500 after:absolute after:content-[''] ${size === 'sm' ? 'after:-inset-2' : 'after:-inset-1.5'}`}
        >
          Thử lại
        </button>
      )}
    </span>
  )
}
