import {
  LEVELS, PAIRS, SENTENCE_STARS, SENTENCES, SOUNDS, STORY_VOICE, findSentence, findSound,
} from '../content'
import type { Sentence } from '../content'
import { STORIES } from '../content/stories'
import { shuffleTiles } from '../content/shuffle'
import { TOPICS } from '../content/topics'
import type { TopicId } from '../content/topics'
import type { LessonCard, SoundGroup } from '../content/types'
import { TOPICS as WORD_DECKS, findWord } from '../content/words'
import type { Word } from '../content/words/types'
import { dayKey, getActivity, weakPhonemes } from './activity'
import type { ActivityEvent, ActivityKind } from './activity'
import { autoAdjustBand, getBand } from './band'
import type { Band } from './band'
import { dueWords, getBox } from './leitner'
import {
  getLessonLength, itemDone, lessonDays, lessonForDay, saveLesson,
} from './lessonStore'
import type { Lesson, LessonItem, LessonLength } from './lessonStore'
import { getStars, soundStars } from './store'
import { unlockedTopics, unlockedWords } from './topicProgress'

export type { Lesson, LessonItem, LessonItemKind, LessonLength } from './lessonStore'
export {
  LESSON_LENGTHS, clearLessons, getLessonLength, lessonDays, lessonForDay, setLessonLength,
} from './lessonStore'

/**
 * How many items of each kind a lesson holds, by length (Phase 9 §2 — rebalanced when a speak step
 * became one word rather than a sound's whole three-card run, and the 🧱 sentence step joined).
 */
export type Recipe = {
  listen: number; speak: number; word: number; sentence: number; review: number
}
export const RECIPES: Record<LessonLength, Recipe> = {
  short: { listen: 1, speak: 2, word: 2, sentence: 1, review: 1 },
  medium: { listen: 1, speak: 4, word: 3, sentence: 1, review: 2 },
  long: { listen: 1, speak: 6, word: 4, sentence: 2, review: 3 },
}

/** Phonemes at or above this are said well enough not to steer the lesson. */
const WEAK_SCORE = 80

/** How many past lessons the topic rotation remembers. */
const ROTATION_MEMORY = 2

const listenEmoji = '🎧'
const speakEmoji = '🗣️'
const wordEmoji = '🧩'
const sentenceEmoji = '🧱'
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

/**
 * The word of `group` today's lesson drills: the one with the fewest `sword:` stars, so the sound's
 * weakest link is what the child meets — the sound tile only turns green once every word does.
 * Ties (a fresh sound, whose three words all sit at 0) are broken by the day seed, so the run
 * rotates through the group over a week instead of always offering the first card.
 */
function weakestWord(group: SoundGroup, day: string): LessonCard | undefined {
  return shuffleTiles(group.cards, `${day}:sound:${group.ph}`)
    .slice()
    .sort((a, b) => getStars(`sword:${a.id}`) - getStars(`sword:${b.id}`))[0]
}

