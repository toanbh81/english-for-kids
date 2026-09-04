import { RemoteRowSkeleton } from '../ui'

// R18/Q16 — decision 9 (7 states) and 31 (one squeezed line, 36px row action). The three lines of
// today's numbers (`ParentDashboard.tsx:753-761`) are composed into ONE string by the SCREEN and
// handed in as `sub` — this component only truncates it; it never wraps free text onto a second
// line. Likewise "· máy này" for `thisDevice` is baked into `name`/`sub` by the caller, not added
// here — see `adult-rows.test.tsx`'s error-state case, which already carries the suffix.
export type RemoteRowState = 'loading' | 'error' | 'empty' | 'data' | 'thisDevice' | 'stale' | 'noAudio'

const SUB: Record<RemoteRowState, string> = {
  data: 'text-ink-500',
  thisDevice: 'text-ink-500',
  error: 'text-fix-700',
  empty: 'text-ink-300',
  stale: 'text-ink-300',
  noAudio: 'text-ink-500',
  loading: 'text-ink-300',
}

const ACTION: Partial<Record<RemoteRowState, string>> = {
  error: 'Thử lại',
  data: 'Chi tiết',
  thisDevice: 'Chi tiết',
  stale: 'Chi tiết',
  noAudio: 'Chi tiết',
}

export function RemoteRow({ name, sub, state, onAction }: {
  name: string
  sub: string
  state: RemoteRowState
  onAction?: () => void
}) {
  if (state === 'loading') return <RemoteRowSkeleton />

  const actionLabel = ACTION[state]

  return (
    <div data-testid="remote-row" className="flex min-h-[56px] items-center gap-2.5 border-b border-line-200 py-1.5">
      <span aria-hidden="true" className="shrink-0 text-[20px] leading-none">🦊</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-extrabold text-ink-900">{name}</span>
        <span className={`truncate text-[11px] font-bold ${SUB[state]}`}>{sub}</span>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="relative h-9 shrink-0 rounded-r10 border-2 border-sand-edge px-2.5 text-[12px] font-extrabold text-ink-500 after:absolute after:-inset-1 after:content-['']"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
