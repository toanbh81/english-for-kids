import {
  LEVELS, PAIRS, SENTENCE_STARS, SENTENCES, SOUNDS, STORY_VOICE, findSound,
} from '../content'
import { STORIES } from '../content/stories'
import { shuffleTiles } from '../content/shuffle'
import { TOPICS } from '../content/topics'
import type { TopicId } from '../content/topics'
import { TOPICS as WORD_DECKS, findWord } from '../content/words'
import type { Word } from '../content/words/types'
import { dayKey, getActivity, weakPhonemes } from './activity'
import type { ActivityEvent, ActivityKind } from './activity'
import { autoAdjustBand, getBand } from './band'
import type { Band } from './band'
import { dueWords, getBox } from './leitner'
import {
  getLessonLength, itemDone, lessonForDay, saveLesson,
} from './lessonStore'
import type { Lesson, LessonItem, LessonLength } from './lessonStore'
import { getStars } from './store'
import { currentTopic, unlockedTopics } from './topicProgress'

export type { Lesson, LessonItem, LessonItemKind, LessonLength } from './lessonStore'
export {
  LESSON_LENGTHS, clearLessons, getLessonLength, lessonDays, lessonForDay, setLessonLength,
} from './lessonStore'

/** How many items of each kind a lesson holds, by length (spec §4). */
export type Recipe = { listen: number; speak: number; word: number; review: number }
export const RECIPES: Record<LessonLength, Recipe> = {
  short: { listen: 1, speak: 2, word: 2, review: 1 },
  medium: { listen: 1, speak: 4, word: 3, review: 2 },
  long: { listen: 1, speak: 6, word: 4, review: 3 },
}

/** Phonemes at or above this are said well enough not to steer the lesson. */
const WEAK_SCORE = 80

const listenEmoji = '🎧'
const speakEmoji = '🗣️'
const wordEmoji = '🧩'
const reviewEmoji = '🔁'

/** First sentence of a passage — a whole Story Voice text is too long for a lesson row. */
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0] ?? text

// --- speaking pool -------------------------------------------------------------------------

/**
 * A speak candidate carries what the weak-phoneme filter needs: `ph` for a sound tile (the tile
 * *is* the phoneme) and `ipa` for a word card (which has no target phoneme of its own, so its
 * transcription is searched for the weak sound's symbol).
 */
type SpeakCandidate = { item: LessonItem; ph?: string; ipa?: string }

const speakItem = (id: string, route: string, text: string): LessonItem =>
  ({ kind: 'speak', activity: 'speak', id, route, label: `Nói: ${text}`, emoji: speakEmoji })

const wordPopCards = () => LEVELS.find(l => l.id === 'word-pop')?.cards ?? []

/** The five bậc, in band order: index 0 is band 1. */
function speakLevels(): SpeakCandidate[][] {
  return [
    SOUNDS.filter(g => g.cards.length > 0)
      .map(g => ({ item: speakItem(g.ph, `/sound/${g.ph}`, g.example), ph: g.ph })),
    wordPopCards().map(c => ({ item: speakItem(c.id, `/practice/${c.id}`, c.text), ipa: c.ipa })),
    PAIRS.map(p => ({ item: speakItem(p.id, `/pair/${p.id}`, `${p.a.word}, ${p.b.word}`) })),
    SENTENCE_STARS.map(s => ({ item: speakItem(s.id, `/star/${s.id}`, s.text) })),
    STORY_VOICE.map(v => ({ item: speakItem(v.id, `/voice/${v.id}`, firstSentence(v.text)) })),
  ]
}

function weakMatcher(events: ActivityEvent[]): (c: SpeakCandidate) => boolean {
  const weak = weakPhonemes(5, events).filter(p => p.avg < WEAK_SCORE).map(p => p.phoneme)
  if (weak.length === 0) return () => false
  const names = new Set(weak)
  const symbols = weak.map(ph => findSound(ph)?.ipa).filter((s): s is string => !!s)
  return c =>
    (c.ph !== undefined && names.has(c.ph)) ||
    (c.ipa !== undefined && symbols.some(sym => c.ipa?.includes(sym)))
}

/**
 * Seeded pick of `n` from `pool` — `shuffleTiles` is the app's mulberry32 stream, so the same day
 * key always yields the same lesson and a reload never reshuffles it. Items the child struggles
 * with jump the queue without ever crowding the rest out entirely.
 */
