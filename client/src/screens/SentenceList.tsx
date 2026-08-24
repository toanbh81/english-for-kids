import { Link } from 'react-router-dom'
import type { Sentence } from '../content'
import { SENTENCES } from '../content'
import { getStars } from '../progress/store'
import { BackButton, StarRow } from '../components/ui'

const TOPIC_ORDER: Sentence['topic'][] = ['animals', 'food', 'school', 'family', 'weather']
const TOPIC_LABEL: Record<Sentence['topic'], { title: string; emoji: string }> = {
  animals: { title: 'Động vật', emoji: '🐘' },
  food: { title: 'Đồ ăn', emoji: '🍎' },
  school: { title: 'Trường học', emoji: '🎒' },
  family: { title: 'Gia đình', emoji: '👨‍👩‍👧' },
  weather: { title: 'Thời tiết', emoji: '☀️' },
}

const ROW =
  'flex min-h-[80px] items-center justify-between gap-4 rounded-xl3 bg-white px-6 py-3 shadow-card transition-transform active:scale-95'

export function SentenceList() {
  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <BackButton to="/" label="Về nhà" className="self-start" />
        <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">🧱 Ghép câu</h1>
        <div className="flex flex-col gap-7">
          {TOPIC_ORDER.map(topic => (
            <section key={topic}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-[26px] font-extrabold text-ink-900">
                <span aria-hidden="true">{TOPIC_LABEL[topic].emoji}</span>
                <span>{TOPIC_LABEL[topic].title}</span>
              </h2>
              <div className="flex flex-col gap-4">
                {SENTENCES.filter(s => s.topic === topic).map(s => (
                  <Link key={s.id} to={`/sentence/${s.id}`} className={ROW}>
                    <span className="font-display text-[24px] font-extrabold text-ink-900">{s.vi}</span>
                    <StarRow value={getStars(`sentence:${s.id}`)} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
