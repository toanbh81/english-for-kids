import { lessonDone, lessonForDay } from './lessonStore'
import { storageKey } from './storageKeys'

// Resolved per call, never captured: the active child is only known once the app has booted.
const activityKey = () => storageKey('activity')
const CAP = 2000
const MISSION_TARGET = { story: 1, speak: 5, word: 3 } as const
const WORD_MISSION_SCORE = 60 // same bar as the Leitner unlock in WordCard
const WEAK_PHONEME_SCORE = 80 // phonemes at or above this are never reported, so never stored
const SESSION_GAP_MS = 10 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type ActivityKind = 'story' | 'speak' | 'word' | 'sentence'
export type ActivityEvent = {
  ts: number
  kind: ActivityKind
  id: string
  score?: number
  phonemes?: { phoneme: string; score: number }[]
}

// Corrupt or unavailable storage (private mode, hand-edited value) must not crash the app —
// including valid JSON of the wrong shape, e.g. '{}', which would break every array query.
const read = (): ActivityEvent[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(activityKey()) ?? '[]')
    return Array.isArray(parsed) ? (parsed as ActivityEvent[]) : []
  } catch { return [] }
}
const write = (events: ActivityEvent[]) => {
  try { localStorage.setItem(activityKey(), JSON.stringify(events)) }
  catch { /* ignore: storage unavailable */ }
}

// Only weak phonemes are ever read back (weakPhonemes / the parent dashboard), and a scored
// sentence can carry dozens of them, so the good ones are dropped before they reach the 2000-entry
// log rather than filling up the child's localStorage quota.
function trimPhonemes(e: ActivityEvent): ActivityEvent {
  if (!e.phonemes) return e
  const weak = e.phonemes.filter(p => p.score < WEAK_PHONEME_SCORE)
  const { phonemes: _dropped, ...rest } = e
  return weak.length ? { ...rest, phonemes: weak } : rest
}

export function logActivity(e: ActivityEvent): void {
  const events = read()
  events.push(trimPhonemes(e))
  if (events.length > CAP) events.splice(0, events.length - CAP)
  write(events)
}

export function getActivity(sinceTs = 0): ActivityEvent[] {
  return read().filter(e => e.ts >= sinceTs)
}

export function clearActivity(): void {
  try { localStorage.removeItem(activityKey()) }
  catch { /* ignore: storage unavailable */ }
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// The "3 từ" mission step means three words actually learned, so a word attempt only counts once
// it clears the same score that unlocks the card. Unscored attempts (Web Speech fallback, which
// returns no number) still count — the child did the work either way.
function countsForDay(events: ActivityEvent[]): { story: number; speak: number; word: number } {
  const counts = { story: 0, speak: 0, word: 0 }
  for (const e of events) {
    if (e.kind === 'story') counts.story++
    else if (e.kind === 'speak') counts.speak++
    else if (e.kind === 'word' && (e.score === undefined || e.score >= WORD_MISSION_SCORE)) counts.word++
  }
  return counts
}

function isDone(counts: { story: number; speak: number; word: number }): boolean {
  return counts.story >= MISSION_TARGET.story && counts.speak >= MISSION_TARGET.speak && counts.word >= MISSION_TARGET.word
}

/**
 * A day is done when the legacy counters hold **or** that day's generated lesson is finished
 * (spec §4, mission compatibility). Both directions matter: streaks earned before Phase 7 keep
 * counting, and a short lesson the child actually completed counts even though it asks for fewer
 * than 5 speaks. `dayEvents` must already be filtered to `day`.
 */
function dayIsDone(day: string, dayEvents: ActivityEvent[]): boolean {
  if (isDone(countsForDay(dayEvents))) return true
  const lesson = lessonForDay(day)
  return lesson !== null && lessonDone(lesson, dayEvents)
}

// Every query takes the event log as an optional trailing argument so a screen can read storage
// once per render and share the same array across all of its queries.
export function missionStatus(now = Date.now(), events = getActivity()): { story: number; speak: number; word: number; done: boolean } {
  const key = dayKey(now)
  const today = events.filter(e => dayKey(e.ts) === key)
  return { ...countsForDay(today), done: dayIsDone(key, today) }
}

export function completedDays(events = getActivity()): Set<string> {
  const byDay = new Map<string, ActivityEvent[]>()
  for (const e of events) {
    const key = dayKey(e.ts)
    const list = byDay.get(key)
    if (list) list.push(e)
    else byDay.set(key, [e])
  }
  const done = new Set<string>()
  for (const [key, events] of byDay) {
    if (dayIsDone(key, events)) done.add(key)
  }
  return done
}

export function streak(now = Date.now(), events = getActivity()): number {
  const done = completedDays(events)
  let cursor = now
  if (!done.has(dayKey(cursor))) {
    cursor -= DAY_MS
    if (!done.has(dayKey(cursor))) return 0
  }
  let count = 0
  while (done.has(dayKey(cursor))) {
    count++
    cursor -= DAY_MS
  }
  return count
}

export function weekDots(now = Date.now(), events = getActivity()): { day: string; done: boolean; isToday: boolean }[] {
  const d = new Date(now)
  const mondayOffset = (d.getDay() + 6) % 7 // 0=Mon ... 6=Sun
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset)
  const done = completedDays(events)
  const todayKey = dayKey(now)
  const dots: { day: string; done: boolean; isToday: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const key = dayKey(dt.getTime())
    dots.push({ day: key, done: done.has(key), isToday: key === todayKey })
  }
  return dots
}

