import {
  logActivity, getActivity, dayKey, missionStatus, completedDays, streak, weekDots,
  minutesPerDay, minutesToday, weakPhonemes, averageScoreByKind, clearActivity, longestStreak,
} from './activity'
import type { ActivityEvent } from './activity'
import { getLesson, setLessonLength } from './lesson'
import type { Lesson } from './lesson'
import { setBandValue } from './band'
import { findSound } from '../content'

const BASE = new Date('2026-08-23T10:00:00').getTime() // Sunday, last day of its week
const DAY = 24 * 60 * 60 * 1000
const MIN = 60 * 1000

beforeEach(() => localStorage.clear())

function logMissionDay(ts: number) {
  logActivity({ ts, kind: 'story', id: `story-${ts}` })
  for (let i = 0; i < 5; i++) logActivity({ ts: ts + i, kind: 'speak', id: `speak-${ts}-${i}` })
  for (let i = 0; i < 3; i++) logActivity({ ts: ts + i, kind: 'word', id: `word-${ts}-${i}` })
}

it('dayKey uses local date parts', () => {
  expect(dayKey(BASE)).toBe('2026-08-23')
})

it('caps the activity log at 2000 events, dropping the oldest', () => {
  for (let i = 0; i < 2001; i++) logActivity({ ts: BASE + i, kind: 'word', id: `w${i}` })
  const events = getActivity()
  expect(events.length).toBe(2000)
  expect(events[0].id).toBe('w1')
  expect(events[events.length - 1].id).toBe('w2000')
})

it('getActivity filters by sinceTs', () => {
  logActivity({ ts: BASE - DAY, kind: 'word', id: 'old' })
  logActivity({ ts: BASE, kind: 'word', id: 'new' })
  expect(getActivity(BASE).map(e => e.id)).toEqual(['new'])
})

it('missionStatus counts only today and flips done at 1 story, 5 speak, 3 word', () => {
  logActivity({ ts: BASE - DAY, kind: 'story', id: 's-yesterday' })
  logActivity({ ts: BASE, kind: 'story', id: 's1' })
  for (let i = 0; i < 4; i++) logActivity({ ts: BASE + i, kind: 'speak', id: `sp${i}` })
  for (let i = 0; i < 2; i++) logActivity({ ts: BASE + i, kind: 'word', id: `w${i}` })

  expect(missionStatus(BASE)).toEqual({ story: 1, speak: 4, word: 2, done: false })

  logActivity({ ts: BASE, kind: 'speak', id: 'sp4' })
  logActivity({ ts: BASE, kind: 'word', id: 'w2' })

  expect(missionStatus(BASE)).toEqual({ story: 1, speak: 5, word: 3, done: true })
})

it('missionStatus counts a word only when it was said well enough (score >= 60)', () => {
  logActivity({ ts: BASE, kind: 'word', id: 'w-fail', score: 40 })
  logActivity({ ts: BASE + 1, kind: 'word', id: 'w-pass', score: 70 })
  logActivity({ ts: BASE + 2, kind: 'word', id: 'w-unscored' }) // web speech / no score

  expect(missionStatus(BASE).word).toBe(2)
})

it('completedDays only includes days meeting the mission thresholds', () => {
  logMissionDay(BASE - DAY)
  logActivity({ ts: BASE, kind: 'story', id: 'incomplete' })
  const done = completedDays()
  expect(done.has(dayKey(BASE - DAY))).toBe(true)
  expect(done.has(dayKey(BASE))).toBe(false)
})

it('streak counts consecutive completed days ending today', () => {
  logMissionDay(BASE - 2 * DAY)
  logMissionDay(BASE - DAY)
  logMissionDay(BASE)
  expect(streak(BASE)).toBe(3)
})

it('streak is 0 when neither today nor yesterday is completed', () => {
  logMissionDay(BASE - 2 * DAY)
  expect(streak(BASE)).toBe(0)
})

it('weekDots returns Mon..Sun with isToday marked exactly once', () => {
  logMissionDay(BASE)
  const dots = weekDots(BASE)
  expect(dots.length).toBe(7)
  expect(dots.filter(d => d.isToday).length).toBe(1)
  expect(dots[0].day).toBe(dayKey(BASE - 6 * DAY)) // Monday
  expect(dots[6].day).toBe(dayKey(BASE)) // Sunday == today
  expect(dots[6].isToday).toBe(true)
  expect(dots[6].done).toBe(true)
})

it('longestStreak finds the longest run of completed days, not just the one ending today', () => {
  // A 3-day run, a gap, then a 2-day run that ends today: streak() would answer 2, longestStreak
  // must still find the earlier 3.
  logMissionDay(BASE - 10 * DAY)
  logMissionDay(BASE - 9 * DAY)
  logMissionDay(BASE - 8 * DAY)
  logMissionDay(BASE - DAY)
  logMissionDay(BASE)
  expect(longestStreak(getActivity())).toBe(3)
  expect(streak(BASE)).toBe(2)
})

