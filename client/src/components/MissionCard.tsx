import { Button } from './ui/Button'
import { ProgressBar } from './ui/ProgressBar'

/** The fraction of today's generated lesson the child has finished (`lessonStatus`). */
export type MissionProgress = { doneCount: number; total: number; done: boolean }

/** The daily mission panel on the map: how far through today's lesson the child is, and the single
 * call to action that takes them to the lesson itself. The items live one tap away on /mission.
 *
 * On a phone the card is the tighter one of design M1b — it sits near the top of Home there, where
 * every pixel it spends is a pixel the island grid below it loses — and it grows back into the
 * iPad card from the tablet breakpoint up. */
export function MissionCard({ status, className = '' }: { status: MissionProgress; className?: string }) {
  const { doneCount, total, done } = status
  // An empty lesson (nothing generated yet) must not divide by zero — it reads as 0 %.
  const pct = total > 0 ? (doneCount / total) * 100 : 0

  return (
    <div className={`rounded-xl2 bg-white shadow-card-sm p-4 flex flex-col gap-2 w-full max-w-md md:rounded-xl3 md:shadow-card md:p-5 md:gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-extrabold text-ink-900 md:text-[23px]">🌞 Nhiệm vụ hôm nay</h2>
        <span className="font-display text-[15px] font-extrabold text-teal-600 md:text-[19px]">{doneCount}/{total}</span>
      </div>

      <ProgressBar value={pct} />

      {done && (
        <div className="text-center font-display text-lg font-extrabold text-good-700 md:text-2xl">Hoàn thành! 🎉</div>
      )}

      {/* "Bắt đầu" only ever means an untouched lesson (spec §2): once the child has ticked
        * something off, the card offers to carry on rather than to start over. */}
      <Button to="/mission" className="w-full">
        {done
          ? 'Hoàn thành rồi! 🎉 Chơi lại?'
          : doneCount === 0 ? 'Bắt đầu ▸' : 'Tiếp tục ▸'}
      </Button>
    </div>
  )
}
