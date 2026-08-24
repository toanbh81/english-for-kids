import type { ActivityEvent, ActivityKind } from './activity'
import { findSound } from '../content'

/**
 * Storage and done-matching for the daily lesson, split out of `lesson.ts` so the dependency graph
 * stays a DAG: `activity.ts` needs the lesson to decide whether a day is complete, while
 * `lesson.ts` needs `activity.ts` to read the event log. This module sits under both — its only
 * link back to `activity.ts` is a type-only import, which `verbatimModuleSyntax` erases, so no
 * runtime cycle exists. Lesson *generation* (content, band, seeding) lives in `lesson.ts`.
 */

export type LessonItemKind = 'listen' | 'speak' | 'word' | 'review'
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

const PREFIX = 'speakup.lesson.'
const LENGTH_KEY = `${PREFIX}length`
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
/** Lesson records kept in storage; older days are pruned so the child's quota never fills up. */
const KEEP_DAYS = 30
/** Same bar as the Leitner unlock and the legacy word mission. */
const PASS_SCORE = 60

const lessonKey = (day: string) => `${PREFIX}${day}`

/** Corrupt or unavailable storage (private mode, hand-edited value) must not crash the app. */
export function lessonForDay(day: string): Lesson | null {
  try {
    const raw = localStorage.getItem(lessonKey(day))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const lesson = parsed as Lesson
    // `created` gates every done-match, so a record without it would mark the whole day complete.
    return Array.isArray(lesson.items) && typeof lesson.day === 'string' && typeof lesson.created === 'number'
      ? lesson
      : null
  } catch { return null }
}

/** Day keys of every persisted lesson, oldest first. */
export function lessonDays(): string[] {
  const days: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const day = key.slice(PREFIX.length)
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

  try { localStorage.setItem(lessonKey(lesson.day), JSON.stringify(lesson)) }
  catch { /* ignore: storage unavailable */ }
}

export function clearLessons(): void {
  try {
    for (const day of lessonDays()) localStorage.removeItem(lessonKey(day))
    localStorage.removeItem(LENGTH_KEY)
  } catch { /* ignore: storage unavailable */ }
}

export function getLessonLength(): LessonLength {
  try {
    const raw = localStorage.getItem(LENGTH_KEY)
    return LESSON_LENGTHS.includes(raw as LessonLength) ? (raw as LessonLength) : DEFAULT_LENGTH
  } catch { return DEFAULT_LENGTH }
}

export function setLessonLength(length: LessonLength): void {
  try { localStorage.setItem(LENGTH_KEY, length) }
  catch { /* ignore: storage unavailable */ }
}

/**
 * The ids an event may carry to count as this item. A sound tile is one lesson item but three
 * cards on screen, and `SoundPractice` logs whichever card the child spoke — so any of the group's
 * cards completes it.
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
