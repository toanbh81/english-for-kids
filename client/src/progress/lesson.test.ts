import {
  RECIPES, getLesson, getLessonLength, lessonDays, lessonForDay, lessonStatus, setLessonLength,
} from './lesson'
import type { Lesson, LessonItem, LessonLength } from './lesson'
import { getActivity, logActivity } from './activity'
import type { ActivityKind } from './activity'
import { setBandAuto, setBandValue } from './band'
import { promote } from './leitner'
import { setStars } from './store'
import { unlockedTopics } from './topicProgress'
import { SOUNDS, findSentence, findSound } from '../content'
import { TOPICS as WORD_DECKS, findWord } from '../content/words'
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
    sentence: items.filter(i => i.kind === 'sentence').length,
    review: items.filter(i => i.kind === 'review').length,
  }
}

/** The islands a lesson's content steps (🧩 words + 🧱 sentences) actually drew from. */
function contentTopics(lesson: Lesson): TopicId[] {
  const topics = lesson.items.flatMap(i =>
    i.kind === 'word' ? [findWord(i.id)!.topic]
      : i.kind === 'sentence' ? [findSentence(i.id)!.topic]
        : [])
  return [...new Set(topics)]
}

/** Opens `animals … colors` by learning six words of each earlier deck: six islands unlocked. */
function openSixTopics() {
  for (const t of ['animals', 'food', 'school', 'family', 'weather'] as TopicId[]) learn(t, 6)
}

const firstWordTopic = (lesson: Lesson): TopicId =>
  findWord(lesson.items.find(i => i.kind === 'word')!.id)!.topic

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
  expect(items).toHaveLength(16)
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
  expect(plain.some(r => r.startsWith('/sound/sh/'))).toBe(false)

  localStorage.clear()
  band(1)
  for (let i = 0; i < 2; i++) {
    logActivity({ ts: BASE - DAY + i, kind: 'speak', id: 'sz-sh-ship', score: 40, phonemes: [{ phoneme: 'sh', score: 20 }] })
  }
  expect(getLesson(BASE).items.map(i => i.route).some(r => r.startsWith('/sound/sh/'))).toBe(true)
})

// --- one word per sound (Phase 9 §2) ----------------------------------------------------------

it('makes a sound step one word of the sound, not the whole group', () => {
  band(1)
  const speak = getLesson(BASE).items.filter(i => i.kind === 'speak')
  expect(speak.length).toBeGreaterThan(0)
  for (const item of speak) {
    const [, ph, cardId] = item.route.split('/').filter(Boolean)
    expect(item.route).toBe(`/sound/${ph}/${cardId}`)
    const card = findSound(ph)!.cards.find(c => c.id === cardId)
    expect(card, `${cardId} should be a card of /${ph}/`).toBeDefined()
    expect(item.id).toBe(cardId) // the id SoundPractice logs
    expect(item.label).toBe(`Nói: ${card!.text}`)
  }
})

it('offers the sound lowest-starred word', () => {
  band(1)
  const [weak, ...rest] = findSound('th')!.cards
  for (const c of rest) setStars(`sword:${c.id}`, 3)
  // /θ/ is the weak phoneme, so the lesson reaches for it — at its one word still not green.
  for (let i = 0; i < 2; i++) {
    logActivity({ ts: BASE - DAY + i, kind: 'speak', id: 'sz-th-three', score: 40, phonemes: [{ phoneme: 'th', score: 20 }] })
  }
  const item = getLesson(BASE).items.find(i => i.route.startsWith('/sound/th/'))
  expect(item?.route).toBe(`/sound/th/${weak.id}`)
})

// --- mixing the topics (Phase 9 §2) -----------------------------------------------------------

it('draws its content from several unlocked islands, not just one', () => {
  band(1)
  openSixTopics()
  expect(unlockedTopics().length).toBeGreaterThanOrEqual(4)

  const topics = contentTopics(getLesson(BASE))
  expect(topics.length).toBeGreaterThanOrEqual(2)
  // medium = 3 words + 1 sentence, and every open deck still has content, so all four differ.
  expect(topics).toHaveLength(4)
})

