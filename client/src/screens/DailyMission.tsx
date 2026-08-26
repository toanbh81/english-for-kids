import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dayKey, getActivity } from '../progress/activity'
import { getLesson, lessonStatus } from '../progress/lesson'
import type { LessonItemKind } from '../progress/lesson'
import { MISSION_STATE, groupItems } from '../progress/missionNav'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip, HomeLabel, PAGE_SHELL } from '../components/ui'
import type { ChipTone } from '../components/ui'

const CELEBRATED_KEY = 'speakup.celebrated'

// The same once-a-day guard Home keeps: the finish screen fires wherever the last item happens to
// be ticked off — on the way back to the map, or here, when the child ends their lesson on
// /mission — and never twice on the same day.
function alreadyCelebrated(day: string): boolean {
  try { return localStorage.getItem(CELEBRATED_KEY) === day }
  catch { return false }
}

function markCelebrated(day: string): void {
  try { localStorage.setItem(CELEBRATED_KEY, day) }
  catch { /* ignore: storage unavailable */ }
}

/**
 * How each kind of step dresses its card (spec §1). The minutes are the prototype's rough
 * estimates, sized off the group: a story is a four-minute sit-down, everything else is about a
 * minute a card, so a lesson of any length still reads as a believable few minutes.
 */
const KIND: Record<LessonItemKind, {
  emoji: string
  tone: ChipTone
  title: (n: number) => string
  minutes: (n: number) => number
}> = {
  listen: { emoji: '🎧', tone: 'teal', title: n => `Nghe ${n} truyện`, minutes: n => 4 * n },
  speak: { emoji: '🗣️', tone: 'coral', title: n => `${n} thẻ phát âm`, minutes: n => n },
  word: { emoji: '🧩', tone: 'sun', title: n => `${n} từ mới`, minutes: n => n },
  sentence: { emoji: '🧱', tone: 'neutral', title: n => `${n} câu ghép`, minutes: n => n },
  review: { emoji: '🔁', tone: 'neutral', title: n => `${n} bài ôn tập`, minutes: n => n },
}

/** The cards sit side by side from `ipad` up — one column per group — and stack below that. Phase 9
 * added the 🧱 group, so a lesson now has five: the table runs to five columns, because a row that
 * wrapped would push the CTA off a 834 px-tall screen. A tablet portrait gets two columns of the
 * same cards (design breakpoint card, 768). Written out in full because Tailwind reads the class
 * names from the source. */
const COLUMNS = [
  '',
  'ipad:grid-cols-1',
  'md:grid-cols-2 ipad:grid-cols-2',
  'md:grid-cols-2 ipad:grid-cols-3',
  'md:grid-cols-2 ipad:grid-cols-4',
  'md:grid-cols-2 ipad:grid-cols-5',
]
/** Longest lesson shape there is: 🎧 🗣️ 🧩 🧱 🔁 (spec §2). */
const MAX_GROUPS = 5

/**
 * The group card. On a phone it is a 76 px **row** — emoji, title, progress and chip on one line
 * (design M2) — because five 256 px columns stacked one under another made this screen 1759 px
 * tall on an 844 px phone, with the steps below the fold and nothing but scrolling to find them.
 * From the tablet breakpoint up it is the column card the iPad has always had, unchanged.
 */
const GROUP_CARD = [
  // `min-w-0`: a grid item refuses to shrink below its content by default, and on a 320 px screen
  // the row's own text would otherwise push it 8 px past the edge instead of ellipsising.
  'flex h-[76px] min-w-0 items-center gap-3 rounded-xl2 bg-white px-4 text-left shadow-card-sm',
  'transition-transform active:scale-95',
  'md:h-auto md:flex-col md:justify-center md:gap-2 md:rounded-xl3 md:p-5 md:text-center md:shadow-card',
].join(' ')

