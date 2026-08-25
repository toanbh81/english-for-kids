import { getStars, setStars, soundStars, totalStars } from './store'

beforeEach(() => localStorage.clear())

it('stores best stars per card and sums total', () => {
  expect(getStars('a')).toBe(0)
  setStars('a', 2); setStars('a', 1)
  expect(getStars('a')).toBe(2)
  setStars('b', 3)
  expect(totalStars()).toBe(5)
})

// --- a sound's stars, derived from its words (Phase 9 §1) ------------------------------------

const words = (stars: Record<string, 1 | 2 | 3>) => {
  for (const [id, v] of Object.entries(stars)) setStars(`sword:${id}`, v)
}

it('holds a sound at 0 until every one of its words has been practised', () => {
  expect(soundStars('th')).toBe(0)
  words({ 'sz-th-three': 3, 'sz-th-thank': 3 })
  expect(soundStars('th')).toBe(0)
})

it('gives the sound its weakest word once all three are done', () => {
  words({ 'sz-th-three': 3, 'sz-th-thank': 2, 'sz-th-think': 3 })
  expect(soundStars('th')).toBe(2)

  setStars('sword:sz-th-thank', 3)
  expect(soundStars('th')).toBe(3)
})

it('counts only the sound’s own words', () => {
  words({ 'sz-th-three': 3, 'sz-th-thank': 3, 'sz-th-think': 3 })
  expect(soundStars('th')).toBe(3)
  expect(soundStars('dh')).toBe(0)
})

/** The old 3-word run wrote `sound:<ph>`; nothing writes it now, but a returning child still has
 * it and must not watch their stars vanish. */
it('keeps a legacy sound key as a floor', () => {
  setStars('sound:th', 2)
  expect(soundStars('th')).toBe(2)

  // A word list that is only partly done cannot pull the floor down…
  words({ 'sz-th-three': 3 })
  expect(soundStars('th')).toBe(2)
})

it('lets the words raise the sound above its legacy floor', () => {
  setStars('sound:th', 2)
  words({ 'sz-th-three': 3, 'sz-th-thank': 3, 'sz-th-think': 3 })
  expect(soundStars('th')).toBe(3)
})

it('is 0 for a phoneme that has no group at all', () => {
  expect(soundStars('nope')).toBe(0)
})

it('treats a corrupt stored value as empty progress', () => {
  localStorage.setItem('speakup.stars', '{not json')
  expect(getStars('a')).toBe(0)
  expect(totalStars()).toBe(0)
  setStars('a', 3)
  expect(getStars('a')).toBe(3)
})
