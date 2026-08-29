import { LEVELS, PAIRS, SENTENCE_STARS, STORY_VOICE } from '../content'
import { completedDays, dayKey, getActivity } from './activity'
import type { ActivityEvent } from './activity'
// `lessonStore`, not `lesson`: lesson generation reads the band, so importing the generator here
// would close the loop. The store sits below both.
import { itemDone, lessonForDay } from './lessonStore'
import { onStoreWrite, storageKey } from './storageKeys'
import { getStars } from './store'

/**
 * The difficulty band (spec §5): which levels the daily lesson may draw speaking practice from.
 * 1 sounds → 2 word cards → 3 minimal pairs → 4 sentence stars → 5 story voice.
 */
export type Band = 1 | 2 | 3 | 4 | 5
export type BandMode = 'auto' | 'manual'
export type BandState = { value: Band; mode: BandMode }

// Resolved per call, never captured: the active child is only known once the app has booted.
const bandKey = () => storageKey('band')
const DAY_MS = 24 * 60 * 60 * 1000
/** Three days this good in a row move the child up a band. */
const GOOD_DAYS = 3
const GOOD_SCORE = 80
/** Two days this rough in a row move the child back down. */
const BAD_DAYS = 2
const BAD_SCORE = 60

const clamp = (n: number): Band => Math.min(5, Math.max(1, Math.round(n))) as Band

const isBand = (n: unknown): n is Band => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5

/** Corrupt or unavailable storage (private mode, hand-edited value) must not crash the app. */
function read(): BandState | null {
  try {
    const raw = localStorage.getItem(bandKey())
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { value, mode } = parsed as Partial<BandState>
    if (!isBand(value)) return null
    return { value, mode: mode === 'manual' ? 'manual' : 'auto' }
  } catch { return null }
}

function write(state: BandState): void {
  try {
    const key = bandKey()
    localStorage.setItem(key, JSON.stringify(state))
    onStoreWrite(key)
  } catch { /* ignore: storage unavailable */ }
}

const wordPopCards = () => LEVELS.find(l => l.id === 'word-pop')?.cards ?? []

/**
 * First read with nothing stored: place the child where their existing stars say they already are,
 * so a returning player is never dropped back to sound tiles (spec §5).
 */
function initialBand(): Band {
  if (STORY_VOICE.some(v => getStars(`voice:${v.id}`) > 0)) return 5
  if (SENTENCE_STARS.some(s => getStars(`sstar:${s.id}`) > 0)) return 4
  if (PAIRS.some(p => getStars(`pair:${p.id}`) > 0)) return 3
  if (wordPopCards().some(c => getStars(c.id) > 0)) return 2
  return 1
}

export function getBand(): BandState {
  const stored = read()
  if (stored) return stored
  const state: BandState = { value: initialBand(), mode: 'auto' }
  write(state)
  return state
}

export function setBandValue(value: Band): void {
  write({ value: clamp(value), mode: 'manual' })
}

/** Resume automatic adjustment from wherever the parent left the band. */
export function setBandAuto(): void {
  write({ value: getBand().value, mode: 'auto' })
}

export function clearBand(): void {
  try { localStorage.removeItem(bandKey()) }
  catch { /* ignore: storage unavailable */ }
}

/** Mean of the day's scored events, or null when nothing was scored (Web Speech, listening only). */
function dayAverage(events: ActivityEvent[]): number | null {
  const scored = events.filter((e): e is ActivityEvent & { score: number } => typeof e.score === 'number')
  if (!scored.length) return null
  return scored.reduce((sum, e) => sum + e.score, 0) / scored.length
}

/**
 * Runs once per day, from lesson generation, and never in manual mode. At most one step per call
 * so the band can only drift one level a day — a child who has a great week climbs, they do not
 * teleport. The history it needs is already on disk: `completedDays` folds in the persisted
 * lessons, and the event log carries the scores.
 */
export function autoAdjustBand(now = Date.now(), events = getActivity()): void {
  const state = getBand()
  if (state.mode === 'manual') return

  const byDay = new Map<string, ActivityEvent[]>()
  for (const e of events) {
    const key = dayKey(e.ts)
    const list = byDay.get(key)
    if (list) list.push(e)
    else byDay.set(key, [e])
  }
  const done = completedDays(events)
  // Yesterday backwards: today's lesson is only being generated now, so today has no verdict yet.
  const previous = (back: number) => dayKey(now - back * DAY_MS)

  const good = (day: string) => {
    const avg = dayAverage(byDay.get(day) ?? [])
    return done.has(day) && avg !== null && avg >= GOOD_SCORE
  }
  /**
   * A bad day is one the child gave up on, not one they simply did not finish: eight of ten items
   * at 85 is a good day's work, and demoting for it punished exactly the children who were doing
   * well. So: fewer than half the lesson's items done, or a lesson they did finish with a
   * day-average under 60. Half or more done without a low average is neutral — neither good nor
   * bad — and a day with no events at all is a rest day.
   */
  const bad = (day: string) => {
    const dayEvents = byDay.get(day) ?? []
    if (!dayEvents.length) return false
    const finished = done.has(day)
    const lesson = lessonForDay(day)
    if (lesson && lesson.items.length > 0) {
      const doneCount = lesson.items.filter(i => itemDone(i, lesson, dayEvents)).length
      if (doneCount * 2 < lesson.items.length) return true
    } else if (!finished) {
      // No lesson record — a day from before Phase 7, or one whose record was pruned. The legacy
      // mission counters are then the only verdict there is: started and never finished is bad.
      return true
    }
    const avg = dayAverage(dayEvents)
    return finished && avg !== null && avg < BAD_SCORE
  }

  const upDays = Array.from({ length: GOOD_DAYS }, (_, i) => previous(i + 1))
  const downDays = Array.from({ length: BAD_DAYS }, (_, i) => previous(i + 1))

  const next = upDays.every(good) ? state.value + 1
    : downDays.every(bad) ? state.value - 1
    : state.value
  const clamped = clamp(next)
  if (clamped !== state.value) write({ value: clamped, mode: 'auto' })
}
