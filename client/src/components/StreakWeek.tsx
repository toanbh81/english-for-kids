import { useState } from 'react'
import { StreakPanel } from './StreakPanel'
import { WeekDots } from './ui/WeekDots'

/** The week pill of the island-map header: a compact 24 px week trail plus the streak count,
 * wrapped in a button — tapping it opens `StreakPanel` with the numbers the strip has no room for
 * (the longest run and this week's minutes). */
export function StreakWeek({
  dots, streak, longest, weekMinutes, stars, minutes,
}: {
  dots: { day: string; done: boolean; isToday: boolean }[]
  streak: number
  longest: number
  weekMinutes: number
  stars: number
  minutes?: Record<string, number>
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Tuần này của con"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="inline-flex min-h-[44px] min-w-[64px] items-center gap-3 rounded-[18px] bg-white px-4 py-2.5 shadow-card-sm"
      >
        <WeekDots dots={dots} size="sm" />
        <div className="font-display text-lg font-extrabold text-ink-900">🔥 {streak} ngày</div>
      </button>
      {open && (
        <StreakPanel
          streak={streak}
          longest={longest}
          weekMinutes={weekMinutes}
          stars={stars}
          dots={dots}
          minutes={minutes}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