/** The CTA has to carry router state, which `Button` (an anchor-props passthrough) cannot take —
 * so it is a `Link` wearing the `Button size="lg" pulse` classes. On a phone it is the design's
 * 64 px bar filling the row next to Foxy; from the tablet breakpoint up it is `size="lg"` again. */
const CTA_BUTTON = [
  'inline-flex flex-1 items-center justify-center gap-2 font-display font-extrabold',
  'transition-transform active:translate-y-[2px]',
  'min-h-[64px] px-5 text-xl rounded-xl2',
  'md:min-h-[72px] md:flex-none md:px-10 md:text-[26px] md:rounded-xl4',
  'bg-coral-500 text-white shadow-chunky-coral active:shadow-[0_3px_0_#E05A3A]',
  'animate-pulse-soft',
].join(' ')

/** Today's lesson as a handful of steps rather than a flat list: one card per kind ("Nghe 1
 * truyện", "4 thẻ phát âm", …) with its own progress, and a teal ring on the first group still
 * open so the child never has to decide where to start. The single CTA goes to the same place. */
export function DailyMission() {
  const navigate = useNavigate()
  // Read the log once per mount, like Home does: every query below shares this snapshot. The band
  // comes off the lesson record, not from `getBand()` — a parent who changes the difficulty at
  // lunchtime must not have the chip disagree with the items the child is actually looking at.
  const [{ status, band, day }] = useState(() => {
    const events = getActivity()
    const now = Date.now()
    return {
      status: lessonStatus(now, events),
      band: getLesson(now, events).band,
      day: dayKey(now),
    }
  })

  const groups = groupItems(status.items)
  // -1 once every group is done — and for an empty lesson, which is why the finished branch below
  // reads `status.done` (it already guards `items.length > 0`) rather than this index.
  const currentIndex = groups.findIndex(group => !group.done)

  // Decided once per mount and then remembered in storage by the effect, exactly as on Home: a
  // child who finishes their last step and lands back here gets the celebration screen, and a
  // revisit later the same day gets the quiet finished state instead.
  const [celebrating] = useState(() => status.done && !alreadyCelebrated(day))
  useEffect(() => {
    if (!celebrating) return
    markCelebrated(day)
    navigate('/mission/done')
  }, [celebrating, day, navigate])

  return (
    // 16 px of side padding on a phone (design M2), the 24 px the iPad cards are laid out on above.
    // A phone also fills the viewport — the steps sit in the middle of what is left over and the
    // CTA rests on the bottom edge — while the tablet and the iPad keep the plain block flow they
    // were laid out in, where the content is shorter than the screen anyway.
    <main className={`relative flex h-full flex-col overflow-y-auto bg-cream-50 px-4 md:block ipad:px-6 ${PAGE_SHELL}`}>
      <div className="mx-auto flex w-full max-w-6xl grow flex-col gap-2.5 ipad:gap-5">
        {/* One header row on a phone — back button, title, subtitle — and the stacked, centred
          * header the iPad has always had from `ipad` up, where the back button takes its own line
          * again (`ipad:flex` keeps it block-level without giving up the centred glyph). */}
        <header className="flex flex-wrap items-center gap-2.5 ipad:block ipad:text-center">
          <BackButton to="/" label="Về trang chủ" mdLabel="Về bản đồ" className="ipad:mb-4 ipad:flex" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 ipad:text-[40px]">
              Nhiệm vụ hôm nay 🌞
            </h1>
            <p className="font-display text-[13px] font-extrabold text-ink-500 ipad:hidden">
              5 bước nhỏ — 15 phút thôi!
            </p>
          </div>
          <div className="flex w-full items-center gap-2 ipad:mt-2 ipad:w-auto ipad:justify-center ipad:gap-3">
            <Chip tone="sun" className="text-sm ipad:text-lg">Bậc ⭐ {band}</Chip>
            <Chip tone="teal" className="text-sm ipad:text-lg">{status.doneCount}/{status.total}</Chip>
          </div>
        </header>

        <div className={`grid grow content-center gap-2.5 md:grow-0 ipad:gap-3 ${COLUMNS[Math.min(groups.length, MAX_GROUPS)]}`}>
          {groups.map((group, i) => {
            const kind = KIND[group.kind]
            const isCurrent = i === currentIndex
            return (
              // A finished group stays a link — its first step, for a replay — because a group is
              // a place on the map, not a checkbox: the ✓ says the work is done, the card still
              // takes the child back to it.
              <Link
                key={group.kind}
                data-testid={`group-${group.kind}`}
                to={group.route}
                state={MISSION_STATE}
                className={`${GROUP_CARD} ${isCurrent ? 'border-4 border-teal-500' : ''}`}
              >
                <span aria-hidden="true" className="text-3xl md:text-5xl">{kind.emoji}</span>
                {/* On a phone the title and the step caption are the two lines of one text block;
                  * `md:contents` dissolves both wrappers again from the tablet breakpoint up, so
                  * the card is the same four stacked children the iPad has always drawn. */}
                <div className="min-w-0 flex-1 md:contents">
                  <div className="truncate font-display text-[17px] font-extrabold text-ink-900 md:overflow-visible md:whitespace-normal md:text-2xl">
                    {kind.title(group.items.length)}
                  </div>
                  <div className="flex min-w-0 items-baseline gap-1.5 md:contents">
                    <div className="font-display text-xs font-extrabold text-teal-600 md:text-xl">
                      {group.doneCount}/{group.items.length}
                    </div>
                    <div className="truncate font-display text-xs font-extrabold text-ink-500 md:overflow-visible md:whitespace-normal md:text-base">
                      Bước {i + 1}
                      {isCurrent && <span className="text-teal-600"> · bắt đầu ở đây!</span>}
                    </div>
                  </div>
                </div>
                {group.done
                  ? (
                    <span className="shrink-0 rounded-xl2 bg-good-50 px-3 py-1 font-display text-sm font-extrabold text-good-700 md:bg-transparent md:p-0 md:text-xl">
                      ✓ Xong
                    </span>
                  )
                  : <Chip tone={kind.tone} className="shrink-0 text-sm md:text-lg">≈ {kind.minutes(group.items.length)} phút</Chip>}
              </Link>
            )
          })}
        </div>

        {/* Sticky, so a long lesson can never push the one thing the child came here to tap below
          * the fold. The cream gradient fades the cards out underneath it rather than cutting them
          * off, and the negative margin lets that fade reach the screen edges through the page
          * padding — 16 px of it on a phone, 24 from `ipad` up. */}
        <div className="sticky bottom-0 -mx-4 mt-1 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-cream-50 from-60% to-transparent px-4 pb-3 pt-6 md:gap-4 md:pt-8 ipad:-mx-6 ipad:px-6">
          {/* 66 px beside the CTA on a phone (design M2), the 96 px mascot from the tablet
            * breakpoint up: the SVG carries its size as an attribute, which only CSS can bend. */}
          <Foxy
            mood="cheer"
            size="md"
            className="shrink-0 [&_svg]:h-[63px] [&_svg]:w-[66px] md:[&_svg]:h-[93px] md:[&_svg]:w-[96px]"
          />
          {status.done
            ? <Button to="/" size="lg" variant="secondary"><HomeLabel /></Button>
            : currentIndex !== -1
              ? (
                <Link to={groups[currentIndex].route} state={MISSION_STATE} className={CTA_BUTTON}>
                  {status.doneCount === 0 ? 'Bắt đầu ▸' : 'Tiếp tục ▸'}
                </Link>
              )
              // An empty lesson (nothing generated yet) has no step to point at and nothing to
              // celebrate either — the grid above renders empty and there is simply no CTA.
              : null}
        </div>
      </div>
    </main>
  )
}
