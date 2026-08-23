import { getBox, promote, demote, dueWords, unlockedCount, clearLeitner, INTERVAL_DAYS } from './leitner'

const BASE = new Date('2026-08-23T10:00:00').getTime()
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => localStorage.clear())

it('getBox is 0 for an unseen word', () => {
  expect(getBox('apple')).toBe(0)
})

it('INTERVAL_DAYS matches the spec', () => {
  expect(INTERVAL_DAYS).toEqual({ 1: 1, 2: 3, 3: 7, 4: 14 })
})

it('promote walks 0->1->2->3->4 and stays at 4, due = now + interval', () => {
  expect(promote('apple', BASE)).toEqual({ box: 1, due: BASE + 1 * DAY })
  expect(getBox('apple')).toBe(1)

  expect(promote('apple', BASE)).toEqual({ box: 2, due: BASE + 3 * DAY })
  expect(promote('apple', BASE)).toEqual({ box: 3, due: BASE + 7 * DAY })
  expect(promote('apple', BASE)).toEqual({ box: 4, due: BASE + 14 * DAY })
  expect(promote('apple', BASE)).toEqual({ box: 4, due: BASE + 14 * DAY })
  expect(getBox('apple')).toBe(4)
})

it('demote resets to box 1 with due = now + 1 day', () => {
  promote('apple', BASE); promote('apple', BASE); promote('apple', BASE) // box 3
  expect(demote('apple', BASE)).toEqual({ box: 1, due: BASE + 1 * DAY })
  expect(getBox('apple')).toBe(1)
})

it('dueWords lists only unlocked words whose due date has passed', () => {
  promote('apple', BASE - 2 * DAY) // due at BASE - DAY, so due <= BASE
  promote('banana', BASE) // due at BASE + DAY, not due yet
  expect(dueWords(BASE)).toEqual(['apple'])
})

it('unlockedCount counts words that have any box entry', () => {
  promote('apple', BASE)
  promote('banana', BASE)
  expect(unlockedCount()).toBe(2)
})

it('clearLeitner wipes stored boxes', () => {
  promote('apple', BASE)
  clearLeitner()
  expect(getBox('apple')).toBe(0)
  expect(unlockedCount()).toBe(0)
})

it('treats a corrupt stored value as empty progress', () => {
  localStorage.setItem('speakup.leitner', '{not json')
  expect(getBox('apple')).toBe(0)
  expect(dueWords(BASE)).toEqual([])
})

it('treats valid JSON of the wrong shape as empty progress', () => {
  localStorage.setItem('speakup.leitner', '[1,2]')
  expect(getBox('apple')).toBe(0)
  expect(dueWords(BASE)).toEqual([])
  expect(unlockedCount()).toBe(0)
})
