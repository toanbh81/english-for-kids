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
 * Stories are the exception, and no longer for the original reason. They used to be excluded from
 * the mission-aware screens outright, so nothing inside one knew it was a lesson step and the chip
 * was the only thread back. That is fixed: the player, the quiz and the retell all read the flag
 * now and all lead home.
 *
 * The exception stays because the story is the one step spread over three routes, only the first of
 * which `isItemRoute` matches. The chip's own reason to hide is "this screen already grew the
 * controls" — and on `/story/:id/quiz` and `/story/:id/retell` that is true only while the flag is
 * still being forwarded hop by hop. Any future link into the middle of a story that forgets it, or
 * a reload that drops the router state, lands the child on a sub-route with a back arrow pointing
 * at the story library and nothing else. Suppressing the chip there would cost them the last thread
 * back, and it costs a mission-aware story screen nothing but a redundant pill in a corner it does
 * not use. So the rule is deliberately asymmetric: hide where the screen is *proven* to lead home,
 * show where it merely usually does.
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
 * Where the chip stands: every migrated screen ends its `PageHeader` with the same right-hand
 * cell, 56/64 px wide, and this is what fills it when nothing screen-specific claims it instead.
 * It sits inside the header's own grid cell rather than floating over the page, so it carries no
 * `fixed`, no `z-40`, and no safe-area offset of its own — the header that hosts it already
 * accounts for those.
 *
 * At 56 px wide the words do not fit beside the sun, so the count goes under it and "Nhiệm vụ"
 * stays in the accessibility tree (`sr-only`) — the name a screen reader reads is the same string
 * at every width. `md:not-sr-only` puts the words back in the flow from the tablet breakpoint up.
 */
const HEADER_BOX
  = 'inline-flex h-14 w-14 flex-col items-center justify-center rounded-r18 bg-sun-50'
  + ' font-display font-extrabold leading-none text-sun-700 shadow-chunky-sun active:translate-y-[2px]'
  + ' md:h-12 md:w-auto md:flex-row md:gap-2 md:rounded-r16 md:px-4 md:text-[16px]'

/**
 * Whether the lesson thread belongs on this screen, and its count when it does — the storage read
 * and the hide rules `LessonChip` and `LessonChipInner` (both variants) share.
 *
 * Only the storage reads are frozen here (lazy `useState`). Whether the chip belongs on this
 * screen is decided below, from that one snapshot — the redundancy rule needs today's items, which
 * is exactly what this read already fetched.
 */
export function useLessonChipStatus(pathname: string, inMission: boolean) {
  const [lesson] = useState(() => lessonStatus(Date.now(), getActivity()))
  const hidden = lesson.done || isRedundant(pathname, inMission, lesson.items)
    || !lesson.items.some(item => onItemRoute(pathname, item.route))
  return hidden ? null : { doneCount: lesson.doneCount, total: lesson.total }
}

/**
 * The thread back to the lesson. A mission item drops the child onto an ordinary practice screen
 * whose own back button goes wherever that screen belongs — the story list, the word deck — so
 * without this, finishing a step left them off the lesson with no sign it was still running.
 *
 * It shows only while the child is standing on one of today's own item routes and the lesson is
 * unfinished, so it never nags during free practice.
 *
 * Every screen now draws its own `PageHeader`, and this is what that header's right-hand cell
 * renders by default — the floating corner pill Phase 12 migrated away from is gone; there is only
 * the one, header-sized chip.
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
  const status = useLessonChipStatus(pathname, inMission)

  if (!status) return null

  return (
    <Link to="/mission" className={HEADER_BOX}>
      {/* Three spans, and from `md` up exactly one of them is rendered: the middle one, carrying
          the whole line as a single text run. That is deliberate. Splitting the label and the
          count into two visible spans made them two flex items, and the pill's own `gap-2` then
          stood where the space between the words used to — 4 px wider on the iPad, which this
          phase may not move. The phone's two lines are the outer pair; the middle span stays in
          the accessibility tree at both widths, so the name a screen reader reads never changes. */}
      <span aria-hidden="true" className="text-[18px] leading-none md:hidden">🌞</span>
      <span className="sr-only md:not-sr-only">🌞 Nhiệm vụ {status.doneCount}/{status.total}</span>
      <span aria-hidden="true" className="text-[13px] leading-none md:hidden">{status.doneCount}/{status.total}</span>
    </Link>
  )
}
