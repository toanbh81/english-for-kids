import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { lessonStatus } from './lesson'
import type { LessonItem, LessonItemKind } from './lesson'

/**
 * The router state every mission-originated navigation carries. A practice screen is the same
 * screen whether the child reached it from Speak Lab or from today's lesson, so the difference has
 * to travel with the navigation: without this flag a screen numbers itself against its own deck
 * and sends the child back to that deck (spec §3).
 */
export const MISSION_STATE = { mission: true }

/** A lesson item with today's done-ness attached — the shape `lessonStatus` hands out. */
export type DoneItem = LessonItem & { done: boolean }

/** One step card's worth of lesson: the items of a kind, plus what the card says about them. */
export type LessonGroup = {
  kind: LessonItemKind
  items: DoneItem[]
  doneCount: number
  done: boolean
  /** Where the group starts: its first step still to do — or, once the group is finished, its
   * first step again, so a favourite story can be played a second time. */
  route: string
}

/**
 * Today's items bucketed by kind, each kind in the order it first appears — the generator lays the
 * lesson out in the order the child should work through it, so the groups follow that rather than
 * a hard-coded listen → speak → word → review.
 *
 * The Daily Mission screen draws its cards from this and the numbering below counts inside it, so
 * "Thẻ 2/4" on a practice screen and "2/4" on the card that led there can never disagree.
 */
export function groupItems(items: DoneItem[]): LessonGroup[] {
  const order: LessonItemKind[] = []
  for (const item of items) if (!order.includes(item.kind)) order.push(item.kind)
  return order.map(kind => {
    const group = items.filter(i => i.kind === kind)
    const next = group.find(item => !item.done)
    return {
      kind,
      items: group,
      doneCount: group.filter(item => item.done).length,
      done: next === undefined,
      route: (next ?? group[0]).route,
    }
  })
}

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

/**
 * The walk itself, over an already-loaded lesson — no storage, so both entry points below can
 * share it after a single read.
 *
 * Routes are matched whole, never by prefix: `/story/s1` and `/story/s1/retell` are two different
 * steps of the same story, and a prefix match would count the retell as the listen.
 *
 * `nextRoute` walks forward only — the next step of this group the child still owes, then the
 * first outstanding step of a later group — so the last step of the lesson ends at `null`, which
 * the screens read as "back to the mission".
 */
const routeIs = (route: string, pathname: string) => route === pathname

/**
 * Whether `pathname` is one of these items' own step routes — the exact rule the walk below uses,
 * exported so nothing has to restate it. `LessonChip` in particular must agree: it suppresses
 * itself where a screen knows it is in a mission, and a screen knows that only when this is true.
 * Guessing the rule instead (a stored `/sound/<ph>` step from a Phase-8 lesson, the child standing
 * on `/sound/<ph>/<cardId>`) left the child on a screen with no header, no chip and no way back.
 */
export function isItemRoute(items: readonly { route: string }[], pathname: string): boolean {
  return items.some(item => routeIs(item.route, pathname))
}

function positionIn(items: DoneItem[], pathname: string): MissionPos | null {
  const item = items.find(i => routeIs(i.route, pathname))
  if (!item) return null

  const groups = groupItems(items)
  const at = groups.findIndex(g => g.kind === item.kind)
  const group = groups[at].items
  const index = group.findIndex(i => routeIs(i.route, pathname))

  let next = group.slice(index + 1).find(i => !i.done)
  for (let g = at + 1; !next && g < groups.length; g++) {
    next = groups[g].items.find(i => !i.done)
  }

  return { group: item.kind, index: index + 1, total: group.length, nextRoute: next?.route ?? null }
}

/**
 * Where `pathname` sits in today's lesson, or `null` when it is not one of today's steps at all
 * (free play, or a lesson route from a different day).
 */
export function missionPosition(pathname: string, now = Date.now()): MissionPos | null {
  return positionIn(lessonStatus(now).items, pathname)
}

/** What the 🔁 group's steps are called on the screens they open. */
const REVIEW_NOUN = 'Ôn tập'

/**
 * What the counter chip calls this step — `own` is the noun the screen would use for its own kind
 * ("Âm", "Từ mới", "Thẻ", "Câu"). The number counts inside `pos.group`, so on a step the lesson put
 * in the 🔁 group the screen's own noun is a different claim from the number beside it: a word card
 * reached from review is not "Từ mới 2/3" of anything, it is the second of two review steps.
 */
export function missionNoun(pos: MissionPos, own: string): string {
  return pos.group === 'review' ? REVIEW_NOUN : own
}

