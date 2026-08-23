import { Link, useParams } from 'react-router-dom'
import { LEVELS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, StarRow } from '../components/ui'

/** 64 px pill — a tap target, not just a label, so it is a chip in look only. */
const STAIRS_LINK =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-teal-50 px-6 font-display text-lg font-extrabold text-teal-600 shadow-card-sm active:translate-y-[2px]'

export function LevelSelect() {
  const { levelId } = useParams()
  const level = LEVELS.find(l => l.id === levelId)
  if (!level) return <p>Không tìm thấy</p>
  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        {/* Back goes to the map — that is where the child came from, since Home links levels
            directly. The stairs at `/levels` are the second way in, hence the chip beside it. */}
        <div className="flex items-center justify-between gap-4">
          <BackButton to="/" label="Về bản đồ" />
          <Link to="/levels" className={STAIRS_LINK}>🗣️ Xem các bậc</Link>
        </div>

        <header className="text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">{level.title}</h1>
          <p className="mt-1 text-lg font-bold text-ink-500">Chạm vào một thẻ để luyện nói nhé!</p>
        </header>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {level.cards.map(c => (
            <Link
              key={c.id}
              to={`/practice/${c.id}`}
              className="flex flex-col items-center gap-2 rounded-xl3 bg-white p-5 shadow-card active:translate-y-[2px]"
            >
              <span aria-hidden="true" className="text-[56px] leading-none">{c.emoji}</span>
              <span className="font-display text-2xl font-extrabold text-ink-900">{c.text}</span>
              <StarRow value={getStars(c.id)} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
