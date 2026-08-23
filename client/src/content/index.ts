import soundZoo from './sound-zoo.json'
import wordPop from './word-pop.json'
import sentencesData from './sentences.json'
import type { Level } from './types'
export const LEVELS: Level[] = [soundZoo as Level, wordPop as Level]
export const findCard = (id: string) => LEVELS.flatMap(l => l.cards).find(c => c.id === id)

export type Sentence = { id: string; topic: 'food' | 'school' | 'family'; words: string[]; vi: string; audio: string }
export const SENTENCES: Sentence[] = sentencesData as Sentence[]
export const findSentence = (id: string): Sentence | undefined => SENTENCES.find(s => s.id === id)