function sessionMinutes(events: ActivityEvent[]): number {
  const sorted = events.slice().sort((a, b) => a.ts - b.ts)
  let total = 0
  let sessionStart = -1
  let prevTs = -1
  for (const e of sorted) {
    if (sessionStart === -1) {
      sessionStart = e.ts
      prevTs = e.ts
      continue
    }
    if (e.ts - prevTs <= SESSION_GAP_MS) {
      prevTs = e.ts
      continue
    }
    total += Math.max(1, Math.round((prevTs - sessionStart) / 60000))
    sessionStart = e.ts
    prevTs = e.ts
  }
  if (sessionStart !== -1) total += Math.max(1, Math.round((prevTs - sessionStart) / 60000))
  return total
}

export function minutesPerDay(days: number, now = Date.now(), events = getActivity()): { day: string; minutes: number }[] {
  const byDay = new Map<string, ActivityEvent[]>()
  for (const e of events) {
    const key = dayKey(e.ts)
    const list = byDay.get(key)
    if (list) list.push(e)
    else byDay.set(key, [e])
  }
  const nowDate = new Date(now)
  const result: { day: string; minutes: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - i)
    const key = dayKey(dt.getTime())
    result.push({ day: key, minutes: sessionMinutes(byDay.get(key) ?? []) })
  }
  return result
}

export function minutesToday(now = Date.now(), events = getActivity()): number {
  return minutesPerDay(1, now, events)[0].minutes
}

export function weakPhonemes(n = 5, events = getActivity()): { phoneme: string; avg: number; count: number }[] {
  const agg = new Map<string, { sum: number; count: number }>()
  for (const e of events) {
    if (!e.phonemes) continue
    for (const p of e.phonemes) {
      const cur = agg.get(p.phoneme) ?? { sum: 0, count: 0 }
      cur.sum += p.score
      cur.count += 1
      agg.set(p.phoneme, cur)
    }
  }
  return Array.from(agg.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([phoneme, v]) => ({ phoneme, avg: v.sum / v.count, count: v.count }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, n)
}

export function averageScoreByKind(events = getActivity()): Record<ActivityKind, number | null> {
  const kinds: ActivityKind[] = ['story', 'speak', 'word', 'sentence']
  const result = {} as Record<ActivityKind, number | null>
  for (const kind of kinds) {
    const scored = events.filter((e): e is ActivityEvent & { score: number } => e.kind === kind && typeof e.score === 'number')
    result[kind] = scored.length ? scored.reduce((sum, e) => sum + e.score, 0) / scored.length : null
  }
  return result
}
