import type { Profile } from '../cloud/profileState'

/**
 * A grid of children to tap — flow 3/4's restore picker ("more than one profile came back, which
 * one?") and the parent screen's profile list (flow 6's "Thêm hồ sơ" card). One component, because
 * both are the same question: which namespace should this device read next.
 *
 * Never the flow 6 app-start "tap your face" gate itself — that is reached by a child with no
 * math question in front of it, and both current call sites of this component sit behind the
 * parent gate. Held to the 64 px tap floor regardless, since a parent's thumb is not smaller than
 * a child's.
 */
type Props = {
  profiles: Profile[]
  onSelect: (id: string) => void
  /** Marked, not disabled — tapping the active profile again is harmless. */
  activeId?: string | null
  busy?: boolean
}

export function ProfilePicker({ profiles, onSelect, activeId, busy }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {profiles.map(p => {
        const active = p.id === activeId
        return (
          <button
            key={p.id}
            type="button"
            disabled={busy}
            aria-pressed={active}
            onClick={() => onSelect(p.id)}
            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl2 border-2 px-3 py-3 font-display text-sm font-extrabold active:translate-y-[2px] disabled:opacity-50 ${
              active ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-line-200 bg-white text-ink-900'
            }`}
          >
            <span aria-hidden="true" className="text-3xl leading-none">{p.avatar}</span>
            <span>{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}
