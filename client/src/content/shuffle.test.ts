import { shuffleTiles, seededSide } from './shuffle'

it('is deterministic: the same seed always produces the same order', () => {
  const words = ['I', 'eat', 'an', 'apple.']
  expect(shuffleTiles(words, 's1')).toEqual(shuffleTiles(words, 's1'))
})

it('different seeds can produce different orders', () => {
  const words = ['I', 'eat', 'an', 'apple.']
  // Any single pair of ids could coincidentally land on the same order, so check across a spread
  // of ids that at least two distinct orders show up rather than asserting on one fixed pair.
  const orders = new Set(Array.from({ length: 20 }, (_, i) => shuffleTiles(words, `s${i}`).join(' ')))
  expect(orders.size).toBeGreaterThan(1)
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

describe('seededSide', () => {
  const run = (id: string, n: number) => Array.from({ length: n }, (_, i) => seededSide(id, i, ['a', 'b'] as const))

  it('gives the same id the same sequence every time', () => {
    expect(run('pair-ship-sheep', 20)).toEqual(run('pair-ship-sheep', 20))
  })

  it('uses both sides and does not alternate', () => {
    const seq = run('pair-ship-sheep', 12)
    expect(new Set(seq)).toEqual(new Set(['a', 'b']))
    expect(seq.some((s, i) => i > 0 && s === seq[i - 1])).toBe(true)
  })

  /** Unpredictability must not cost the contrast: five of the same word in a row is a run a
   * seeded stream will produce sooner or later, and a child who never hears the other side has
   * nothing to compare against. Two in a row is the cap. */
  it('never repeats a side more than twice in a row', () => {
    for (let i = 0; i < 200; i++) {
      const seq = run(`seed-${i}`, 40)
      const tripled = seq.some((s, j) => j >= 2 && s === seq[j - 1] && s === seq[j - 2])
      expect(tripled, `seed-${i} drew ${seq.join('')}`).toBe(false)
    }
  })

  it('puts both sides inside any four consecutive draws', () => {
    for (let i = 0; i < 200; i++) {
      const seq = run(`seed-${i}`, 40)
      for (let j = 0; j + 4 <= seq.length; j++) {
        expect(new Set(seq.slice(j, j + 4)).size, `seed-${i} at ${j}`).toBe(2)
      }
    }
  })

  it('different ids get different sequences', () => {
    const orders = new Set(Array.from({ length: 20 }, (_, i) => run(`pair-${i}`, 8).join('')))
    expect(orders.size).toBeGreaterThan(1)
  })
})
