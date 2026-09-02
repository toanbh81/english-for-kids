import { useEffect, type ReactNode } from 'react'
import { LessonChip } from '../../LessonChip'
import { EngineBadge } from './EngineBadge'
import { registerHeader } from './headerRegistry'

/** The 3-column header every migrated screen shares: back button, centred content, and a right
 * cell that defaults to the header-variant `LessonChip` — a caller that has nothing to put there
 * (Home, the parent dashboard) passes `right={null}` for an empty cell instead. Mounting this
 * registers with `headerRegistry` so the floating global `<LessonChip />` in `App.tsx` steps
 * aside while this header (and its own chip) is on screen. */
export function PageHeader({ back, right, engine, children }: { back: ReactNode; right?: ReactNode; engine?: 'azure' | 'webspeech' | null; children?: ReactNode }) {
  useEffect(() => registerHeader(), [])
  return (
    <header className="grid h-14 grid-cols-[56px_1fr_56px] items-center gap-2 md:h-16 md:grid-cols-[64px_1fr_minmax(64px,auto)] md:gap-3">
      <div className="justify-self-start">{back}</div>
      <div className="flex min-w-0 flex-col items-center justify-self-center gap-[3px] md:flex-row md:gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">{children}</div>
        <EngineBadge engine={engine} />
      </div>
      <div data-testid="header-right" className="flex justify-self-end">{right === undefined ? <LessonChip variant="header" /> : right}</div>
    </header>
  )
}
