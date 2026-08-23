import { Link } from 'react-router-dom'
import { Button } from './ui/Button'
import { ProgressBar } from './ui/ProgressBar'

type MissionStatus = { story: number; speak: number; word: number; done: boolean }

const ROWS: { key: keyof Omit<MissionStatus, 'done'>; emoji: string; label: string; target: number; to: string }[] = [
  { key: 'story', emoji: '🎧', label: 'truyện', target: 1, to: '/stories' },
  { key: 'speak', emoji: '🗣️', label: 'thẻ', target: 5, to: '/level/sound-zoo' },
  { key: 'word', emoji: '🧩', label: 'từ', target: 3, to: '/words' },
]

/** The daily mission panel: one tappable row per step, the "n/3" progress of the whole mission and
 * the single call to action that takes the child to the mission screen. */
export function MissionCard({ status, className = '' }: { status: MissionStatus; className?: string }) {
  const doneSteps = ROWS.filter(row => status[row.key] >= row.target).length

  return (
    <div className={`rounded-xl3 bg-white shadow-card p-5 flex flex-col gap-3 w-full max-w-md ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[23px] font-extrabold text-ink-900">🌞 Nhiệm vụ hôm nay</h2>
        <span className="font-display text-[19px] font-extrabold text-teal-600">{doneSteps}/{ROWS.length}</span>
      </div>

      <ProgressBar value={(doneSteps / ROWS.length) * 100} />

      {/* The step rows are the whole card in the stacked layout. On the landscape map the card is
        * an overlay in the corner of the island frame, where the handoff shows only the progress
        * and the CTA — the steps themselves live one tap away on /mission. */}
      <div className="flex flex-col gap-3 lg:hidden">
        {ROWS.map(row => {
          const count = status[row.key]
          const rowDone = count >= row.target
          return (
            <Link
              key={row.key}
              to={row.to}
              className={`min-h-[64px] rounded-xl2 flex items-center gap-3 px-4 font-display text-xl font-extrabold text-ink-900 active:translate-y-[2px] ${rowDone ? 'bg-teal-50' : 'bg-cream-50'}`}
            >
              <span className="text-3xl">{row.emoji}</span>
              <span>{row.target} {row.label} {count}/{row.target}</span>
              {rowDone && <span className="ml-auto text-good-700">✓</span>}
            </Link>
          )
        })}
      </div>

      {status.done && (
        <div className="text-center font-display text-2xl font-extrabold text-good-700">Hoàn thành! 🎉</div>
      )}

      <Button to="/mission" className="w-full">
        {status.done ? 'Hoàn thành rồi! 🎉 Chơi lại?' : 'Bắt đầu ▸'}
      </Button>
    </div>
  )
}
