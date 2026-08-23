// Deterministic per-id PRNG (mulberry32) so the same sentence always shuffles into the same tile
// order — tests stay reproducible and a kid re-opening a sentence sees the same layout.
// Exported as a pair because other screens need the same "unpredictable but fixed per id" trick:
// Minimal Pairs draws its 🔊 target from a stream seeded by the pair's id.
export function mulberry32(seed: number): () => number {
  let t = seed
  return function next() {
    t |= 0
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return h
}

/**
 * Fisher–Yates shuffle seeded deterministically from `seed` (typically the sentence id). If the
 * shuffle happens to land back on the original order, rotate by one — a "shuffled" pool that
 * looks untouched would be confusing for a kid trying to build the sentence.
 */
export function shuffleTiles<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(seedFromId(seed))
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  if (arr.length >= 2 && arr.every((item, i) => item === items[i])) {
    arr.push(arr.shift() as T)
  }
  return arr
}
