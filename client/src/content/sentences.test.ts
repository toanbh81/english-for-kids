import { SENTENCES, findSentence } from './index'

it('has 20 sentences with unique ids', () => {
  expect(SENTENCES).toHaveLength(20)
  expect(new Set(SENTENCES.map(s => s.id)).size).toBe(20)
})

it('has exactly 4 sentences per topic (animals, food, school, family, weather)', () => {
  const counts = { animals: 0, food: 0, school: 0, family: 0, weather: 0 }
  for (const s of SENTENCES) counts[s.topic]++
  expect(counts).toEqual({ animals: 4, food: 4, school: 4, family: 4, weather: 4 })
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

// The builder tells duplicate tiles apart by index, but a repeated word still makes two orderings
// look identical to a child, so content keeps every sentence duplicate-free.
it('no sentence repeats a word', () => {
  for (const s of SENTENCES) {
    expect(new Set(s.words).size, `${s.id}: ${s.words.join(' ')}`).toBe(s.words.length)
  }
})

it('findSentence resolves a known id and returns undefined for an unknown one', () => {
  expect(findSentence('s1')?.words.join(' ')).toBe('I eat an apple.')
  expect(findSentence('nope')).toBeUndefined()
})
