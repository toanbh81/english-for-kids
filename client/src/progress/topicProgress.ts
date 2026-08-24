import { TOPICS } from '../content/topics'
import type { TopicId } from '../content/topics'
import { TOPICS as WORD_DECKS } from '../content/words'
import { SENTENCES } from '../content'
import { getBox } from './leitner'
import { getStars } from './store'

/** Words a topic deck holds — the unlock and star rules are both "x of 8". */
const DECK_SIZE = 8
/** A topic opens once the previous deck is this far along (spec §2). */
const UNLOCK_AT = 6

const deckWordIds = (id: TopicId): string[] =>
  WORD_DECKS.find(d => d.id === id)?.words.map(w => w.id) ?? []

/** How many of a topic's words the child has unlocked in Leitner (box > 0). */
export function unlockedWords(id: TopicId): number {
  return deckWordIds(id).filter(w => getBox(w) > 0).length
}

/**
 * Phase 7 draws the map from Leitner progress, but children who played phases 1–6 have stars and
 * unlocked words in topics the new unlock chain would hide. The update must never take content
 * away, so any trace of progress in a topic — an unlocked word, a sentence with stars — opens it
 * regardless of the chain (spec §2, migration exception).
 */
function hasProgress(id: TopicId): boolean {
  if (unlockedWords(id) > 0) return true
  return SENTENCES.some(s => s.topic === id && getStars(`sentence:${s.id}`) > 0)
}

export function topicUnlocked(id: TopicId): boolean {
  const index = TOPICS.findIndex(t => t.id === id)
  if (index < 0) return false
  if (index === 0) return true // animals is always open
  if (hasProgress(id)) return true
  return unlockedWords(TOPICS[index - 1].id) >= UNLOCK_AT
}

export function unlockedTopics(): TopicId[] {
  return TOPICS.filter(t => topicUnlocked(t.id)).map(t => t.id)
}

/** Island stars: 0 none unlocked, ≥1 → 1★, ≥6 → 2★, all 8 → 3★ (spec §2). */
export function topicStars(id: TopicId): 0 | 1 | 2 | 3 {
  const n = unlockedWords(id)
  if (n >= DECK_SIZE) return 3
  if (n >= UNLOCK_AT) return 2
  if (n >= 1) return 1
  return 0
}

export function deckComplete(id: TopicId): boolean {
  return unlockedWords(id) >= DECK_SIZE
}

/**
 * The topic the daily lesson draws new words from: the first unlocked topic, in unlock order,
 * whose deck still has something left to learn. Every unlocked deck finished → the last one open,
 * so the map still points somewhere sensible.
 */
export function currentTopic(): TopicId {
  const open = unlockedTopics()
  if (open.length === 0) return TOPICS[0].id
  return open.find(id => !deckComplete(id)) ?? open[open.length - 1]
}
