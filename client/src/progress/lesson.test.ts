import {
  RECIPES, getLesson, getLessonLength, lessonDays, lessonForDay, lessonStatus, setLessonLength,
} from './lesson'
import type { LessonLength } from './lesson'
import { getActivity, logActivity } from './activity'
import type { ActivityKind } from './activity'
import { setBandAuto, setBandValue } from './band'
import { promote } from './leitner'
import { setStars } from './store'
import { findSound } from '../content'
import { TOPICS as WORD_DECKS } from '../content/words'
import type { TopicId } from '../content/topics'
import type { Band } from './band'

const BASE = new Date('2026-08-24T10:00:00').getTime() // Monday
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => localStorage.clear())

function band(value: Band) {
  setBandValue(value)
  setBandAuto() // auto mode, but with no history there is nothing to adjust
}

function learn(topic: TopicId, n: number) {
  const words = WORD_DECKS.find(d => d.id === topic)?.words ?? []
  for (const w of words.slice(0, n)) promote(w.id, BASE - 30 * DAY)
}

const kinds = (now = BASE) => {
  const items = getLesson(now).items
  return {
    listen: items.filter(i => i.kind === 'listen').length,
    speak: items.filter(i => i.kind === 'speak').length,
    word: items.filter(i => i.kind === 'word').length,
    review: items.filter(i => i.kind === 'review').length,
  }
}

it('defaults to the medium lesson length', () => {
  expect(getLessonLength()).toBe('medium')
})

it.each(['short', 'medium', 'long'] as LessonLength[])('follows the %s recipe', length => {
  band(3)
  setLessonLength(length)
  expect(kinds()).toEqual(RECIPES[length])
})

it('generates the same lesson twice on the same day, and persists it', () => {
  band(3)
  const first = getLesson(BASE)
  const second = getLesson(BASE + 3 * 60 * 60 * 1000)
  expect(second).toEqual(first)
  expect(lessonForDay('2026-08-24')).toEqual(first)
  expect(lessonForDay('2026-08-25')).toBeNull()
})

it('gives every item a route, a Vietnamese label and an emoji, with no duplicates', () => {
  band(5)
  setLessonLength('long')
  const items = getLesson(BASE).items
  expect(items).toHaveLength(14)
  for (const i of items) {
    expect(i.route.startsWith('/')).toBe(true)
    expect(i.label.length).toBeGreaterThan(3)
    expect(i.emoji).not.toBe('')
  }
  expect(new Set(items.map(i => i.route)).size).toBe(items.length)
})

it('band 1 keeps the speak pool on sound tiles — no sentence stars or story voice', () => {
  band(1)
  const items = getLesson(BASE).items
  expect(items.some(i => i.route.startsWith('/star/'))).toBe(false)
  expect(items.some(i => i.route.startsWith('/voice/'))).toBe(false)
  expect(items.filter(i => i.kind === 'speak').every(i => i.route.startsWith('/sound/'))).toBe(true)
})

it('band 5 draws at least one item from the newest level', () => {
  band(5)
  const speak = getLesson(BASE).items.filter(i => i.kind === 'speak')
  expect(speak.some(i => i.route.startsWith('/voice/'))).toBe(true)
  expect(speak.some(i => !i.route.startsWith('/voice/'))).toBe(true) // and lower levels too
})

it('a weak phoneme steers the speak choice', () => {
  band(1)
  const plain = getLesson(BASE).items.map(i => i.route)
  expect(plain).not.toContain('/sound/sh')

  localStorage.clear()
  band(1)
  for (let i = 0; i < 2; i++) {
    logActivity({ ts: BASE - DAY + i, kind: 'speak', id: 'sz-sh-ship', score: 40, phonemes: [{ phoneme: 'sh', score: 20 }] })
  }
  expect(getLesson(BASE).items.map(i => i.route)).toContain('/sound/sh')
})

