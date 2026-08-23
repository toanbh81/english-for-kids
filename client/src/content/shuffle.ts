// Deterministic per-id PRNG (mulberry32) so the same sentence always shuffles into the same tile
// order — tests stay reproducible and a kid re-opening a sentence sees the same layout.
function mulberry32(seed: number): () => number {
  let t = seed
  return function next() {
    t |= 0
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromId(id: string): number {
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

/**
 * One of two `sides`, chosen by the `turn`-th draw (0-based) of the stream seeded by `id`.
 *
 * The same seeded-PRNG trick as `shuffleTiles`, but for a choice made over and over rather than a
 * one-off layout: Minimal Pairs picks which of a pair's two words 🔊 plays with it. A strict
 * alternation is a pattern a child spots within two rounds and then stops listening for, while a
 * real random draw would make the screen untestable — this gives a sequence with runs and repeats
 * in it that is nonetheless identical every time that id is opened.
 */
export function seededSide<T>(id: string, turn: number, sides: readonly [T, T]): T {
  const rand = mulberry32(seedFromId(id))
  let draw = rand()
  for (let i = 0; i < turn; i++) draw = rand()
  return draw < 0.5 ? sides[0] : sides[1]
}
