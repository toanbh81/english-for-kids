import { Link } from 'react-router-dom'

type MissionStatus = { story: number; speak: number; word: number; done: boolean }

const ROWS: { key: keyof Omit<MissionStatus, 'done'>; emoji: string; label: string; target: number; to: string }[] = [
  { key: 'story', emoji: '🎧', label: 'truyện', target: 1, to: '/stories' },
  { key: 'speak', emoji: '🗣️', label: 'thẻ', target: 5, to: '/level/sound-zoo' },
  { key: 'word', emoji: '🧩', label: 'từ', target: 3, to: '/words' },
]

export function MissionCard({ status }: { status: MissionStatus }) {
  return (
    <div className="rounded-3xl bg-white shadow p-5 flex flex-col gap-2 w-full max-w-md">
      <h2 className="text-2xl font-extrabold">Nhiệm vụ hôm nay</h2>
      {ROWS.map(row => {
        const count = status[row.key]
        const rowDone = count >= row.target
        return (
          <Link
            key={row.key}
            to={row.to}
            className="min-h-[64px] rounded-2xl bg-cream flex items-center gap-3 px-4 text-xl font-bold active:scale-95"
          >
            <span className="text-3xl">{row.emoji}</span>
            <span>{row.target} {row.label} {count}/{row.target}</span>
            {rowDone && <span className="text-good">✓</span>}
          </Link>
        )
      })}
      {status.done && (
        <div className="text-center text-2xl font-extrabold text-good">Hoàn thành! 🎉</div>
      )}
    </div>
  )
}
