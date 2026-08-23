const LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export function StreakWeek({ dots, streak }: { dots: { day: string; done: boolean; isToday: boolean }[]; streak: number }) {
  return (
    <div className="rounded-3xl bg-white shadow p-5 flex flex-col items-center gap-3 w-full max-w-md">
      <div className="flex gap-3">
        {dots.map((dot, i) => (
          <div key={dot.day} className="flex flex-col items-center gap-1">
            <span className="text-sm font-bold text-slate-500">{LABELS[i]}</span>
            <span
              data-testid="streak-dot"
              data-today={dot.isToday}
              className={`text-2xl ${dot.done ? 'text-star' : 'text-slate-300'} ${dot.isToday ? 'ring-2 ring-coral rounded-full' : ''}`}
            >
              {dot.done ? '★' : '○'}
            </span>
          </div>
        ))}
      </div>
      <div className="text-2xl font-extrabold">🔥 {streak} ngày</div>
    </div>
  )
}
