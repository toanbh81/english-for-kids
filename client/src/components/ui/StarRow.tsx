export type StarSize = 'sm' | 'md' | 'lg'

const SIZE: Record<StarSize, string> = { sm: 'text-xl gap-0.5', md: 'text-3xl gap-1', lg: 'text-5xl gap-2' }

/** Three stars, `value` of them filled. The empty star keeps the warm `#E2D5C0` of the
 * handoff rather than a grey, so it reads as "not yet" instead of "disabled". */
export function StarRow({ value, size = 'md', animate, className = '' }: {
  value: 0 | 1 | 2 | 3
  size?: StarSize
  animate?: boolean
  className?: string
}) {
  return (
    <div className={`inline-flex ${SIZE[size]} ${className}`}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          data-testid={i <= value ? 'star-filled' : 'star-empty'}
          className={`${i <= value ? 'text-sun-400' : 'text-[#E2D5C0]'} ${animate && i <= value ? 'animate-star-drop' : ''}`}
          style={animate && i <= value ? { animationDelay: `${(i - 1) * 0.15}s` } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  )
}
