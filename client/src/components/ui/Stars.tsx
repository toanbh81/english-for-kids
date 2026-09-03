export type StarSize = 'xs' | '13' | '14' | 'sm' | 'md' | 'lg'
const SIZE: Record<StarSize, string> = { xs: 'text-[12px]', '13': 'text-[13px]', '14': 'text-[14px]', sm: 'text-[16px]', md: 'text-[28px]', lg: 'text-[44px]' }

/** The one star row of the app (brief §2.11): xs 12 (B2's word-list tiles) / sm 16 / md 28 / lg 44,
 * filled `#FFB020`, empty `#E2D5C0`, and `animate` drops the filled ones in 0.18 s apart — only
 * when a result is new. `13`/`14` (Phase 14, R31) add two list-row marks between `xs` and `sm`
 * without touching the scale to numbers — the four old names stay put, so 20+ existing call-sites
 * are untouched, and `StarRow` re-exports `StarSize` from here so it gains both new marks for free. */
export function Stars({ value, size = 'md', animate, className = '' }: {
  value: 0 | 1 | 2 | 3
  size?: StarSize
  animate?: boolean
  className?: string
}) {
  return (
    <div data-testid="stars" className={`inline-flex leading-none tracking-[2px] ${SIZE[size]} ${className}`}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          data-testid={i <= value ? 'star-filled' : 'star-empty'}
          className={`${i <= value ? 'text-star' : 'text-star-empty'} ${animate && i <= value ? 'animate-star-drop' : ''}`}
          style={animate && i <= value ? { animationDelay: `${((i - 1) * 0.18).toFixed(2)}s` } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  )
}
