import { findSound } from '../content'
import { onStoreWrite, storageKey } from './storageKeys'

// Resolved per call, never captured: the active child is only known once the app has booted.
const starsKey = () => storageKey('stars')
type StarMap = Record<string, 1 | 2 | 3>
// Corrupt or unavailable storage (private mode, hand-edited value) must not crash the app.
const read = (): StarMap => {
  try { return JSON.parse(localStorage.getItem(starsKey()) ?? '{}') as StarMap }
  catch { return {} }
}
export function getStars(id: string): 0 | 1 | 2 | 3 { return read()[id] ?? 0 }
export function setStars(id: string, stars: 1 | 2 | 3) {
  const m = read()
  if ((m[id] ?? 0) < stars) {
    m[id] = stars
    const key = starsKey()
    localStorage.setItem(key, JSON.stringify(m))
    onStoreWrite(key)
  }
}
export function totalStars() { return Object.values(read()).reduce((s, v) => s + v, 0) }

/**
 * A sound's stars, derived from its words (Phase 9 §1) — never stored.
 *
 * Since `/sound/:ph` became a word list, each word carries its own `sword:<cardId>` stars and the
 * sound is only as good as its WEAKEST word: the tile and the stairs keep meaning "all three words
 * are green", and an unpractised word holds the sound at 0.
 *
 * Lives here rather than in `content/sounds.ts` because it is a progress question (it reads
 * storage) that merely happens to need the sound's card list; `content/` stays storage-free.
 *
 * The old 3-word run wrote a single `sound:<ph>` key. Nothing writes it any more, but a returning
 * child still has it, and deriving 0 from words they never practised individually would look like
 * the app had wiped their progress — so the legacy value stays as a read-only floor.
 */
export function soundStars(ph: string): 0 | 1 | 2 | 3 {
  const cards = findSound(ph)?.cards ?? []
  const derived = cards.reduce<0 | 1 | 2 | 3>(
    (worst, c) => { const s = getStars(`sword:${c.id}`); return s < worst ? s : worst },
    cards.length ? 3 : 0,
  )
  const legacy = getStars(`sound:${ph}`)
  return derived > legacy ? derived : legacy
}
export function clearStars(): void {
  try { localStorage.removeItem(starsKey()) }
  catch { /* ignore: storage unavailable */ }
}
