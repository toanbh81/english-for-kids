import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getActivity } from '../progress/activity'
import { lessonStatus } from '../progress/lesson'
import type { LessonItem } from '../progress/lesson'
import { isItemRoute } from '../progress/missionNav'
import { useHeaderMounted } from './ui/page/headerRegistry'

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
 * The header-cell chip Phase 12 screens draw themselves (via `PageHeader`'s `right` default),
 * sized to sit inside the header's own 56/64 px cell rather than float over the page — so unlike
 * `CHIP_BOX` this carries no `fixed`, no `z-40`, and no safe-area offset of its own; the header
 * that hosts it already accounts for those.
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
 * `variant="header"` is the smaller, unfixed chip `PageHeader` draws in its own right-hand cell;
 * the default `"global"` is the floating corner pill. A screen that has mounted a `PageHeader` —
 * `useHeaderMounted` — has already drawn its own header-cell chip, so the floating global one steps
 * aside rather than show the lesson twice. A screen not yet migrated onto `PageShell` has no header
 * to register, so the global chip keeps floating for it exactly as before.
 */
export function LessonChip({ variant = 'global' }: { variant?: 'global' | 'header' } = {}) {
  const { pathname, state } = useLocation()
  const headerMounted = useHeaderMounted()
  const inMission = (state as { mission?: unknown } | null)?.mission === true
  if (isExcluded(pathname)) return null
  // Phase 12 transition: a screen that mounts PageHeader draws its own chip in the header cell,
  // so the global one steps aside; screens not yet migrated still get the floating chip.
  if (variant === 'global' && headerMounted) return null
  // Keyed on the path so the inner component remounts on every navigation: its lazy state reads
  // the lesson and the event log exactly once per screen the child lands on, never per render.
  return <LessonChipInner key={pathname} pathname={pathname} inMission={inMission} variant={variant} />
}

function LessonChipInner({ pathname, inMission, variant }: { pathname: string; inMission: boolean; variant: 'global' | 'header' }) {
  const status = useLessonChipStatus(pathname, inMission)

  if (!status) return null

  const box = variant === 'header' ? HEADER_BOX : CHIP_BOX
  const emojiSize = variant === 'header' ? 'text-[18px]' : 'text-[22px]'

  return (
    // `z-40` (global only, carried in CHIP_BOX) clears the screens' own content but stays under a
    // full-screen overlay.
    <Link to="/mission" className={box}>
      {/* Three spans, and from `md` up exactly one of them is rendered: the middle one, carrying
          the whole line as a single text run. That is deliberate. Splitting the label and the
          count into two visible spans made them two flex items, and the pill's own `gap-2` then
          stood where the space between the words used to — 4 px wider on the iPad, which this
          phase may not move. The phone's two lines are the outer pair; the middle span stays in
          the accessibility tree at both widths, so the name a screen reader reads never changes. */}
      <span aria-hidden="true" className={`${emojiSize} leading-none md:hidden`}>🌞</span>
      <span className="sr-only md:not-sr-only">🌞 Nhiệm vụ {status.doneCount}/{status.total}</span>
      <span aria-hidden="true" className="text-[13px] leading-none md:hidden">{status.doneCount}/{status.total}</span>
    </Link>
  )
}