/** The five bậc, in band order: index 0 is band 1. */
function speakLevels(day: string): SpeakCandidate[][] {
  return [
    // A sound step is one word (Phase 9 §2): it routes to that word's practice screen and is done
    // by the event that screen logs — the card id — while `ph` keeps it visible to the weak-phoneme
    // filter, which is a claim about the sound, not about the card.
    SOUNDS.map(g => ({ g, card: weakestWord(g, day) }))
      .filter((x): x is { g: SoundGroup; card: LessonCard } => x.card !== undefined)
      .map(({ g, card }) => ({
        item: speakItem(card.id, `/sound/${g.ph}/${card.id}`, card.text), ph: g.ph,
      })),
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
  const levels = speakLevels(day).slice(0, band)
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

// --- mixing the topics -------------------------------------------------------------------------
//
// The mission and the islands are separate axes (Phase 9 §2): an island is one topic's library,
// today's lesson is drawn across every unlocked topic, so a whole practice session is never stuck
// on one theme. `currentTopic()` no longer feeds generation at all.

/**
 * The islands a lesson taught from, by what its items *are* rather than which slot they sat in: a
 * new word that landed in a 🔁 slot (`selectReview`'s filler is genuinely unlearned words) teaches
 * that island just as much as one in a 🧩 slot, and "no island left behind" is a claim about the
 * child's day, not about the recipe. Anything with no word or sentence behind it — a story, a
 * retell, a sound — belongs to no island and is skipped.
 */
function topicsTouched(lesson: Lesson | null): Set<TopicId> {
  const touched = new Set<TopicId>()
  for (const item of lesson?.items ?? []) {
    const topic = item.activity === 'word' ? findWord(item.id)?.topic
      : item.activity === 'sentence' ? findSentence(item.id)?.topic
        : undefined
    if (topic) touched.add(topic)
  }
  return touched
}

/**
 * The lessons the child actually has on record before `day`, most recent first. Deliberately *not*
 * "yesterday and the day before": a child who takes the weekend off has no record for those days,
 * and reading the rotation off the calendar would forget which islands they had just done and start
 * the cycle over. What the rotation means is "the last time we practised", so that is what it reads.
 */
function recentLessons(day: string, n = ROTATION_MEMORY): Lesson[] {
  return lessonDays()
    .filter(d => d < day)
    .slice(-n)
    .reverse()
    .map(d => lessonForDay(d))
    .filter((lesson): lesson is Lesson => lesson !== null)
}

/**
 * The order today's content slots offer the unlocked topics. Three keys, strongest first — written
 * in the order the code actually applies them, because which one decides a given day matters:
 *
 * 1. **freshness — no island left behind.** An island the last lesson never touched outranks one it
 *    did, which is what makes any two lessons in a row cover the whole open map while slots allow.
 *    The lesson before that counts too, at half the weight, so a wide map keeps cycling instead of
 *    flipping between the same two halves — the most recent lesson always outranks it, which is what
 *    keeps the pairwise guarantee intact. On most days this key alone decides the front of the list,
 *    and it is what rotates the leading topic from one lesson to the next.
 * 2. **the frontier.** Among islands of equal freshness, the deck with the fewest learned words goes
 *    first, so the unlock chain keeps advancing instead of one near-finished island soaking up every
 *    slot.
 * 3. **the day seed.** What is left is settled by the day's seeded shuffle — the same day key always
 *    gives the same order, so a reload rebuilds today's lesson rather than reshuffling it. This is
 *    the whole of the order on a fresh profile (no lessons on record, every deck at zero), which is
 *    exactly when two children — or two first days — should not be handed identical lessons.
 */
function dayTopicOrder(day: string): TopicId[] {
  const recent = recentLessons(day).map(topicsTouched)
  // Touched in the most recent lesson → `recent.length`; only in the one before → 1 less; never → 0.
  const staleness = (id: TopicId) => {
    const at = recent.findIndex(touched => touched.has(id))
    return at === -1 ? 0 : recent.length - at
  }
  return shuffleTiles(unlockedTopics(), `${day}:topics`)
    .map((id, seeded) => ({ id, seeded, stale: staleness(id), learned: unlockedWords(id) }))
    .sort((a, b) => a.stale - b.stale || a.learned - b.learned || a.seeded - b.seeded)
    .map(t => t.id)
}

/**
 * Deal the topics' pools out one item at a time, cycling `order` and skipping whatever has run dry.
 * Round-robin is the whole of mixing rule 1: consecutive slots come from different topics while
 * more than one still has content, and the first n items touch as many islands as n allows. A topic
 * that runs out drops out of the cycle rather than ending it.
 */
function deal<T>(order: TopicId[], pool: (id: TopicId) => T[]): T[] {
  const queues = order.map(id => pool(id))
  const dealt: T[] = []
  for (let round = 0; queues.some(q => q.length > round); round++) {
    for (const q of queues) if (q.length > round) dealt.push(q[round])
  }
  return dealt
}

// --- new words -----------------------------------------------------------------------------

const deckOf = (id: TopicId): Word[] => WORD_DECKS.find(d => d.id === id)?.words ?? []

const wordItem = (w: Word, kind: 'word' | 'review' = 'word'): LessonItem =>
  ({ kind, activity: 'word', id: w.id, route: `/words/${w.topic}/${w.id}`, label: `Từ mới: ${w.word}`, emoji: wordEmoji })

/**
 * Words the child has not unlocked yet, mixed across every open island in `order`, and behind them
 * the locked decks — once every open deck is finished the lesson may reach ahead rather than repeat
 * itself. The locked decks are dealt as a second pass, so reaching ahead can never take a slot from
 * an island the child can actually see on the map.
 */
function newWordPool(day: string, order: TopicId[]): Word[] {
  const unlearned = (id: TopicId) =>
    shuffleTiles(deckOf(id).filter(w => getBox(w.id) === 0), `${day}:word:${id}`)
  const locked = TOPICS.map(t => t.id).filter(id => !order.includes(id))
  return [...deal(order, unlearned), ...deal(locked, unlearned)]
}

// --- sentences -----------------------------------------------------------------------------

const sentenceItem = (s: Sentence): LessonItem => ({
  kind: 'sentence',
  activity: 'sentence',
  id: s.id,
  route: `/sentence/${s.id}`,
  label: `Ghép câu: ${s.words.join(' ')}`,
  emoji: sentenceEmoji,
})

/**
 * The 🧱 candidates, best first. Spread outranks freshness: an unbuilt sentence from an island
 * today's word slots did NOT reach comes before an unbuilt one from an island they did, because the
 * sentence slot is where a day whose words all landed on one island still reaches a second one. Only
 * when no untouched island has an unbuilt sentence does it fall back to a touched island's, and only
 * when nothing anywhere is unbuilt does it replay an already-starred sentence — which keeps the 🧱
 * step on the card rather than leaving the lesson one short.
 *
 * `spent` is the islands the word slots used; the rule lives here rather than in the caller's choice
 * of `order` so that it holds for whoever calls this next.
 */
function sentencePool(day: string, order: TopicId[], spent: Set<TopicId>): Sentence[] {
  const of = (id: TopicId, starred: boolean) => shuffleTiles(
    SENTENCES.filter(s => s.topic === id && (getStars(`sentence:${s.id}`) > 0) === starred),
    `${day}:sentence:${id}`,
  )
  // Islands the words did not reach lead the cycle, so the first unbuilt sentence comes from one of
  // them; a touched island still takes its turn within the round, which is what keeps a long
  // lesson's two sentence slots on two different islands rather than twice on the same one.
  const spread = [...order.filter(id => !spent.has(id)), ...order.filter(id => spent.has(id))]
  return [...deal(spread, id => of(id, false)), ...deal(spread, id => of(id, true))]
}

// --- review --------------------------------------------------------------------------------

/** An item the child has already earned stars on, with the band level it belongs to (0 = ungated). */
type Attempted = { stars: number; item: LessonItem; level: number }

const reviewItem = (
  id: string, route: string, activity: ActivityKind, text: string,
): LessonItem => ({ kind: 'review', activity, id, route, label: `Ôn lại: ${text}`, emoji: reviewEmoji })

/**
 * Everything the child has already earned stars on, each with the stars that rank it. The stars are
 * read here rather than from a key by the caller because a sound no longer *has* a key of its own:
 * `soundStars` derives it from the words (and the retired `sound:<ph>` value, kept as a floor), so
 * asking storage for `sound:<ph>` would tell a Phase 9 child they had never practised a sound in
 * their life and quietly drop every sound out of review.
 */
function attemptedPool(day: string): Attempted[] {
  const pool: Attempted[] = []
  const add = (stars: number, level: number, item: LessonItem) => pool.push({ stars, item, level })

  for (const s of STORIES) {
    add(getStars(`story:${s.id}`), 0, reviewItem(s.id, `/story/${s.id}`, 'story', s.titleVi))
    add(getStars(`retell:${s.id}`), 0, reviewItem(`retell:${s.id}`, `/story/${s.id}/retell`, 'sentence', s.titleVi))
  }
  for (const s of SENTENCES) {
    add(getStars(`sentence:${s.id}`), 0, reviewItem(s.id, `/sentence/${s.id}`, 'sentence', s.words.join(' ')))
  }
  // A sound is reviewed the way it is now practised: one word, the weakest of the group, by the
  // same rule the 🗣️ step uses — and the id is that card's, which is what the screen logs.
  for (const g of SOUNDS) {
    const card = weakestWord(g, day)
    if (card) add(soundStars(g.ph), 1, reviewItem(card.id, `/sound/${g.ph}/${card.id}`, 'speak', card.text))
  }
  // Only word-pop cards earn stars under their bare card id; sound-zoo progress is per word, under
  // `sword:<cardId>`, which `soundStars` folds into the sound above.
  for (const c of wordPopCards()) {
    add(getStars(c.id), 2, reviewItem(c.id, `/practice/${c.id}`, 'speak', c.text))
  }
  for (const p of PAIRS) {
    add(getStars(`pair:${p.id}`), 3, reviewItem(p.id, `/pair/${p.id}`, 'speak', `${p.a.word}, ${p.b.word}`))
  }
  for (const s of SENTENCE_STARS) {
    add(getStars(`sstar:${s.id}`), 4, reviewItem(s.id, `/star/${s.id}`, 'speak', s.text))
  }
  for (const v of STORY_VOICE) {
    add(getStars(`voice:${v.id}`), 5, reviewItem(v.id, `/voice/${v.id}`, 'speak', firstSentence(v.text)))
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
    const attempted = attemptedPool(day)
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

  const order = dayTopicOrder(day)
  const pool = newWordPool(day, order)
  const words = pool.slice(0, recipe.word)
  for (const w of words) add(wordItem(w))

  // Mixing rule 1 for the 🧱 slot: the pool puts the islands today's words did not reach first, so
  // a day of three word slots and four open islands still touches all four.
  const spent = new Set<TopicId>(words.map(w => w.topic))
  for (const s of sentencePool(day, order, spent).slice(0, recipe.sentence)) add(sentenceItem(s))

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
