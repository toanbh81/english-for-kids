const KEY = 'speakup.stars'
type StarMap = Record<string, 1 | 2 | 3>
// Corrupt or unavailable storage (private mode, hand-edited value) must not crash the app.
const read = (): StarMap => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as StarMap }
  catch { return {} }
}
export function getStars(id: string): 0 | 1 | 2 | 3 { return read()[id] ?? 0 }
export function setStars(id: string, stars: 1 | 2 | 3) {
  const m = read(); if ((m[id] ?? 0) < stars) { m[id] = stars; localStorage.setItem(KEY, JSON.stringify(m)) }
}
export function totalStars() { return Object.values(read()).reduce((s, v) => s + v, 0) }
export function clearStars(): void {
  try { localStorage.removeItem(KEY) }
  catch { /* ignore: storage unavailable */ }
}
