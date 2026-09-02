import type { ReactNode } from 'react'
import { LessonChip } from '../../LessonChip'
import { EngineBadge } from './EngineBadge'

/** The 3-column header every migrated screen shares: back button, centred content, and a right
 * cell that defaults to `LessonChip` — a caller that has nothing to put there (Home, the parent
 * dashboard) passes `right={null}` for an empty cell instead. */
export function PageHeader({ back, right, engine, dimmed, children }: { back: ReactNode; right?: ReactNode; engine?: 'azure' | 'webspeech' | null; dimmed?: boolean; children?: ReactNode }) {
  const dim = dimmed ? 'opacity-40 pointer-events-none' : ''
  return (
    <header className="grid h-14 grid-cols-[56px_1fr_56px] items-center gap-2 md:h-16 md:grid-cols-[64px_1fr_minmax(64px,auto)] md:gap-3">
      <div className={`justify-self-start ${dim}`}>{back}</div>
      <div className="flex min-w-0 flex-col items-center justify-self-center gap-[3px] md:flex-row md:gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">{children}</div>
        <EngineBadge engine={engine} />
      </div>
      <div data-testid="header-right" className={`flex justify-self-end ${dim}`}>{right === undefined ? <LessonChip /> : right}</div>
    </header>
  )
}
