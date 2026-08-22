import { Link } from 'react-router-dom'
import { STORIES } from '../content/stories'
import { getStars } from '../progress/store'
import { Stars } from '../components/Stars'

export function StoryList() {
  return (
    <main className="p-8">
      <Link to="/" className="text-2xl inline-flex items-center min-h-[64px] px-4">← Về nhà</Link>
      <h1 className="text-5xl font-extrabold my-6">🎧 Nghe kể chuyện</h1>
      <div className="grid grid-cols-3 gap-5">
        {STORIES.map(s => (
          <Link
            key={s.id}
            to={`/story/${s.id}`}
            className="rounded-3xl bg-white shadow p-5 flex flex-col items-center gap-2 active:scale-95"
          >
            <span className="text-7xl">{s.emoji}</span>
            <span className="text-3xl font-extrabold">{s.title}</span>
            <span className="text-xl text-slate-500">{s.titleVi}</span>
            <Stars value={getStars(`story:${s.id}`)} />
          </Link>
        ))}
      </div>
    </main>
  )
}
