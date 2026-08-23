import { TOPICS, ALL_WORDS, findTopic, findWord } from './index'

it('has 3 topics of 8 words each, 24 words total', () => {
  expect(TOPICS).toHaveLength(3)
  for (const t of TOPICS) expect(t.words).toHaveLength(8)
  expect(ALL_WORDS).toHaveLength(24)
})

it('has unique word ids formatted as <topic>-<word>', () => {
  const ids = ALL_WORDS.map(w => w.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const w of ALL_WORDS) expect(w.id).toBe(`${w.topic}-${w.word}`)
})

it('every word has an audio path under /audio/words/', () => {
  for (const w of ALL_WORDS) expect(w.audio).toBe(`/audio/words/${w.word}.mp3`)
})

/** The samples are generated with an American voice, so a British-only /ɒ/ under the word would
 * contradict the audio the child is copying — General American uses /ɑː/ there. */
it('transcribes every word in the same American accent as its audio', () => {
  for (const w of ALL_WORDS) expect(w.ipa).not.toContain('ɒ')
})

it('every word has a non-empty Vietnamese meaning and an English example sentence', () => {
  for (const w of ALL_WORDS) {
    expect(w.vi.length).toBeGreaterThan(0)
    const wordCount = w.example.trim().split(/\s+/).length
    expect(wordCount).toBeGreaterThanOrEqual(3)
    expect(wordCount).toBeLessThanOrEqual(5)
  }
})

it('findTopic finds a topic by id and findWord finds a word by id', () => {
  expect(findTopic('food')?.title).toBe('Đồ ăn')
  expect(findTopic('nope')).toBeUndefined()
  expect(findWord('food-apple')?.word).toBe('apple')
  expect(findWord('nope')).toBeUndefined()
})
