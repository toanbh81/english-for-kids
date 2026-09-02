export type StarSize = 'sm' | 'md' | 'lg'
const SIZE: Record<StarSize, string> = { sm: 'text-[16px]', md: 'text-[28px]', lg: 'text-[44px]' }

/** The one star row of the app (brief §2.11): sm 16 / md 28 / lg 44, filled `#FFB020`, empty
 * `#E2D5C0`, and `animate` drops the filled ones in 0.18 s apart — only when a result is new. */
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
