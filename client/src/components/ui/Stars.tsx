export type StarSize = 'xs' | '13' | '14' | 'sm' | 'md' | 'lg'
const SIZE: Record<StarSize, string> = { xs: 'text-[12px]', '13': 'text-[13px]', '14': 'text-[14px]', sm: 'text-[16px]', md: 'text-[28px]', lg: 'text-[44px]' }

export type StarTone = 'default' | 'band'
// Fix wave P3: TopicHub's island-header subtitle (brief §2 A8) reads both the filled and the
// empty stars as pale yellow on teal — the app-default gold/tan pair was the lowest-contrast text
// on that band. `star-band` is a `tailwind.config.ts` token (like `star`/`star-empty` already are),
// not an inline hex, so this stays "no new hex" per the round-3 palette.
const TONE: Record<StarTone, { on: string; off: string }> = {
  default: { on: 'text-star', off: 'text-star-empty' },
  band: { on: 'text-star-band', off: 'text-star-band/50' },
}

/** The one star row of the app (brief §2.11): xs 12 (B2's word-list tiles) / sm 16 / md 28 / lg 44,
 * filled `#FFB020`, empty `#E2D5C0`, and `animate` drops the filled ones in 0.18 s apart — only
 * when a result is new. `13`/`14` (Phase 14, R31) add two list-row marks between `xs` and `sm`
 * without touching the scale to numbers — the four old names stay put, so 20+ existing call-sites
 * are untouched, and `StarRow` re-exports `StarSize` from here so it gains both new marks for free.
 * `tone` (Phase 14 fix wave, P3) is a second, independent axis — one named tone, not a general
 * colour prop — for the one place the default gold/tan pair loses contrast against its background. */
export function Stars({ value, size = 'md', tone = 'default', animate, className = '' }: {
  value: 0 | 1 | 2 | 3
  size?: StarSize
  tone?: StarTone
  animate?: boolean
  className?: string
}) {
  return (
    <div data-testid="stars" className={`inline-flex leading-none tracking-[2px] ${SIZE[size]} ${className}`}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          data-testid={i <= value ? 'star-filled' : 'star-empty'}
          className={`${i <= value ? TONE[tone].on : TONE[tone].off} ${animate && i <= value ? 'animate-star-drop' : ''}`}
          style={animate && i <= value ? { animationDelay: `${((i - 1) * 0.18).toFixed(2)}s` } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  )
}
