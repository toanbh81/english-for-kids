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
 * Where the chip stands, and why the phone does not put it in the bottom-right corner.
 *
 * The landscape frame really does keep that corner empty, and from `md` up this is the same pill
 * in the same place it has always been — the phase's binding rule is that 1194×834 renders
 * byte-for-byte as it did, so every `md:` below restores the *exact* previous value.
 *
 * Below 768 the corner is the busiest part of the screen. Every phone layout this phase built pins
 * its hand-off to the bottom edge — the flashcard's "Tiếp theo →", the sound result's CTA pair,
 * the story's "Tiếp tục ▸" — and a 204×64 pill floating over them covered 49–94% of the one
 * control the child is meant to press, so the tap went to `/mission` and threw them out of the
 * step they were finishing. A floating element cannot be pushed aside by the content under it;
 * the only fix is to stand somewhere the screens do not use.
 *
 * That place is the top-right. Every screen that can carry the chip ends its header with the same
 * reserved gutter — `min-w-[66px] text-right`, the engine badge, empty unless the simple engine is
 * running (WordCard, SoundPractice, PracticeCard, PairPractice, StarPractice, VoicePractice,
 * StoryRetell and Ghép câu all write it) — and the header's centre column is bounded by it, so a
 * 64 px badge dropped into that gutter covers no control at any phone width. It is `top`-anchored
 * through the same safe-area expression `PAGE_SHELL` uses, so it lands on the header's own first
 * line rather than under the notch.
 *
 * At 64 px wide the words do not fit beside the sun, so the count goes under it and "Nhiệm vụ"
 * stays in the accessibility tree (`sr-only`) — the name a screen reader reads is the same string
 * at every width. `md:not-sr-only` puts the words back in the flow and `md:text-xl` restores the
 * pill's size; `text-xl` carries its own 28 px leading and no unprefixed `leading-*` competes with
 * it here, so the size restore is enough.
 *
 * What the corner trades, in full — three read-outs, no controls:
 * - the story player's "Cảnh 2/4" and the quiz's "Câu 1/3" counters. On the player the chip is the
 *   child's only thread back to the lesson, worth more than a scene number the progress bar under
 *   the picture also gives them.
 * - the engine badge itself, the gutter this sits in: "chế độ đơn giản" is covered 53–86% whenever
 *   the simple engine is running. That line is written for the parent, not the child, and it is
 *   readable again the moment the screen is wider than a phone.
 */
const CHIP_BOX
  = 'fixed right-5 top-[max(1rem,calc(env(safe-area-inset-top)_+_9px))] z-40 inline-flex h-16 w-16'
  + ' min-h-[64px] flex-col items-center justify-center gap-0 rounded-full bg-sun-50 px-0'
  + ' font-display font-extrabold text-sun-700 shadow-chunky-sun active:translate-y-[2px]'
  + ' md:bottom-4 md:right-4 md:top-auto md:h-auto md:w-auto md:flex-row md:justify-normal'
  + ' md:gap-2 md:px-6 md:text-xl'

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
    // `z-40` clears the screens' own content but stays under a full-screen overlay.
    <Link to="/mission" className={CHIP_BOX}>
      {/* Three spans, and from `md` up exactly one of them is rendered: the middle one, carrying
          the whole line as a single text run. That is deliberate. Splitting the label and the
          count into two visible spans made them two flex items, and the pill's own `gap-2` then
          stood where the space between the words used to — 4 px wider on the iPad, which this
          phase may not move. The phone's two lines are the outer pair; the middle span stays in
          the accessibility tree at both widths, so the name a screen reader reads never changes. */}
      <span aria-hidden="true" className="text-[22px] leading-none md:hidden">🌞</span>
      <span className="sr-only md:not-sr-only">🌞 Nhiệm vụ {status.doneCount}/{status.total}</span>
      <span aria-hidden="true" className="text-[13px] leading-none md:hidden">{status.doneCount}/{status.total}</span>
    </Link>
  )
}