it('longestStreak is 0 with no completed days', () => {
  expect(longestStreak(getActivity())).toBe(0)
})

it('minutesPerDay returns an entry per requested day, ending today', () => {
  const days = minutesPerDay(14, BASE)
  expect(days.length).toBe(14)
  expect(days[13].day).toBe(dayKey(BASE))
  expect(days[0].day).toBe(dayKey(BASE - 13 * DAY))
})

it('minutesPerDay sums a single session for events within 10 minutes of each other', () => {
  logActivity({ ts: BASE, kind: 'word', id: 'a' })
  logActivity({ ts: BASE + 4 * MIN, kind: 'word', id: 'b' })
  expect(minutesPerDay(1, BASE)[0].minutes).toBe(4)
})

it('minutesPerDay splits into separate 1-minute sessions when the gap exceeds 10 minutes', () => {
  logActivity({ ts: BASE, kind: 'word', id: 'a' })
  logActivity({ ts: BASE + 30 * MIN, kind: 'word', id: 'b' })
  expect(minutesPerDay(1, BASE)[0].minutes).toBe(2)
})

it('minutesToday matches minutesPerDay(1) for today', () => {
  logActivity({ ts: BASE, kind: 'word', id: 'a' })
  logActivity({ ts: BASE + 4 * MIN, kind: 'word', id: 'b' })
  expect(minutesToday(BASE)).toBe(4)
})

it('logActivity stores only the weak phonemes (score < 80) and drops the field when none are', () => {
  logActivity({ ts: BASE, kind: 'word', id: 'w1', phonemes: [{ phoneme: 'th', score: 40 }, { phoneme: 'r', score: 95 }] })
  logActivity({ ts: BASE + 1, kind: 'word', id: 'w2', phonemes: [{ phoneme: 'r', score: 90 }] })

  const stored = getActivity()
  expect(stored[0].phonemes).toEqual([{ phoneme: 'th', score: 40 }])
  expect(stored[1].phonemes).toBeUndefined()
})

it('weakPhonemes averages scores across events and ignores phonemes seen once', () => {
  logActivity({ ts: BASE, kind: 'word', id: 'w1', phonemes: [{ phoneme: 'th', score: 40 }, { phoneme: 'r', score: 90 }] })
  logActivity({ ts: BASE + 1, kind: 'word', id: 'w2', phonemes: [{ phoneme: 'th', score: 60 }] })
  logActivity({ ts: BASE + 2, kind: 'word', id: 'w3', phonemes: [{ phoneme: 'z', score: 20 }] })

  expect(weakPhonemes(5)).toEqual([{ phoneme: 'th', avg: 50, count: 2 }])
})

it('weakPhonemes returns the lowest-average phonemes first, capped at n', () => {
  logActivity({ ts: BASE, kind: 'word', id: 'a', phonemes: [{ phoneme: 'p', score: 80 }, { phoneme: 'b', score: 20 }] })
  logActivity({ ts: BASE + 1, kind: 'word', id: 'b', phonemes: [{ phoneme: 'p', score: 90 }, { phoneme: 'b', score: 30 }] })
  const weak = weakPhonemes(1)
  expect(weak).toEqual([{ phoneme: 'b', avg: 25, count: 2 }])
})

it('averageScoreByKind averages scores per kind and is null when there are none', () => {
  logActivity({ ts: BASE, kind: 'speak', id: 's1', score: 80 })
  logActivity({ ts: BASE + 1, kind: 'speak', id: 's2', score: 60 })
  const avg = averageScoreByKind()
  expect(avg.speak).toBe(70)
  expect(avg.story).toBeNull()
})

it('clearActivity wipes stored events', () => {
  logActivity({ ts: BASE, kind: 'word', id: 'a' })
  clearActivity()
  expect(getActivity()).toEqual([])
})

it('treats a corrupt stored value as empty progress', () => {
  localStorage.setItem('speakup.activity', '{not json')
  expect(getActivity()).toEqual([])
  expect(missionStatus(BASE)).toEqual({ story: 0, speak: 0, word: 0, done: false })
})

it('treats valid JSON of the wrong shape as empty progress', () => {
  localStorage.setItem('speakup.activity', '{}')
  expect(getActivity()).toEqual([])
  expect(missionStatus(BASE)).toEqual({ story: 0, speak: 0, word: 0, done: false })
})

