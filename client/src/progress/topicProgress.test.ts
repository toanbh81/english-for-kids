import { currentTopic, deckComplete, topicStars, topicUnlocked, unlockedTopics, unlockedWords } from './topicProgress'
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

it('animals is always unlocked and the rest start locked', () => {
  expect(unlockedTopics()).toEqual(['animals'])
  expect(topicUnlocked('animals')).toBe(true)
  expect(topicUnlocked('food')).toBe(false)
  expect(topicUnlocked('weather')).toBe(false)
})

it('a topic unlocks once the previous deck reaches 6 of 8 words', () => {
  learn('animals', 5)
  expect(topicUnlocked('food')).toBe(false)

  learn('animals', 6)
  expect(topicUnlocked('food')).toBe(true)
  expect(topicUnlocked('school')).toBe(false)
  expect(unlockedTopics()).toEqual(['animals', 'food'])
})

it('migration: a topic with existing progress stays open even out of order', () => {
  learn('family', 1)
  expect(topicUnlocked('family')).toBe(true)
  expect(topicUnlocked('school')).toBe(false)
})

it('migration: a topic sentence with stars opens the topic', () => {
  setStars('sentence:s17', 2) // a weather sentence
  expect(topicUnlocked('weather')).toBe(true)
  expect(unlockedTopics()).toEqual(['animals', 'weather'])
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

it('currentTopic is the first unlocked topic with an unfinished deck', () => {
  expect(currentTopic()).toBe('animals')

  learn('animals', 8)
  expect(currentTopic()).toBe('food') // animals done, food now open

  learn('food', 8)
  expect(currentTopic()).toBe('school')
})

it('currentTopic falls back to the last unlocked topic when every open deck is finished', () => {
  learn('animals', 8)
  learn('food', 8)
  learn('school', 8)
  learn('family', 8)
  learn('weather', 8)
  learn('colors', 8)
  learn('body', 8)
  learn('toys', 8)
  expect(unlockedTopics()).toHaveLength(8)
  expect(currentTopic()).toBe('toys')
})
