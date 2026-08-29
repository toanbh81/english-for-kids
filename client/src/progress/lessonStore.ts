import type { ActivityEvent, ActivityKind } from './activity'
import { findSound } from '../content'
import { onStoreWrite, storageKey } from './storageKeys'

/**
 * Storage and done-matching for the daily lesson, split out of `lesson.ts` so the dependency graph
 * stays a DAG: `activity.ts` needs the lesson to decide whether a day is complete, while
 * `lesson.ts` needs `activity.ts` to read the event log. This module sits under both — its only
 * link back to `activity.ts` is a type-only import, which `verbatimModuleSyntax` erases, so no
 * runtime cycle exists. Lesson *generation* (content, band, seeding) lives in `lesson.ts`.
 */

export type LessonItemKind = 'listen' | 'speak' | 'word' | 'sentence' | 'review'
export type LessonItem = {
  kind: LessonItemKind
  activity: ActivityKind
  id: string
  route: string
  label: string
  emoji: string
}
export type Lesson = { day: string; created: number; band: number; items: LessonItem[] }

export type LessonLength = 'short' | 'medium' | 'long'
export const LESSON_LENGTHS: LessonLength[] = ['short', 'medium', 'long']
const DEFAULT_LENGTH: LessonLength = 'medium'

// Resolved per call, never captured: the active child is only known once the app has booted.
const prefix = () => storageKey('lesson.')
const lengthKey = () => `${prefix()}length`
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
/**
 * Schema stamp on every persisted lesson. A record without it — or with any other value — is a
 * hand-edited, half-written or older-shape record, and is thrown away rather than trusted: the
 * caller regenerates today's lesson instead of rendering items with missing fields (which used to
 * take the whole app down with it).
 */
const VERSION = 1
/**
 * Lesson records kept in storage; older days are pruned so the child's quota never fills up.
 *
 * Exported because the sync pull has to obey the same policy: a server that still holds a year of
 * lesson records must not write them all back for `saveLesson` to delete again on the next launch —
 * a ping-pong that costs the child's storage quota, and on a full store costs them a star (the
 * `setItem` in `store.ts` is a swallowed failure, not a visible one).
 */
export const KEEP_DAYS = 30
/** Same bar as the Leitner unlock and the legacy word mission. */
const PASS_SCORE = 60

const lessonKey = (day: string) => `${prefix()}${day}`

/**
 * The day inside a stored name (`lesson.2026-08-29` → `2026-08-29`), or null for anything else —
 * `lesson.length`, or a key this module does not own.
 *
 * The naming rule stays in here, with the code that writes it, so the sync engine can ask which of
 * the server's kv keys are lesson records without restating the shape.
 */
export function lessonDayInName(name: string): string | null {
  if (!name.startsWith('lesson.')) return null
  const day = name.slice('lesson.'.length)
  return DAY_RE.test(day) ? day : null
}

/** Every field a screen reads off an item must be a string, or the row renders `undefined` — and
 * `route.startsWith(...)` in `matchIds` throws, which is what bricked the app. */
const ITEM_FIELDS = ['kind', 'activity', 'id', 'route', 'label', 'emoji'] as const

function isLessonItem(value: unknown): value is LessonItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ITEM_FIELDS.every(field => typeof item[field] === 'string')
}

/**
 * A stored lesson value, already `JSON.parse`'d, validated against the exact shape `saveLesson`
 * writes — split out of `lessonForDay` so the SAME validation covers a value that never went
 * through `localStorage` at all.
 *
 * That second caller is `cloud/remote.ts`'s remote dashboard: a `kv` row's `value` column is jsonb,
 * so PostgREST hands it back already parsed, never as a JSON string to `JSON.parse` again. Without
 * this split, giving the remote view its own lesson-completion rule (Phase 11 task 5) would have
 * meant a second copy of these five checks drifting from this one the moment either changed.
 */
export function parseLesson(parsed: unknown): Lesson | null {
  if (!parsed || typeof parsed !== 'object') return null
  const { v, day: storedDay, created, band, items } = parsed as Partial<Lesson> & { v?: unknown }
  if (v !== VERSION) return null
  // `created` gates every done-match, so a record without it would mark the whole day complete.
  if (typeof storedDay !== 'string' || typeof created !== 'number' || typeof band !== 'number') return null
  if (!Array.isArray(items) || !items.every(isLessonItem)) return null
  // Rebuilt rather than passed through, so the version stamp stays a storage detail and two
  // lessons of the same day still compare equal whether they were just generated or read back.
  return { day: storedDay, created, band, items }
}