it('every query reads a passed events array instead of localStorage', () => {
  const events: ActivityEvent[] = [
    { ts: BASE, kind: 'story', id: 's1' },
    ...Array.from({ length: 5 }, (_, i) => ({ ts: BASE + i, kind: 'speak' as const, id: `sp${i}`, score: 80 })),
    ...Array.from({ length: 3 }, (_, i) => ({
      ts: BASE + i, kind: 'word' as const, id: `w${i}`, score: 90,
      phonemes: [{ phoneme: 'th', score: 30 }],
    })),
  ]
  const getItem = vi.spyOn(Storage.prototype, 'getItem')

  expect(missionStatus(BASE, events)).toEqual({ story: 1, speak: 5, word: 3, done: true })
  expect(completedDays(events).has(dayKey(BASE))).toBe(true)
  expect(streak(BASE, events)).toBe(1)
  expect(weekDots(BASE, events)[6].done).toBe(true)
  expect(minutesPerDay(1, BASE, events)[0].minutes).toBe(1)
  expect(minutesToday(BASE, events)).toBe(1)
  expect(weakPhonemes(5, events)).toEqual([{ phoneme: 'th', avg: 30, count: 3 }])
  expect(averageScoreByKind(events).speak).toBe(80)

  expect(getItem).not.toHaveBeenCalled()
  getItem.mockRestore()
})

// --- Phase 7: mission compatibility (spec §4) ------------------------------------------------

/** Complete every item of a lesson the way the real screens log it. */
function playLesson(lesson: Lesson, at: number) {
  lesson.items.forEach((item, i) => {
    // A Phase 9 sound step already carries the card id SoundPractice logs; a step stored in the
    // older whole-group shape carries the phoneme, and any card of the group completes it. Gated on
    // the route, so a short id of some other kind can never be mistaken for a phoneme key.
    const group = item.route.startsWith('/sound/') ? findSound(item.id) : undefined
    const id = group?.cards[0].id ?? item.id
    logActivity({ ts: at + i, kind: item.activity, id, score: 85 })
  })
}

it('a day that meets the legacy counters still counts, with no lesson on record', () => {
  logMissionDay(BASE)
  expect(missionStatus(BASE).done).toBe(true)
  expect(completedDays().has(dayKey(BASE))).toBe(true)
  expect(streak(BASE)).toBe(1)
  expect(localStorage.getItem(`speakup.lesson.${dayKey(BASE)}`)).toBeNull()
})

it('a completed lesson makes the day count without the legacy counters', () => {
  setBandValue(1)
  setLessonLength('short') // 1 story, 2 speak, 2 word, 1 review — under the 5-speak legacy bar
  const lesson = getLesson(BASE)
  expect(missionStatus(BASE).done).toBe(false)

  playLesson(lesson, BASE + 60_000)
  const status = missionStatus(BASE)
  expect(status.speak).toBeLessThan(5) // the legacy rule alone would still say "not done"
  expect(status.done).toBe(true)
  expect(completedDays().has(dayKey(BASE))).toBe(true)
  expect(streak(BASE)).toBe(1)
  expect(weekDots(BASE)[6].done).toBe(true) // BASE is a Sunday
})

it('a half-finished lesson does not make the day count', () => {
  setBandValue(1)
  setLessonLength('short')
  const lesson = getLesson(BASE)
  playLesson({ ...lesson, items: lesson.items.slice(0, 3) }, BASE + 60_000)
  expect(missionStatus(BASE).done).toBe(false)
  expect(completedDays().has(dayKey(BASE))).toBe(false)
})

// --- Phase 11 task 5: an injectable lesson lookup, for the remote dashboard --------------------

it('completedDays/streak/weekDots default to this device\'s own lesson records', () => {
  setBandValue(1)
  setLessonLength('short') // under the 5-speak legacy bar
  const lesson = getLesson(BASE)
  playLesson(lesson, BASE + 60_000)

  // No override: the local lesson record on disk is consulted, exactly as before this change.
  expect(completedDays().has(dayKey(BASE))).toBe(true)
  expect(streak(BASE)).toBe(1)
  expect(weekDots(BASE)[6].done).toBe(true) // BASE is a Sunday
})

it('a lesson-lookup override that always says "no lesson" falls back to the legacy counters only', () => {
  setBandValue(1)
  setLessonLength('short')
  const lesson = getLesson(BASE)
  playLesson(lesson, BASE + 60_000) // completes the short lesson, but under 5 speaks

  const noLesson = () => null

  // The remote dashboard's exact call shape: it has no server-side lesson record to hand back, so
  // it never gets to claim a day done that the legacy counters alone would call unfinished — even
  // though a real lesson record exists RIGHT HERE, on disk, for this same day.
  expect(completedDays(getActivity(), noLesson).has(dayKey(BASE))).toBe(false)
  expect(streak(BASE, getActivity(), noLesson)).toBe(0)
  expect(weekDots(BASE, getActivity(), noLesson)[6].done).toBe(false)

  // The local, un-overridden query is unaffected — the override is per-call, not global state.
  expect(completedDays().has(dayKey(BASE))).toBe(true)
})

it('a lesson-lookup override never touches localStorage, even when a local lesson record exists', () => {
  setBandValue(1)
  setLessonLength('short')
  const lesson = getLesson(BASE)
  playLesson(lesson, BASE + 60_000)

  const events = getActivity()
  const getItem = vi.spyOn(Storage.prototype, 'getItem')
  streak(BASE, events, () => null)
  expect(getItem).not.toHaveBeenCalled()
  getItem.mockRestore()
})
