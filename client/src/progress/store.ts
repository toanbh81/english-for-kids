const KEY = 'speakup.stars'
type StarMap = Record<string, 1 | 2 | 3>
const read = (): StarMap => JSON.parse(localStorage.getItem(KEY) ?? '{}')
export function getStars(id: string): 0 | 1 | 2 | 3 { return read()[id] ?? 0 }
export function setStars(id: string, stars: 1 | 2 | 3) {
  const m = read(); if ((m[id] ?? 0) < stars) { m[id] = stars; localStorage.setItem(KEY, JSON.stringify(m)) }
}
export function totalStars() { return Object.values(read()).reduce((s, v) => s + v, 0) }
