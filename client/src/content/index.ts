import soundZoo from './sound-zoo.json'
import wordPop from './word-pop.json'
import sentencesData from './sentences.json'
import pairsData from './minimal-pairs.json'
import sentenceStarsData from './sentence-stars.json'
import storyVoiceData from './story-voice.json'
import type { Level, PairItem, SentenceStar, VoicePassage } from './types'
export const LEVELS: Level[] = [soundZoo as Level, wordPop as Level]
export const findCard = (id: string) => LEVELS.flatMap(l => l.cards).find(c => c.id === id)

export const PAIRS: PairItem[] = pairsData as PairItem[]
export const findPair = (id: string): PairItem | undefined => PAIRS.find(p => p.id === id)

export { SOUNDS, findSound } from './sounds'

export type Sentence = { id: string; topic: 'food' | 'school' | 'family'; words: string[]; vi: string; audio: string }
export const SENTENCES: Sentence[] = sentencesData as Sentence[]
export const findSentence = (id: string): Sentence | undefined => SENTENCES.find(s => s.id === id)

export type { SentenceStar, VoicePassage } from './types'
export const SENTENCE_STARS: SentenceStar[] = sentenceStarsData as SentenceStar[]
export const findSentenceStar = (id: string): SentenceStar | undefined => SENTENCE_STARS.find(s => s.id === id)

export const STORY_VOICE: VoicePassage[] = storyVoiceData as VoicePassage[]
export const findVoice = (id: string): VoicePassage | undefined => STORY_VOICE.find(v => v.id === id)
