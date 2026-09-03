import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Chip, type ChipTone } from '../Chip'
import { Stars } from '../Stars'

const BOX = { sm: 'h-[110px] gap-[5px] px-1.5 py-2 md:h-[136px]', lg: 'h-[128px] gap-[5px] px-2 py-2.5 md:h-[160px]' }
const SURFACE = {
  open: 'bg-white shadow-card-sm',
  locked: 'bg-sand opacity-85 shadow-[0_5px_0_#E2D5C0]',
  accent: 'bg-sun-50 shadow-[0_5px_0_#EFDDA8]',
}
const TITLE = {
  sm: 'font-display text-[15px] font-extrabold leading-[1.1] md:text-[19px]',
  17: 'font-display text-[17px] font-extrabold leading-[1.2] line-clamp-2 md:text-[20px]',
  15: 'font-display text-[15px] font-extrabold leading-[1.2] line-clamp-2 md:text-[19px]',
}
const SUB = { ink: 'text-[14px] font-bold text-ink-500 md:text-[17px]', sand: 'text-[12px] font-bold text-sand-text md:text-[15px]' }

type TileBase = {
  to: string
  size?: 'sm' | 'lg'
  variant?: 'open' | 'locked' | 'accent'
  emoji?: string
  ipa?: string
  /** Only meaningful with `size='lg'` — the A14 mood-line tile uses 15 for a shorter first line. */
  titleSize?: 15 | 17
  sub?: ReactNode
  subTone?: 'ink' | 'sand'
  chip?: { tone?: ChipTone; label: ReactNode }
  stars?: 0 | 1 | 2 | 3
  state?: unknown
  className?: string
}

// Every tile needs an accessible name: either its visible `title` text stands in for it, or a
// caller with an emoji/IPA-only tile (A10/A11's word-pop and sound tiles, say) must supply
// `ariaLabel` explicitly — TS refuses to compile a tile with neither, so this can't regress
// silently the way it did when `ariaLabel` was merely optional (task-2 review, Important #2).
type TileProps = TileBase & ({ title: string; ariaLabel?: string } | { title?: never; ariaLabel: string })

/** The shared list frame's tile (brief §1, decision 1): small square at `sm` (word/sound/story/
 * topic — content ≤ one word, emoji or IPA glyph), large rectangle at `lg` (sentence/pair/
 * paragraph — up to two lines, ellipsized). `variant='locked'` is the not-unlocked-yet look
 * (`sand` surface, dimmed text, and — unless `chip.tone` overrides it — a `sand`-toned "Chưa mở
 * khoá" chip); `variant='accent'` is the WordTopics "review" tile (`sun-50` surface). */
export function Tile({
  to,
  size = 'sm',
  variant = 'open',
  emoji,
  ipa,
  title,
  titleSize,
  sub,
  subTone,
  chip,
  stars,
  ariaLabel,
  state,
  className = '',
}: TileProps) {
  return (
    <Link
      to={to}
      state={state}
      // No fallback synthesized from `title` here: when `ariaLabel` is absent, the browser
      // computes the link's accessible name from its own visible text content (the title span
      // below) — which `TileProps` now guarantees exists. `Stars`' star glyphs are kept out of
      // that computed name by the `aria-hidden` wrapper further down.
      aria-label={ariaLabel}
      data-testid="tile"
      className={`flex flex-col items-center justify-center rounded-r18 text-center transition-transform active:translate-y-[2px] ${BOX[size]} ${SURFACE[variant]} ${className}`}
    >
      {emoji && (
        <span
          aria-hidden="true"
          className={size === 'sm' ? 'text-[40px] leading-none md:text-[56px]' : 'text-[28px] leading-none md:text-[34px]'}
        >
          {emoji}
        </span>
      )}
      {ipa && (
        <span className="font-display text-[36px] font-extrabold leading-none text-[#C08457] md:text-[45px]">{ipa}</span>
      )}
      {title && (
        <span className={`${TITLE[size === 'sm' ? 'sm' : (titleSize ?? 17)]}${variant === 'locked' ? ' text-sand-text' : ' text-ink-900'}`}>
          {title}
        </span>
      )}
      {sub && <span className={SUB[subTone ?? 'ink']}>{sub}</span>}
      {chip && (
        // `size="xs"` (not a fighting `className` override — task-5 review, Important #1):
        // `Chip`'s own base classes always win the cascade over anything passed via `className`,
        // so the 11/13px radius-9 padding-2×8 shape has to come from a real `Chip` size.
        <Chip tone={chip.tone ?? (variant === 'locked' ? 'sand' : 'neutral')} size="xs">
          {chip.label}
        </Chip>
      )}
      {stars !== undefined && (
        // `Stars` carries no accessible label of its own (its `★` glyphs are plain text), so it
        // must not leak into the link's computed name — `contents` keeps the wrapper out of the
        // flex layout while `aria-hidden` keeps it out of the accessibility tree.
        <span aria-hidden="true" className="contents">
          <Stars value={stars} size="13" className="md:text-[14px]" />
        </span>
      )}
    </Link>
  )
}