function pick<T>(pool: T[], n: number, seed: string, priority?: (x: T) => boolean): T[] {
  if (n <= 0 || pool.length === 0) return []
  const shuffled = shuffleTiles(pool, seed)
  const ordered = priority
    ? [...shuffled.filter(priority), ...shuffled.filter(x => !priority(x))]
    : shuffled
  return ordered.slice(0, n)
}

function selectSpeak(count: number, band: Band, day: string, events: ActivityEvent[]): LessonItem[] {
  const levels = speakLevels().slice(0, band)
  const newest = levels[levels.length - 1] ?? []
  const lower = levels.slice(0, -1).flat()
  const isWeak = weakMatcher(events)

  // Half the slots (rounded up) come from the band's newest level: the child meets the level they
  // just reached every day, while the levels below keep ticking over.
  const chosen = pick(newest, Math.ceil(count / 2), `${day}:speak-new`, isWeak)
  chosen.push(...pick(lower, count - chosen.length, `${day}:speak-low`, isWeak))
  if (chosen.length < count) {
    const taken = new Set(chosen.map(c => c.item.route))
    const rest = [...newest, ...lower].filter(c => !taken.has(c.item.route))
    chosen.push(...pick(rest, count - chosen.length, `${day}:speak-fill`, isWeak))
  }
  return chosen.map(c => c.item)
}

// --- new words -----------------------------------------------------------------------------

const deckOf = (id: TopicId): Word[] => WORD_DECKS.find(d => d.id === id)?.words ?? []

const wordItem = (w: Word, kind: 'word' | 'review' = 'word'): LessonItem =>
  ({ kind, activity: 'word', id: w.id, route: `/words/${w.topic}/${w.id}`, label: `Từ mới: ${w.word}`, emoji: wordEmoji })

/**
 * Words the child has not unlocked yet, current topic first, then the rest of the open map, then
 * the locked decks — once every open deck is finished the lesson may reach ahead rather than
 * repeat itself (spec §4).
 */
function newWordPool(day: string): Word[] {
  const current = currentTopic()
  const open = unlockedTopics()
  const order: TopicId[] = [
    current,
    ...open.filter(id => id !== current),
    ...TOPICS.map(t => t.id).filter(id => !open.includes(id)),
  ]
  return order.flatMap(id =>
    shuffleTiles(deckOf(id).filter(w => getBox(w.id) === 0), `${day}:word:${id}`))
}

// --- review --------------------------------------------------------------------------------

/** An item the child has already earned stars on, with the band level it belongs to (0 = ungated). */
type Attempted = { key: string; item: LessonItem; level: number }

const reviewItem = (
  id: string, route: string, activity: ActivityKind, text: string,
): LessonItem => ({ kind: 'review', activity, id, route, label: `Ôn lại: ${text}`, emoji: reviewEmoji })

function attemptedPool(): Attempted[] {
  const pool: Attempted[] = []
  const add = (key: string, level: number, item: LessonItem) => pool.push({ key, item, level })

  for (const s of STORIES) {
    add(`story:${s.id}`, 0, reviewItem(s.id, `/story/${s.id}`, 'story', s.titleVi))
    add(`retell:${s.id}`, 0, reviewItem(`retell:${s.id}`, `/story/${s.id}/retell`, 'sentence', s.titleVi))
  }
  for (const s of SENTENCES) {
    add(`sentence:${s.id}`, 0, reviewItem(s.id, `/sentence/${s.id}`, 'sentence', s.words.join(' ')))
  }
  for (const g of SOUNDS) {
    add(`sound:${g.ph}`, 1, reviewItem(g.ph, `/sound/${g.ph}`, 'speak', g.example))
  }
  // Only word-pop cards earn stars under their bare card id; sound-zoo progress is stored per
  // sound group as `sound:<ph>` (added above), never per card.
  for (const c of wordPopCards()) {
    add(c.id, 2, reviewItem(c.id, `/practice/${c.id}`, 'speak', c.text))
  }
  for (const p of PAIRS) {
    add(`pair:${p.id}`, 3, reviewItem(p.id, `/pair/${p.id}`, 'speak', `${p.a.word}, ${p.b.word}`))
  }
  for (const s of SENTENCE_STARS) {
    add(`sstar:${s.id}`, 4, reviewItem(s.id, `/star/${s.id}`, 'speak', s.text))
  }
  for (const v of STORY_VOICE) {
    add(`voice:${v.id}`, 5, reviewItem(v.id, `/voice/${v.id}`, 'speak', firstSentence(v.text)))
  }
  return pool
}