it('new words come from the current topic', () => {
  band(1)
  expect(getLesson(BASE).items.filter(i => i.kind === 'word').every(i => i.route.startsWith('/words/animals/'))).toBe(true)

  localStorage.clear()
  band(1)
  learn('animals', 8) // deck finished, food opens and becomes current
  expect(getLesson(BASE).items.filter(i => i.kind === 'word').every(i => i.route.startsWith('/words/food/'))).toBe(true)
})

it('review prefers due Leitner words', () => {
  band(1)
  learn('animals', 2) // both promoted 30 days ago, so both are due
  setStars('sound:th', 1) // an attempted item that would otherwise fill review
  const review = getLesson(BASE).items.filter(i => i.kind === 'review')
  expect(review).toHaveLength(RECIPES.medium.review)
  expect(review.every(i => i.route.startsWith('/words/animals/'))).toBe(true)
  expect(review.every(i => i.activity === 'word')).toBe(true)
})

it('review falls back to the lowest-star attempted item, inside the band', () => {
  band(3)
  setStars('sound:th', 3)
  setStars('pair:pair-fan-van', 1)
  setStars('voice:sv1', 1) // above the band — must not be offered
  const review = getLesson(BASE).items.filter(i => i.kind === 'review')
  expect(review[0].route).toBe('/pair/pair-fan-van')
  expect(review.some(i => i.route.startsWith('/voice/'))).toBe(false)
})

it('review fills with extra new words when nothing has been attempted yet', () => {
  band(1)
  const items = getLesson(BASE).items
  const review = items.filter(i => i.kind === 'review')
  const words = items.filter(i => i.kind === 'word')
  expect(review).toHaveLength(RECIPES.medium.review)
  expect(review.every(i => i.activity === 'word')).toBe(true)
  // the filler must not repeat the lesson's own new words
  for (const r of review) expect(words.map(w => w.route)).not.toContain(r.route)
})

it('lessonStatus marks an item done on a matching event at 60, but not at 50', () => {
  band(1)
  const lesson = getLesson(BASE)
  const word = lesson.items.find(i => i.kind === 'word')!
  expect(lessonStatus(BASE).doneCount).toBe(0)

  logActivity({ ts: BASE + 60_000, kind: 'word', id: word.id, score: 50 })
  expect(lessonStatus(BASE, getActivity()).items.find(i => i.route === word.route)?.done).toBe(false)

  logActivity({ ts: BASE + 120_000, kind: 'word', id: word.id, score: 60 })
  const status = lessonStatus(BASE, getActivity())
  expect(status.items.find(i => i.route === word.route)?.done).toBe(true)
  expect(status.doneCount).toBe(1)
  expect(status.total).toBe(lesson.items.length)
  expect(status.done).toBe(false)
})

it('an event before the lesson was generated does not count', () => {
  band(1)
  const lesson = getLesson(BASE)
  const word = lesson.items.find(i => i.kind === 'word')!
  logActivity({ ts: BASE - 60_000, kind: 'word', id: word.id, score: 90 })
  expect(lessonStatus(BASE, getActivity()).doneCount).toBe(0)
})

it('a sound tile is done by speaking any of its three cards', () => {
  band(1)
  const lesson = getLesson(BASE)
  const sound = lesson.items.find(i => i.route.startsWith('/sound/'))!
  logActivity({ ts: BASE + 60_000, kind: 'speak', id: `sz-${sound.id}-x`, score: 90 })
  expect(lessonStatus(BASE, getActivity()).items.find(i => i.route === sound.route)?.done).toBe(false)

  // the ids the SoundPractice screen actually logs
  const card = findSound(sound.id)!.cards[1]
  logActivity({ ts: BASE + 120_000, kind: 'speak', id: card.id, score: 90 })
  expect(lessonStatus(BASE, getActivity()).items.find(i => i.route === sound.route)?.done).toBe(true)
})

it('prunes lesson records to the most recent 30 days', () => {
  band(1)
  for (let d = 0; d < 35; d++) getLesson(BASE + d * DAY)
  const days = lessonDays()
  expect(days).toHaveLength(30)
  expect(days[0]).toBe('2026-08-29') // the first five days were pruned away
  expect(lessonForDay('2026-08-24')).toBeNull()
  expect(getLessonLength()).toBe('medium') // the length key survived the prune
})

