import { Button } from './ui/Button'
import { ProgressBar } from './ui/ProgressBar'

/** The fraction of today's generated lesson the child has finished (`lessonStatus`). */
export type MissionProgress = { doneCount: number; total: number; done: boolean }

/** The daily mission panel on the map: how far through today's lesson the child is, and the single
 * call to action that takes them to the lesson itself. The items live one tap away on /mission. */
export function MissionCard({ status, className = '' }: { status: MissionProgress; className?: string }) {
  const { doneCount, total, done } = status
  // An empty lesson (nothing generated yet) must not divide by zero — it reads as 0 %.
  const pct = total > 0 ? (doneCount / total) * 100 : 0

  return (
    <div className={`rounded-xl3 bg-white shadow-card p-5 flex flex-col gap-3 w-full max-w-md ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[23px] font-extrabold text-ink-900">🌞 Nhiệm vụ hôm nay</h2>
        <span className="font-display text-[19px] font-extrabold text-teal-600">{doneCount}/{total}</span>
      </div>

      <ProgressBar value={pct} />

      {done && (
        <div className="text-center font-display text-2xl font-extrabold text-good-700">Hoàn thành! 🎉</div>
      )}

      <Button to="/mission" className="w-full">
        {done ? 'Hoàn thành rồi! 🎉 Chơi lại?' : 'Bắt đầu ▸'}
      </Button>
    </div>
  )
}
