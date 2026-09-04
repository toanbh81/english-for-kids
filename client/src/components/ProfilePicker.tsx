import type { Profile } from '../cloud/profileState'

/**
 * A grid of children to tap — flow 3/4's restore picker ("more than one profile came back, which
 * one?"), the parent screen's profile list, and flow 6's app-start "tap your face". One component,
 * because all three are the same question: which namespace should this device read next.
 *
 * Held to the adult group's rule (round 4 / R3): visible boxes are 28/32/36/44, hit area ≥44 — no
 * 56/64 child-sized targets in this group. `ProfileGate`'s app-start use is the child's own screen,
 * but the other two call sites live behind the parent gate, and this is one component either way.
 */
type Density = 'auto' | 'row' | 'grid' | 'compact'

type Props = {
  profiles: Profile[]
  onSelect: (id: string) => void
  /** Marked, not disabled — tapping the active profile again is harmless. */
  activeId?: string | null
  busy?: boolean
  /** `auto` (default) derives the layout from `profiles.length`: 2–3 is one row of 96px cells, 4–8
   * is an 88px grid with a scroller. `compact` is CloudStart's 72px cell, forced regardless of
   * count and never showing the "N hồ sơ" footer. `row`/`grid` are the explicit escape hatches. */
  density?: Density
  /** The id of the profile currently being switched to: its cell spins in place of the avatar and
   * the whole grid dims while every button is disabled. */
  pendingId?: string | null
  /** Set `false` to suppress the "N hồ sơ · cuộn xem thêm" footer even once the grid overflows
   * (>8 profiles) in `grid` density — it never shows below that count regardless of this prop. */
  footer?: boolean
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

const pick = (d: Density, n: number): Exclude<Density, 'auto'> => (d !== 'auto' ? d : n <= 3 ? 'row' : 'grid')

const WRAP: Record<Exclude<Density, 'auto'>, string> = {
  row: 'flex gap-2',
  grid: 'grid grid-cols-2 gap-2 md:grid-cols-4',
  compact: 'grid grid-cols-2 gap-2 md:grid-cols-4',
}
const CELL: Record<Exclude<Density, 'auto'>, string> = {
  row: 'h-24 flex-1 min-w-0',
  grid: 'h-[88px]',
  compact: 'h-[72px]',
}
const EMOJI: Record<Exclude<Density, 'auto'>, string> = {
  row: 'text-[30px]',
  grid: 'text-[26px]',
  compact: 'text-[22px]',
}

export function ProfilePicker({ profiles, onSelect, activeId, busy, density = 'auto', pendingId, footer }: Props) {
  const distinguished = distinguishAll(profiles)
  const d = pick(density, profiles.length)
  const disabled = busy || !!pendingId

  const cells = (
    <div data-testid="picker" className={`${WRAP[d]} ${pendingId ? 'opacity-50' : ''}`}>
      {profiles.map(p => {
        const active = p.id === activeId
        const pending = p.id === pendingId
        const distinguisher = distinguished.get(p.id)
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            title={p.name}
            onClick={() => onSelect(p.id)}
            className={`relative flex ${CELL[d]} flex-col items-center justify-center gap-1 rounded-r14 border-2 px-1.5 py-2 active:translate-y-[2px] disabled:opacity-50 ${
              active ? 'border-teal-500 bg-teal-50' : 'border-line-200 bg-white'
            }`}
          >
            {active && (
              <span aria-hidden="true" className="absolute right-1 top-1 text-[12px] text-teal-600">✓</span>
            )}
            {pending ? (
              <span
                data-testid="cell-spinner"
                className="h-[22px] w-[22px] animate-[spin_1.2s_linear_infinite] rounded-full border-2 border-teal-line border-t-teal-500"
              />
            ) : (
              <span aria-hidden="true" className={`${EMOJI[d]} leading-none`}>{p.avatar}</span>
            )}
            <span
              className={
                d === 'compact'
                  ? 'truncate text-[13px] font-extrabold leading-[1.2] text-ink-900'
                  : 'line-clamp-2 text-[14px] font-extrabold leading-[1.2] text-ink-900'
              }
            >
              {p.name}
            </span>
            {/* Fix round 1, Important #1: as a flex-column child under `items-center` (not `stretch`)
              * this span had no bounded width, so a long distinguisher WRAPPED instead of truncating
              * — two lines of "Tạo"/"25/08/2026" pushed the row-density cell (fixed `h-24`) past its
              * own height and overlapped the name above it. `w-full` gives `truncate` a box to clip
              * against; the full text still reaches an assistive reader / a hover via `title`. */}
            {distinguisher && (
              <span className="w-full truncate text-center text-[11px] font-bold text-ink-300" title={distinguisher}>
                {distinguisher}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  if (d === 'row') return cells

  // `grid` and `compact` both live inside a capped scroll region with a bottom fade; only `grid`
  // ever grows the footer — `compact` (CloudStart's small picker) never shows it, whatever the
  // count. Fix round 1, ruled #2: the hint is only true once the grid actually has something to
  // scroll TO. The 2-column phone layout is the tightest one (md: goes to 4), so it is also the one
  // that overflows first — `ceil(n/2)` rows × 88 + `(rows-1)` × 8 stays ≤ the 380px cap exactly
  // through 8 profiles (4 rows × 88 + 3 × 8 = 376) and first exceeds it at 9 (5 rows × 88 + 4 × 8 =
  // 472). Below that there is nothing to scroll to, so "cuộn xem thêm" next to a fully-visible grid
  // would be a lie — the footer simply does not render rather than invent a new, unreviewed bare
  // "N hồ sơ" copy for that case.
  const showFooter = d === 'grid' && footer !== false && profiles.length > 8

  return (
    <div className="flex flex-col gap-1">
      <div
        data-testid="picker-scroll"
        className="relative max-h-[380px] overflow-y-auto after:sticky after:bottom-0 after:mt-auto after:h-9 after:bg-gradient-to-b after:from-transparent after:to-white after:content-['']"
      >
        {cells}
      </div>
      {showFooter && (
        <p className="text-center text-[12px] font-bold text-ink-300">{profiles.length} hồ sơ · cuộn xem thêm</p>
      )}
    </div>
  )
}
