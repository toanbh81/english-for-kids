import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getActivity } from '../progress/activity'
import { lessonStatus } from '../progress/lesson'

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
 * Stories are the exception. They are excluded from the mission-aware screens on purpose — a story
 * keeps its own player flow — so nothing inside one knows it is a lesson step, and the chip is the
 * only thread back to the mission.
 */
function isRedundant(pathname: string, state: unknown): boolean {
  const inMission = (state as { mission?: unknown } | null)?.mission === true
  return inMission && !pathname.startsWith('/story/')
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
  if (isExcluded(pathname) || isRedundant(pathname, state)) return null
  // Keyed on the path so the inner component remounts on every navigation: its lazy state reads
  // the lesson and the event log exactly once per screen the child lands on, never per render.
  return <LessonChipInner key={pathname} pathname={pathname} />
}

function LessonChipInner({ pathname }: { pathname: string }) {
  const [status] = useState(() => {
    const events = getActivity()
    const lesson = lessonStatus(Date.now(), events)
    if (lesson.done) return null
    return lesson.items.some(item => item.route === pathname) ? lesson : null
  })

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
