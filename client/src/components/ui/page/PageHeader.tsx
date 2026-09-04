import type { ReactNode } from 'react'
import { LessonChip } from '../../LessonChip'
import { EngineBadge } from './EngineBadge'

/** The 3-column header every migrated screen shares: back button, centred content, and a right
 * cell that defaults to `LessonChip` — a caller that has nothing to put there (Home, the parent
 * dashboard) passes `right={null}` for an empty cell instead.
 *
 * `title`/`sub` swap the centred `children` slot for a left-aligned one-row heading (Phase 14's
 * list screens); `align` overrides the default that decision picks (`start` once `title` is set,
 * `center` otherwise) — the 33 Phase 12/13 call-sites pass only `children`, so they keep the
 * centred layout byte-for-byte. `onBand` is the named exception (R19 / decision 5, TopicHub only)
 * to "header always sits on cream": it turns the header transparent and the back disc white-on-teal
 * so it can sit directly on a topic's art band instead. */
export function PageHeader({ back, right, engine, dimmed, title, sub, align, onBand, children }: {
  back: ReactNode; right?: ReactNode; engine?: 'azure' | 'webspeech' | null; dimmed?: boolean
  title?: ReactNode; sub?: ReactNode; align?: 'center' | 'start'; onBand?: boolean; children?: ReactNode
}) {
  const dim = dimmed ? 'opacity-40 pointer-events-none' : ''
  const start = (align ?? (title !== undefined ? 'start' : 'center')) === 'start'
  // brief §1: header căn trái dùng gap 10/14; header căn giữa giữ 8/12 của Phase 12. Split into the
  // two tokens that sit either side of `md:h-16 md:grid-cols-...` below so the default (no title,
  // no onBand) header className stays the exact pre-Task-1 string, not just an equivalent one.
  const gapStart = start ? 'gap-2.5' : 'gap-2'
  const gapMd = start ? 'md:gap-3.5' : 'md:gap-3'
  // R19 / quyết định 5: ngoại lệ CÓ TÊN với luật "header luôn trên cream" — chỉ TopicHub dùng.
  // Fix wave M1: the white-back-button rule used to also live here, duplicating the cell-level one
  // below (`[&>a]:bg-white/[.92] [&>a]:text-teal-600`, line ~30) on the very same anchor — dropped
  // here since the cell-level rule is the more local, cheaper selector.
  const band = onBand ? ' bg-transparent' : ''
  // Every `start` call site before Task 10 (Phase 14's list screens) passes the `child` `BackButton`
  // — a 56/64 px circle, exactly the fixed track below — so a fixed track and an `auto` one size it
  // identically and neither changes those screens' pixels. Task 10 is the first to pair `start` with
  // the `adult` pill (a real, wider label, "Về nhà"/"Về bản đồ 🏝️"): a fixed 56/64 px track cannot
  // hold it, and CSS grid does not reflow a track to fit an overflowing item, so the pill painted
  // straight over the title next to it. `auto` sizes the track to whatever `back` actually is, in
  // both branches — a no-op for a circle, the fix for a pill. Center mode keeps the exact fixed-track
  // tokens, in the exact positions, its own "byte-identical" test asserts on (`toBe`, not
  // `toHaveClass` — token order matters there); so does the right column, which no call site has hit
  // this problem on yet.
  const colsPhone = start ? 'grid-cols-[auto_1fr_56px]' : 'grid-cols-[56px_1fr_56px]'
  const colsMd = start ? 'md:grid-cols-[auto_1fr_minmax(64px,auto)]' : 'md:grid-cols-[64px_1fr_minmax(64px,auto)]'
  return (
    <header className={`grid h-14 ${colsPhone} items-center ${gapStart} md:h-16 ${colsMd} ${gapMd}${band}`}>
      <div className={`justify-self-start ${onBand ? '[&>a]:bg-white/[.92] [&>a]:text-teal-600' : ''} ${dim}`}>{back}</div>
      <div className={start
        ? 'flex min-w-0 flex-1 items-center justify-self-stretch gap-2.5 text-left'
        : 'flex min-w-0 flex-col items-center justify-self-center gap-[3px] md:flex-row md:gap-2.5'}>
        {title !== undefined ? (
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate font-display text-[22px] font-extrabold leading-[1.1] text-ink-900 md:text-[28px]">{title}</h1>
            {sub !== undefined && <p className="truncate text-[13px] font-bold text-ink-500 md:text-[15px]">{sub}</p>}
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">{children}</div>
        )}
        <EngineBadge engine={engine} />
      </div>
      <div data-testid="header-right" className={`flex justify-self-end ${dim}`}>{right === undefined ? <LessonChip /> : right}</div>
    </header>
  )
}