it('gives consecutive word slots different topics', () => {
  band(1)
  openSixTopics()
  const words = getLesson(BASE).items.filter(i => i.kind === 'word').map(i => findWord(i.id)!.topic)
  for (let i = 1; i < words.length; i++) expect(words[i]).not.toBe(words[i - 1])
})

it('rotates the leading topic from one day to the next', () => {
  band(1)
  openSixTopics()
  const today = firstWordTopic(getLesson(BASE))
  const tomorrow = firstWordTopic(getLesson(BASE + DAY))
  expect(tomorrow).not.toBe(today)
})

it('touches every unlocked island across two consecutive days', () => {
  band(1)
  openSixTopics()
  const open = unlockedTopics()
  expect(open).toHaveLength(6) // more islands than one day has content slots

  const both = [...new Set([
    ...contentTopics(getLesson(BASE)),
    ...contentTopics(getLesson(BASE + DAY)),
  ])]
  for (const id of open) expect(both).toContain(id)
})

it('rotation survives a day off', () => {
  band(1)
  openSixTopics()
  const first = contentTopics(getLesson(BASE))
  const missed = unlockedTopics().filter(id => !first.includes(id))
  expect(missed.length).toBeGreaterThan(0)

  // Nothing at all on the day between — no lesson is generated, so the calendar has a hole in it.
  const next = contentTopics(getLesson(BASE + 2 * DAY))

  // The rotation still knows which islands the last lesson missed, and leads with them.
  for (const id of missed) expect(next).toContain(id)
  expect(firstWordTopic(getLesson(BASE + 2 * DAY))).not.toBe(firstWordTopic(getLesson(BASE)))
})

// A locked island is not a place the child can go — reaching ahead is only for a map whose open
// decks are all finished.
it('prefers open islands over locked ones', () => {
  band(1)
  openSixTopics()
  const open = unlockedTopics()
  for (const id of contentTopics(getLesson(BASE))) expect(open).toContain(id)
})

it('skips a deck the child has already finished', () => {
  band(1)
  learn('animals', 8) // animals done, food open and untouched
  expect(getLesson(BASE).items.filter(i => i.kind === 'word')
    .every(i => i.route.startsWith('/words/food/'))).toBe(true)
})

// --- sentence steps ---------------------------------------------------------------------------

it('adds a 🧱 sentence step that routes to the builder', () => {
  band(1)
  const items = getLesson(BASE).items.filter(i => i.kind === 'sentence')
  expect(items).toHaveLength(RECIPES.medium.sentence)
  for (const item of items) {
    const sentence = findSentence(item.id)!
    expect(item.route).toBe(`/sentence/${sentence.id}`)
    expect(item.activity).toBe('sentence')
    expect(item.emoji).toBe('🧱')
    expect(item.label).toBe(`Ghép câu: ${sentence.words.join(' ')}`)
  }
})

it('lays the steps out listen → speak → word → sentence → review', () => {
  band(3)
  const order: string[] = []
  for (const item of getLesson(BASE).items) if (!order.includes(item.kind)) order.push(item.kind)
  expect(order).toEqual(['listen', 'speak', 'word', 'sentence', 'review'])
})

// s13–s16 are the animals sentences — the only ones open on a fresh map.
it('offers sentences the child has no stars on yet', () => {
  band(1)
  for (const s of ['s13', 's14', 's15']) setStars(`sentence:${s}`, 3)

  const chosen = getLesson(BASE).items.filter(i => i.kind === 'sentence').map(i => i.id)
  expect(chosen).toEqual(['s16']) // the one animals sentence still unbuilt
})

