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
import { Chip, SpeechBubble, StarRow } from '../components/ui'

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
 */
const SLOTS = [
  { left: '3%', top: '0%', color: 'bg-coral-500 shadow-[0_8px_0_#E05A3A,0_0_0_8px_#FFE9DF]' },
  { left: '27%', top: '0%', color: 'bg-peach-400 shadow-[0_8px_0_#E07A42,0_0_0_8px_#FFE7D2]' },
  { left: '51%', top: '0%', color: 'bg-sky-400 shadow-[0_8px_0_#5BA7D4,0_0_0_8px_#DDF0FB]' },
  { left: '75%', top: '0%', color: 'bg-teal-500 shadow-[0_8px_0_#1FA396,0_0_0_8px_#D3F1EC]' },
  { left: '75%', top: '52%', color: 'bg-sun-400 shadow-[0_8px_0_#E0A61A,0_0_0_8px_#FFF1C9]' },
  { left: '51%', top: '52%', color: 'bg-[#7ED99A] shadow-[0_8px_0_#4FB56E,0_0_0_8px_#E3F6E8]' },
  { left: '27%', top: '52%', color: 'bg-[#F8A3AE] shadow-[0_8px_0_#D97C89,0_0_0_8px_#FFE3E6]' },
  { left: '3%', top: '52%', color: 'bg-[#B8A6E8] shadow-[0_8px_0_#8E79C8,0_0_0_8px_#EDE7FB]' },
] as const

/** Every disc is the same size now that there are eight of them: 96 px, 112 px from `ipad` up — well
 * clear of the 64 px tap floor, and small enough that two rows fit the band without touching. */
const ISLAND_DISC = 'h-24 w-24 text-[40px] ipad:h-28 ipad:w-28 ipad:text-[46px]'

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

// `ipad:w-[15%]`: a percentage width, so an island's centre is a fixed fraction of the band on every
// viewport and the trail below stays under the discs. The tighter `ipad:gap-1` is what buys the two
// rows their clearance on the shortest screen the map now runs on (1194×834).
const ISLAND_BOX = 'flex flex-col items-center gap-1.5 ipad:absolute ipad:w-[15%] ipad:gap-1'

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
    <main className="relative min-h-full overflow-y-auto overflow-x-hidden bg-cream-50 p-4 md:p-7">
      <h1 className="sr-only">Speak Up!</h1>

      {/* Soft background blobs of the handoff frame. They hang off every edge, so they are clipped
          by their own container rather than by the page: otherwise the bottom-right blob stretched
          the scroll height and the child could scroll down into empty cream. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-28 h-[300px] w-[300px] rounded-full bg-[#FFEDD6]" />
        <div className="absolute -bottom-32 -right-20 h-[340px] w-[340px] rounded-full bg-teal-50" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1194px] flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Foxy mood={mood} size="md" className="animate-bob" />
            <SpeechBubble title={<span className="text-coral-text">Chào bé! 👋</span>} subtitle={say} className="flex-1" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StreakWeek dots={weekDots(now, events)} streak={streak(now, events)} />
            <div className="inline-flex items-center gap-2 rounded-[18px] bg-sun-50 px-5 py-3 font-display text-[22px] font-extrabold text-sun-700 shadow-chunky-sun">
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
        <div className="relative grid grid-cols-2 gap-x-4 gap-y-4 ipad:block ipad:aspect-[1194/834] ipad:max-h-[calc(100vh-180px)]">
          {/* `contents` in the stacked grid, so the islands stay plain grid items; from `ipad` up it
            * becomes the top band of the map and the percentages resolve against it. The band stops
            * 200 px short of the bottom, which is the strip the mission card and the parent link
            * occupy — that keeps the trail and the island labels clear of them at any frame size. */}
          <div className="contents ipad:absolute ipad:inset-x-0 ipad:bottom-[200px] ipad:top-0 ipad:block">
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
                    className={`${ISLAND_BOX} opacity-50`}
                  >
                    <span aria-hidden="true" className={`flex items-center justify-center rounded-full ${ISLAND_DISC} ${island.color}`}>
                      🔒
                    </span>
                    <span className="font-display text-xl font-extrabold leading-tight text-ink-500">{island.name}</span>
                    <Chip tone="neutral" size="sm">Chưa mở khóa</Chip>
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
                  className={`${ISLAND_BOX} transition-transform active:scale-95`}
                >
                  <span aria-hidden="true" className={`flex items-center justify-center rounded-full ${ISLAND_DISC} ${island.color}`}>
                    {island.emoji}
                  </span>
                  {/* The subtitle is the island's job description (Phase 9 §4): the map is the
                    * free-choice library the child dips into, next to — never instead of — the
                    * daily mission. Locked tiles say "Chưa mở khóa" there instead: there is
                    * nothing to practise on an island that has not opened yet. */}
                  <span aria-hidden="true" className="flex flex-col items-center leading-tight">
                    <span className="font-display text-xl font-extrabold text-ink-900">{island.name}</span>
                    <span className="font-display text-[13px] font-extrabold text-ink-500">Luyện thêm</span>
                  </span>
                  <StarRow value={stars} size="sm" />
                </Link>
              )
            })}
          </div>

          {/* The way into Speak Lab. The islands are the topic map, so without this the staircase —
            * and with it Nghe & chọn, Sentence Stars and Story Voice — would have no route in. */}
          <div className="col-span-2 flex justify-center ipad:absolute ipad:bottom-6 ipad:left-1/2 ipad:-translate-x-1/2">
            <Link
              to="/levels"
              className="inline-flex min-h-[64px] items-center gap-2 rounded-xl2 bg-teal-500 px-7 font-display text-xl font-extrabold text-white shadow-chunky-teal active:translate-y-[2px]"
            >
              🗣️ Các bậc luyện nói
            </Link>
          </div>

          <div className="col-span-2 ipad:absolute ipad:bottom-2 ipad:left-2 ipad:w-[380px]">
            <MissionCard status={lesson} />
          </div>

          <div className="col-span-2 flex justify-end ipad:absolute ipad:bottom-2 ipad:right-2">
            <Link
              to="/parent"
              className="flex min-h-[64px] min-w-[64px] items-center justify-center rounded-xl2 bg-white px-5 font-display text-lg font-extrabold text-ink-500 shadow-card-sm active:translate-y-[2px]"
            >
              👨‍👩‍👧 Phụ huynh
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
