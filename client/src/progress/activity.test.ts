import {
  logActivity, getActivity, dayKey, missionStatus, completedDays, streak, weekDots,
  minutesPerDay, minutesToday, weakPhonemes, averageScoreByKind, clearActivity,
} from './activity'
import type { ActivityEvent } from './activity'

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
