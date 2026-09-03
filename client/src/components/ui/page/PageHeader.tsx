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
  // brief §1: header căn trái dùng gap 10/14; header căn giữa giữ 8/12 của Phase 12.
  const gap = start ? 'gap-2.5 md:gap-3.5' : 'gap-2 md:gap-3'
  // R19 / quyết định 5: ngoại lệ CÓ TÊN với luật "header luôn trên cream" — chỉ TopicHub dùng.
  const band = onBand ? 'bg-transparent [&>div:first-child>a]:bg-white/[.92] [&>div:first-child>a]:text-teal-600' : ''
  return (
    <header className={`grid h-14 grid-cols-[56px_1fr_56px] items-center ${gap} md:h-16 md:grid-cols-[64px_1fr_minmax(64px,auto)] ${band}`}>
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