/**
 * Review draws due Leitner words first — spaced repetition is the whole point of the box — then
 * the shakiest thing the child has already touched, staying inside the band so a review never
 * hands them a level they have not reached. Nothing to revisit yet (a brand-new player) → extra
 * new words, which is the only honest filler.
 */
function selectReview(
  count: number, band: Band, day: string, now: number, used: Set<string>, spare: Word[],
): LessonItem[] {
  if (count <= 0) return []
  const items: LessonItem[] = []
  // A local copy: the caller owns `used` and adds these routes itself as it appends the items.
  const taken = new Set(used)
  const take = (item: LessonItem) => {
    if (items.length >= count || taken.has(item.route)) return
    taken.add(item.route)
    items.push(item)
  }

  const due = dueWords(now)
    .map(id => findWord(id))
    .filter((w): w is Word => w !== undefined)
  for (const w of pick(due, count, `${day}:review-due`)) {
    take(reviewItem(w.id, `/words/${w.topic}/${w.id}`, 'word', w.word))
  }

  if (items.length < count) {
    const attempted = attemptedPool()
      .map(a => ({ ...a, stars: getStars(a.key) }))
      .filter(a => a.stars > 0 && a.level <= band && !taken.has(a.item.route))
    const ordered = shuffleTiles(attempted, `${day}:review-weak`)
      .slice()
      .sort((a, b) => a.stars - b.stars)
    for (const a of ordered) take(a.item)
  }

  // Filler keeps its "Từ mới" wording — it is a new word, it just happens to sit in a review slot.
  for (const w of spare) take(wordItem(w, 'review'))
  return items
}

// --- generation ----------------------------------------------------------------------------

function generate(day: string, band: Band, now: number, events: ActivityEvent[]): Lesson {
  const recipe = RECIPES[getLessonLength()]
  const items: LessonItem[] = []
  const used = new Set<string>()
  const add = (item: LessonItem) => {
    if (used.has(item.route)) return
    used.add(item.route)
    items.push(item)
  }

  // listen: the story the child has the fewest stars on; the shuffle breaks ties, the stable sort
  // keeps that order inside each star count.
  const stories = shuffleTiles(STORIES, `${day}:listen`)
    .slice()
    .sort((a, b) => getStars(`story:${a.id}`) - getStars(`story:${b.id}`))
  for (const s of stories.slice(0, recipe.listen)) {
    add({ kind: 'listen', activity: 'story', id: s.id, route: `/story/${s.id}`, label: `Nghe: ${s.titleVi}`, emoji: listenEmoji })
  }

  for (const item of selectSpeak(recipe.speak, band, day, events)) add(item)

  const pool = newWordPool(day)
  for (const w of pool.slice(0, recipe.word)) add(wordItem(w))

  for (const item of selectReview(recipe.review, band, day, now, used, pool.slice(recipe.word))) {
    add(item)
  }

  return { day, created: now, band, items }
}

/**
 * Today's lesson, generated once and then frozen: a reload, a second screen or a mid-day revisit
 * all see the same list. The band is re-evaluated exactly here, on the first call of a new day.
 */
export function getLesson(now = Date.now(), events = getActivity()): Lesson {
  const day = dayKey(now)
  const existing = lessonForDay(day)
  if (existing) return existing
  autoAdjustBand(now, events)
  const lesson = generate(day, getBand().value, now, events)
  saveLesson(lesson)
  return lesson
}

export function lessonStatus(now = Date.now(), events = getActivity()): {
  items: (LessonItem & { done: boolean })[]
  doneCount: number
  total: number
  done: boolean
} {
  const lesson = getLesson(now, events)
  const dayEvents = events.filter(e => dayKey(e.ts) === lesson.day)
  const items = lesson.items.map(item => ({ ...item, done: itemDone(item, lesson, dayEvents) }))
  const doneCount = items.filter(i => i.done).length
  return { items, doneCount, total: items.length, done: items.length > 0 && doneCount === items.length }
}
