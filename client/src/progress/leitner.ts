const KEY = 'speakup.leitner'
const DAY_MS = 24 * 60 * 60 * 1000

export type LeitnerEntry = { box: 1 | 2 | 3 | 4; due: number }
export const INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 14 } as const

type LeitnerMap = Record<string, LeitnerEntry>

// Corrupt or unavailable storage (private mode, hand-edited value) must not crash the app.
const read = (): LeitnerMap => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as LeitnerMap }
  catch { return {} }
}
const write = (m: LeitnerMap) => {
  try { localStorage.setItem(KEY, JSON.stringify(m)) }
  catch { /* ignore: storage unavailable */ }
}

export function getBox(wordId: string): 0 | 1 | 2 | 3 | 4 {
  return read()[wordId]?.box ?? 0
}

export function promote(wordId: string, now = Date.now()): LeitnerEntry {
  const m = read()
  const current = m[wordId]?.box ?? 0
  const next = (current >= 4 ? 4 : current + 1) as 1 | 2 | 3 | 4
  const entry: LeitnerEntry = { box: next, due: now + INTERVAL_DAYS[next] * DAY_MS }
  m[wordId] = entry
  write(m)
  return entry
}

export function demote(wordId: string, now = Date.now()): LeitnerEntry {
  const m = read()
  const entry: LeitnerEntry = { box: 1, due: now + INTERVAL_DAYS[1] * DAY_MS }
  m[wordId] = entry
  write(m)
  return entry
}

export function dueWords(now = Date.now()): string[] {
  return Object.entries(read())
    .filter(([, entry]) => entry.due <= now)
    .map(([wordId]) => wordId)
}

export function unlockedCount(): number {
  return Object.keys(read()).length
}

export function clearLeitner(): void {
  try { localStorage.removeItem(KEY) }
  catch { /* ignore: storage unavailable */ }
}
