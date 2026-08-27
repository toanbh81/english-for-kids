import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TOPICS } from '../content/topics'
import { totalStars } from '../progress/store'
import { dayKey, getActivity, missionStatus, streak, weekDots, minutesToday } from '../progress/activity'
import { lessonStatus } from '../progress/lesson'
import { getLimitMinutes } from '../progress/limit'
import { topicStars, topicUnlocked } from '../progress/topicProgress'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { MissionCard } from '../components/MissionCard'
import { StreakWeek } from '../components/StreakWeek'
import { Chip, PAGE_SHELL, SpeechBubble, StarRow } from '../components/ui'

const CELEBRATED_KEY = 'speakup.celebrated'

// The celebration is once per day, not once per visit to Home — the day it last fired is
// remembered so coming back to Home does not re-throw confetti at the child.
function alreadyCelebrated(day: string): boolean {
  try { return localStorage.getItem(CELEBRATED_KEY) === day }
  catch { return false }
}

function markCelebrated(day: string): void {
  try { localStorage.setItem(CELEBRATED_KEY, day) }
  catch { /* ignore: storage unavailable */ }
}

/**
 * The eight places an island can stand (Phase 9 §3): a two-row serpentine, row one left → right and
 * row two right → left, so the trail snakes on rather than doubling back. `left`/`top` are
 * percentages of the map band, and the island box is a percentage wide too — that keeps every
 * centre at a fixed fraction of the band on any viewport, so the trail below never drifts off the
 * discs. Column centres land at 10.5 / 34.5 / 58.5 / 82.5 %, leaving a 9 % gutter (~100 px at
 * 1194) between neighbours. The topics fill the slots in unlock order.
 *
 * `left`/`top` only take effect from `ipad` up, where the islands go absolute, and the colours are
 * prefixed to match: a phone has no map, and M1b draws its islands as plain white cards with a bare
 * emoji rather than as coloured discs. Nothing here changes what the map looks like at 1194 — every
 * one of these classes still applies there.
 */
const SLOTS = [
  { left: '3%', top: '0%', color: 'ipad:bg-coral-500 ipad:shadow-[0_8px_0_#E05A3A,0_0_0_8px_#FFE9DF]' },
  { left: '27%', top: '0%', color: 'ipad:bg-peach-400 ipad:shadow-[0_8px_0_#E07A42,0_0_0_8px_#FFE7D2]' },
  { left: '51%', top: '0%', color: 'ipad:bg-sky-400 ipad:shadow-[0_8px_0_#5BA7D4,0_0_0_8px_#DDF0FB]' },
  { left: '75%', top: '0%', color: 'ipad:bg-teal-500 ipad:shadow-[0_8px_0_#1FA396,0_0_0_8px_#D3F1EC]' },
  { left: '75%', top: '52%', color: 'ipad:bg-sun-400 ipad:shadow-[0_8px_0_#E0A61A,0_0_0_8px_#FFF1C9]' },
  { left: '51%', top: '52%', color: 'ipad:bg-[#7ED99A] ipad:shadow-[0_8px_0_#4FB56E,0_0_0_8px_#E3F6E8]' },
  { left: '27%', top: '52%', color: 'ipad:bg-[#F8A3AE] ipad:shadow-[0_8px_0_#D97C89,0_0_0_8px_#FFE3E6]' },
  { left: '3%', top: '52%', color: 'ipad:bg-[#B8A6E8] ipad:shadow-[0_8px_0_#8E79C8,0_0_0_8px_#EDE7FB]' },
] as const

/** The emoji: a bare 36 px glyph on the phone card, and from `ipad` up the 112 px coloured disc of
 * the map — well clear of the 64 px tap floor, and small enough that two rows fit the band without
 * touching. */
/** The disc is 112 px on the frame the map was drawn for (1194×834) and scales down with the
 * viewport below that, because the island band is what is left of the screen after the header and
 * the control strip — it shrinks, and fixed-size furniture inside it does not. `13vh` keeps the
 * original 112 from 862 pt up and hands back ~88 at the 680 pt floor, which is where two rows plus
 * the controls stop fitting at all (see the `ipad` screen in tailwind.config.ts). */
const ISLAND_DISC = 'text-4xl ipad:h-[min(7rem,13vh)] ipad:w-[min(7rem,13vh)] ipad:text-[min(46px,5.4vh)]'
  + ' ipad:[@media(max-height:800px)]:h-[11vh] ipad:[@media(max-height:800px)]:w-[11vh]'

