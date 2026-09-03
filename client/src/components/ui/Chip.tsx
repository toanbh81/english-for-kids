import type { ReactNode } from 'react'

export type ChipTone = 'teal' | 'coral' | 'sun' | 'neutral' | 'coralSolid' | 'sand'
export type ChipSize = 'xs' | 'header' | 'sm' | 'md'

const TONE: Record<ChipTone, string> = {
  teal: 'bg-teal-50 text-teal-600',
  coral: 'bg-coral-50 text-coral-text',
  sun: 'bg-sun-50 text-sun-700',
  neutral: 'bg-cream-50 text-ink-500',
  coralSolid: 'bg-coral-500 text-white',
  // The "Chưa mở khoá" chip on a locked list `Tile` (brief §1 "Ô nhỏ · khoá"): `#EFE2CC`/`#A79781`.
  // `#EFE2CC` is the existing `line-200` token (already used as a background by `ProgressBar`,
  // `Toggle`, `SceneDots`), not a new hex.
  sand: 'bg-line-200 text-sand-text',
}

// `rounded-full px-4 py-2` used to live on the shared span below, outside this map — a `Tile`
// chip tried to shrink it with a fighting `className` override (`rounded-[9px] px-2 py-0.5
// text-[11px]`), which never won: Tailwind's generated stylesheet order, not JSX class order,
// decides the cascade, so the base literal classes always beat a later `className` (task-5
// review, Important #1). Radius and padding now travel with font-size in each size's own entry
// instead, so there is nothing left to fight — `sm`/`md` are byte-identical to their old output.
const SIZE: Record<ChipSize, string> = {
  // The list `Tile`'s chip (brief §1 "ô nhỏ" chip: 11/13px, radius 9, padding 2×8) — a tile is
  // ~110px wide, so `whitespace-nowrap` keeps a two-word label ("Chưa có từ ôn") on one line
  // instead of wrapping into the tile's fixed height.
  xs: 'text-[11px] leading-tight rounded-[9px] px-2 py-0.5 whitespace-nowrap md:text-[13px]',
  // The 15px header chip (brief §2 A6 DailyMission's band/group chips, §2 C2 StoryPlayer's scene
  // chip): radius 12, padding 7-8×14. Fix wave I2/P6: three call sites tried to shrink the `md`
  // pill with a fighting `className` override and always lost the same way `Tile`'s `xs` chip did
  // (task-5 review, Important #1) — Tailwind's *stylesheet* order, not JSX order, decides the
  // cascade, so the size now travels with the chip instead of fighting it after the fact.
  header: 'text-[15px] rounded-r12 px-3.5 py-[7px]',
  sm: 'text-base rounded-full px-4 py-2',
  md: 'text-lg rounded-full px-4 py-2',
}

/** Small pill label — speed, counts, "Nghe mẫu", scene hints. */
export function Chip({ tone = 'neutral', size = 'md', className = '', children }: {
  tone?: ChipTone
  size?: ChipSize
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold ${SIZE[size]} ${TONE[tone]} ${className}`}>
      {children}
    </span>
  )
}
