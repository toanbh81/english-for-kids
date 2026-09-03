import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dayKey, getActivity } from '../progress/activity'
import { getLesson, lessonStatus } from '../progress/lesson'
import type { LessonItemKind } from '../progress/lesson'
import { MISSION_STATE, groupItems } from '../progress/missionNav'
import { storageKey } from '../progress/storageKeys'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip, EmptyState, HomeLabel } from '../components/ui'
import type { ChipTone } from '../components/ui'
import { PageShell, PageHeader, PageBody, PageFooter } from '../components/ui/page'

// Per child, like every other stored value — see progress/storageKeys.ts.
const celebratedKey = () => storageKey('celebrated')

// The same once-a-day guard Home keeps: the finish screen fires wherever the last item happens to
// be ticked off — on the way back to the map, or here, when the child ends their lesson on
// /mission — and never twice on the same day.
function alreadyCelebrated(day: string): boolean {
  try { return localStorage.getItem(celebratedKey()) === day }
  catch { return false }
}

function markCelebrated(day: string): void {
  try { localStorage.setItem(celebratedKey(), day) }
  catch { /* ignore: storage unavailable */ }
}

/**
 * How each kind of step dresses its card (spec §1). The minutes are the prototype's rough
 * estimates, sized off the group: a story is a four-minute sit-down, everything else is about a
 * minute a card, so a lesson of any length still reads as a believable few minutes.
 */
/** Fix round 1: the band chip/header sub must name the level too ("Bậc ⭐ 2 · Đọc từ"), not just
 * the number — `docs/design/2026-09-03-round3-lists-nav-brief.md:127,129,130`. Copied verbatim
 * from `LevelStairs.tsx`'s own `STEPS[].name`, in the same 1→5 order its doc comment on
 * `progress/band.ts` already gives ("1 sounds → 2 word cards → 3 minimal pairs → 4 sentence stars
 * → 5 story voice"), rather than re-deriving or inventing the copy here. Not imported from
 * `LevelStairs.tsx` because `STEPS` is a local, unexported const there and this task's scope is
 * `DailyMission.tsx` only. */
