import { Link, useSearchParams } from 'react-router-dom'
import { SENTENCES } from '../content'
import { TOPICS, findTopic } from '../content/topics'
import { getStars } from '../progress/store'
import { topicUnlocked } from '../progress/topicProgress'
import { BackButton, StarRow } from '../components/ui'

const ROW =
  'flex min-h-[80px] items-center justify-between gap-4 rounded-xl3 bg-white px-6 py-3 shadow-card transition-transform active:scale-95'

export function SentenceList() {
  const [params] = useSearchParams()
  // `?topic=<id>` comes from a topic hub. An unknown id is treated as no filter at all, so a stale
  // deep link still shows the child something to do.
  const topic = findTopic(params.get('topic') ?? '')
  // Unfiltered, this screen is a full index of the game's sentences — so it lists only the topics
  // the map has opened, or it would be a way around the island unlocks. A hub that links in with
  // its own `?topic=` has already made that decision.
  const shown = topic ? [topic] : TOPICS.filter(t => topicUnlocked(t.id))

  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <BackButton
          to={topic ? `/topic/${topic.id}` : '/'}
          label={topic ? 'Quay lại' : 'Về nhà'}
          className="self-start"
        />
        <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">
          {topic ? `🧱 Ghép câu — ${topic.name}` : '🧱 Ghép câu'}
        </h1>
        <div className="flex flex-col gap-7">
          {shown.map(t => (
            <section key={t.id}>
              {/* One topic on screen is already named by the heading above — a second copy of the
                * same name would only repeat itself. */}
              {!topic && (
                <h2 className="mb-3 flex items-center gap-2 font-display text-[26px] font-extrabold text-ink-900">
                  <span aria-hidden="true">{t.emoji}</span>
                  <span>{t.name}</span>
                </h2>
              )}
              <div className="flex flex-col gap-4">
                {SENTENCES.filter(s => s.topic === t.id).map(s => (
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
