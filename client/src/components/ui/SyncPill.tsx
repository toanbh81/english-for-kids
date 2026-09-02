import type { SyncStatus } from '../../cloud/sync'

export function SyncPill({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  if (status.state === 'off') return null

  const hhmm = (t: number) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const v = status.lastError
    ? { cls: 'bg-fix-50 text-fix-700', ic: '⚠', t: 'Không đồng bộ được', retry: true }
    : status.syncing
      ? { cls: 'bg-teal-50 text-teal-600', ic: '◌', t: 'Đang đồng bộ…', spin: true }
      : status.state === 'offline'
        ? { cls: 'bg-sand text-ink-500', ic: '⚡', t: 'Ngoại tuyến' }
        : status.state === 'pending'
          ? { cls: 'bg-sun-50 text-sun-700', ic: '●', t: `Chưa đồng bộ ${status.pending} mục` }
          : status.lastSyncedAt
            ? { cls: 'bg-sand text-ink-500', ic: '🕘', t: `Đồng bộ lúc ${hhmm(status.lastSyncedAt)}` }
            : { cls: 'bg-good-50 text-good-700', ic: '✓', t: 'Đã đồng bộ' }

  return (
    <span className="flex items-center gap-2">
      <span
        data-testid="sync-status"
        className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-r10 px-2.5 text-[12px] font-extrabold ${v.cls}`}
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
          className="h-8 rounded-r10 border-2 border-sand-edge px-2.5 text-[12px] font-extrabold text-ink-500"
        >
          Thử lại
        </button>
      )}
    </span>
  )
}
