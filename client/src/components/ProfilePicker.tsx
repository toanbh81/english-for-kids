import type { Profile } from '../cloud/profileState'
import { shortName } from '../cloud/profileState'

/**
 * A grid of children to tap — flow 3/4's restore picker ("more than one profile came back, which
 * one?"), the parent screen's profile list, and flow 6's app-start "tap your face". One component,
 * because all three are the same question: which namespace should this device read next.
 *
 * Held to the 64 px tap floor: two of the three call sites sit behind the parent gate, but the
 * app-start one is the child's own screen, and a parent's thumb is not smaller than a child's
 * anyway.
 */
type Props = {
  profiles: Profile[]
  onSelect: (id: string) => void
  /** Marked, not disabled — tapping the active profile again is harmless. */
  activeId?: string | null
  busy?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The three honest things that can be said about a profile, in order of how readable they are. */
const byDate = (p: Profile): string | null => {
  if (p.created <= 0) return null
  const d = new Date(p.created)
  return `Tạo ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}
const byTime = (p: Profile): string | null => {
  if (p.created <= 0) return null
  const d = new Date(p.created)
  return `Tạo ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/**
 * The last resort: the first block of the UUID.
 *
 * Eight hex digits, not four. Four is 16 bits, and a collision between two profiles on one device
 * is a 1-in-65536 coincidence — rare enough to never see in testing and common enough to happen to
 * somebody, which is the worst kind of odds to build on when the whole job of this label is to be
 * different. Eight makes it 1 in four billion. It is still not a proof: if two ids ever did share a
 * first block, the two rows would read alike again, and this comment would rather say so than
 * claim otherwise.
 */
const byId = (p: Profile): string => `Mã ${p.id.slice(0, 8)}`

/**
 * A second line for rows that would otherwise be identical — and never two identical rows.
 *
 * Every profile this app creates carries the same default name and the same fox ("Bé", 🦊), so a
 * restore picker can very easily be two indistinguishable buttons; picking the wrong one lands the
 * parent in an empty profile and reads as a failed restore. The discriminator is always a FACT
 * about the profile, and it steps up until the rows really are different: the creation date, then
 * the date and time (two profiles made the same afternoon — the ordinary case for a parent adding
 * a sibling), then the head of the id, which is ugly but is as good as unique (see `byId`).
 *
 * Only colliding rows get one. A picker of "Sóc" and "Cáo" needs no explaining, and dating every
 * row would be noise on a screen a child taps every morning.
 */
function distinguishAll(profiles: Profile[]): Map<string, string> {
  const groups = new Map<string, Profile[]>()
  for (const p of profiles) {
    const label = `${p.avatar} ${p.name}`
    const group = groups.get(label)
    if (group) group.push(p)
    else groups.set(label, [p])
  }

  const labels = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const chosen = [byDate, byTime]
      .map(describe => group.map(describe))
      .find(texts => texts.every(t => t !== null) && new Set(texts).size === group.length)
    group.forEach((p, i) => labels.set(p.id, chosen?.[i] ?? byId(p)))
  }
  return labels
}

export function ProfilePicker({ profiles, onSelect, activeId, busy }: Props) {
  const distinguished = distinguishAll(profiles)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {profiles.map(p => {
        const active = p.id === activeId
        const distinguisher = distinguished.get(p.id)
        return (
          <button
            key={p.id}
            type="button"
            disabled={busy}
            aria-pressed={active}
            title={p.name}
            onClick={() => onSelect(p.id)}
            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl2 border-2 px-3 py-3 font-display text-sm font-extrabold active:translate-y-[2px] disabled:opacity-50 ${
              active ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-line-200 bg-white text-ink-900'
            }`}
          >
            <span aria-hidden="true" className="text-3xl leading-none">{p.avatar}</span>
            <span>{shortName(p.name)}</span>
            {distinguisher && <span className="text-[11px] font-bold text-ink-500">{distinguisher}</span>}
          </button>
        )
      })}
    </div>
  )
}
