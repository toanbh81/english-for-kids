import { Button } from './ui/Button'
import { ProgressBar } from './ui/ProgressBar'

/** The fraction of today's generated lesson the child has finished (`lessonStatus`). */
export type MissionProgress = { doneCount: number; total: number; done: boolean }

/** The daily mission panel on the map: how far through today's lesson the child is, and the single
 * call to action that takes them to the lesson itself. The items live one tap away on /mission.
 *
 * Task 10 (spec decisions 18/19): the card is now a fixed 300×128 tile at every width — the
 * responsive M1b-vs-iPad sizing is gone — with a fourth state, `empty` (`total === 0`, derived
 * here rather than added to `MissionProgress`) for the morning before today's lesson exists: the
 * count reads "—", the bar sits at 0 %, and the CTA offers free practice instead of a lesson that
 * has nothing in it yet. */
export function MissionCard({ status, className = '' }: { status: MissionProgress; className?: string }) {
  const { doneCount, total, done } = status
  const empty = total === 0
  // An empty lesson (nothing generated yet) must not divide by zero — it reads as 0 %.
  const pct = total > 0 ? (doneCount / total) * 100 : 0
  const count = empty ? '—' : done ? `✓ ${doneCount}/${total}` : `${doneCount}/${total}`
  const countTone = empty ? 'text-ink-300' : done ? 'text-good-700' : doneCount === 0 ? 'text-ink-500' : 'text-teal-600'

  return (
    <div
      data-testid="mission-card"
      className={`flex h-[128px] w-full max-w-[300px] flex-col justify-center gap-2 rounded-r22 border-2 border-[#F1E7D4] bg-white px-4 py-3.5 shadow-[0_6px_0_#EFE2CC] ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[16px] font-extrabold text-ink-900">🌞 Nhiệm vụ hôm nay</h2>
        <span className={`font-display text-[15px] font-extrabold ${countTone}`}>{count}</span>
      </div>

      <ProgressBar value={pct} className={`h-[11px] ${done ? '[&>div]:bg-good-300' : ''}`} />

      {/* "Bắt đầu" only ever means an untouched lesson (spec §2): once the child has ticked
        * something off, the card offers to carry on rather than to start over. */}
      <Button
        size="sm"
        to={empty ? '/' : '/mission'}
        variant={empty ? 'outline' : done ? 'secondary' : 'primary'}
        className="w-full"
      >
        {empty ? 'Luyện tự do →' : done ? 'Chơi lại 🎉' : doneCount === 0 ? 'Bắt đầu ▸' : 'Tiếp tục ▸'}
      </Button>
    </div>
  )
}
