import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TOPICS } from '../content/topics'
import { totalStars } from '../progress/store'
import { dayKey, getActivity, missionStatus, streak, weekDots, minutesToday, longestStreak, minutesPerDay } from '../progress/activity'
import { lessonStatus } from '../progress/lesson'
import { hasAnyHistory, sumHistory } from '../progress/history'
import { getLimitMinutes } from '../progress/limit'
import { activeProfileId, storageKey } from '../progress/storageKeys'
import { topicStars, topicUnlocked } from '../progress/topicProgress'
import { listProfiles } from '../cloud/profileState'
import { isAnonymous } from '../cloud/auth'
import { isCloudConfigured } from '../cloud/supabase'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { MissionCard } from '../components/MissionCard'
import { StreakWeek } from '../components/StreakWeek'
import { Chip, NoticeStack, SpeechBubble, StarRow } from '../components/ui'
import type { NoticeProps } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

// Per child, like every other stored value — see progress/storageKeys.ts.
const celebratedKey = () => storageKey('celebrated')

// The celebration is once per day, not once per visit to Home — the day it last fired is
// remembered so coming back to Home does not re-throw confetti at the child.
function alreadyCelebrated(day: string): boolean {
  try { return localStorage.getItem(celebratedKey()) === day }
  catch { return false }
}

function markCelebrated(day: string): void {
  try { localStorage.setItem(celebratedKey(), day) }
  catch { /* ignore: storage unavailable */ }
}

// ---------------------------------------------------------------------------
// Phase 11: the milestone banner and the Add-to-Home-Screen nudge.
//
// Both are dismiss-once flags, profile-scoped like `celebrated` above, and neither is a synced
// key — `progress/synced.ts`'s allowlist has never heard of either name, so `isSyncedName` says no
// and the outbox never queues them. That is what makes them safe to write with a bare
// `localStorage.setItem`, exactly like the celebration stamp.
// ---------------------------------------------------------------------------

const bannerDismissedKey = () => storageKey('cloud.bannerDismissed')
const a2hsDismissedKey = () => storageKey('a2hs.dismissed')

