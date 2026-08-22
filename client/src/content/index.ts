import soundZoo from './sound-zoo.json'
import wordPop from './word-pop.json'
import type { Level } from './types'
export const LEVELS: Level[] = [soundZoo as Level, wordPop as Level]
export const findCard = (id: string) => LEVELS.flatMap(l => l.cards).find(c => c.id === id)
