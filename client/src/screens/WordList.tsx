import { Link, useParams } from 'react-router-dom'
import type { Word } from '../content/words/types'
import { findTopic, findWord } from '../content/words'
import { getBox, dueWords } from '../progress/leitner'

const TAP_TARGET = 'min-h-[64px] flex items-center'

export function WordList() {
  const { topic = '' } = useParams()
  const isReview = topic === 'review'
  const t = isReview ? undefined : findTopic(topic)

  if (!isReview && !t) {
    return (
      <main className="p-8">
        <p className="text-2xl mb-4">Không tìm thấy chủ đề</p>
        <Link to="/words" className={`text-2xl px-4 ${TAP_TARGET}`}>← Từ vựng</Link>
      </main>
    )
  }

  const words: Word[] = isReview
    ? dueWords().map(findWord).filter((w): w is Word => !!w)
    : t!.words
  const title = isReview ? 'Ôn tập hôm nay' : t!.title

  return (
    <main className="p-8">
      <Link to="/words" className={`text-2xl px-4 ${TAP_TARGET}`}>← Từ vựng</Link>
      <h1 className="text-5xl font-extrabold my-6 flex items-center gap-3">
        <span>{isReview ? '📚' : t!.emoji}</span>
        <span>{title}</span>
      </h1>
      {words.length === 0 ? (
        <p className="text-2xl text-slate-500">Chưa có từ cần ôn hôm nay 🎉</p>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {words.map(w => (
            <Link
              key={w.id}
              to={`/words/${topic}/${w.id}`}
              className="rounded-3xl bg-white shadow p-5 flex flex-col items-center gap-2 active:scale-95"
            >
              <span className="text-6xl">{w.emoji}</span>
              <span className="text-2xl font-extrabold">{w.word}</span>
              <span className="text-2xl">{getBox(w.id) > 0 ? '🔓' : '🔒'}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
