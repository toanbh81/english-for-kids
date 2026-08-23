import { starsForSentence, starsForVoice } from './levelStars'
import type { PronunciationResult } from './types'

const base = (over: Partial<PronunciationResult>): PronunciationResult => ({
  overall: 0, accuracy: 0, fluency: 0, completeness: 0, words: [], engine: 'azure', ...over,
})

describe('starsForSentence', () => {
  it('gives 3 stars when accuracy, fluency and completeness are all >= 80', () => {
    expect(starsForSentence(base({ accuracy: 80, fluency: 80, completeness: 80 }))).toBe(3)
    expect(starsForSentence(base({ accuracy: 95, fluency: 90, completeness: 100 }))).toBe(3)
  })
  it('drops to 2 stars when fluency is short even if accuracy/completeness qualify for 3', () => {
    expect(starsForSentence(base({ accuracy: 90, fluency: 70, completeness: 90 }))).toBe(2)
  })
  it('gives 2 stars when accuracy and completeness are both >= 60 but not >= 80', () => {
    expect(starsForSentence(base({ accuracy: 60, fluency: 0, completeness: 60 }))).toBe(2)
    expect(starsForSentence(base({ accuracy: 70, fluency: 50, completeness: 65 }))).toBe(2)
  })
  it('gives 1 star when accuracy or completeness is below 60', () => {
    expect(starsForSentence(base({ accuracy: 59, fluency: 90, completeness: 90 }))).toBe(1)
    expect(starsForSentence(base({ accuracy: 90, fluency: 90, completeness: 59 }))).toBe(1)
    expect(starsForSentence(base({ accuracy: 10, fluency: 10, completeness: 10 }))).toBe(1)
  })
})

describe('starsForVoice', () => {
  it('caps at 2 stars for the Web Speech engine, even with a high accuracy', () => {
    expect(starsForVoice(base({ accuracy: 95 }), 'webspeech')).toBe(2)
    expect(starsForVoice(base({ accuracy: 59 }), 'webspeech')).toBe(1)
  })
  it('caps at 2 stars when prosody is undefined regardless of the engine label', () => {
    expect(starsForVoice(base({ accuracy: 85, engine: 'azure' }), 'azure')).toBe(2)
    expect(starsForVoice(base({ accuracy: 40, engine: 'azure' }), null)).toBe(1)
  })
  it('gives 3 stars when prosody >= 80 and accuracy >= 70', () => {
    expect(starsForVoice(base({ prosody: 90, accuracy: 80 }), 'azure')).toBe(3)
  })
  it('gives 2 stars when prosody >= 80 but accuracy is below 70', () => {
    expect(starsForVoice(base({ prosody: 85, accuracy: 60 }), 'azure')).toBe(2)
  })
  it('gives 2 stars when prosody is 60-79', () => {
    expect(starsForVoice(base({ prosody: 65, accuracy: 90 }), 'azure')).toBe(2)
  })
  it('gives 1 star when prosody is below 60', () => {
    expect(starsForVoice(base({ prosody: 40, accuracy: 90 }), 'azure')).toBe(1)
  })
})
