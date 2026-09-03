import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SENTENCES } from '../content'
import { STORIES } from '../content/stories'
import type { Story } from '../content/stories/types'
import { TOPICS, findTopic } from '../content/topics'
import type { Topic } from '../content/topics'
import { findTopic as findWordDeck } from '../content/words'
import { lessonStatus } from '../progress/lesson'
import { getStars } from '../progress/store'
import { topicStars, topicUnlocked, unlockedWords } from '../progress/topicProgress'
import { BackButton, Button, Chip, Stars } from '../components/ui'
import { PageShell, PageHeader, PageBody, PageFooter } from '../components/ui/page'

/**
 * Task 12 (R19/R20, decision 5) fix round 1, decision 15: since A8 has no iPad artboard (R32),
 * the inferred default is phone × 1.25 rather than the phone numbers held flat at every width —
 * `ipad:` counterparts sit next to every new `md:` value even though the two never disagree here
 * (decision 15: landscape must not differ from portrait), because `ipad:` is the variant the
 * `:is(&)` specificity fix (`tailwind.config.ts`) actually arms against a real `md:` tie on a real
 * iPad landscape — writing only `md:` would rely on there never being a competing `ipad:` rule for
 * the same property, which is exactly the trap that fix exists to close. Section cards are the
 * child's tap targets, so every size here sits well above the 64 px floor.
 */
const SECTION =
  'flex min-h-[84px] flex-wrap items-center gap-3.5 rounded-[24px] bg-white px-[18px] py-4 shadow-card transition-transform active:scale-95'
  + ' md:min-h-[105px] md:flex-nowrap md:gap-5 md:rounded-xl3 md:px-6 ipad:min-h-[105px]'
/** The empty-story row (R20): `#F6EFE2`/`0 6px 0 #E2D5C0`, opacity .8, never a link. */
const SECTION_EMPTY =
  'flex min-h-[84px] flex-wrap items-center gap-3.5 rounded-[24px] bg-[#F6EFE2] px-[18px] py-4 opacity-80 shadow-[0_6px_0_#E2D5C0]'
  + ' md:min-h-[105px] md:flex-nowrap md:gap-5 md:rounded-xl3 md:px-6 ipad:min-h-[105px]'
const SECTION_EMOJI = 'text-[34px] leading-none md:text-[56px]'
/** Now a flex row of two children — the row's own name and, right after it with no text-node
 * space in between (so `nextSibling` in the title lands on the count, not a whitespace node), the
 * teal count that used to live in a separate note line (R20: "counts move into the row titles").
 * 19px × 1.25 rounds to 24, not the Phase-10-era 26 this carried before decision 15. */
const SECTION_TITLE = 'flex items-baseline gap-1.5 font-display text-[19px] font-extrabold text-ink-900 md:text-[24px] ipad:text-[24px]'
const SECTION_TITLE_EMPTY = 'font-display text-[19px] font-extrabold text-sand-text md:text-[24px] ipad:text-[24px]'
/** The generic empty-state note (LockedTopic's own copy) — untouched by decision 15's ×1.25,
 * which is specific to A8's own rows; kept separate from `ROW_SUB` below so scaling one doesn't
 * silently reach into the other. */
const SECTION_NOTE = 'text-sm font-bold text-ink-500 md:text-lg'
/** A story row's English subtitle — decision 15's "sub" (13px phone → 16px at ×1.25). */
const ROW_SUB = 'text-sm font-bold text-ink-500 md:text-[16px] ipad:text-[16px]'
/** The row's right-hand group: the "hôm nay" chip, a sentence/story's stars, and the phone's
 * chevron. It is always rendered, so at 768 up an empty one is a zero-width box and `ml-auto` a
 * no-op. */
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

/** How many other islands (never this one — a topic with no story cannot appear in its own count)
 * carry a story, read from the content itself (R20) rather than a number typed into the copy. */
const TOPICS_WITH_STORY = new Set(STORIES.map(s => s.topic)).size

/** The best star result across a list of progress keys — one 0–3 number standing in for a whole
 * section, the same way `topicStars` already condenses a whole word deck into one figure. Used for
 * both the "Ghép câu" section and, when a topic has more than one story, the "Truyện" section: the
 * design's "9 khi có [truyện]" treats *having a story* as one scored section, not one per story. */
function bestOf(ids: string[]): 0 | 1 | 2 | 3 {
  let best: 0 | 1 | 2 | 3 = 0
  for (const id of ids) {
    const s = getStars(id)
    if (s > best) best = s
  }
  return best
}

type NextItem = { label: string; to: string; replay: boolean }

/**
 * The pinned footer's "mục dở đầu tiên" (R19): Từ mới → Ghép câu → Truyện, first section under
 * 3★ wins. Once every section this island has is maxed, it loops back to the words deck instead —
 * `replay: true` swaps the footer's own copy from "Học tiếp" to "Luyện lại".
 */