function wasDismissed(key: string): boolean {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

function dismiss(key: string): void {
  try { localStorage.setItem(key, '1') } catch { /* ignore: storage unavailable */ }
}

/** Already installed, on whatever platform bothers to say so. */
function isStandaloneDisplay(): boolean {
  try {
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return true
    return window.matchMedia?.('(display-mode: standalone)').matches ?? false
  } catch {
    return false
  }
}

/**
 * The ITP-7-day wipe this nudge exists for is a WebKit thing, and on iOS EVERY browser is WebKit —
 * Chrome and Firefox there are Safari's engine in a different shell, and they lose the storage the
 * same way. So the test is the platform, not the browser, which is exactly what this regex asks;
 * the copy names no browser either, and says "Màn hình chính", which is what all of them call it.
 */
function looksLikeIOS(): boolean {
  try { return /iP(hone|od|ad)/.test(window.navigator.userAgent) } catch { return false }
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
 * Below `ipad` it is one card of the M1b grid: a 110 px tile on a phone (dropped from the old 128
 * so a 2-column grid still shows two full rows under two banners — task 9 / design §2 A3) and
 * 150 px from `md` up, where the grid also goes three columns and has room to breathe. It stands
 * on its own chunky shadow — no map, no trail, no position. From `ipad` up (landscape only —
 * `md:` also matches a real iPad, but the `ipad:` variant outranks it, see `tailwind.config.ts`)
 * every one of those card styles is unset again and the island goes absolute at its slot, which is
 * the curved map exactly as it has always been.
 *
 * `ipad:w-[15%]`: a percentage width, so an island's centre is a fixed fraction of the band on every
 * viewport and the trail below stays under the discs. The tighter `ipad:gap-1` is what buys the two
 * rows their clearance on the shortest screen the map now runs on (1194×834).
 */
const ISLAND_BOX = 'flex h-[110px] flex-col items-center justify-center gap-1 rounded-xl3 px-2 text-center'
  + ' md:h-[150px]'
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
  // The streak panel's "Tuần này" tile: the same seven days ParentDashboard sums for its own
  // "Tuần này" line.
  const weekMinutes = minutesPerDay(7, now, events).reduce((sum, d) => sum + d.minutes, 0)
  // The streak panel's per-day minute labels, keyed by day rather than by array index: `dots`
  // below is the calendar week (Monday..Sunday from `weekDots()`), which only lines up with a
  // *rolling* 7-day window on a Sunday. 14 days covers any Monday-aligned week no matter what day
  // it is today, so every dot finds its own date in this map regardless of where the week falls.
  const minutesByDay = Object.fromEntries(minutesPerDay(14, now, events).map(r => [r.day, r.minutes]))
  // TODAY's work, and only today's: `missionStatus` and `lessonStatus` both filter the log to the
  // current day. It is the right question for Foxy's mood and greeting ("Giỏi lắm, tiếp tục nhé!"
  // is about this morning) and the wrong one for anything about the child's history — see
  // `hasHistory` below.
  const doneToday =
    lesson.doneCount > 0 || counters.story > 0 || counters.speak > 0 || counters.word > 0
  const mood: FoxyMood = lesson.done ? 'cheer' : doneToday ? 'happy' : 'idle'
  const say = lesson.done
    ? 'Hoàn thành nhiệm vụ rồi! 🎉'
    : doneToday
      ? 'Giỏi lắm, tiếp tục nhé!'
      : 'Hôm nay mình luyện nói nhé!'
  /**
   * Has ANY child on this iPad ever done anything — the whole log, and every namespace, not today's
   * slice of the active one.
   *
   * Two narrowings, both fixed here, because the restore link below is the door that abandons an
   * account and it may only appear on a device with nothing to lose:
   *
   *  - **Not today-scoped.** `missionStatus`/`lessonStatus` filter to the current day, so this used
   *    to reappear every morning before the child's first tap, on top of months of history.
   *  - **Not active-profile-scoped.** Every child on this iPad belongs to the SAME account, so a
   *    sibling's stars are exactly as strandable as this child's. Asking only about the active
   *    namespace put the link on the empty sibling's Home — which flow 6's picker makes a one-tap
   *    everyday destination — while the first child's months of progress sat one namespace away.
   */
  // A Set, so a child who is both in the roster and active is counted once — and `null` is always
  // in it, because the legacy un-namespaced keys are where everything lives on a device whose
  // `speakup.profile` write failed (roster written, active not, `ensureLocalProfile` returns
  // early). That device has a full history and no namespace to find it under.
  const historyIds = new Set<string | null>(listProfiles().map(p => p.id))
  historyIds.add(activeProfileId())
  historyIds.add(null)
  const hasHistory = hasAnyHistory(sumHistory([...historyIds]))
  const overLimit = minutesToday(now, events) >= getLimitMinutes()

  // Decided once per mount, then remembered in storage by the effect below, so the trip to the
  // celebration screen happens on the render that first sees a finished lesson — and only then.
  const [celebrating] = useState(() => lesson.done && !alreadyCelebrated(dayKey(now)))
  useEffect(() => {
    if (!celebrating) return
    markCelebrated(dayKey(now))
    navigate('/mission/done')
  }, [celebrating, now, navigate])

  // A build with no cloud env vars has nothing below to show: no banner, no "already used
  // this?" link. `cloudAvailable` is read once, synchronously, so a device without the env
  // vars never even asks whether it is signed in — no chunk load, no effect, byte for byte the
  // app before Phase 11.
  const [cloudAvailable] = useState(isCloudConfigured)
  // null = not answered yet (or no cloud at all) — the banner needs a definite "still anonymous"
  // before it may claim the parent has not linked, so it stays hidden rather than guessing.
  const [linked, setLinked] = useState<boolean | null>(null)
  useEffect(() => {
    if (!cloudAvailable) return
    let cancelled = false
    isAnonymous().then(anon => { if (!cancelled) setLinked(!anon) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [cloudAvailable])

  const [bannerDismissed, setBannerDismissed] = useState(() => cloudAvailable && wasDismissed(bannerDismissedKey()))
  const showMilestoneBanner = cloudAvailable && linked === false && streak(now, events) >= 3 && !bannerDismissed
  function handleDismissBanner() {
    dismiss(bannerDismissedKey())
    setBannerDismissed(true)
  }

  const [a2hsDismissed, setA2hsDismissed] = useState(() => wasDismissed(a2hsDismissedKey()))
  const showA2hs = !a2hsDismissed && looksLikeIOS() && !isStandaloneDisplay()
  function handleDismissA2hs() {
    dismiss(a2hsDismissedKey())
    setA2hsDismissed(true)
  }

  // The A2HS notice's "Cách làm" action has nothing of its own to navigate to — Safari's Add-to-
  // Home-Screen is a share-sheet action, not a page — so it just expands the notice's own sub text
  // in place, the fallback the brief calls for when an action has no existing screen to open.
  const [a2hsHowToOpen, setA2hsHowToOpen] = useState(false)

  // The three ad-hoc `bg-sun-50`/`bg-fix-50` banners this Home used to hand-roll, now built as
  // `NoticeProps` and handed to one `NoticeStack` — see Phase 12 task 11. Order here is the order
  // ties break in (the stack's own priority sort only reorders across different `kind`s).
  const noticeItems: NoticeProps[] = []
  if (overLimit) {
    noticeItems.push({
      kind: 'warn',
      title: 'Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!',
      testId: 'limit-banner',
    })
  }
  if (showMilestoneBanner) {
    noticeItems.push({
      kind: 'info',
      title: 'Liên kết email để giữ tiến độ của bé',
      sub: 'Tiến độ mới lưu trên máy này — nhờ bố mẹ liên kết email để giữ an toàn.',
      action: { label: 'Góc phụ huynh', onClick: () => navigate('/parent') },
      onClose: handleDismissBanner,
      testId: 'milestone-banner',
    })
  }
  if (showA2hs) {
    noticeItems.push({
      kind: 'info',
      title: 'Thêm Speak Up vào Màn hình chính',
      sub: a2hsHowToOpen
        ? 'Nhấn nút Chia sẻ ⬆️ trên thanh Safari, rồi chọn "Thêm vào MH Chính".'
        : 'Mở nhanh hơn, không cần trình duyệt.',
      action: { label: 'Cách làm', onClick: () => setA2hsHowToOpen(v => !v) },
      onClose: handleDismissA2hs,
      testId: 'a2hs-banner',
    })
  }

  // The parent-dashboard corner button, moved verbatim into the header's right cell — Home is
  // excluded from the mission chip by route (`LessonChip`'s own `isExcluded`), so the default
  // `right` (the chip) would just render nothing here; this is Home's own control for that cell.
  const parentButton = (
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
  )

  /**
   * Task 9 / design decision 16: the streak week pill and the star total, which used to sit only in
   * the body (a bare row on a phone, restyled into the map's chunky sun pill from `ipad` up), move
   * into the header's right cell from `md` up — portrait AND landscape both, since `md:` matches a
   * real iPad at either orientation. `parentButton` rides along unconditionally: it already lives in
   * this cell at every width (see `right` below), so nothing about its own placement changes.
   *
   * The `hidden md:flex` wrapper is what keeps this pair off a phone header, where the two fixed
   * 56 px side columns leave no room for them — the body keeps its own copy for a phone, marked
   * `home-streak-row` + `md:hidden` below, so the two never show at once.
   */
  const headerCluster = (
    <>
      <div className="hidden items-center gap-2 md:flex">
        <StreakWeek
          dots={weekDots(now, events)}
          streak={streak(now, events)}
          longest={longestStreak(events)}
          weekMinutes={weekMinutes}
          stars={totalStars()}
          minutes={minutesByDay}
        />
        <div className="inline-flex items-center gap-2 rounded-[18px] font-display text-lg font-extrabold text-sun-700 ipad:bg-sun-50 ipad:px-5 ipad:py-3 ipad:text-[22px] ipad:leading-normal ipad:shadow-chunky-sun">
          ⭐ {totalStars()}
        </div>
      </div>
      {parentButton}
    </>
  )

  return (
    <PageShell className="relative">
      {/* Soft background blobs of the handoff frame. They hang off every edge, so they are clipped
          by their own container rather than by the page: otherwise the bottom-right blob stretched
          the scroll height and the child could scroll down into empty cream. `-z-10`: this wrapper
          is `position: absolute`, but `PageHeader`/`PageBody` are plain static-flow siblings —
          without an explicit negative z-index the blob paints ABOVE them (a positioned element
          always paints above static in-flow content, DOM order or not) and covered the header's
          greeting text. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-28 h-[300px] w-[300px] rounded-full bg-[#FFEDD6]" />
        <div className="absolute -bottom-32 -right-20 h-[340px] w-[340px] rounded-full bg-teal-50" />
      </div>

      {/* Home has no destination to walk back to. */}
      <PageHeader back={null} right={<div className="flex items-center gap-2 max-md:contents md:gap-3">{headerCluster}</div>}>
        <h1 className="sr-only">Speak Up!</h1>
        {/* The header's centre column sits between two fixed 56/64 px side columns — no room
          * there for Foxy and the full speech bubble below `md`, so the phone header shows a
          * single truncated greeting line instead; Foxy and the full bubble move to the body's
          * first row (see below), which is not squeezed by the header's side columns. */}
        {/* `block max-w-[190px]`: `PageHeader`'s centre cell is `justify-self-center` — a
          * shrink-to-fit box, not stretched to the grid track — so `truncate` alone on a bare
          * `<span>` has no bounded width to clip against and just overflows past the column. A
          * fixed cap (comfortably inside the ~260 px a 390 px phone's `1fr` column leaves after
          * the two 56 px side columns) gives it one regardless of ancestor sizing. */}
        <span className="block max-w-[190px] truncate font-display text-[17px] font-extrabold text-coral-text md:hidden md:text-[20px]">
          {say}
        </span>
        <div className="hidden items-center gap-3 md:flex">
          <Foxy mood={mood} size="md" className="animate-bob" />
          <SpeechBubble
            title={<span className="text-coral-text">Chào bé! 👋</span>}
            subtitle={say}
            className="flex-1"
          />
        </div>
      </PageHeader>

      <PageBody className="relative gap-2.5 ipad:gap-3">
        {/* The over-limit / milestone / A2HS banners, as one `NoticeStack` — first row of the body,
          * above Foxy, so whatever the child or parent most needs to see is the first thing under
          * the header regardless of scroll position. */}
        <NoticeStack items={noticeItems} />

        {/* Foxy and the full greeting, phone only — restored here because the header has no room
          * for them below `md` (see above). M1b prints the greeting as plain text: the bubble is
          * M1a's, and on a 390 px screen its white panel, its padding and its shadow cost ~26 px
          * of height for decoration the grid below needs more. Only the chrome goes — the two
          * lines themselves are the same element at every width, so the greeting is never in the
          * page twice below `md`. `max-md:` because every one of these classes is `SpeechBubble`'s
          * own, and an unprefixed override of ours would be a coin toss on Tailwind's utility
          * order — harmless here since the block is already `md:hidden`, but kept for safety. */}
        <div className="flex items-center gap-3 md:hidden">
          <Foxy mood={mood} size="md" className="animate-bob" />
          <SpeechBubble
            title={<span className="text-coral-text">Chào bé! 👋</span>}
            subtitle={say}
            className="flex-1 max-md:rounded-none max-md:bg-transparent max-md:px-0 max-md:py-0 max-md:shadow-none"
          />
        </div>

        {/* The phone-only copy: from `md` up the same numbers live in the header's right cell
          * instead (`headerCluster` above), so this row hides there rather than showing twice. */}
        <div data-testid="home-streak-row" className="flex flex-wrap items-center gap-2 ipad:gap-3 md:hidden">
          <StreakWeek
            dots={weekDots(now, events)}
            streak={streak(now, events)}
            longest={longestStreak(events)}
            weekMinutes={weekMinutes}
            stars={totalStars()}
            minutes={minutesByDay}
          />
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

        {/* One set of islands serves both layouts: a 2-column grid on a phone or portrait tablet,
          * and the absolutely positioned map from `ipad` up, where the percentage offsets take
          * effect. The frame keeps the handoff's 1194×834 proportions but never grows past the
          * viewport, so on a short landscape iPad the whole map — mission card included — stays
          * on screen. */}
        <div className="relative grid grid-cols-2 gap-2.5 md:grid-cols-3 md:auto-rows-fr md:gap-3 ipad:block ipad:aspect-[1194/834] ipad:max-h-[calc(100vh-260px)]">
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
          {/* `md:col-span-3`, not just `col-span-2`: task 9 makes the grid three columns from `md`
            * up, and a 2-of-3 span no longer reaches the last column — CSS auto-placement then slid
            * the first island into that leftover cell, on the SAME row as this card, instead of
            * giving it (and the heading below) a clean row of their own. A full-width span is what
            * lets the 8 islands + Speak Lab that follow start their own fresh 3×3 block: 9 items,
            * 3 whole rows, no leftover cell for one of them to hide in. */}
          <div className="col-span-2 md:col-span-3 ipad:absolute ipad:bottom-2 ipad:left-2 ipad:w-[min(380px,32%)]">
            <MissionCard status={lesson} />
          </div>

          {/* The grid needs a heading; the map does not — the islands *are* the map. Same
            * full-width reasoning as the mission card above. */}
          <h2 className="col-span-2 md:col-span-3 font-display text-base font-extrabold text-ink-500 ipad:hidden">
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

          {/* One row along the foot of the grid on a phone — the wide way into Speak Lab, a 64 px
            * square for the grown-ups — and, from `md` up, `contents` hands every link back to the
            * grid/map frame so their own corners apply instead: Speak Lab becomes the 9th tile of
            * the 3-column portrait grid (task 9 / design decision 16), and from `ipad` up its own
            * `ipad:absolute` corner (unset by `ipad:flex-none`, same idea `ISLAND_BOX` uses) puts
            * it back at the foot of the map exactly as before. */}
          <div data-testid="home-foot" className="col-span-2 flex items-stretch gap-2.5 md:contents ipad:contents">
            {/* The way into Speak Lab. The islands are the topic map, so without this the staircase —
              * and with it Nghe & chọn, Sentence Stars and Story Voice — would have no route in.
              * `ipad:h-auto` cancels `md:h-[150px]` at landscape — the 150 is only for the 9th
              * grid cell of the portrait layout; on the map this box has to keep shrinking to its
              * child's own height (the `min-h-[64px]` teal button), same as before task 9, or its
              * bottom-anchored (`ipad:bottom-6`) box grows upward and collides with the restore
              * link floating above it. Same `ISLAND_BOX` trick, same reason. */}
            <div className="flex flex-1 md:h-[150px] md:flex-none ipad:h-auto ipad:absolute ipad:bottom-6 ipad:left-1/2 ipad:flex-none ipad:-translate-x-1/2 ipad:justify-center">
              <Link
                to="/levels"
                // `ipad:h-auto ipad:rounded-xl2 ipad:text-xl` restore the map's own button exactly —
                // `md:h-full`/`md:rounded-r22`/`md:text-[19px]` are the portrait 9th-tile look and
                // would otherwise leak into the landscape map too (ipad: outranks md:, but only for
                // the properties it actually restates).
                className="inline-flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl2 bg-teal-500 px-7 font-display text-xl font-extrabold text-white shadow-chunky-teal active:translate-y-[2px] md:h-full md:rounded-r22 md:text-[19px] ipad:h-auto ipad:w-auto ipad:rounded-xl2 ipad:text-xl"
              >
                🗣️ Các bậc luyện nói
              </Link>
            </div>

            {/* The design's phone foot keeps its own 56–64 px parent square next to Speak Lab
              * (§2 A3, "Hàng chân"); from `md` up the same button already lives in the header's
              * right cell (`headerCluster` above), so this copy steps aside there rather than
              * showing twice. */}
            <div data-testid="home-foot-parent" className="flex items-center justify-center md:hidden">
              {parentButton}
            </div>

            {/* Spec flows 3/4's other door, and it is only ever offered on a device that has
              * nothing of its own to lose: a fresh install, or a cache the browser wiped. The test
              * is the child's whole HISTORY (`hasHistory`), never today's activity — a today-scoped
              * one put this link back on screen every morning before the first tap, on top of
              * months of progress, in front of a child, one tap from a screen that can hand this
              * iPad to a different account. */}
            {cloudAvailable && !hasHistory && (
              // `md:hidden`: on a portrait iPad this link is `home-foot`'s only child without a
              // `md:` span of its own, so from `md` up it would auto-place as a stray 10th cell in
              // what has to stay a clean 8-island-plus-Speak-Lab 3×3 block (see the mission card
              // comment above) — design §2 A3 wants it under MissionCard on a brand-new iPad
              // portrait, a repositioning task 9 does not attempt; hiding it here keeps the grid
              // honest in the meantime rather than leaving it to land wherever the grid has room.
              // `ipad:flex` restores it at landscape — `ipad:` outranks `md:` on the shared
              // `display` property, same trick `ISLAND_BOX` relies on, so the map keeps this link
              // exactly as before rather than losing it to the portrait-only hide.
              <div className="flex items-center justify-center md:hidden ipad:flex ipad:absolute ipad:bottom-[100px] ipad:left-1/2 ipad:-translate-x-1/2">
                <Link to="/start" data-testid="home-foot-restore" className="text-xs font-bold text-ink-500 underline ipad:text-sm">
                  Đã dùng Speak Up rồi?
                </Link>
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </PageShell>
  )
}
