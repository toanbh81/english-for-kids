import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SENTENCES } from '../content'
import { STORIES } from '../content/stories'
import { findTopic } from '../content/topics'
import type { Topic } from '../content/topics'
import { findTopic as findWordDeck } from '../content/words'
import { lessonStatus } from '../progress/lesson'
import { getStars } from '../progress/store'
import { topicStars, topicUnlocked, unlockedWords } from '../progress/topicProgress'
import { BackButton, Chip, StarRow } from '../components/ui'

/** Section cards are the child's tap targets, so they sit well above the 64 px floor. */
const SECTION =
  'flex min-h-[96px] items-center gap-5 rounded-xl3 bg-white px-6 py-4 shadow-card transition-transform active:scale-95'
const SECTION_MUTED =
  'flex min-h-[96px] items-center gap-5 rounded-xl3 bg-cream-50 px-6 py-4 shadow-card-sm opacity-70'
const SECTION_EMOJI = 'text-[56px] leading-none'
const SECTION_TITLE = 'font-display text-[26px] font-extrabold text-ink-900'
const SECTION_NOTE = 'text-lg font-bold text-ink-500'

/**
 * The badge that ties the two axes together (Phase 9 §4). The mission and the islands stay separate
 * — the hub never becomes a second mission screen — but a child standing on an island should be
 * able to see that the words (or the sentences, or that one story) waiting behind a section are
 * also part of today's lesson, so practising here ticks something off there.
 */
function TodayChip() {
  return <Chip tone="teal" size="sm">Có trong nhiệm vụ hôm nay</Chip>
}

function LockedTopic() {
  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 pt-10 text-center">
        <span aria-hidden="true" className="text-[96px] leading-none">🔒</span>
        <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Chưa mở khóa</h1>
        <p className={SECTION_NOTE}>Con học thêm ở đảo trước để mở đảo này nhé!</p>
        <BackButton to="/" label="Về nhà" />
      </div>
    </main>
  )
}

function TopicHubInner({ topic }: { topic: Topic }) {
  const deck = findWordDeck(topic.id)
  const deckSize = deck?.words.length ?? 0
  const words = unlockedWords(topic.id)

  const sentences = SENTENCES.filter(s => s.topic === topic.id)
  const starred = sentences.filter(s => getStars(`sentence:${s.id}`) > 0).length

  const stories = STORIES.filter(s => s.topic === topic.id)

  // One read of today's lesson per mount — `lessonStatus` parses the activity log and may generate
  // the day's lesson, so it must not run once per section. Its items carry the routes the practice
  // screens live at, and those routes are what the sections are matched against: a word item is
  // `/words/<topic>/<id>` (review steps included), a sentence `/sentence/<id>`, a story `/story/<id>`.
  const [todayRoutes] = useState(() => new Set(lessonStatus().items.map(i => i.route)))
  const wordsToday = [...todayRoutes].some(r => r.startsWith(`/words/${topic.id}/`))
  const sentencesToday = sentences.some(s => todayRoutes.has(`/sentence/${s.id}`))

  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <BackButton to="/" label="Về nhà" className="self-start" />

        <header className="flex flex-wrap items-center gap-4">
          <span aria-hidden="true" className="text-[64px] leading-none">{topic.emoji}</span>
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">{topic.name}</h1>
          <StarRow value={topicStars(topic.id)} />
        </header>

        <Link to={`/words/${topic.id}`} className={SECTION}>
          <span aria-hidden="true" className={SECTION_EMOJI}>🧩</span>
          <span className="flex flex-col">
            <span className={SECTION_TITLE}>Từ mới</span>
            <span className={SECTION_NOTE}>{words}/{deckSize} từ</span>
          </span>
          {wordsToday && <span className="ml-auto"><TodayChip /></span>}
        </Link>

        <Link to={`/sentences?topic=${topic.id}`} className={SECTION}>
          <span aria-hidden="true" className={SECTION_EMOJI}>🧱</span>
          <span className="flex flex-col">
            <span className={SECTION_TITLE}>Ghép câu</span>
            <span className={SECTION_NOTE}>{starred}/{sentences.length} câu có sao</span>
          </span>
          {sentencesToday && <span className="ml-auto"><TodayChip /></span>}
        </Link>

        <section className="flex flex-col gap-4">
          {stories.length === 0 ? (
            // No story for this topic yet: a muted card, never a link, so a tap cannot dead-end.
            <div className={SECTION_MUTED}>
              <span aria-hidden="true" className={SECTION_EMOJI}>🎧</span>
              <span className="flex flex-col">
                <span className={SECTION_TITLE}>Truyện</span>
                <Chip tone="neutral" size="sm">Sắp có 📖</Chip>
              </span>
            </div>
          ) : (
            stories.map(story => (
              <Link key={story.id} to={`/story/${story.id}`} className={SECTION}>
                <span aria-hidden="true" className={SECTION_EMOJI}>🎧</span>
                <span className="flex flex-col">
                  <span className={SECTION_TITLE}>{story.titleVi}</span>
                  <span className={SECTION_NOTE}>{story.title}</span>
                </span>
                <span className="ml-auto flex items-center gap-3">
                  {todayRoutes.has(`/story/${story.id}`) && <TodayChip />}
                  <StarRow value={getStars(`story:${story.id}`)} />
                </span>
              </Link>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

/**
 * A topic's hub: its words, its sentences and its stories in one place (spec §3). The outer shell
 * decides whether the topic may be opened at all — a child can deep-link into a locked or unknown
 * id from PWA history, and that has to land somewhere friendly rather than on a blank screen.
 */
export function TopicHub() {
  const { id = '' } = useParams()
  const topic = findTopic(id)
  if (!topic || !topicUnlocked(topic.id)) return <LockedTopic />
  return <TopicHubInner topic={topic} />
}