/**
 * Corrupt or unavailable storage (private mode, hand-edited value) must not crash the app: a record
 * that fails any check reads as "no lesson yet", so the caller generates a fresh one over the top.
 */
export function lessonForDay(day: string): Lesson | null {
  try {
    const raw = localStorage.getItem(lessonKey(day))
    if (!raw) return null
    return parseLesson(JSON.parse(raw))
  } catch { return null }
}

/** Day keys of every persisted lesson, oldest first. */
export function lessonDays(): string[] {
  const days: string[] = []
  try {
    const p = prefix()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(p)) continue
      const day = key.slice(p.length)
      if (DAY_RE.test(day)) days.push(day)
    }
  } catch { return [] }
  return days.sort()
}

export function saveLesson(lesson: Lesson): void {
  // Prune first, then write: a quota error on the write must not be what skips the prune, or a
  // full store would stay full forever. Day keys sort lexicographically the same way they sort
  // chronologically, so the oldest records are the front of the list, and `speakup.lesson.length`
  // never matches DAY_RE. Today's own key is excluded so it is never counted twice.
  try {
    const others = lessonDays().filter(day => day !== lesson.day)
    for (const day of others.slice(0, Math.max(0, others.length - (KEEP_DAYS - 1)))) {
      localStorage.removeItem(lessonKey(day))
    }
  } catch { /* ignore: storage unavailable */ }

  try {
    const key = lessonKey(lesson.day)
    localStorage.setItem(key, JSON.stringify({ ...lesson, v: VERSION }))
    onStoreWrite(key)
  } catch { /* ignore: storage unavailable */ }
}

/** Every key this module owns — day records, the length setting, and anything left over from an
 * older shape — so "clear the lesson store" really leaves nothing of it behind. */
function lessonKeys(): string[] {
  const keys: string[] = []
  try {
    const p = prefix()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(p)) keys.push(key)
    }
  } catch { return [] }
  return keys
}

export function clearLessons(): void {
  try {
    for (const key of lessonKeys()) localStorage.removeItem(key)
  } catch { /* ignore: storage unavailable */ }
}

export function getLessonLength(): LessonLength {
  try {
    const raw = localStorage.getItem(lengthKey())
    return LESSON_LENGTHS.includes(raw as LessonLength) ? (raw as LessonLength) : DEFAULT_LENGTH
  } catch { return DEFAULT_LENGTH }
}

export function setLessonLength(length: LessonLength): void {
  try {
    const key = lengthKey()
    localStorage.setItem(key, length)
    onStoreWrite(key)
  } catch { /* ignore: storage unavailable */ }
}

/**
 * The ids an event may carry to count as this item.
 *
 * A Phase 9 sound step is one word — `/sound/<ph>/<cardId>`, id `<cardId>` — and `SoundPractice`
 * logs exactly that card, so the plain id is the whole answer and `findSound` finds nothing under
 * it. The branch below stays for the lesson a returning child has in storage from before the split:
 * its sound step is a whole group (`/sound/<ph>`, id `<ph>`), which any of the group's cards
 * completes, exactly as it did yesterday.
 */
function matchIds(item: LessonItem): string[] {
  if (item.route.startsWith('/sound/')) {
    const group = findSound(item.id)
    return group ? [item.id, ...group.cards.map(c => c.id)] : [item.id]
  }
  return [item.id]
}

/**
 * `dayEvents` are the events of the lesson's own day (the caller already groups by day, which is
 * what keeps this module free of `activity.ts` at runtime). An attempt only counts if it lands
 * after the lesson was generated and was said well enough — unscored attempts (Web Speech, which
 * returns no number) count, as they do for the legacy mission.
 */
export function itemDone(item: LessonItem, lesson: Lesson, dayEvents: ActivityEvent[]): boolean {
  const ids = new Set(matchIds(item))
  return dayEvents.some(e =>
    e.ts >= lesson.created &&
    e.kind === item.activity &&
    ids.has(e.id) &&
    (e.score === undefined || e.score >= PASS_SCORE))
}

export function lessonDone(lesson: Lesson, dayEvents: ActivityEvent[]): boolean {
  return lesson.items.length > 0 && lesson.items.every(i => itemDone(i, lesson, dayEvents))
}
