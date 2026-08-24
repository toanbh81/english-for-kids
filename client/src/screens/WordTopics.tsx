import { Link } from 'react-router-dom'
import { TOPICS, ALL_WORDS } from '../content/words'
import { getBox, dueWords } from '../progress/leitner'
import { topicUnlocked } from '../progress/topicProgress'
import { BackButton, CARD_LINK, Chip } from '../components/ui'

/**
 * The flat vocabulary index, kept from phases 1–6 as the way into the review deck. Since Phase 7
 * the map decides what a child may open, so this screen shows only the topics the map has already
 * unlocked — otherwise it was a side door straight into locked content.
 */
export function WordTopics() {
  const dueCount = dueWords().filter(id => ALL_WORDS.some(w => w.id === id)).length
  const topics = TOPICS.filter(t => topicUnlocked(t.id))

  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <BackButton to="/" label="Về nhà" className="self-start" />

        <header className="text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">
            Từ mới hôm nay 🧩
          </h1>
          <p className="mt-1 text-lg font-bold text-ink-500">Chạm thẻ để lật — nói đúng để mở khoá!</p>
        </header>

        <div className="grid grid-cols-3 gap-6">
          <Link to="/words/review" className={CARD_LINK}>
            <span aria-hidden="true" className="text-[64px] leading-none">📚</span>
            {/* The count rides inside the chip's own text so the label reads as one phrase. */}
            <Chip tone="sun" className="text-[22px]">Ôn tập hôm nay ({dueCount})</Chip>
          </Link>
          {topics.map(t => {
            const unlocked = t.words.filter(w => getBox(w.id) > 0).length
            return (
              <Link key={t.id} to={`/words/${t.id}`} className={CARD_LINK}>
                <span aria-hidden="true" className="text-[64px] leading-none">{t.emoji}</span>
                <span className="font-display text-[26px] font-extrabold text-ink-900">{t.title}</span>
                <span className="text-lg font-bold text-ink-500">{unlocked}/{t.words.length} đã mở khoá</span>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
