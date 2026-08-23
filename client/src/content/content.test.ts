import { LEVELS, PAIRS, findPair, SENTENCE_STARS, findSentenceStar, STORY_VOICE, findVoice } from './index'
import { SOUNDS, findSound } from './sounds'
import { PHONEME_TIPS } from '../scoring/feedback'

const SOUND_ORDER = ['th', 'dh', 'v', 'f', 'z', 'sh', 'ch', 'r', 'l']

function soundZooCards() {
  const level = LEVELS.find(l => l.id === 'sound-zoo')
  if (!level) throw new Error('sound-zoo level missing')
  return level.cards
}

it('sound-zoo has 27 cards with unique ids', () => {
  const cards = soundZooCards()
  expect(cards).toHaveLength(27)
  expect(new Set(cards.map(c => c.id)).size).toBe(27)
})

it('groups into 9 sounds of exactly 3 words each, in the spec order', () => {
  const cards = soundZooCards()
  const byPhoneme = SOUND_ORDER.map(ph => cards.filter(c => c.targetPhoneme === ph))
  for (const group of byPhoneme) expect(group).toHaveLength(3)

  // The cards themselves are laid out group-by-group in SOUND_ORDER, not interleaved.
  const orderSeen = cards.map(c => c.targetPhoneme)
  const expectedOrder = SOUND_ORDER.flatMap(ph => [ph, ph, ph])
  expect(orderSeen).toEqual(expectedOrder)
})

it('every sound-zoo card targets a known PHONEME_TIPS key', () => {
  for (const card of soundZooCards()) {
    expect(card.targetPhoneme).toBeDefined()
    expect(Object.keys(PHONEME_TIPS)).toContain(card.targetPhoneme)
  }
})

it('every sound-zoo card has an audio path matching /audio/<text>.mp3', () => {
  for (const card of soundZooCards()) {
    expect(card.audio).toBe(`/audio/${card.text}.mp3`)
  }
})

/** Every sample is generated with an American voice (en-US-JennyNeural), so a British-only
 * transcription under the word contradicts the audio the child is copying. /ɒ/ is the giveaway:
 * it exists in RP and not in General American, where the same words take /ɑː/. */
it('transcribes every sound-zoo word in the same American accent as its audio', () => {
  for (const card of soundZooCards()) {
    expect(card.ipa).not.toContain('ɒ')
  }
})

it('SOUNDS mirrors the spec order with the right IPA and example word', () => {
  expect(SOUNDS.map(s => s.ph)).toEqual(SOUND_ORDER)
  const expectedIpa: Record<string, string> = { th: 'θ', dh: 'ð', v: 'v', f: 'f', z: 'z', sh: 'ʃ', ch: 'tʃ', r: 'r', l: 'l' }
  for (const group of SOUNDS) {
    expect(group.ipa).toBe(expectedIpa[group.ph])
    expect(group.cards).toHaveLength(3)
    expect(group.example).toBe(group.cards[0].text)
  }
})

it('findSound resolves a known phoneme and returns undefined for an unknown one', () => {
  expect(findSound('th')?.example).toBe('three')
  expect(findSound('nope')).toBeUndefined()
})

it('has 8 minimal pairs with unique ids', () => {
  expect(PAIRS).toHaveLength(8)
  expect(new Set(PAIRS.map(p => p.id)).size).toBe(8)
})

it('all 16 minimal-pair words are distinct', () => {
  const words = PAIRS.flatMap(p => [p.a.word, p.b.word])
  expect(words).toHaveLength(16)
  expect(new Set(words).size).toBe(16)
})

it('every minimal-pair word has audio under /audio/pairs/', () => {
  for (const p of PAIRS) {
    expect(p.a.audio).toBe(`/audio/pairs/${p.a.word}.mp3`)
    expect(p.b.audio).toBe(`/audio/pairs/${p.b.word}.mp3`)
  }
})

it('findPair resolves a known id and returns undefined for an unknown one', () => {
  expect(findPair('pair-ship-sheep')?.contrast).toBe('ɪ/iː')
  expect(findPair('nope')).toBeUndefined()
})

it('has 10 sentence stars with unique ids, 4-8 words each', () => {
  expect(SENTENCE_STARS).toHaveLength(10)
  expect(new Set(SENTENCE_STARS.map(s => s.id)).size).toBe(10)
  for (const s of SENTENCE_STARS) {
    expect(s.words.length).toBeGreaterThanOrEqual(4)
    expect(s.words.length).toBeLessThanOrEqual(8)
  }
})

it('every sentence star has stress and link indexes in range, with adjacent links', () => {
  for (const s of SENTENCE_STARS) {
    expect(s.stress.length).toBeGreaterThan(0)
    for (const i of s.stress) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(s.words.length)
    }
    for (const [a, b] of s.link ?? []) {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(s.words.length)
      expect(b).toBe(a + 1)
    }
  }
})

it('every sentence star has audio under /audio/stars/', () => {
  for (const s of SENTENCE_STARS) {
    expect(s.audio).toBe(`/audio/stars/${s.id}.mp3`)
  }
})

it('findSentenceStar resolves a known id and returns undefined for an unknown one', () => {
  expect(findSentenceStar('ss1')?.text).toBe('I have a red apple.')
  expect(findSentenceStar('nope')).toBeUndefined()
})

const VALID_MOODS = ['happy', 'surprised', 'question', 'sad', 'excited', 'calm']

it('has 8 story-voice passages with unique ids, valid moods and 2-3 sentences', () => {
  expect(STORY_VOICE).toHaveLength(8)
  expect(new Set(STORY_VOICE.map(v => v.id)).size).toBe(8)
  for (const v of STORY_VOICE) {
    expect(VALID_MOODS).toContain(v.mood)
    const sentenceCount = (v.text.match(/[.!?]/g) ?? []).length
    expect(sentenceCount).toBeGreaterThanOrEqual(2)
    expect(sentenceCount).toBeLessThanOrEqual(3)
  }
})

it('every story-voice passage has audio under /audio/voice/', () => {
  for (const v of STORY_VOICE) {
    expect(v.audio).toBe(`/audio/voice/${v.id}.mp3`)
  }
})

it('findVoice resolves a known id and returns undefined for an unknown one', () => {
  expect(findVoice('sv1')?.mood).toBe('happy')
  expect(findVoice('nope')).toBeUndefined()
})
