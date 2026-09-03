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

/** The shared list frame's tile (brief §1, decision 1): small square at `sm` (word/sound/story/
 * topic — content ≤ one word, emoji or IPA glyph), large rectangle at `lg` (sentence/pair/
 * paragraph — up to two lines, ellipsized). `variant='locked'` is the not-unlocked-yet look
 * (`sand` surface, dimmed text); `variant='accent'` is the WordTopics "review" tile (`sun-50`
 * surface). At least one of `emoji`/`ipa`/`title` should be given. */
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
}: {
  to: string
  size?: 'sm' | 'lg'
  variant?: 'open' | 'locked' | 'accent'
  emoji?: string
  ipa?: string
  title?: ReactNode
  /** Only meaningful with `size='lg'` — the A14 mood-line tile uses 15 for a shorter first line. */
  titleSize?: 15 | 17
  sub?: ReactNode
  subTone?: 'ink' | 'sand'
  chip?: { tone?: ChipTone; label: ReactNode }
  stars?: 0 | 1 | 2 | 3
  ariaLabel?: string
  state?: unknown
  className?: string
}) {
  return (
    <Link
      to={to}
      state={state}
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
        <Chip tone={chip.tone ?? 'neutral'} size="sm" className="rounded-[9px] px-2 py-0.5 text-[11px] leading-tight md:text-[13px]">
          {chip.label}
        </Chip>
      )}
      {stars !== undefined && <Stars value={stars} size="13" className="md:text-[14px]" />}
    </Link>
  )
}
