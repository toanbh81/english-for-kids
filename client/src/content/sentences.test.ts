import { SENTENCES, findSentence } from './index'

it('has 12 sentences with unique ids', () => {
  expect(SENTENCES).toHaveLength(12)
  expect(new Set(SENTENCES.map(s => s.id)).size).toBe(12)
})

it('has exactly 4 sentences per topic (food, school, family)', () => {
  const counts = { food: 0, school: 0, family: 0 }
  for (const s of SENTENCES) counts[s.topic]++
  expect(counts).toEqual({ food: 4, school: 4, family: 4 })
})

it('every sentence\'s words join into text ending with a period', () => {
  for (const s of SENTENCES) expect(s.words.join(' ')).toMatch(/\.$/)
})

it('every sentence has a Vietnamese translation and an audio path', () => {
  for (const s of SENTENCES) {
    expect(s.vi.length).toBeGreaterThan(0)
    expect(s.audio).toBe(`/audio/sentences/${s.id}.mp3`)
  }
})

it('findSentence resolves a known id and returns undefined for an unknown one', () => {
  expect(findSentence('s1')?.words.join(' ')).toBe('I eat an apple.')
  expect(findSentence('nope')).toBeUndefined()
})
