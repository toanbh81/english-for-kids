import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { lessonStatus } from './lesson'
import type { LessonItem, LessonItemKind } from './lesson'

/**
 * The router state every mission-originated navigation carries. A practice screen is the same
 * screen whether the child reached it from Speak Lab or from today's lesson, so the difference has
 * to travel with the navigation: without this flag a screen numbers itself against its own deck
 * and sends the child back to that deck (spec §3).
 */
export const MISSION_STATE = { mission: true }

/** Where the screen the child is standing on sits in today's lesson. */
export type MissionPos = {
  /** The kind of step this item is — the group the numbering counts inside. */
  group: LessonItemKind
  /** 1-based position within the group. */
  index: number
  /** How many items the group holds. */
  total: number
  /** Where "Tiếp theo" goes; `null` when nothing is left to do. */
  nextRoute: string | null
}

type DoneItem = LessonItem & { done: boolean }
type Group = { kind: LessonItemKind; items: DoneItem[] }

/**
 * Today's items bucketed by kind, each kind in the order it first appears — the same buckets the
 * Daily Mission screen draws its cards from, so "Thẻ 2/4" here and "2/4" on the card that led here
 * always count the same steps.
 */
function groupItems(items: DoneItem[]): Group[] {
  const order: LessonItemKind[] = []
  for (const item of items) if (!order.includes(item.kind)) order.push(item.kind)
  return order.map(kind => ({ kind, items: items.filter(i => i.kind === kind) }))
}

/**
 * Where `pathname` sits in today's lesson, or `null` when it is not one of today's steps at all
 * (free play, or a lesson route from a different day).
 *
 * Routes are matched whole, never by prefix: `/story/s1` and `/story/s1/retell` are two different
 * steps of the same story, and a prefix match would count the retell as the listen.
 *
 * `nextRoute` walks forward only — the next step of this group the child still owes, then the
 * first outstanding step of a later group — so a finished lesson (or the last step of it) ends at
 * `null`, which the screens read as "back to the mission".
 */
export function missionPosition(pathname: string, now = Date.now()): MissionPos | null {
  const items = lessonStatus(now).items
  const item = items.find(i => i.route === pathname)
  if (!item) return null

  const groups = groupItems(items)
  const at = groups.findIndex(g => g.kind === item.kind)
  const group = groups[at].items
  const index = group.findIndex(i => i.route === pathname)

  let next = group.slice(index + 1).find(i => !i.done)
  for (let g = at + 1; !next && g < groups.length; g++) {
    next = groups[g].items.find(i => !i.done)
  }

  return { group: item.kind, index: index + 1, total: group.length, nextRoute: next?.route ?? null }
}

/**
 * The mission position of the screen calling it — `null` for free play, which is every visit that
 * did not arrive carrying `MISSION_STATE`.
 *
 * Memoised on the path so the lesson and the event log are read once per screen the child lands
 * on: recomputing mid-attempt would let the item the child is working on tick itself off and move
 * the "Tiếp theo" target under their finger.
 */
export function useMissionPosition(): MissionPos | null {
  const { pathname, state } = useLocation()
  const inMission = (state as { mission?: unknown } | null)?.mission === true
  return useMemo(() => (inMission ? missionPosition(pathname) : null), [inMission, pathname])
}
