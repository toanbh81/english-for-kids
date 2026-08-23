import { Link } from 'react-router-dom'
import { TOPICS, ALL_WORDS } from '../content/words'
import { getBox, dueWords } from '../progress/leitner'

const TAP_TARGET = 'min-h-[64px] flex items-center'

export function WordTopics() {
  const dueCount = dueWords().filter(id => ALL_WORDS.some(w => w.id === id)).length

  return (
    <main className="p-8">
      <Link to="/" className={`text-2xl px-4 ${TAP_TARGET}`}>← Về nhà</Link>
      <h1 className="text-5xl font-extrabold my-6">📖 Từ vựng</h1>
      <div className="grid grid-cols-3 gap-5">
        <Link
          to="/words/review"
          className="rounded-3xl bg-white shadow p-5 flex flex-col items-center gap-2 active:scale-95"
        >
          <span className="text-7xl">📚</span>
          <span className="text-2xl font-extrabold text-center">Ôn tập hôm nay ({dueCount})</span>
        </Link>
        {TOPICS.map(t => {
          const unlocked = t.words.filter(w => getBox(w.id) > 0).length
          return (
            <Link
              key={t.id}
              to={`/words/${t.id}`}
              className="rounded-3xl bg-white shadow p-5 flex flex-col items-center gap-2 active:scale-95"
            >
              <span className="text-7xl">{t.emoji}</span>
              <span className="text-3xl font-extrabold">{t.title}</span>
              <span className="text-xl text-slate-500">{unlocked}/{t.words.length} đã mở khoá</span>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
