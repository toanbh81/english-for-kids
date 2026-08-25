import { autoAdjustBand, clearBand, getBand, setBandAuto, setBandValue } from './band'
import { logActivity } from './activity'
import { getLesson } from './lesson'
import { setStars } from './store'
import type { Band } from './band'

const BASE = new Date('2026-08-24T10:00:00').getTime()
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => localStorage.clear())

/** A day that meets the legacy mission counters, every scored event at `score`. */
function playDay(ts: number, score: number) {
  logActivity({ ts, kind: 'story', id: `story-${ts}` })
  for (let i = 0; i < 5; i++) logActivity({ ts: ts + i, kind: 'speak', id: `sp-${ts}-${i}`, score })
  for (let i = 0; i < 3; i++) logActivity({ ts: ts + i, kind: 'word', id: `w-${ts}-${i}`, score })
}

/** A day the child started but never finished. */
function abandonDay(ts: number, score = 90) {
  logActivity({ ts, kind: 'speak', id: `sp-${ts}`, score })
}

function seed(value: Band) {
  setBandValue(value)
  setBandAuto()
}

it('starts at band 1 with nothing stored, and persists that', () => {
  expect(getBand()).toEqual({ value: 1, mode: 'auto' })
  expect(localStorage.getItem('speakup.band')).toBe(JSON.stringify({ value: 1, mode: 'auto' }))
})

it('initialises the band from existing stars', () => {
  setStars('wp-cat', 2)
  expect(getBand().value).toBe(2)

  clearBand()
  setStars('pair:pair-ship-sheep', 1)
  expect(getBand().value).toBe(3)

  clearBand()
  setStars('sstar:ss1', 3)
  expect(getBand().value).toBe(4)

  clearBand()
  setStars('voice:sv1', 1)
  expect(getBand().value).toBe(5)
})

it('a manual band freezes auto adjustment', () => {
  setBandValue(2)
  expect(getBand()).toEqual({ value: 2, mode: 'manual' })

  for (let d = 1; d <= 3; d++) playDay(BASE - d * DAY, 95)
  autoAdjustBand(BASE)
  expect(getBand()).toEqual({ value: 2, mode: 'manual' })

  setBandAuto()
  expect(getBand()).toEqual({ value: 2, mode: 'auto' })
  autoAdjustBand(BASE)
  expect(getBand()).toEqual({ value: 3, mode: 'auto' })
})

it('steps up after 3 consecutive completed days averaging >= 80', () => {
  seed(1)
  for (let d = 1; d <= 2; d++) playDay(BASE - d * DAY, 90)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(1) // only two good days

  playDay(BASE - 3 * DAY, 90)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(2)
})

it('does not step up when a day was completed but scored below 80', () => {
  seed(1)
  playDay(BASE - 1 * DAY, 70)
  playDay(BASE - 2 * DAY, 90)
  playDay(BASE - 3 * DAY, 90)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(1)
})

it('steps down after 2 consecutive days started but not completed', () => {
  seed(3)
  abandonDay(BASE - 1 * DAY)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(3) // one bad day is not enough

  abandonDay(BASE - 2 * DAY)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(2)
})

it('steps down after 2 completed days averaging below 60', () => {
  seed(4)
  playDay(BASE - 1 * DAY, 40)
  playDay(BASE - 2 * DAY, 50)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(3)
})

it('a rest day with no activity at all is not a bad day', () => {
  seed(3)
  abandonDay(BASE - 1 * DAY)
  // nothing on BASE - 2 days
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(3)
})

it('moves at most one step per call', () => {
  seed(1)
  for (let d = 1; d <= 6; d++) playDay(BASE - d * DAY, 95)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(2)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(3)
})

it('clamps at the bottom of the range', () => {
  seed(1)
  abandonDay(BASE - 1 * DAY)
  abandonDay(BASE - 2 * DAY)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(1)
})

it('clamps at the top of the range', () => {
  seed(5)
  for (let d = 1; d <= 3; d++) playDay(BASE - d * DAY, 95)
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(5)
})

// --- partial lesson days ------------------------------------------------------------------------

/**
 * A day with a real generated lesson, `count` of its items done at `score`. `seed` is called first
 * so the lessons are generated in manual mode: `getLesson` runs `autoAdjustBand` itself, and the
 * tests below want to control exactly when the verdict is taken.
 */
function lessonDay(ts: number, count: number, score: number) {
  const lesson = getLesson(ts)
  lesson.items.slice(0, count).forEach((item, i) => {
    logActivity({ ts: lesson.created + 1000 + i, kind: item.activity, id: item.id, score })
  })
  return lesson
}

it('holds the band for a child who does most of the lesson well, day after day', () => {
  setBandValue(3) // manual while the days are seeded
  for (let d = 1; d <= 6; d++) {
    const lesson = lessonDay(BASE - d * DAY, 8, 85)
    expect(lesson.items).toHaveLength(11) // the medium recipe: 8 of 11 is the good partial day
  }

  setBandAuto()
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(3)
  // …and it keeps holding: an unfinished-but-good day is neutral, so it never accumulates.
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(3)
})

it('still counts a genuinely abandoned day as bad, and two of them demote', () => {
  setBandValue(3)
  lessonDay(BASE - 1 * DAY, 2, 85)

  setBandAuto()
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(3) // one bad day is not enough

  setBandValue(3)
  lessonDay(BASE - 2 * DAY, 2, 85)

  setBandAuto()
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(2)
})

it('demotes on two finished lessons whose day still averaged below 60', () => {
  setBandValue(4)
  for (let d = 1; d <= 2; d++) {
    // The lesson itself is finished (every item at the 60 pass mark), but the day around it is
    // full of attempts the child struggled with — that average is what marks the day bad.
    const lesson = lessonDay(BASE - d * DAY, 10, 65)
    for (let i = 0; i < 10; i++) {
      logActivity({ ts: lesson.created + 5000 + i, kind: 'speak', id: `flail-${d}-${i}`, score: 20 })
    }
  }

  setBandAuto()
  autoAdjustBand(BASE)
  expect(getBand().value).toBe(3)
})

it('survives a corrupt stored band', () => {
  localStorage.setItem('speakup.band', '{"value":"nine"}')
  expect(getBand()).toEqual({ value: 1, mode: 'auto' })
})