/**
 * One island per topic (spec §2): the map is the topic list, in unlock order.
 *
 * The slots are hand-placed on a hand-fitted trail, so there is no ninth position to fall back on:
 * a topic added without one would spread `undefined` and render a colourless, unpositioned disc on
 * top of the first island — a bug nobody would see until they looked at the map. Say so at module
 * load instead, where whoever added the topic cannot miss it.
 */
if (TOPICS.length > SLOTS.length) {
  throw new Error(
    `Home map: ${TOPICS.length} topics but only ${SLOTS.length} island slots. `
    + 'Add a slot to SLOTS (and a point to TRAIL) in screens/Home.tsx for every new topic.',
  )
}
const ISLANDS = TOPICS.map((topic, i) => ({ ...topic, ...SLOTS[i] }))

/**
 * An island is two different things at two sizes.
 *
 * Below `ipad` it is one card of the M1b grid: a 128 px tile (160 from the tablet breakpoint, where
 * the grid has room to breathe) that stands on its own chunky shadow — no map, no trail, no
 * position. From `ipad` up every one of those card styles is unset again and the island goes
 * absolute at its slot, which is the curved map exactly as it has always been.
 *
 * `ipad:w-[15%]`: a percentage width, so an island's centre is a fixed fraction of the band on every
 * viewport and the trail below stays under the discs. The tighter `ipad:gap-1` is what buys the two
 * rows their clearance on the shortest screen the map now runs on (1194×834).
 */
const ISLAND_BOX = 'flex h-32 flex-col items-center justify-center gap-1 rounded-xl3 px-2 text-center'
  + ' md:h-40'
  + ' ipad:absolute ipad:h-auto ipad:w-[15%] ipad:justify-start ipad:gap-1 ipad:rounded-none'
  + ' ipad:bg-transparent ipad:px-0 ipad:shadow-none'

/** Open card / locked card of the grid. Both are unset again from `ipad` up by `ISLAND_BOX`, where
 * the island is a disc on a trail and carries no card of its own. */
const ISLAND_OPEN = 'bg-white shadow-card'
const ISLAND_LOCKED = 'bg-[#F3EADA] opacity-[.85] shadow-[0_8px_0_#E2D5C0] ipad:opacity-50'

// The dotted trail the islands sit on. Decorative only, and drawn in the same 1194×834 frame
// coordinates the SVG stretches over. The points are the island CENTRES, not their `left`/`top`
// corners — the trail used to run through the corners and so passed above and left of every
// island. The eight centres were measured in the browser at 1194×834 and the curve fitted to them
// (each pass lands within half a pixel): across row one, round the right-hand end, back across row
// two. The gentle sag between neighbours is what keeps it from reading as two ruled lines.
const TRAIL = [
  'M125 103',
  'C 197 127, 340 127, 412 103', // row one, left → right, sagging gently between the discs
  'C 484 127, 626 127, 698 103',
  'C 770 127, 913 127, 985 103',
  'C 1088 103, 1142 185, 1142 320', // the turn: out past the right-hand column, then down
  'C 1142 455, 1088 537, 985 537',
  'C 913 561, 770 561, 698 537', // row two, right → left
  'C 626 561, 484 561, 412 537',
  'C 340 561, 197 561, 125 537',
].join(' ')

