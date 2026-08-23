import { LEVELS, PAIRS, findPair } from './index'
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