/** The one hand-off out of a mission step: where it goes and what the button says. */
export type MissionNext = {
  pos: MissionPos
  /** The next step, or the mission screen when this was the end of the chain. */
  route: string
  /** What the screen's next/finish CTA should read. */
  label: string
}

const NEXT_LABEL = 'Tiếp theo →'
const FINISH_LABEL = 'Hoàn thành 🎉'
/**
 * Neither "next" nor "finished": the chain ends here, but the lesson does not.
 *
 * Exported because the story chain says it too. `/story/:id/quiz` and `/story/:id/retell` are
 * sub-routes, so no `MissionNext` resolves there to hand them the wording — but a child leaving a
 * story mid-lesson is in exactly the state this label names, and three screens spelling the same
 * sentence out by hand is three chances for them to drift apart.
 */
export const RETURN_LABEL = 'Về nhiệm vụ →'
/** The lesson itself — the one destination that is not a step, so it travels without the flag. */
export const MISSION_ROUTE = '/mission'

/**
 * The hand-off for `pathname`, or `null` when it is not one of today's steps.
 *
 * The label is a claim about the whole lesson, not about this group. `nextRoute === null` only
 * means nothing is owed *after* this step — a child replaying a finished later step while an
 * earlier group is still open would be told "Hoàn thành 🎉" for a lesson they have not finished.
 * So "Hoàn thành" is reserved for the case where this step is the last thing outstanding (once it
 * is done, `lessonStatus().done` is true); anything else owed elsewhere reads "Về nhiệm vụ →".
 *
 * A replay is not a step of the run, either. Once THIS step is already done, chaining forward
 * would walk the child on past whatever they still owe — a second go at a favourite word card
 * would quietly carry them into the next group while the story they never opened stays open, and
 * nothing on screen would ever mention it again. So a replay hands back to the mission, where the
 * open step is a card they can see, and only the debt-free case still chains.
 */
export function missionNext(pathname: string, now = Date.now()): MissionNext | null {
  const items = lessonStatus(now).items
  const pos = positionIn(items, pathname)
  if (!pos) return null
  const owedElsewhere = items.some(i => !i.done && !routeIs(i.route, pathname))
  const replaying = items.some(i => routeIs(i.route, pathname) && i.done)
  const chained = replaying && owedElsewhere ? null : pos.nextRoute
  return {
    pos,
    route: chained ?? MISSION_ROUTE,
    label: chained ? NEXT_LABEL : owedElsewhere ? RETURN_LABEL : FINISH_LABEL,
  }
}

/** The one reading of the flag, so no screen can invent a second one. */
const hasFlag = (state: unknown) => (state as { mission?: unknown } | null)?.mission === true

/**
 * Whether this navigation arrived carrying `MISSION_STATE` — the whole of "the child came from the
 * mission", and a different question from `useMissionNext()` below.
 *
 * That difference is the whole point of having both. This one is a fact about how the child got
 * here and stays true however today's lesson changes underneath them; the hand-off additionally
 * requires the path to still be one of today's steps, because it has to name the step that comes
 * next. A screen that only needs a way *back* — the story chain's sub-routes, a screen the lesson
 * has moved past, a not-found fallback that has no lesson position at all — must ask this one, or
 * a regenerated lesson strands the child on a screen with no thread home.
 */
export function useMissionFlag(): boolean {
  return hasFlag(useLocation().state)
}

/**
 * The mission hand-off for the screen calling it — `null` for free play, which is every visit that
 * did not arrive carrying `MISSION_STATE`. `go` is the whole navigation: forward to the next step
 * still carrying the flag, or back to the mission (which celebrates if the lesson is done).
 *
 * Memoised on the path so the lesson and the event log are read once per screen the child lands
 * on: recomputing mid-attempt would let the step the child is working on tick itself off and move
 * the CTA's target — and its wording — under their finger.
 */
export function useMissionNext(): (MissionNext & { go: () => void }) | null {
  const nav = useNavigate()
  const { pathname, state } = useLocation()
  const inMission = hasFlag(state)
  const next = useMemo(() => (inMission ? missionNext(pathname) : null), [inMission, pathname])

  const go = useCallback(() => {
    if (!next) return
    // The flag travels on to the next step; `/mission` is not a step and needs no state. Read off
    // the route the hand-off actually chose, not off `pos.nextRoute` — a replay has a step ahead
    // of it and still goes back to the mission.
    if (next.route === MISSION_ROUTE) nav(next.route)
    else nav(next.route, { state: MISSION_STATE })
  }, [nav, next])

  return next && { ...next, go }
}
