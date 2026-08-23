const LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** The week pill of the island-map header: seven 30 px day circles — a sun-yellow star for a day
 * whose mission was finished, a dashed empty ring for one that was not — and the streak count. */
export function StreakWeek({ dots, streak }: { dots: { day: string; done: boolean; isToday: boolean }[]; streak: number }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-[18px] bg-white px-4 py-2.5 shadow-card-sm">
      <div className="flex gap-1.5">
        {dots.map((dot, i) => (
          <div key={dot.day} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-extrabold text-ink-300">{LABELS[i]}</span>
            <span
              data-testid="streak-dot"
              data-today={dot.isToday}
              className={[
                'flex h-[30px] w-[30px] items-center justify-center rounded-full text-base leading-none',
                dot.done
                  ? 'bg-sun-400 text-white'
                  : 'border-2 border-dashed border-[#D9CBB4] bg-[#F3EADA] text-[#D9CBB4]',
                dot.isToday ? 'ring-2 ring-coral-500 ring-offset-2 ring-offset-white' : '',
              ].filter(Boolean).join(' ')}
            >
              {dot.done ? '★' : '○'}
            </span>
          </div>
        ))}
      </div>
      <div className="font-display text-lg font-extrabold text-ink-900">🔥 {streak} ngày</div>
    </div>
  )
}
