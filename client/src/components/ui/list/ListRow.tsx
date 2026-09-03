import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Stars } from '../Stars'

// 96 for stories (C1), 64 for sentences (C8) — no 72 (decision 29): the design's opening card
// mentions 64/72 but every artboard that actually ships a row uses one of these two.
const H = {
  64: 'min-h-[64px] gap-2.5 rounded-r16 px-3.5 shadow-card-xs',
  96: 'min-h-[96px] gap-3.5 rounded-r20 px-4 shadow-[0_6px_0_#EFE2CC]',
}

/** The shared list frame's row (brief §1, decision 1): text left, sao (stars) right. `h={96}`
 * draws a leading disc (StoryList); `h={64}` is a plain one-line row (SentenceList, grouped under
 * a sticky `StickyGroup` H2). */
export function ListRow({
  to,
  h,
  title,
  sub,
  disc,
  stars,
  chevron,
  ariaLabel,
  state,
  className = '',
}: {
  to: string
  h: 64 | 96
  title: ReactNode
  sub?: ReactNode
  disc?: { emoji: string; bg: string }
  stars?: 0 | 1 | 2 | 3
  chevron?: boolean
  ariaLabel?: string
  state?: unknown
  className?: string
}) {
  return (
    <Link
      to={to}
      state={state}
      aria-label={ariaLabel}
      data-testid="list-row"
      className={`flex w-full items-center bg-white transition-transform active:translate-y-[2px] ${H[h]} ${className}`}
    >
      {disc && (
        <span
          aria-hidden="true"
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-r18 text-[38px] leading-none ${disc.bg}`}
        >
          {disc.emoji}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={
            h === 64
              ? 'truncate font-display text-[16px] font-extrabold text-ink-900 md:text-[19px]'
              : 'truncate font-display text-[19px] font-extrabold text-ink-900 md:text-[23px]'
          }
        >
          {title}
        </span>
        {sub && <span className="truncate text-[13px] font-bold text-ink-500 md:text-[15px]">{sub}</span>}
      </span>
      {stars !== undefined && (
        // See Tile.tsx: `Stars` has no accessible label of its own, so its `★` glyphs must not
        // leak into the row link's computed name.
        <span aria-hidden="true" className="contents">
          <Stars value={stars} size="13" className="ml-auto shrink-0 md:text-[14px]" />
        </span>
      )}
      {chevron && <span aria-hidden="true" className="shrink-0 font-display text-[22px] leading-none text-ink-300">▸</span>}
    </Link>
  )
}
