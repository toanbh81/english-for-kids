import { useEffect, useRef } from 'react'
import { Button } from './ui'
import { WeekDots } from './ui/WeekDots'

/**
 * The strip's tap target, expanded: this week's dots with per-day minutes, and the three numbers a
 * parent taps the strip to see — the running streak, the child's best-ever run, and how much of
 * this week they have practised.
 *
 * Below `ipad:` it is a bottom sheet under a scrim (both dismiss on tap, alongside Escape); from
 * `ipad:` it is a borderless popover anchored under the strip (the scrim is `ipad:hidden` — nothing
 * behind the popover captures the tap that would open a *different* island underneath it).
 */
export function StreakPanel({
  streak, longest, weekMinutes, stars, dots, minutes, onClose,
}: {
  streak: number
  longest: number
  weekMinutes: number
  stars: number
  dots: { day: string; done: boolean; isToday: boolean }[]
  minutes?: Record<string, number>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Open: move focus into the dialog, onto its one focusable control ("Đóng") — a modal that opens
  // with focus left behind on the trigger reads as inert to a screen-reader or keyboard user. Close
  // (this component unmounts — `StreakWeek` only renders it while `open`): hand focus back to
  // whatever had it before, which is always the `StreakWeek` trigger button that opened it.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { previouslyFocused?.focus?.() }
  }, [])

  return (
    <>
      <div className="fixed inset-0 z-[54] bg-[rgba(74,59,51,.35)] ipad:hidden" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tuần này của con 🔥"
        className="fixed inset-x-0 bottom-0 z-[55] rounded-t-r28 bg-white px-4 pb-11 pt-2.5 ipad:absolute ipad:inset-auto ipad:top-full ipad:left-0 ipad:mt-2 ipad:w-[360px] ipad:rounded-r22 ipad:shadow-dialog"
      >
        <div className="mx-auto mb-2.5 h-[5px] w-11 rounded-full bg-sand-edge ipad:hidden" />

        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-[20px] font-extrabold text-ink-900">Tuần này của con 🔥</h2>
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sun-50 px-3 py-1 font-display text-[14px] font-extrabold text-sun-700">
            ⭐ {stars}
          </div>
        </div>
        {streak === 0 && (
          <p className="mt-1 text-[13px] font-bold text-ink-500">0 ngày · bắt đầu hôm nay nhé!</p>
        )}

        <div className="mt-4">
          <WeekDots dots={dots} minutes={minutes} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-r16 bg-teal-50 px-2 py-3 text-center">
            <div className="font-display text-[20px] font-extrabold text-teal-600">{streak} ngày</div>
            <div className="text-[11px] font-extrabold text-ink-300">Chuỗi hiện tại</div>
          </div>
          <div className="rounded-r16 bg-sand px-2 py-3 text-center">
            <div className="font-display text-[20px] font-extrabold text-ink-900">{longest} ngày</div>
            <div className="text-[11px] font-extrabold text-ink-300">Dài nhất</div>
          </div>
          <div className="rounded-r16 bg-sand px-2 py-3 text-center">
            <div className="font-display text-[20px] font-extrabold text-ink-900">{weekMinutes}&apos;</div>
            <div className="text-[11px] font-extrabold text-ink-300">Tuần này</div>
          </div>
        </div>

        <Button variant="outline" className="mt-4 w-full" onClick={onClose}>Đóng</Button>
      </div>
    </>
  )
}
