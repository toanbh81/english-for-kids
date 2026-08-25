import { deckComplete, topicStars, topicUnlocked, unlockedTopics, unlockedWords } from './topicProgress'
import { promote } from './leitner'
import { setStars } from './store'
import { TOPICS as WORD_DECKS } from '../content/words'
import type { TopicId } from '../content/topics'

const BASE = new Date('2026-08-24T10:00:00').getTime()

beforeEach(() => localStorage.clear())

/** Unlock `n` words of a deck the way WordCard does — a Leitner promotion. */
function learn(topic: TopicId, n: number) {
  const words = WORD_DECKS.find(d => d.id === topic)?.words ?? []
  for (const w of words.slice(0, n)) promote(w.id, BASE)
}

/** Phase 9 §3: the mission mixes across every open island, so a fresh profile needs more than one
 * island to mix. The first four are open on day one; the chain starts at the fifth. */
it('the first four topics are unlocked and the rest start locked', () => {
  expect(unlockedTopics()).toEqual(['animals', 'food', 'school', 'family'])
  expect(topicUnlocked('animals')).toBe(true)
  expect(topicUnlocked('family')).toBe(true)
  expect(topicUnlocked('weather')).toBe(false)
  expect(topicUnlocked('toys')).toBe(false)
})

it('the fifth topic unlocks once the fourth deck reaches 6 of 8 words', () => {
  learn('family', 5)
  expect(topicUnlocked('weather')).toBe(false)

  learn('family', 6)
  expect(topicUnlocked('weather')).toBe(true)
  expect(topicUnlocked('colors')).toBe(false)
  expect(unlockedTopics()).toEqual(['animals', 'food', 'school', 'family', 'weather'])
})

it('every later topic keeps the same 6 of 8 chain', () => {
  learn('family', 6)
  learn('weather', 6)
  expect(topicUnlocked('colors')).toBe(true)
  expect(topicUnlocked('body')).toBe(false)

  learn('colors', 6)
  expect(topicUnlocked('body')).toBe(true)
  expect(topicUnlocked('toys')).toBe(false)
})

it('migration: a topic with existing progress stays open even out of order', () => {
  learn('toys', 1)
  expect(topicUnlocked('toys')).toBe(true)
  expect(topicUnlocked('weather')).toBe(false)
  expect(unlockedTopics()).toEqual(['animals', 'food', 'school', 'family', 'toys'])
})

it('migration: a topic sentence with stars opens the topic', () => {
  setStars('sentence:s17', 2) // a weather sentence
  expect(topicUnlocked('weather')).toBe(true)
  expect(unlockedTopics()).toEqual(['animals', 'food', 'school', 'family', 'weather'])
})

it('island stars follow the word deck: 0 / >=1 / >=6 / all 8', () => {
  expect(topicStars('animals')).toBe(0)
  learn('animals', 1)
  expect(topicStars('animals')).toBe(1)
  learn('animals', 5)
  expect(topicStars('animals')).toBe(1)
  learn('animals', 6)
  expect(topicStars('animals')).toBe(2)
  learn('animals', 8)
  expect(topicStars('animals')).toBe(3)
  expect(unlockedWords('animals')).toBe(8)
  expect(deckComplete('animals')).toBe(true)
})

it('opens every island once each deck is finished', () => {
  for (const id of ['animals', 'food', 'school', 'family', 'weather', 'colors', 'body', 'toys'] as const) {
    learn(id, 8)
  }
  expect(unlockedTopics()).toHaveLength(8)
})
