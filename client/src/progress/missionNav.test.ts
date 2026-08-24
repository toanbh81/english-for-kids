import type { LessonItem, LessonItemKind } from './lesson'

/** The lesson generator has its own suite; these tests are about the walk over its output, so the
 * status is handed in directly and every group boundary can be written down. `asked` records the
 * `now` the module passed through, which is what keeps the day the caller means the day the
 * lesson is read for. */
const lesson = vi.hoisted(() => ({
  items: [] as (LessonItem & { done: boolean })[],
  asked: undefined as number | undefined,
}))
vi.mock('./lesson', () => ({
  lessonStatus: (now?: number) => {
    lesson.asked = now
    return {
      items: lesson.items,
      doneCount: lesson.items.filter(i => i.done).length,
      total: lesson.items.length,
      done: lesson.items.length > 0 && lesson.items.every(i => i.done),
    }
  },
}))

import { groupItems, missionNext, missionPosition } from './missionNav'

function item(kind: LessonItemKind, route: string, done = false): LessonItem & { done: boolean } {
  return { kind, activity: 'speak', id: route, route, label: route, emoji: '🗣️', done }
}

function setLesson(...items: (LessonItem & { done: boolean })[]) {
  lesson.items = items
}

beforeEach(() => {
  lesson.asked = undefined
  /** listen ×1, speak ×3, word ×2 — a lesson shaped like the real generator's output. */
  setLesson(
    item('listen', '/story/s1'),
    item('speak', '/sound/th'),
    item('speak', '/practice/wp-1'),
    item('speak', '/pair/p1'),
    item('word', '/words/food/apple'),
    item('word', '/words/food/banana'),
  )
})

// --- position -------------------------------------------------------------------------------

it('numbers an item inside its own group, not the whole lesson', () => {
  expect(missionPosition('/practice/wp-1')).toEqual({
    group: 'speak', index: 2, total: 3, nextRoute: '/pair/p1',
  })
})

it('hands on to the next step of the same group', () => {
  expect(missionPosition('/sound/th')?.nextRoute).toBe('/practice/wp-1')
})

it('crosses into the next group once its own group is behind it', () => {
  expect(missionPosition('/pair/p1')).toEqual({
    group: 'speak', index: 3, total: 3, nextRoute: '/words/food/apple',
  })
})

it('skips steps the child has already done', () => {
  setLesson(
    item('speak', '/sound/th'),
    item('speak', '/practice/wp-1', true),
    item('speak', '/pair/p1'),
    item('word', '/words/food/apple'),
  )

  expect(missionPosition('/sound/th')?.nextRoute).toBe('/pair/p1')
})

/** A group whose remaining steps are all done is not a dead end: the walk keeps going forward
 * until it finds something to do, or runs out of lesson. */
it('walks past a finished group to the first step still owed', () => {
  setLesson(
    item('speak', '/sound/th'),
    item('word', '/words/food/apple', true),
    item('review', '/sentence/s1'),
  )

  expect(missionPosition('/sound/th')?.nextRoute).toBe('/sentence/s1')
})

it('ends at null on the last step of the lesson', () => {
  expect(missionPosition('/words/food/banana')).toEqual({
    group: 'word', index: 2, total: 2, nextRoute: null,
  })
})

it('ends at null when everything else is already done', () => {
  setLesson(
    item('speak', '/sound/th'),
    item('word', '/words/food/apple', true),
  )

  expect(missionPosition('/sound/th')?.nextRoute).toBeNull()
})

it('has no position for a screen that is not one of today\'s steps', () => {
  expect(missionPosition('/practice/sz-th-three')).toBeNull()
  expect(missionPosition('/')).toBeNull()
})

/** Two steps of the same story share a prefix — the listen and the retell — so the lookup has to
 * compare whole routes or the retell would be numbered as the listen. */
it('matches routes whole, never by prefix', () => {
  setLesson(
    item('listen', '/story/s1'),
    item('review', '/story/s1/retell'),
  )

  expect(missionPosition('/story/s1')).toMatchObject({ group: 'listen', index: 1, total: 1 })
  expect(missionPosition('/story/s1/retell')).toMatchObject({ group: 'review', index: 1, total: 1 })
  expect(missionPosition('/story/s')).toBeNull()
})

it('has no position at all when the lesson is empty', () => {
  setLesson()
  expect(missionPosition('/sound/th')).toBeNull()
})

/** Every lookup is "as of" a moment — a screen mounted just before midnight must not be numbered
 * against tomorrow's lesson — so the caller's `now` has to reach the lesson, not be dropped. */
it('reads the lesson as of the moment it was asked about', () => {
  const noon = new Date('2026-08-23T12:00:00').getTime()

  missionPosition('/sound/th', noon)
  expect(lesson.asked).toBe(noon)

  lesson.asked = undefined
  missionNext('/sound/th', noon)
  expect(lesson.asked).toBe(noon)
})

// --- the hand-off ---------------------------------------------------------------------------

it('sends the child on to the next step, and says so', () => {
  expect(missionNext('/sound/th')).toMatchObject({
    route: '/practice/wp-1', label: 'Tiếp theo →',
  })
})

it('ends the chain at the mission screen', () => {
  expect(missionNext('/words/food/banana')?.route).toBe('/mission')
})

/** "Hoàn thành 🎉" is a claim about the whole lesson: it is only honest when this step is the last
 * thing outstanding. */
it('celebrates only when this step is the last one owed', () => {
  setLesson(
    item('speak', '/sound/th', true),
    item('word', '/words/food/apple'),
  )

  expect(missionNext('/words/food/apple')?.label).toBe('Hoàn thành 🎉')
})

/** Replaying a finished later step while an earlier group is still open: the chain ends here, the
 * lesson does not, so the button must not congratulate the child for it. */
it('offers the way back, not a celebration, while an earlier step is owed', () => {
  setLesson(
    item('speak', '/sound/th'),
    item('word', '/words/food/apple', true),
  )

  expect(missionNext('/words/food/apple')).toMatchObject({
    route: '/mission', label: 'Về nhiệm vụ →',
  })
})

it('has no hand-off for a screen that is not one of today\'s steps', () => {
  expect(missionNext('/practice/sz-th-three')).toBeNull()
})

// --- groups ---------------------------------------------------------------------------------

/** The Daily Mission cards and the numbering on the practice screens read the same buckets — one
 * function, so the two can never drift apart. */
it('buckets the lesson by kind, in the order each kind first appears', () => {
  const groups = groupItems(lesson.items)

  expect(groups.map(g => g.kind)).toEqual(['listen', 'speak', 'word'])
  expect(groups.map(g => g.items.length)).toEqual([1, 3, 2])
})

it('tells each group how far along it is, and where it starts', () => {
  setLesson(
    item('speak', '/sound/th', true),
    item('speak', '/pair/p1'),
    item('word', '/words/food/apple', true),
  )

  const [speak, word] = groupItems(lesson.items)

  expect(speak).toMatchObject({ doneCount: 1, done: false, route: '/pair/p1' })
  // A finished group still points at its first step, so a favourite can be replayed.
  expect(word).toMatchObject({ doneCount: 1, done: true, route: '/words/food/apple' })
})