function nextItem(args: {
  topic: Topic
  words: number; deckSize: number; wordsStars: 0 | 1 | 2 | 3
  starred: number; sentenceCount: number; sentenceStars: 0 | 1 | 2 | 3
  stories: Story[]; storyStars: 0 | 1 | 2 | 3 | null
}): NextItem {
  const { topic, words, deckSize, wordsStars, starred, sentenceCount, sentenceStars, stories, storyStars } = args
  const wordsItem: NextItem = { label: `Từ mới ${words}/${deckSize}`, to: `/words/${topic.id}`, replay: false }
  if (wordsStars < 3) return wordsItem
  if (sentenceStars < 3) return { label: `Ghép câu ${starred}/${sentenceCount}`, to: `/sentences?topic=${topic.id}`, replay: false }
  // Same "is this section scored 3★ yet" test the star chip uses (`storyStars` is the same
  // `bestOf` collapse) — a topic with two stories counts as done once either one is maxed, not
  // only once both are, so the footer and the chip never disagree about whether Truyện is finished.
  if (storyStars !== null && storyStars < 3) {
    const todo = stories.find(s => getStars(`story:${s.id}`) < 3) ?? stories[0]
    return { label: todo.titleVi, to: `/story/${todo.id}`, replay: false }
  }
  return { ...wordsItem, replay: true }
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
  const wordsStars = topicStars(topic.id)

  const sentences = SENTENCES.filter(s => s.topic === topic.id)
  const starred = sentences.filter(s => getStars(`sentence:${s.id}`) > 0).length
  const sentenceStars = bestOf(sentences.map(s => `sentence:${s.id}`))

  const stories = STORIES.filter(s => s.topic === topic.id)
  const storyStars = stories.length ? bestOf(stories.map(s => `story:${s.id}`)) : null

  // "⭐ n/m sao đảo" (R19): m = 3 × the number of scored sections (words + sentences, plus a story
  // section only when this island has one at all — never one per story, see `bestOf` above); n is
  // those same sections' stars, summed.
  const sections: number[] = [wordsStars, sentenceStars, ...(storyStars === null ? [] : [storyStars])]
  const starNum = sections.reduce((a, b) => a + b, 0)
  const starDen = sections.length * 3

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

  const next = nextItem({ topic, words, deckSize, wordsStars, starred, sentenceCount: sentences.length, sentenceStars, stories, storyStars })

  return (
    <PageShell>
      {/* The island band (R19): the shared background of the header *and* the name block below
          it — as of fix round 2, `island-header` is a real (not `aria-hidden`) container the two
          of them sit inside, not a separately-sized decoration guessing at their combined height.
          The artboard's own invariant is "band = header + name block, exactly" — a fixed/computed
          height (236px, or `md:h-[295px]` at ×1.25 per decision 15) drifts from that the moment
          either block's own natural size doesn't match the guess (round 1's re-review found the
          first row riding 10–58px into the band because the guess was short); dropping the height
          entirely and letting the band size itself to its two real children removes the guess.
          `w-screen ml-[calc(50%-50vw)]` + the negative top margin (`PageShell`'s own top-padding
          formula, copied verbatim from `pageShell.ts`) bleed the *background* out to the true
          viewport edges the same way `PageFooter`'s fade bleeds past the shell's own gutter
          (`page/PageFooter.tsx`) — but a fixed negative margin like that fade's only cancels the
          shell's own *padding*, not the shell's separate `max-w-[1080px]` wrapper (`PageShell.tsx`)
          a landscape iPad is wider than: fix round 3's re-review caught the band confined to that
          1080px column, cream on both sides, on `ipad`. `w-screen`/`ml-[calc(50%-50vw)]` is the
          standard "full-bleed inside a centred max-width layout" recipe — it sizes and re-centres
          on the *viewport* directly, so it reaches the true edges at any width regardless of how
          narrow an ancestor's own max-width is, no per-breakpoint pixel guess needed. The inner
          content column below restores the shell's own padding *and* its own `max-w-[1080px]`
          cap, so the header/name block sit exactly where they always have — capped and centred
          like every list screen's rows — with only the teal now reaching further than they do.
          `relative isolate` keeps the fill's `-z-10` scoped to this box (a bare `relative` doesn't
          establish a stacking context, so a `-z-10` child would otherwise escape to the next
          ancestor that does, painting behind the whole app — the exact bug round 1 fixed for the
          old `main`-relative band). */}
      <div
        data-testid="island-header"
        className="relative isolate w-screen ml-[calc(50%-50vw)] -mt-[max(1.25rem,calc(env(safe-area-inset-top)_+_8px))] md:mb-[-8px] ipad:mb-[-8px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-b-[44px_44px_40px_40px] bg-teal-500"
        />
        <div className="mx-auto w-full max-w-[1080px] px-4 pt-[max(1.25rem,calc(env(safe-area-inset-top)_+_8px))] md:px-6 ipad:px-6">
          {/* R19 / decision 5: the one named exception to "header always on cream" — `onBand`
              turns the header transparent and its back button white-on-teal so it sits on the
              band, centred on the island's own star chip instead of the topic name (that moved
              into the name block below). */}
          <PageHeader onBand back={<BackButton to="/" label="Về nhà" />}>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-r12 bg-white/[.92] px-3.5 py-[7px] font-display text-[15px] font-extrabold text-teal-600">
              {`⭐ ${starNum}/${starDen} sao đảo`}
            </span>
          </PageHeader>

          {/* Fix round 2: the artboard's own paddings around the name block, not a number that
              happened to make the old fixed-height band line up — 4px between the header and the
              avatar, 10px between the avatar and the band's own (now content-driven) bottom edge;
              × 1.25 at `md:`/`ipad:` per decision 15, same as every other size in this block. */}
          <div className="flex items-center gap-3.5 pt-1 pb-[10px] md:gap-4 md:pt-[5px] md:pb-[13px] ipad:gap-4 ipad:pt-[5px] ipad:pb-[13px]">
            <span
              aria-hidden="true"
              className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full bg-white text-[42px] leading-none shadow-[0_6px_0_#1FA396] md:h-[105px] md:w-[105px] md:text-[53px] ipad:h-[105px] ipad:w-[105px] ipad:text-[53px]"
            >
              {topic.emoji}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="truncate font-display text-[28px] font-extrabold leading-tight text-white md:text-[35px] ipad:text-[35px]">{topic.name}</h1>
              <div className="flex items-center gap-1.5">
                <Stars value={wordsStars} size="13" />
                <span className="text-[13px] font-bold text-[#D3F1EC] md:text-[16px] ipad:text-[16px]">Đảo số {islandNo} · Luyện thêm nhé!</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PageBody>
        {/* Decision 15: no A8 iPad artboard, so the inferred default is phone × 1.25, applied to
            every size below (rounded to a whole px) — `ipad:` mirrors `md:` verbatim rather than
            leaving landscape to inherit portrait's rule by omission (see the note on `SECTION`
            above). `ipad:mx-auto ipad:max-w-[1080px]` is the same centring every list screen gets
            for free from `PageShell`'s own wrapper (`WordList.tsx` relies on it without writing it
            out) — written explicitly here since this content sits beside the full-bleed band, not
            inside a plain cream shell, so it is worth being able to see at the call site. */}
        <div className="flex w-full flex-col gap-3 md:gap-5 ipad:mx-auto ipad:max-w-[1080px] ipad:gap-5">

          <Link to={`/words/${topic.id}`} className={`${SECTION} ${wordsToday ? TODAY_OUTLINE : ''}`}>
            <span aria-hidden="true" className={SECTION_EMOJI}>🧩</span>
            <span className={SECTION_TITLE}>
              <span>Từ mới</span>
              <span className="text-teal-600">{words}/{deckSize}</span>
            </span>
            <span className={SECTION_TAIL}>
              {wordsToday && <TodayChip />}
              <Chevron />
            </span>
          </Link>

          <Link to={`/sentences?topic=${topic.id}`} className={`${SECTION} ${sentencesToday ? TODAY_OUTLINE : ''}`}>
            <span aria-hidden="true" className={SECTION_EMOJI}>🧱</span>
            <span className={SECTION_TITLE}>
              <span>Ghép câu</span>
              <span className="text-teal-600">{starred}/{sentences.length}</span>
            </span>
            <span className={SECTION_TAIL}>
              {sentencesToday && <TodayChip />}
              <Stars value={sentenceStars} size="13" />
              <Chevron />
            </span>
          </Link>

          <section className="flex flex-col gap-3 md:gap-4">
            {stories.length === 0 ? (
              // No story for this topic yet: a muted card, never a link, so a tap cannot dead-end.
              <div className={SECTION_EMPTY}>
                <span aria-hidden="true" className={`${SECTION_EMOJI} grayscale`}>🎧</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={SECTION_TITLE_EMPTY}>Truyện</span>
                  <span className="text-[12px] font-bold text-ink-500">
                    {`Đảo này chưa có truyện — nghe truyện ở ${TOPICS_WITH_STORY} đảo khác nhé`}
                  </span>
                </span>
                <Chip tone="sand" size="sm" className="ml-auto shrink-0">Sắp có 📖</Chip>
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
                    <span className="font-display text-[19px] font-extrabold text-ink-900 md:text-[24px] ipad:text-[24px]">{story.titleVi}</span>
                    <span className={ROW_SUB}>{story.title}</span>
                  </span>
                  <span className={SECTION_TAIL}>
                    {todayRoutes.has(`/story/${story.id}`) && <TodayChip />}
                    <Stars value={getStars(`story:${story.id}`)} size="sm" />
                    <Chevron />
                  </span>
                </Link>
              ))
            )}
          </section>
        </div>
      </PageBody>

      <PageFooter>
        <Button to={next.to} className="w-full">
          {`${next.replay ? 'Luyện lại' : 'Học tiếp'}: ${next.label} ▸`}
        </Button>
      </PageFooter>
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
