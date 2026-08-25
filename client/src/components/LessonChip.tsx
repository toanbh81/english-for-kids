import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getActivity } from '../progress/activity'
import { lessonStatus } from '../progress/lesson'
import type { LessonItem } from '../progress/lesson'
import { isItemRoute } from '../progress/missionNav'

/**
 * Screens that must never carry the chip: the map and the mission itself are already the way back,
 * and the parent area is not the child's flow at all.
 */
function isExcluded(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/mission') || pathname.startsWith('/parent')
}

/**
 * A screen the child opened as a mission step already carries the lesson: its header goes back to
 * `/mission` and its CTA hands on to the next step (spec §3), so the chip would be a third,
 * redundant control competing with them in the corner.
 *
 * The flag alone is not enough to know that. A screen only grows those controls when
 * `useMissionNext()` finds the path among today's steps, so the chip has to ask the very same
 * question — `isItemRoute`, the matcher `missionNav` walks with — rather than trust the flag. They
 * disagreed for a child upgrading from Phase 8: yesterday's stored lesson still holds the old
 * `/sound/<ph>` step while the tap lands on `/sound/<ph>/<cardId>`, so the screen found no mission,
 * the chip assumed it had, and the child was left on a word with nothing leading back.
 *
 * Stories are the exception in the other direction. They are excluded from the mission-aware
 * screens on purpose — a story keeps its own player flow — so nothing inside one knows it is a
 * lesson step even when the routes do match, and the chip is the only thread back to the mission.
 */
function isRedundant(pathname: string, inMission: boolean, items: LessonItem[]): boolean {
  return inMission && !pathname.startsWith('/story/') && isItemRoute(items, pathname)
}

/**
 * Whether the child is standing on `route` — the step itself, or one of the screens that step
 * leads into. A story is played, then quizzed, then retold across `/story/s1`, `/story/s1/quiz`
 * and `/story/s1/retell`, and the chip is the only thread back through all three: dropping it at
 * the quiz stranded the child in the middle of their own lesson step.
 *
 * The prefix is matched by whole segment, never as bare text: `/words/food/apple` must not claim
 * `/words/food/apple-pie`, which is a different card entirely.
 */
function onItemRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

/**
 * The thread back to the lesson. A mission item drops the child onto an ordinary practice screen
 * whose own back button goes wherever that screen belongs — the story list, the word deck — so
 * without this, finishing a step left them off the lesson with no sign it was still running.
 *
 * It shows only while the child is standing on one of today's own item routes and the lesson is
 * unfinished, so it never nags during free practice.
 */
export function LessonChip() {
  const { pathname, state } = useLocation()
  const inMission = (state as { mission?: unknown } | null)?.mission === true
  if (isExcluded(pathname)) return null
  // Keyed on the path so the inner component remounts on every navigation: its lazy state reads
  // the lesson and the event log exactly once per screen the child lands on, never per render.
  return <LessonChipInner key={pathname} pathname={pathname} inMission={inMission} />
}

function LessonChipInner({ pathname, inMission }: { pathname: string; inMission: boolean }) {
  // Only the storage reads are frozen here. Whether the chip belongs on this screen is decided
  // below, from that one snapshot — the redundancy rule needs today's items, which is exactly what
  // this read already fetched.
  const [lesson] = useState(() => lessonStatus(Date.now(), getActivity()))

  const status = lesson.done || isRedundant(pathname, inMission, lesson.items)
    || !lesson.items.some(item => onItemRoute(pathname, item.route))
    ? null
    : lesson

  if (!status) return null

  return (
    <Link
      to="/mission"
      // `z-40` clears the screens' own content but stays under a full-screen overlay; the fixed
      // bottom-right corner is the one place no screen puts its primary control.
      className="fixed bottom-4 right-4 z-40 inline-flex min-h-[64px] items-center gap-2 rounded-full bg-sun-50 px-6 font-display text-xl font-extrabold text-sun-700 shadow-chunky-sun active:translate-y-[2px]"
    >
      🌞 Nhiệm vụ {status.doneCount}/{status.total}
    </Link>
  )
}
