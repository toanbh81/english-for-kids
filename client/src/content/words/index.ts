import animals from './animals.json'
import food from './food.json'
import school from './school.json'
import family from './family.json'
import weather from './weather.json'
import colors from './colors.json'
import body from './body.json'
import toys from './toys.json'
import type { Word, WordTopic } from './types'

export const TOPICS: WordTopic[] = [
  animals as WordTopic,
  food as WordTopic,
  school as WordTopic,
  family as WordTopic,
  weather as WordTopic,
  colors as WordTopic,
  body as WordTopic,
  toys as WordTopic,
]
export const ALL_WORDS: Word[] = TOPICS.flatMap(t => t.words)
export const findTopic = (id: string): WordTopic | undefined => TOPICS.find(t => t.id === id)
export const findWord = (id: string): Word | undefined => ALL_WORDS.find(w => w.id === id)