const BAND_NAME: Record<number, string> = {
  1: 'Tập âm',
  2: 'Đọc từ',
  3: 'Nghe & chọn',
  4: 'Sentence Stars',
  5: 'Story Voice',
}

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
  // Task 10: the iPad-landscape worst case is 5 columns in 834px tall — `md:h-auto` stays for iPad
  // portrait (2 columns), `ipad:` outranks it so landscape gets the fixed 240 the brief measured.
  'ipad:h-[240px]',
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
  const doneGroups = groups.filter(g => g.done).length

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
    <PageShell>
      <PageHeader
        back={<BackButton to="/" label="Về trang chủ" mdLabel="Về bản đồ" />}
        title="Nhiệm vụ hôm nay 🌞"
        sub={groups.length === 0 ? `Bậc ⭐ ${band} · ${BAND_NAME[band]}` : '5 bước nhỏ — 15 phút thôi!'}
        right={
          // Task 10: the two chips move into the header's right cell, iPad-only — on a phone this
          // renders an empty (`hidden`) box rather than nothing, so there is no need for the
          // `right={null}` a screen with truly nothing there would pass (decision 8).
          <div className="hidden items-center gap-2 md:flex">
            <Chip tone="sun" className="hidden text-[15px] rounded-r12 px-3.5 py-2 md:inline-flex">Bậc ⭐ {band} · {BAND_NAME[band]}</Chip>
            <Chip tone="teal" className="text-[15px] rounded-r12 px-3.5 py-2">{doneGroups}/{groups.length} nhóm xong</Chip>
          </div>
        }
      />
      <PageBody>
        {groups.length === 0 ? (
          <EmptyState
            size="hero"
            title="Hôm nay chưa có nhiệm vụ"
            sub="Bé có thể luyện tự do ở bất kỳ đảo nào — hoặc leo các bậc luyện nói."
          />
        ) : (
          <>
            <div className={`mt-2.5 grid grow content-center gap-2.5 md:mt-4 md:grow-0 ipad:gap-3 ${COLUMNS[Math.min(groups.length, MAX_GROUPS)]}`}>
              {groups.map((group, i) => {
                const kind = KIND[group.kind]
                const isCurrent = i === currentIndex
                return (
                  // A finished group stays a link — its first step, for a replay — because a
                  // group is a place on the map, not a checkbox: the ✓ says the work is done, the
                  // card still takes the child back to it.
                  <Link
                    key={group.kind}
                    data-testid={`group-${group.kind}`}
                    to={group.route}
                    state={MISSION_STATE}
                    className={`${GROUP_CARD} ${isCurrent ? 'border-4 border-teal-500' : ''}`}
                  >
                    <span aria-hidden="true" className="text-3xl md:text-5xl">{kind.emoji}</span>
                    {/* On a phone the title and the step caption are the two lines of one text
                      * block; `md:contents` dissolves both wrappers again from the tablet
                      * breakpoint up, so the card is the same four stacked children the iPad has
                      * always drawn. */}
                    <div className="min-w-0 flex-1 md:contents">
                      <div className="truncate font-display text-[17px] font-extrabold text-ink-900 md:overflow-visible md:whitespace-normal md:text-2xl">
                        {kind.title(group.items.length)}
                      </div>
                      {/* Task 10: one line, count-first, instead of a separate teal count block —
                        * the invitation on the ringed card now replaces the step number rather
                        * than trailing after it. */}
                      <div className="truncate font-display text-xs font-extrabold text-ink-500 md:overflow-visible md:whitespace-normal md:text-base">
                        {group.doneCount}/{group.items.length} · {isCurrent ? <span className="text-teal-600">bắt đầu ở đây!</span> : `bước ${i + 1}`}
                      </div>
                    </div>
                    {group.done
                      ? (
                        <span className="shrink-0 rounded-xl2 bg-good-50 px-3 py-1 font-display text-sm font-extrabold text-good-700 md:bg-transparent md:p-0 md:text-xl">
                          ✓ Xong
                        </span>
                      )
                      : <Chip tone={kind.tone} className="shrink-0 text-sm md:text-lg">≈ {kind.minutes(group.items.length)}'</Chip>}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </PageBody>
      <PageFooter>
        {groups.length === 0 ? (
          // Task 10: the hero empty state gets its own two-button footer instead of the single
          // CTA `EmptyState`'s own `cta` used to draw — Foxy sits out this branch, the mascot
          // already lives inside the hero card above.
          <>
            <Button to="/" className="flex-1">Luyện tự do →</Button>
            <Button to="/" variant="outline" className="flex-1"><HomeLabel /></Button>
          </>
        ) : (
          <>
            {/* 66 px beside the CTA on a phone (design M2), the 96 px mascot from the tablet
              * breakpoint up, 80 px from ipad landscape: the SVG carries its size as an
              * attribute, which only CSS can bend. */}
            <Foxy
              mood="cheer"
              size="md"
              className="shrink-0 [&_svg]:h-[63px] [&_svg]:w-[66px] md:[&_svg]:h-[93px] md:[&_svg]:w-[96px] ipad:[&_svg]:h-[77px] ipad:[&_svg]:w-[80px]"
            />
            {/* `ipad:flex-none` on both branches: `flex-[1.35]` sets a 0% flex-basis, which makes
              * a flex item ignore its own `width` — a bare `ipad:w-[480px]` alongside it renders
              * no different from the phone-width stretch (confirmed via
              * `shots/ipad/mission.png`). Zeroing grow/shrink at `ipad:` first is what lets the
              * fixed width actually take effect on the landscape footer row, on the done-revisit
              * CTA (fix round 1) exactly as on the in-progress one below it. */}
            {status.done
              ? <Button to="/" size="lg" variant="secondary" className="flex-[1.35] ipad:w-[480px] ipad:flex-none"><HomeLabel /></Button>
              : currentIndex !== -1
                ? (
                  <Button to={groups[currentIndex].route} state={MISSION_STATE} size="lg" className="flex-[1.35] ipad:w-[480px] ipad:flex-none">
                    {status.doneCount === 0 ? 'Bắt đầu ▸' : 'Tiếp tục ▸'}
                  </Button>
                )
                : null}
          </>
        )}
      </PageFooter>
    </PageShell>
  )
}