// Every open sentence already built: the 🧱 step is still there, replaying one, rather than the
// lesson quietly coming up a card short.
it('falls back to a built sentence when none is left unstarred', () => {
  band(1)
  for (const s of ['s13', 's14', 's15', 's16']) setStars(`sentence:${s}`, 3)

  const chosen = getLesson(BASE).items.filter(i => i.kind === 'sentence')
  expect(chosen).toHaveLength(RECIPES.medium.sentence)
  expect(findSentence(chosen[0].id)?.topic).toBe('animals')
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

it('reviews a sound the child has only per-word stars on, at its weakest word', () => {
  band(1)
  // No legacy `sound:<ph>` key anywhere — exactly the shape Phase 9 writes. Each sound's first card
  // is left the weakest, so both the 🗣️ step and the 🔁 step have one obvious choice.
  for (const g of SOUNDS) {
    setStars(`sword:${g.cards[0].id}`, 1)
    for (const c of g.cards.slice(1)) setStars(`sword:${c.id}`, 3)
  }

  const review = getLesson(BASE).items.filter(i => i.kind === 'review')
  expect(review).toHaveLength(RECIPES.medium.review)
  expect(review.every(i => i.route.startsWith('/sound/'))).toBe(true)
  for (const item of review) {
    const [, ph, cardId] = item.route.split('/').filter(Boolean)
    expect(cardId).toBe(findSound(ph)!.cards[0].id) // the sound's lowest-starred word
    expect(item.id).toBe(cardId) // and the id SoundPractice logs for it
    expect(item.activity).toBe('speak')
  }
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

it('completes a sound step from its own word, not from a sibling of the same sound', () => {
  band(1)
  const lesson = getLesson(BASE)
  const sound = lesson.items.find(i => i.route.startsWith('/sound/'))!
  const [, ph] = sound.route.split('/').filter(Boolean)
  const done = () => lessonStatus(BASE, getActivity()).items.find(i => i.route === sound.route)?.done

  const sibling = findSound(ph)!.cards.find(c => c.id !== sound.id)!
  logActivity({ ts: BASE + 60_000, kind: 'speak', id: sibling.id, score: 90 })
  expect(done()).toBe(false)

  // the id the SoundPractice screen actually logs for this card
  logActivity({ ts: BASE + 120_000, kind: 'speak', id: sound.id, score: 90 })
  expect(done()).toBe(true)
})

// --- yesterday's lesson, today's code ---------------------------------------------------------
//
// A lesson generated before Phase 9 is sitting in storage: its sound step is a whole group
// (`/sound/<ph>`, id `<ph>`) and it has no 🧱 step at all. It has to keep working for the rest of
// the day rather than being thrown away or taking the mission screen down.

it('still renders and matches a lesson stored in the pre-Phase-9 shape', () => {
  band(1)
  const items: LessonItem[] = [
    { kind: 'listen', activity: 'story', id: 'little-fox', route: '/story/little-fox', label: 'Nghe: Cáo nhỏ', emoji: '🎧' },
    { kind: 'speak', activity: 'speak', id: 'th', route: '/sound/th', label: 'Nói: three', emoji: '🗣️' },
    { kind: 'word', activity: 'word', id: 'animals-elephant', route: '/words/animals/animals-elephant', label: 'Từ mới: elephant', emoji: '🧩' },
  ]
  const stored: Lesson = { day: '2026-08-24', created: BASE - 60_000, band: 1, items }
  localStorage.setItem(KEY, JSON.stringify({ ...stored, v: 1 }))

  expect(lessonForDay('2026-08-24')).toEqual(stored)
  const before = lessonStatus(BASE, getActivity())
  expect(before.items.map(i => i.route)).toEqual(items.map(i => i.route))
  expect(before.total).toBe(3)

  // The old whole-group step is still completed by any card of the sound — the word list it now
  // lands on is a fine place to do that.
  logActivity({ ts: BASE, kind: 'speak', id: findSound('th')!.cards[1].id, score: 90 })
  const after = lessonStatus(BASE, getActivity())
  expect(after.items.find(i => i.route === '/sound/th')?.done).toBe(true)
  expect(after.doneCount).toBe(1)
})

// --- malformed records ------------------------------------------------------------------------

const KEY = 'speakup.lesson.2026-08-24'

it('rejects a stored lesson without the current version stamp', () => {
  band(1)
  const lesson = getLesson(BASE)
  expect(JSON.parse(localStorage.getItem(KEY)!).v).toBe(1)

  // A pre-Phase-7-fix record: same shape, no stamp.
  localStorage.setItem(KEY, JSON.stringify(lesson))
  expect(lessonForDay('2026-08-24')).toBeNull()

  localStorage.setItem(KEY, JSON.stringify({ ...lesson, v: 2 }))
  expect(lessonForDay('2026-08-24')).toBeNull()
})

it('regenerates instead of throwing when a stored item is missing its fields', () => {
  band(1)
  const lesson = getLesson(BASE)
  // The shape that used to brick the app: a record that parses, but whose items have no `route`
  // for `matchIds` to read.
  localStorage.setItem(KEY, JSON.stringify({ ...lesson, v: 1, items: [{}] }))
  expect(lessonForDay('2026-08-24')).toBeNull()

  const status = lessonStatus(BASE, getActivity())
  expect(status.total).toBe(lesson.items.length)
  expect(status.items.every(i => typeof i.route === 'string' && i.route.startsWith('/'))).toBe(true)
  expect(lessonForDay('2026-08-24')).not.toBeNull()
})

it('rejects a record whose items are not an array at all', () => {
  band(1)
  const lesson = getLesson(BASE)
  localStorage.setItem(KEY, JSON.stringify({ ...lesson, v: 1, items: 'nope' }))
  expect(lessonForDay('2026-08-24')).toBeNull()
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
  // /sound/<ph>/<cardId> — the word the child is drilling; /sound/<ph> is the group's word list,
  // which a lesson only holds as a review of a sound practised before Phase 9.
  if (head === 'sound') return { kind: 'speak', id: b ?? findSound(a)!.cards[2].id }
  if (head === 'practice' || head === 'pair' || head === 'star' || head === 'voice') return { kind: 'speak', id: a }
  if (head === 'words') return { kind: 'word', id: b }
  if (head === 'sentence') return { kind: 'sentence', id: a }
  throw new Error(`no screen convention known for ${route}`)
}

/** A kind no screen would ever pair with that route — the deliberate mismatch. */
const WRONG_KIND: Record<ActivityKind, ActivityKind> = {
  story: 'speak', speak: 'sentence', word: 'speak', sentence: 'speak',
}

/** `find` takes the whole item, not just its route: `/sentence/<id>` is now both a 🧱 step and a
 * possible 🔁 review, and only the kind tells the two apart. */
const ROUTE_CASES: { name: string; setup: () => void; find: (item: LessonItem) => boolean }[] = [
  { name: 'listen story', setup: () => band(1), find: i => /^\/story\/[^/]+$/.test(i.route) },
  { name: 'sound word', setup: () => band(1), find: i => i.route.startsWith('/sound/') },
  { name: 'word card', setup: () => band(2), find: i => i.route.startsWith('/practice/') },
  { name: 'minimal pair', setup: () => band(3), find: i => i.route.startsWith('/pair/') },
  { name: 'sentence star', setup: () => band(4), find: i => i.route.startsWith('/star/') },
  { name: 'story voice', setup: () => band(5), find: i => i.route.startsWith('/voice/') },
  { name: 'new word', setup: () => band(1), find: i => i.route.startsWith('/words/') },
  { name: 'sentence step', setup: () => band(1), find: i => i.kind === 'sentence' },
  {
    name: 'sentence review',
    setup: () => { band(1); setStars('sentence:s1', 1) },
    find: i => i.kind === 'review' && i.route.startsWith('/sentence/'),
  },
  {
    name: 'retell review',
    setup: () => { band(1); setStars('retell:little-fox', 1) },
    find: i => i.route.endsWith('/retell'),
  },
]

it.each(ROUTE_CASES)('$name is done by the event its screen logs', ({ setup, find }) => {
  setup()
  const lesson = getLesson(BASE)
  const item = lesson.items.find(find)
  expect(item, 'the lesson should contain this route').toBeDefined()

  const { kind, id } = screenEvent(item!.route)
  logActivity({ ts: BASE + 60_000, kind, id, score: 85 })
  expect(lessonStatus(BASE, getActivity()).items.find(i => i.route === item!.route)?.done).toBe(true)
})

it.each(ROUTE_CASES)('$name is not done by an event of the wrong kind', ({ setup, find }) => {
  setup()
  const lesson = getLesson(BASE)
  const item = lesson.items.find(find)!
  const { kind, id } = screenEvent(item.route)

  logActivity({ ts: BASE + 60_000, kind: WRONG_KIND[kind], id, score: 85 })
  expect(lessonStatus(BASE, getActivity()).items.find(i => i.route === item.route)?.done).toBe(false)
})
