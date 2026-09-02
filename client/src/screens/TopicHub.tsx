import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SENTENCES } from '../content'
import { STORIES } from '../content/stories'
import { TOPICS, findTopic } from '../content/topics'
import type { Topic } from '../content/topics'
import { findTopic as findWordDeck } from '../content/words'
import { lessonStatus } from '../progress/lesson'
import { getStars } from '../progress/store'
import { topicStars, topicUnlocked, unlockedWords } from '../progress/topicProgress'
import { BackButton, Chip, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/**
 * Phone styles sit at the default breakpoint and `md:` (768) puts the tablet/iPad value back — the
 * phase-10 idiom, written out in full in `screens/SoundPractice.tsx`. `max-md:` appears only where
 * a shared primitive (`Chip`) writes the class being overridden for itself.
 *
 * Section cards are the child's tap targets, so both sizes sit well above the 64 px floor: the
 * design's 84 px row on a phone (§12 M8), the 96 px the landscape frame has always had from 768 up.
 * `flex-wrap` is the phone's safety valve — a story whose title, "hôm nay" chip and stars cannot
 * share one 390 px line drops the trailing group onto a second line instead of crushing the title.
 */
const SECTION =
  'flex min-h-[84px] flex-wrap items-center gap-3.5 rounded-[24px] bg-white px-[18px] py-4 shadow-card transition-transform active:scale-95'
  + ' md:min-h-[96px] md:flex-nowrap md:gap-5 md:rounded-xl3 md:px-6'
const SECTION_MUTED =
  'flex min-h-[84px] flex-wrap items-center gap-3.5 rounded-[24px] bg-cream-50 px-[18px] py-4 shadow-card-sm opacity-70'
  + ' md:min-h-[96px] md:flex-nowrap md:gap-5 md:rounded-xl3 md:px-6'
const SECTION_EMOJI = 'text-[34px] leading-none md:text-[56px]'
const SECTION_TITLE = 'font-display text-[19px] font-extrabold text-ink-900 md:text-[26px]'
const SECTION_NOTE = 'text-sm font-bold text-ink-500 md:text-lg'
/** The row's right-hand group: the "hôm nay" chip, the story's stars, and the phone's chevron.
 * It is always rendered, so at 768 up an empty one is a zero-width box and `ml-auto` a no-op. */
const SECTION_TAIL = 'ml-auto flex shrink-0 items-center gap-2 md:gap-3'

/** The design's "▸" at the end of every row — a phone affordance only: the landscape frame has
 * never had one and is not gaining one this phase. */
function Chevron() {
  return <span aria-hidden="true" className="font-display text-[22px] leading-none text-ink-300 md:hidden">▸</span>
}

/** A section that holds one of today's items is outlined as well as chipped on a phone (§12 M8),
 * where the chip alone shrinks to 11 px. `md:border-0` is the exact restore: the landscape card
 * has no border at all. */
const TODAY_OUTLINE = 'border-[3px] border-teal-500 md:border-0'

/**
 * The badge that ties the two axes together (Phase 9 §4). The mission and the islands stay separate
 * — the hub never becomes a second mission screen — but a child standing on an island should be
 * able to see that the words (or the sentences, or that one story) waiting behind a section are
 * also part of today's lesson, so practising here ticks something off there.
 */
function TodayChip() {
  // 11 px on a phone, where the chip shares an 84 px row with an emoji, a title and a chevron —
  // `max-md:` because `px-4 py-2` and the size's `text-base` are `Chip`'s own classes.
  return <Chip tone="teal" size="sm" className="max-md:px-2.5 max-md:py-1 max-md:text-[11px]">Có trong nhiệm vụ hôm nay</Chip>
}

function LockedTopic() {
  return (
    <PageShell>
      <PageHeader back={<BackButton to="/" label="Về nhà" />}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">Chưa mở khóa</h1>
      </PageHeader>
      <PageBody center className="items-center gap-6 text-center">
        <span aria-hidden="true" className="text-[96px] leading-none">🔒</span>
        <p className={SECTION_NOTE}>Con học thêm ở đảo trước để mở đảo này nhé!</p>
      </PageBody>
    </PageShell>
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

  // Which island this is on the map, 1-based — the design's "Đảo số 1" line, and real data rather
  // than a second star metric: `TOPICS` is the unlock order the map itself is laid out in.
  const islandNo = TOPICS.findIndex(t => t.id === topic.id) + 1

  return (
    <PageShell>
      {/* The back arrow sits on the plain cream header now — the teal island band is decorative
          body content (phase 13 decides its final shape). */}
      <PageHeader back={<BackButton to="/" label="Về nhà" />}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">{topic.name}</h1>
      </PageHeader>
      <PageBody className="relative">
        {/* The island header (§12 M8): one of the two background colours the design allows, behind
            the title block, with the rounded foot the frame draws. Its height is the design's
            236 px measured the way the design measures it — 180 px of content below the frame's own
            top padding — so it tracks the safe-area shell instead of fixing a number that is only
            right on a notched phone: 236 px on an iPhone, 204 px in a browser with no inset to clear.
            Decorative and absolute, so it scrolls with the content it sits behind and never enters
            the flow the sections are laid out in. */}
        <div
          aria-hidden="true"
          data-testid="island-header"
          className="pointer-events-none absolute inset-x-0 top-0 h-[calc(180px_+_max(1.5rem,calc(env(safe-area-inset-top)_+_9px)))] rounded-b-[40px] bg-teal-500 md:hidden"
        />

        <div className="relative flex flex-col gap-3 md:gap-5">
          {/* Design M8's title block: a 92 px white disc, and the stars beside a line that says
              which island this is. The `md:contents` wrapper is what lets one DOM be both layouts —
              below 768 it is the text column, and from 768 up it leaves the box tree entirely, so
              the emoji and the stars are the same flex items of the same wrapping row they have
              always been. */}
          <div className="flex flex-wrap items-center gap-3.5 pb-3 md:gap-4 md:pb-0">
            <span
              aria-hidden="true"
              className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-full bg-white text-[46px] leading-none shadow-[0_6px_0_#1FA396] md:h-auto md:w-auto md:rounded-none md:bg-transparent md:text-[64px] md:shadow-none"
            >
              {topic.emoji}
            </span>
            <div className="flex flex-1 items-center gap-2 md:contents">
              {/* One star row, restyled — never a second copy of the same count. */}
              <StarRow value={topicStars(topic.id)} size="sm" className="md:gap-1 md:text-3xl" />
              <span className="font-display text-sm font-extrabold text-teal-50 md:hidden">
                Đảo số {islandNo} · Luyện thêm nhé!
              </span>
            </div>
          </div>

          <Link to={`/words/${topic.id}`} className={`${SECTION} ${wordsToday ? TODAY_OUTLINE : ''}`}>
            <span aria-hidden="true" className={SECTION_EMOJI}>🧩</span>
            <span className="flex flex-col">
              <span className={SECTION_TITLE}>Từ mới</span>
              <span className={SECTION_NOTE}>{words}/{deckSize} từ</span>
            </span>
            <span className={SECTION_TAIL}>
              {wordsToday && <TodayChip />}
              <Chevron />
            </span>
          </Link>

          <Link to={`/sentences?topic=${topic.id}`} className={`${SECTION} ${sentencesToday ? TODAY_OUTLINE : ''}`}>
            <span aria-hidden="true" className={SECTION_EMOJI}>🧱</span>
            <span className="flex flex-col">
              <span className={SECTION_TITLE}>Ghép câu</span>
              <span className={SECTION_NOTE}>{starred}/{sentences.length} câu có sao</span>
            </span>
            <span className={SECTION_TAIL}>
              {sentencesToday && <TodayChip />}
              <Chevron />
            </span>
          </Link>

          <section className="flex flex-col gap-3 md:gap-4">
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
                <Link
                  key={story.id}
                  to={`/story/${story.id}`}
                  className={`${SECTION} ${todayRoutes.has(`/story/${story.id}`) ? TODAY_OUTLINE : ''}`}
                >
                  <span aria-hidden="true" className={SECTION_EMOJI}>🎧</span>
                  <span className="flex flex-col">
                    <span className={SECTION_TITLE}>{story.titleVi}</span>
                    <span className={SECTION_NOTE}>{story.title}</span>
                  </span>
                  <span className={SECTION_TAIL}>
                    {todayRoutes.has(`/story/${story.id}`) && <TodayChip />}
                    <StarRow value={getStars(`story:${story.id}`)} size="sm" className="md:gap-1 md:text-3xl" />
                    <Chevron />
                  </span>
                </Link>
              ))
            )}
          </section>
        </div>
      </PageBody>
    </PageShell>
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
