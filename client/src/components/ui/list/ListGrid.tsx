import type { ReactNode } from 'react'

const SIZE = {
  sm: 'grid-cols-3 gap-2 md:grid-cols-5 md:gap-3 ipad:grid-cols-6',
  lg: 'grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 ipad:grid-cols-4',
} as const

/** The shared list frame's grid (brief §1, decision 1): small tiles (word/sound/story/topic —
 * content ≤ one word) at `sm` — 3/5/6 columns phone/iPad-portrait/iPad-landscape — and large tiles
 * (sentence/pair/paragraph — two lines of text) at `lg` — 2/3/4 columns. No `lg:` breakpoint is
 * used anywhere in this project; `ipad:` outranks `md:` by construction (tailwind.config.ts), so
 * the landscape-only column count always wins on a real iPad landscape. An odd last row sits left
 * because the grid's own tracks are `1fr` and tiles don't stretch to fill them — no extra class
 * needed to keep a short final row from centering itself. */
export function ListGrid({ size = 'sm', className = '', children }: {
  size?: keyof typeof SIZE
  className?: string
  children: ReactNode
}) {
  return <div data-testid="list-grid" className={`grid ${SIZE[size]} ${className}`}>{children}</div>
}