export function Home() {
  const navigate = useNavigate()
  // One read of the activity log per mount, shared by every query below — the log is a single
  // localStorage entry, and each query used to parse it again. Today's lesson is generated here
  // too: its `created` stamp has to be the moment the child opened the app, so free practice
  // before they ever tap "Nhiệm vụ hôm nay" still counts towards it.
  const [{ events, now, lesson }] = useState(() => {
    const events = getActivity()
    const now = Date.now()
    return { events, now, lesson: lessonStatus(now, events) }
  })
  const counters = missionStatus(now, events)
  const hasProgress =
    lesson.doneCount > 0 || counters.story > 0 || counters.speak > 0 || counters.word > 0
  const mood: FoxyMood = lesson.done ? 'cheer' : hasProgress ? 'happy' : 'idle'
  const say = lesson.done
    ? 'Hoàn thành nhiệm vụ rồi! 🎉'
    : hasProgress
      ? 'Giỏi lắm, tiếp tục nhé!'
      : 'Hôm nay mình luyện nói nhé!'
  const overLimit = minutesToday(now, events) >= getLimitMinutes()

  // Decided once per mount, then remembered in storage by the effect below, so the trip to the
  // celebration screen happens on the render that first sees a finished lesson — and only then.
  const [celebrating] = useState(() => lesson.done && !alreadyCelebrated(dayKey(now)))
  useEffect(() => {
    if (!celebrating) return
    markCelebrated(dayKey(now))
    navigate('/mission/done')
  }, [celebrating, now, navigate])

  return (
    // `min-h-full`, never `h-full`: the stacked portrait layout is taller than the viewport, and a
    // fixed-height root would leave the mission CTA and the parent link below an unscrollable fold.
    // The root grows with its content and the page scrolls; only the `ipad` map frame is clipped.
    // 16 px of side frame on the phone (design §1) — the vertical padding is the safe-area shell,
    // resting at the 1 rem this screen has always used where there is no notch to clear.
    <main className={`relative min-h-full overflow-y-auto overflow-x-hidden bg-cream-50 px-4 [--page-pad-bottom:1rem] [--page-pad-top:1rem] md:px-7 md:[--page-pad-bottom:1.75rem] md:[--page-pad-top:1.75rem] ${PAGE_SHELL}`}>
      <h1 className="sr-only">Speak Up!</h1>

      {/* Soft background blobs of the handoff frame. They hang off every edge, so they are clipped
          by their own container rather than by the page: otherwise the bottom-right blob stretched
          the scroll height and the child could scroll down into empty cream. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-28 h-[300px] w-[300px] rounded-full bg-[#FFEDD6]" />
        <div className="absolute -bottom-32 -right-20 h-[340px] w-[340px] rounded-full bg-teal-50" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1194px] flex-col gap-2.5 ipad:gap-3">
        {/* Greeting over streak on a phone, one wide row from `ipad` up: at 390 px the week pill
          * and the star count have nowhere to sit beside Foxy's bubble. */}
        <header className="flex flex-col gap-2 ipad:flex-row ipad:flex-wrap ipad:items-center ipad:justify-between ipad:gap-3">
          <div className="flex items-center gap-3">
            <Foxy mood={mood} size="md" className="animate-bob" />
            {/* M1b prints the greeting as plain text: the bubble is M1a's, and on a 390 px screen
              * its white panel, its padding and its shadow cost ~26 px of height for decoration the
              * grid below needs more. Only the chrome goes — the two lines themselves are the same
              * element at every width, so the greeting is never in the page twice. `max-md:` because
              * every one of these classes is `SpeechBubble`'s own, and an unprefixed override of
              * ours would be a coin toss on Tailwind's utility order. */}
            <SpeechBubble
              title={<span className="text-coral-text">Chào bé! 👋</span>}
              subtitle={say}
              className="flex-1 max-md:rounded-none max-md:bg-transparent max-md:px-0 max-md:py-0 max-md:shadow-none"
            />
          </div>
          {/* `data-today` is on the seven day circles, and only there. `StreakWeek` draws them at
            * the map's 30 px, which with their labels and the streak count is wider than a 320 px
            * phone — so the phone shrinks them in place to 24 px until the design's compact
            * seven-dot variant exists (brief §16). Back to 30 px from `ipad` up, untouched. */}
          <div className="flex flex-wrap items-center gap-2 [&_[data-today]]:h-6 [&_[data-today]]:w-6 [&_[data-today]]:text-sm ipad:gap-3 ipad:[&_[data-today]]:h-[30px] ipad:[&_[data-today]]:w-[30px] ipad:[&_[data-today]]:text-base">
            <StreakWeek dots={weekDots(now, events)} streak={streak(now, events)} />
            {/* The star total is the design's 13 px line under the greeting on a phone and the
              * chunky sun pill of the map from `ipad` up — one element, restyled, so the number
              * is never in the page twice. */}
            {/* `ipad:leading-normal` is not decoration. `text-lg` sets a 28 px line-height as well
              * as an 18 px size, and `ipad:text-[22px]` restores only the size — so the pill came
              * out 52 px tall instead of the map's 57 and dragged the row 3 px down with it. Any
              * arbitrary-size restore has to restate the leading it is stepping on (1.5 is the
              * inherited value the 22 px pill has always resolved against). */}
            <div className="inline-flex items-center gap-2 rounded-[18px] font-display text-lg font-extrabold text-sun-700 ipad:bg-sun-50 ipad:px-5 ipad:py-3 ipad:text-[22px] ipad:leading-normal ipad:shadow-chunky-sun">
              ⭐ {totalStars()}
            </div>
          </div>
        </header>

        {overLimit && (
          <div
            data-testid="limit-banner"
            className="rounded-xl2 bg-sun-50 px-5 py-4 text-center font-display text-xl font-extrabold text-sun-700 shadow-card-sm"
          >
            Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!
          </div>
        )}

        {/* One set of islands serves both layouts: a 2-column grid on a phone or portrait tablet,
          * and the absolutely positioned map from `ipad` up, where the percentage offsets take
          * effect. The frame keeps the handoff's 1194×834 proportions but never grows past the
          * viewport, so on a short landscape iPad the whole map — mission card included — stays
          * on screen. */}
        <div className="relative grid grid-cols-2 gap-2.5 md:gap-4 ipad:block ipad:aspect-[1194/834] ipad:max-h-[calc(100vh-180px)]">
          {/* First in the grid, and so first under the greeting: on a phone the one thing the child
            * is here to do must not sit below the fold. It used to be last, which put "Bắt đầu" at
            * y≈1221 on an 844 px screen (design M1b). From `ipad` up it goes back to the bottom-left
            * corner of the map, where DOM order stops mattering because every child is absolute. */}
          {/* `w-[min(380px,32%)]`, not a flat 380: the three controls along the foot of the map are
            * positioned independently — this one from the left, Speak Lab centred, the parent link
            * from the right — so the only thing keeping them apart is their widths. 380 px was
            * measured against the design's 1194 frame; on a 10.2" iPad (1080 pt, and less again
            * once Safari takes its tab and bookmark bars) the card reached past the centre and sat
            * under the Speak Lab button. A percentage cap keeps the gap proportional at every
            * iPad width instead of only at the one the design was drawn on. */}
          <div className="col-span-2 ipad:absolute ipad:bottom-2 ipad:left-2 ipad:w-[min(380px,32%)]">
            <MissionCard status={lesson} />
          </div>

          {/* The grid needs a heading; the map does not — the islands *are* the map. */}
          <h2 className="col-span-2 font-display text-base font-extrabold text-ink-500 ipad:hidden">
            🏝️ Đảo chủ đề
          </h2>

          {/* `contents` in the stacked grid, so the islands stay plain grid items; from `ipad` up it
            * becomes the top band of the map and the percentages resolve against it. The band stops
            * 244 px short of the bottom, which is the strip the mission card and the parent link
            * occupy — that keeps the trail and the island labels clear of them at any frame size. */}
          <div className="contents ipad:absolute ipad:inset-x-0 ipad:bottom-[244px] ipad:top-0 ipad:block">
            <svg
              aria-hidden="true"
              viewBox="0 0 1194 834"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 hidden h-full w-full ipad:block"
            >
              <path d={TRAIL} stroke="#EAD9BE" strokeWidth={14} strokeLinecap="round" strokeDasharray="2 26" fill="none" />
            </svg>

            {ISLANDS.map(island => {
              const unlocked = topicUnlocked(island.id)
              const stars = topicStars(island.id)
              // `left`/`top` are the island's top-left corner, the same anchor the handoff frame
              // uses. The press is a scale rather than a nudge down, which would fight the
              // absolute `top` on the map.
              const position = { left: island.left, top: island.top }

              // A locked island keeps its place on the trail — the child can see what is coming —
              // but it is not a link and never reads as one.
              if (!unlocked) {
                return (
                  <div
                    key={island.id}
                    data-testid={`island-${island.id}`}
                    aria-disabled="true"
                    style={position}
                    className={`${ISLAND_BOX} ${ISLAND_LOCKED}`}
                  >
                    <span aria-hidden="true" className={`flex items-center justify-center rounded-full ${ISLAND_DISC} ${island.color}`}>
                      🔒
                    </span>
                    {/* `ipad:leading-tight` restates the tight leading `ipad:text-xl` would
                      * otherwise reset from a media query — 3 px per island, which is 3 px of the
                      * map's hard-won clearance at 1194×834. */}
                    <span className="font-display text-base font-extrabold leading-tight text-ink-500 ipad:text-xl ipad:leading-tight">{island.name}</span>
                    {/* `ipad:whitespace-nowrap`: an island is 15% of the map band, which is ~141 px
                      * on a 10.2" iPad. The chip wraps to two lines there and the second line
                      * pushes out of the island band and over the mission card — the map is fitted
                      * to the band's height, so a label that grows has nowhere to go but down. */}
                    <Chip tone="neutral" size="sm" className="ipad:whitespace-nowrap">Chưa mở khóa</Chip>
                  </div>
                )
              }

              return (
                <Link
                  key={island.id}
                  data-testid={`island-${island.id}`}
                  to={`/topic/${island.id}`}
                  aria-label={`${island.name}, ${stars} sao`}
                  style={position}
                  className={`${ISLAND_BOX} ${ISLAND_OPEN} transition-transform active:scale-95`}
                >
                  <span aria-hidden="true" className={`flex items-center justify-center rounded-full ${ISLAND_DISC} ${island.color}`}>
                    {island.emoji}
                  </span>
                  {/* The subtitle is the island's job description (Phase 9 §4): the map is the
                    * free-choice library the child dips into, next to — never instead of — the
                    * daily mission. Locked tiles say "Chưa mở khóa" there instead: there is
                    * nothing to practise on an island that has not opened yet. */}
                  {/* The two rows of the map get half the island band each, and that band is what
                    * is left of the viewport after the header and the control strip. On a short
                    * landscape iPad — a mini is ~634 pt tall once Safari takes its bars — half is
                    * about 127 px, which a 76 px disc plus three lines of label overruns. So the
                    * label sheds its least load-bearing line there: the name and the stars stay,
                    * the job description goes. Above 720 pt nothing changes. */}
                  <span aria-hidden="true" className="flex flex-col items-center leading-tight">
                    <span className="font-display text-base font-extrabold text-ink-900 ipad:text-[min(20px,2.5vh)]">{island.name}</span>
                    <span className="font-display text-[11px] font-extrabold text-teal-600 ipad:text-[13px] ipad:text-ink-500 ipad:[@media(max-height:720px)]:hidden">Luyện thêm</span>
                  </span>
                  <StarRow value={stars} size="sm" />
                </Link>
              )
            })}
          </div>

          {/* One row along the foot of the grid on a phone — the wide way into Speak Lab and a
            * 64 px square for the grown-ups — and, from `ipad` up, `contents` hands both links back
            * to the map frame so their own corners of it still apply. */}
          <div className="col-span-2 flex items-stretch gap-2.5 ipad:contents">
            {/* The way into Speak Lab. The islands are the topic map, so without this the staircase —
              * and with it Nghe & chọn, Sentence Stars and Story Voice — would have no route in. */}
            <div className="flex flex-1 ipad:absolute ipad:bottom-6 ipad:left-1/2 ipad:flex-none ipad:-translate-x-1/2 ipad:justify-center">
              <Link
                to="/levels"
                className="inline-flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl2 bg-teal-500 px-7 font-display text-xl font-extrabold text-white shadow-chunky-teal active:translate-y-[2px] ipad:w-auto"
              >
                🗣️ Các bậc luyện nói
              </Link>
            </div>

            <div className="flex justify-end ipad:absolute ipad:bottom-2 ipad:right-2">
              <Link
                to="/parent"
                aria-label="Phụ huynh"
                className="flex min-h-[64px] w-16 items-center justify-center rounded-xl2 bg-white font-display text-lg font-extrabold text-ink-500 shadow-card-sm active:translate-y-[2px] ipad:w-auto ipad:min-w-[64px] ipad:px-5"
              >
                {/* The label is the accessible name at every size (it is on the link); on a phone
                  * the square keeps just the emoji, which is the only thing the design's 64×64
                  * button has room for. Two whole spellings, `HomeLabel`-style, rather than one
                  * emoji plus an `ipad:`-revealed word next to it: a flex `gap` between two items
                  * is 8 px where the map's single text run had a 4-ish px space, and the button
                  * came out 157 px wide instead of the 153 the corner has always been. */}
                <span aria-hidden="true" className="ipad:hidden">👨‍👩‍👧</span>
                <span aria-hidden="true" className="hidden ipad:inline">👨‍👩‍👧 Phụ huynh</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
