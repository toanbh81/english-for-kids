import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dayKey, getActivity } from '../progress/activity'
import { getLesson, lessonStatus } from '../progress/lesson'
import type { LessonItemKind } from '../progress/lesson'
import { MISSION_STATE, groupItems } from '../progress/missionNav'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip, PAGE_SHELL } from '../components/ui'
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
 * wrapped would push the CTA off a 834 px-tall screen. Written out in full because Tailwind reads
 * the class names from the source. */
const COLUMNS = [
  '', 'ipad:grid-cols-1', 'ipad:grid-cols-2', 'ipad:grid-cols-3', 'ipad:grid-cols-4', 'ipad:grid-cols-5',
]
/** Longest lesson shape there is: 🎧 🗣️ 🧩 🧱 🔁 (spec §2). */
const MAX_GROUPS = 5

/** The group card: the kit's `Card` surface as a tap target, centred like the list-screen cards. */
const GROUP_CARD =
  'flex flex-col items-center gap-2 rounded-xl3 bg-white p-5 text-center shadow-card transition-transform active:scale-95'

/** The CTA has to carry router state, which `Button` (an anchor-props passthrough) cannot take —
 * so it is a `Link` wearing the `Button size="lg" pulse` classes. */
const CTA_BUTTON = [
  'inline-flex items-center justify-center gap-2 font-display font-extrabold',
  'transition-transform active:translate-y-[2px]',
  'min-h-[72px] px-10 text-[26px] rounded-xl4',
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
    <main className={`relative h-full overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
      <BackButton to="/" label="Về bản đồ" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pt-4">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Nhiệm vụ hôm nay 🌞</h1>
          <div className="flex items-center gap-3">
            <Chip tone="sun">Bậc ⭐ {band}</Chip>
            <Chip tone="teal">{status.doneCount}/{status.total}</Chip>
          </div>
        </header>

        <div className={`grid gap-3 ${COLUMNS[Math.min(groups.length, MAX_GROUPS)]}`}>
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
                <span aria-hidden="true" className="text-5xl">{kind.emoji}</span>
                <div className="font-display text-2xl font-extrabold text-ink-900">
                  {kind.title(group.items.length)}
                </div>
                <div className="font-display text-xl font-extrabold text-teal-600">
                  {group.doneCount}/{group.items.length}
                </div>
                <div className="font-display text-base font-extrabold text-ink-500">
                  Bước {i + 1}
                  {isCurrent && <span className="text-teal-600"> · bắt đầu ở đây!</span>}
                </div>
                {group.done
                  ? <span className="font-display text-xl font-extrabold text-good-700">✓ Xong</span>
                  : <Chip tone={kind.tone}>≈ {kind.minutes(group.items.length)} phút</Chip>}
              </Link>
            )
          })}
        </div>

        {/* Sticky, so a long lesson can never push the one thing the child came here to tap below
          * the fold. The cream gradient fades the cards out underneath it rather than cutting them
          * off, and `-mx-6` lets that fade reach the screen edges through the page padding. */}
        <div className="sticky bottom-0 -mx-6 mt-1 flex flex-wrap items-end justify-between gap-4 bg-gradient-to-t from-cream-50 from-60% to-transparent px-6 pb-3 pt-8">
          <Foxy mood="cheer" size="md" />
          {status.done
            ? <Button to="/" size="lg" variant="secondary">Về bản đồ 🏝️</Button>
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
