import type { Lesson } from './lessonStore'
import { lessonDone, lessonForDay } from './lessonStore'
import { ACTIVITY_CAP, onStoreWrite, storageKey } from './storageKeys'

// Resolved per call, never captured: the active child is only known once the app has booted.
const activityKey = () => storageKey('activity')
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
  try {
    const key = activityKey()
    localStorage.setItem(key, JSON.stringify(events))
    // The one announcement the sync engine hears; it turns into rows in `events` (never into a kv
    // value — the log outgrows kv's 16 KB ceiling). See progress/storageKeys.ts.
    onStoreWrite(key)
  } catch { /* ignore: storage unavailable */ }
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
  if (events.length > ACTIVITY_CAP) events.splice(0, events.length - ACTIVITY_CAP)
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
 * Where a day's lesson record comes from, when one is needed at all.
 *
 * The default, `lessonForDay`, reads THIS DEVICE's localStorage under whichever profile is
 * currently active — which is exactly right for every local query below, and exactly wrong for
 * Phase 11's remote dashboard (`cloud/remote.ts`). A remote view computes another profile's stats
 * from events fetched off the server; if `dayIsDone` fell through to the default lookup regardless,
 * it would silently score that profile's "day done" against whichever lesson record happens to sit
 * under the ACTIVE LOCAL profile's namespace — a different child, or no lesson at all, depending on
 * what this device happens to be doing. That is not a slightly-off answer, it is a fabricated one,
 * and the caller has no way to tell it apart from the truth. So a caller with no access to the
 * remote profile's lesson kv rows passes `() => null` explicitly, which is a real, honest fallback:
 * `dayIsDone` still has the legacy per-day counters (1 story, 5 speak, 3 word) to fall back on —
 * they are computed from the SAME events array — it only loses the newer "finished today's
 * generated lesson" rule for days a shorter lesson would otherwise have covered.
 */
export type LessonLookup = (day: string) => Lesson | null

/**
 * A day is done when the legacy counters hold **or** that day's generated lesson is finished
 * (spec §4, mission compatibility). Both directions matter: streaks earned before Phase 7 keep
 * counting, and a short lesson the child actually completed counts even though it asks for fewer
 * than 5 speaks. `dayEvents` must already be filtered to `day`.
 */
function dayIsDone(day: string, dayEvents: ActivityEvent[], lessonLookup: LessonLookup = lessonForDay): boolean {
  if (isDone(countsForDay(dayEvents))) return true
  const lesson = lessonLookup(day)
  return lesson !== null && lessonDone(lesson, dayEvents)
}

// Every query takes the event log as an optional trailing argument so a screen can read storage
// once per render and share the same array across all of its queries.
export function missionStatus(now = Date.now(), events = getActivity()): { story: number; speak: number; word: number; done: boolean } {
  const key = dayKey(now)
  const today = events.filter(e => dayKey(e.ts) === key)
  return { ...countsForDay(today), done: dayIsDone(key, today) }
}

export function completedDays(events = getActivity(), lessonLookup: LessonLookup = lessonForDay): Set<string> {
  const byDay = new Map<string, ActivityEvent[]>()
  for (const e of events) {
    const key = dayKey(e.ts)
    const list = byDay.get(key)
    if (list) list.push(e)
    else byDay.set(key, [e])
  }
  const done = new Set<string>()
  for (const [key, events] of byDay) {
    if (dayIsDone(key, events, lessonLookup)) done.add(key)
  }
  return done
}

export function streak(now = Date.now(), events = getActivity(), lessonLookup: LessonLookup = lessonForDay): number {
  const done = completedDays(events, lessonLookup)
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

export function weekDots(
  now = Date.now(),
  events = getActivity(),
  lessonLookup: LessonLookup = lessonForDay,
): { day: string; done: boolean; isToday: boolean }[] {
  const d = new Date(now)
  const mondayOffset = (d.getDay() + 6) % 7 // 0=Mon ... 6=Sun
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset)
  const done = completedDays(events, lessonLookup)
  const todayKey = dayKey(now)
  const dots: { day: string; done: boolean; isToday: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const key = dayKey(dt.getTime())
    dots.push({ day: key, done: done.has(key), isToday: key === todayKey })
  }
  return dots
}

/** The longest run of consecutive completed days on record — unlike `streak()`, it does not need
 * to end today, so a child's best-ever run stays visible even after a day off breaks it. */
export function longestStreak(events = getActivity(), lessonLookup: LessonLookup = lessonForDay): number {
  const days = [...completedDays(events, lessonLookup)].sort()
  let best = 0
  let run = 0
  let prev: number | null = null
  for (const d of days) {
    const t = new Date(d + 'T00:00:00').getTime()
    run = prev !== null && Math.round((t - prev) / DAY_MS) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = t
  }
  return best
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
