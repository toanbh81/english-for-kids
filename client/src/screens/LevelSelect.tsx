import { Link, useParams } from 'react-router-dom'
import { LEVELS } from '../content'
import { getStars } from '../progress/store'
import { Stars } from '../components/Stars'

export function LevelSelect() {
  const level = LEVELS.find(l => l.id === useParams().levelId)
  if (!level) return <p>Không tìm thấy</p>
  return (
    <main className="p-8">
      <Link to="/" className="text-2xl inline-flex items-center min-h-[64px] px-4">← Về nhà</Link>
      <h1 className="text-5xl font-extrabold my-6">{level.title}</h1>
      <div className="grid grid-cols-3 gap-5">
        {level.cards.map(c => (
          <Link
            key={c.id}
            to={`/practice/${c.id}`}
            className="rounded-3xl bg-white shadow p-5 flex flex-col items-center gap-2 active:scale-95"
          >
            <span className="text-6xl">{c.emoji}</span>
            <span className="text-3xl font-extrabold">{c.text}</span>
            <Stars value={getStars(c.id)} />
          </Link>
        ))}
      </div>
    </main>
  )
}
