import type { LessonItem, LessonItemKind } from './lesson'

/** The lesson generator has its own suite; these tests are about the walk over its output, so the
 * status is handed in directly and every group boundary can be written down. */
const lesson = vi.hoisted(() => ({ items: [] as (LessonItem & { done: boolean })[] }))
vi.mock('./lesson', () => ({
  lessonStatus: () => ({
    items: lesson.items,
    doneCount: lesson.items.filter(i => i.done).length,
    total: lesson.items.length,
    done: lesson.items.length > 0 && lesson.items.every(i => i.done),
  }),
}))

import { missionPosition } from './missionNav'

function item(kind: LessonItemKind, route: string, done = false): LessonItem & { done: boolean } {
  return { kind, activity: 'speak', id: route, route, label: route, emoji: '🗣️', done }
}

/** listen ×1, speak ×3, word ×2 — a lesson shaped like the real generator's output. */
function setLesson(...items: (LessonItem & { done: boolean })[]) {
  lesson.items = items
}

beforeEach(() => {
  setLesson(
    item('listen', '/story/s1'),
    item('speak', '/sound/th'),
    item('speak', '/practice/wp-1'),
    item('speak', '/pair/p1'),
    item('word', '/words/food/apple'),
    item('word', '/words/food/banana'),
  )
})

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
