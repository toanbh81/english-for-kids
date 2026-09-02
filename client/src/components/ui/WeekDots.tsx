const LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

type Dot = { day: string; done: boolean; isToday: boolean }

/**
 * The week's star trail — a sun-yellow star for a day whose mission was finished, a dashed empty
 * ring for one that was not, a gold ring on today, and a day still to come dimmed.
 *
 * `weekDots()` never returns a `future` flag (it only knows `done`/`isToday`), so this derives it
 * itself: any dot dated after the one marked `isToday` (string-comparable `YYYY-MM-DD` keys). With
 * no `isToday` dot in the array at all (should not happen from `weekDots()`, but a caller could
 * pass a hand-built list) nothing is treated as future.
 *
 * `size="sm"` shrinks the 34 px dot to 24 px, for the compact strip inside `StreakWeek`'s header
 * button — every other width keeps the full 34 px size.
 */
export function WeekDots({ dots, minutes, size }: { dots: Dot[]; minutes?: number[]; size?: 'sm' }) {
  const todayKey = dots.find(d => d.isToday)?.day
  const small = size === 'sm'
  return (
    <div className="flex justify-between">
      {dots.map((d, i) => {
        const future = todayKey !== undefined && d.day > todayKey
        return (
          <div key={d.day} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-extrabold text-ink-300">{LABELS[i]}</span>
            <span
              data-testid="streak-dot"
              data-today={d.isToday ? 'true' : undefined}
              className={[
                'flex items-center justify-center rounded-full',
                small ? 'h-6 w-6 text-sm' : 'h-[34px] w-[34px] text-[15px]',
                d.done ? 'bg-sun-400' : 'border-2 border-dashed border-[#D9CBB4] bg-sand',
                d.isToday ? 'ring-[4px] ring-today' : '',
                future ? 'opacity-45' : '',
              ].filter(Boolean).join(' ')}
            >
              {d.done ? '⭐' : ''}
            </span>
            {minutes && (
              <span className={`whitespace-nowrap text-[12px] font-extrabold ${d.done ? 'text-teal-600' : d.isToday ? 'text-coral-text' : 'text-ink-300'}`}>
                {d.done ? `${minutes[i]}'` : d.isToday ? 'hôm nay' : '—'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
