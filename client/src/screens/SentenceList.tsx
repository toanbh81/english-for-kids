import { Link } from 'react-router-dom'
import type { Sentence } from '../content'
import { SENTENCES } from '../content'
import { getStars } from '../progress/store'
import { Stars } from '../components/Stars'

const TAP_TARGET = 'min-h-[64px] flex items-center'

const TOPIC_ORDER: Sentence['topic'][] = ['food', 'school', 'family']
const TOPIC_LABEL: Record<Sentence['topic'], { title: string; emoji: string }> = {
  food: { title: 'Đồ ăn', emoji: '🍎' },
  school: { title: 'Trường học', emoji: '🎒' },
  family: { title: 'Gia đình', emoji: '👨‍👩‍👧' },
}

export function SentenceList() {
  return (
    <main className="p-8">
      <Link to="/" className={`text-2xl px-4 ${TAP_TARGET}`}>← Về nhà</Link>
      <h1 className="text-5xl font-extrabold my-6">🧱 Ghép câu</h1>
      <div className="flex flex-col gap-8">
        {TOPIC_ORDER.map(topic => (
          <section key={topic}>
            <h2 className="text-3xl font-extrabold mb-3 flex items-center gap-2">
              <span>{TOPIC_LABEL[topic].emoji}</span>
              <span>{TOPIC_LABEL[topic].title}</span>
            </h2>
            <div className="flex flex-col gap-3">
              {SENTENCES.filter(s => s.topic === topic).map(s => (
                <Link
                  key={s.id}
                  to={`/sentence/${s.id}`}
                  className={`rounded-3xl bg-white shadow px-6 flex items-center justify-between gap-4 active:scale-95 ${TAP_TARGET}`}
                >
                  <span className="text-2xl font-extrabold">{s.vi}</span>
                  <Stars value={getStars(`sentence:${s.id}`)} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
