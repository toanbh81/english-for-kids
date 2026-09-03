import type { ReactNode } from 'react'

const PAD = { tile: 'px-0.5 py-1', row: 'px-0.5 pb-0.5 pt-1.5' }

/** Groups a run of `Tile`/`ListRow` children under an H2 that sticks to the top of the scroller
 * (brief §1: "danh sách dài nhóm theo chủ đề với H2 dính"). The background matches the page's own
 * (`cream-50`) so the group's own content doesn't show through while it scrolls underneath.
 * `pad='row'` drops the count tail's padding to match a row group (C8) instead of a tile grid. */
export function StickyGroup({
  emoji,
  name,
  count,
  pad = 'tile',
  children,
}: {
  emoji: string
  name: string
  count?: ReactNode
  pad?: 'tile' | 'row'
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 md:gap-3">
      <h2
        data-testid="sticky-group"
        className={`sticky top-0 z-10 flex items-center gap-2 bg-cream-50 font-display text-[15px] font-extrabold text-ink-500 md:text-[17px] ${PAD[pad]}`}
      >
        <span aria-hidden="true">{emoji}</span>
        <span className="truncate">{name}</span>
        {count !== undefined && <span className="shrink-0 font-sans text-[12px] font-bold text-ink-300 md:text-[13px]">· {count}</span>}
      </h2>
      {children}
    </section>
  )
}
