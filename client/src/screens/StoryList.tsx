import { Link } from 'react-router-dom'
import { STORIES } from '../content/stories'
import { getStars } from '../progress/store'
import { BackButton, StarRow } from '../components/ui'

const CARD =
  'flex flex-col items-center gap-2 rounded-xl3 bg-white p-6 shadow-card transition-transform active:scale-95'

export function StoryList() {
  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <BackButton to="/" label="Về nhà" className="self-start" />
        <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">🎧 Nghe kể chuyện</h1>
        <div className="grid grid-cols-3 gap-6">
          {STORIES.map(s => (
            <Link key={s.id} to={`/story/${s.id}`} className={CARD}>
              <span aria-hidden="true" className="text-[72px] leading-none">{s.emoji}</span>
              <span className="text-center font-display text-[26px] font-extrabold leading-tight text-ink-900">{s.title}</span>
              <span className="text-center text-lg font-bold text-ink-500">{s.titleVi}</span>
              <StarRow value={getStars(`story:${s.id}`)} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