// --- done-matching against what the screens actually log --------------------------------------
//
// The table below is transcribed from the screens' own `logActivity` calls, NOT derived from the
// lesson item — an item that declared the wrong `activity`/`id` for its route would fail here even
// though it would sail through a test that replays `item.activity`/`item.id` back at itself.
//
//   StoryQuiz        story   <storyId>            StoryRetell     sentence  retell:<storyId>
//   SoundPractice    speak   <a card of the ph>   PracticeCard    speak     <cardId>
//   PairPractice     speak   <pairId>             StarPractice    speak     <sstarId>
//   VoicePractice    speak   <passageId>          WordCard        word      <wordId>
//   SentenceBuilder  sentence <sentenceId>

function screenEvent(route: string): { kind: ActivityKind; id: string } {
  const [head, a, b] = route.split('/').filter(Boolean)
  if (head === 'story' && b === 'retell') return { kind: 'sentence', id: `retell:${a}` }
  if (head === 'story') return { kind: 'story', id: a }
  if (head === 'sound') return { kind: 'speak', id: findSound(a)!.cards[2].id } // any card of the group
  if (head === 'practice' || head === 'pair' || head === 'star' || head === 'voice') return { kind: 'speak', id: a }
  if (head === 'words') return { kind: 'word', id: b }
  if (head === 'sentence') return { kind: 'sentence', id: a }
  throw new Error(`no screen convention known for ${route}`)
}

/** A kind no screen would ever pair with that route — the deliberate mismatch. */
const WRONG_KIND: Record<ActivityKind, ActivityKind> = {
  story: 'speak', speak: 'sentence', word: 'speak', sentence: 'speak',
}

const ROUTE_CASES: { name: string; setup: () => void; find: (route: string) => boolean }[] = [
  { name: 'listen story', setup: () => band(1), find: r => /^\/story\/[^/]+$/.test(r) },
  { name: 'sound tile', setup: () => band(1), find: r => r.startsWith('/sound/') },
  { name: 'word card', setup: () => band(2), find: r => r.startsWith('/practice/') },
  { name: 'minimal pair', setup: () => band(3), find: r => r.startsWith('/pair/') },
  { name: 'sentence star', setup: () => band(4), find: r => r.startsWith('/star/') },
  { name: 'story voice', setup: () => band(5), find: r => r.startsWith('/voice/') },
  { name: 'new word', setup: () => band(1), find: r => r.startsWith('/words/') },
  {
    name: 'sentence review',
    setup: () => { band(1); setStars('sentence:s1', 1) },
    find: r => r.startsWith('/sentence/'),
  },
  {
    name: 'retell review',
    setup: () => { band(1); setStars('retell:little-fox', 1) },
    find: r => r.endsWith('/retell'),
  },
]

it.each(ROUTE_CASES)('$name is done by the event its screen logs', ({ setup, find }) => {
  setup()
  const lesson = getLesson(BASE)
  const item = lesson.items.find(i => find(i.route))
  expect(item, 'the lesson should contain this route').toBeDefined()

  const { kind, id } = screenEvent(item!.route)
  logActivity({ ts: BASE + 60_000, kind, id, score: 85 })
  expect(lessonStatus(BASE, getActivity()).items.find(i => i.route === item!.route)?.done).toBe(true)
})

it.each(ROUTE_CASES)('$name is not done by an event of the wrong kind', ({ setup, find }) => {
  setup()
  const lesson = getLesson(BASE)
  const item = lesson.items.find(i => find(i.route))!
  const { kind, id } = screenEvent(item.route)

  logActivity({ ts: BASE + 60_000, kind: WRONG_KIND[kind], id, score: 85 })
  expect(lessonStatus(BASE, getActivity()).items.find(i => i.route === item.route)?.done).toBe(false)
})
