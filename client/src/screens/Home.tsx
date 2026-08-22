import { Link } from 'react-router-dom'
import { LEVELS } from '../content'
import { totalStars } from '../progress/store'

export function Home() {
  return (
    <main className="h-full flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-6xl font-extrabold text-coral">Speak Up! 🦊</h1>
      <div className="text-2xl">⭐ {totalStars()} sao</div>
      <div className="flex gap-6">
        {LEVELS.map(l => (
          <Link
            key={l.id}
            to={`/level/${l.id}`}
            className="w-64 h-40 rounded-3xl bg-teal text-white text-3xl font-extrabold flex items-center justify-center shadow-lg active:scale-95"
          >
            {l.title}
          </Link>
        ))}
      </div>
    </main>
  )
}
