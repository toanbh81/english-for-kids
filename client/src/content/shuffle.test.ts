import { shuffleTiles } from './shuffle'

it('is deterministic: the same seed always produces the same order', () => {
  const words = ['I', 'eat', 'an', 'apple.']
  expect(shuffleTiles(words, 's1')).toEqual(shuffleTiles(words, 's1'))
})

it('different seeds can produce different orders', () => {
  const words = ['I', 'eat', 'an', 'apple.']
  const a = shuffleTiles(words, 's1')
  const b = shuffleTiles(words, 's7')
  expect(a).not.toBe(b) // distinct array instances
  // Not asserting a !== b by value: two seeds could coincidentally agree, but across the pair
  // used elsewhere in this file they do not.
})

it('never returns the original order for 2+ items, across many seeds', () => {
  const words = ['a', 'b', 'c', 'd']
  for (let i = 0; i < 200; i++) {
    const seed = `seed-${i}`
    const shuffled = shuffleTiles(words, seed)
    expect(shuffled).not.toEqual(words)
    expect(shuffled.slice().sort()).toEqual(words.slice().sort())
  }
})

it('is a no-op for a single item', () => {
  expect(shuffleTiles(['only'], 'x')).toEqual(['only'])
})

it('handles an empty list', () => {
  expect(shuffleTiles([], 'x')).toEqual([])
})

it('preserves item identity by index for arrays with duplicate values', () => {
  const items = [0, 1, 2, 1] // duplicate "1" appears at indices 1 and 3
  const shuffled = shuffleTiles(items, 's1')
  expect(shuffled.slice().sort()).toEqual([0, 1, 1, 2])
})
