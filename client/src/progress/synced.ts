import { LESSON_LENGTHS, lessonDayInName } from './lessonStore'

/**
 * **The stored values that are allowed to leave the device — an allowlist, and the whole of it.**
 *
 * If you are adding a store to `progress/`, this is the file that decides whether its value is
 * mirrored to the cloud. A key that is not named here **does not sync**, silently and on purpose.
 *
 * It used to be the other way round — everything under `speakup.<profileId>.` minus a short denylist
 * — and that defaults to leaking. `migrateKeysInto` deliberately sweeps keys this codebase has never
 * heard of into the child's namespace (a value an older version wrote is still that child's), so a
 * denylist uploads whatever any past or future version left behind, with no module owning it. The
 * spec says a child's voice never leaves the device; a rule that has to be *remembered* for each new
 * key is not a rule that keeps that promise. Failing closed costs a forgotten key its sync until
 * someone notices; failing open costs a child their privacy and nobody notices at all.
 *
 * `activity` is deliberately absent: the event log is mirrored as rows in the `events` table, not as
 * a kv value (it outgrows kv's 16 KB ceiling). `celebrated` is absent because a once-a-day confetti
 * stamp is this device's business.
 *
 * The **form** is how the owning store writes the value, and it is here rather than inferred because
 * inferring it is what N1 got wrong: two of these are bare scalars on purpose, and bytes that are
 * not JSON are perfectly correct for them. See `mergeStored` — only a `json` value can be judged
 * unreadable.
 */
export type StoredForm = 'json' | 'text'

/** What a stored value has to look like to be worth keeping, sending, or accepting. */
export type ShapeCheck = (raw: string) => boolean

export type SyncedKey = { form: StoredForm; valid: ShapeCheck }

const parsed = (raw: string): unknown => {
  try { return JSON.parse(raw) as unknown } catch { return undefined }
}

/** A plain JSON object — what `merge_kv`'s per-entry max needs on both sides, and what every one of
 * the `json` keys below is. An array passes `typeof x === 'object'` and is not one of these. */
const isJsonObject: ShapeCheck = raw => {
  const value = parsed(raw)
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** `limit.minutes` as `limit.ts` reads it back: `Number(raw)`, finite and positive. */
const isMinutes: ShapeCheck = raw => {
  const n = raw.trim() === '' ? Number.NaN : Number(raw)
  return Number.isFinite(n) && n > 0
}

/** `lesson.length` as `lessonStore` reads it back: one of the three words, bare. */
const isLessonLength: ShapeCheck = raw => (LESSON_LENGTHS as readonly string[]).includes(raw)

/**
 * **The declared shape of each mirrored value — and a promise that VERSIONS WITH THE APP.**
 *
 * A value that fails its own shape is never written to disk from the cloud and never sent to it, so
 * this table is the app's statement of what each key is. That has a consequence a future author has
 * to plan for:
 *
 * > **Changing the shape of a key here is a deliberate migration, not an edit.** Devices running the
 * > old build are still validating against the old shape; a value in the new shape reaching one of
 * > them is "invalid", and the pull will heal it away — replacing the new value with the old one and
 * > pushing that back up. To change a shape safely: either write the new shape under a NEW key name
 * > and leave the old one alone until the old build is gone, or ship a release whose validator
 * > accepts BOTH shapes, wait for it to roll out, and only then start writing the new one.
 *
 * The `form` column is separate from `valid` on purpose: `form` says how the bytes are encoded on
 * the wire (`json` values are parsed into `kv.value`, `text` values travel as JSON strings), while
 * `valid` says what they must mean. Two of these six are bare scalars, and for them "not JSON" is
 * the correct state, not damage.
 */
export const SYNCED_KEYS: ReadonlyMap<string, SyncedKey> = new Map<string, SyncedKey>([
  // progress/store.ts        — { [cardId]: 1 | 2 | 3 }
  ['stars', { form: 'json', valid: isJsonObject }],
  // progress/leitner.ts      — { [wordId]: { box, due } }
  ['leitner', { form: 'json', valid: isJsonObject }],
  // progress/band.ts         — { value, mode }
  ['band', { form: 'json', valid: isJsonObject }],
  // progress/limit.ts        — String(n), e.g. "20"
  ['limit.minutes', { form: 'text', valid: isMinutes }],
  // progress/lessonStore.ts  — "short" | "medium" | "long"
  ['lesson.length', { form: 'text', valid: isLessonLength }],
])

/** progress/lessonStore.ts — one persisted lesson record per day, `{ v, day, created, band, items }`. */
const LESSON_DAY: SyncedKey = { form: 'json', valid: isJsonObject }

/**
 * The registration for this name, or null if it is not mirrored at all.
 *
 * The one family that is not a fixed name is the lesson records, `lesson.<day>` — and the shape of
 * that tail is `lessonStore`'s to know, so it is asked rather than restated here.
 */
export function syncedKey(name: string): SyncedKey | null {
  return SYNCED_KEYS.get(name) ?? (lessonDayInName(name) === null ? null : LESSON_DAY)
}

/** Is this one of the child's values the cloud is allowed to hold? */
export const isSyncedName = (name: string): boolean => syncedKey(name) !== null

export const syncedForm = (name: string): StoredForm | null => syncedKey(name)?.form ?? null

/** The shape check for a registered name, or null when nothing here vouches for it. */
export const syncedShape = (name: string): ShapeCheck | null => syncedKey(name)?.valid ?? null

/**
 * Does this value pass its own declared shape?
 *
 * **An unregistered name is `false`, never `true`.** Callers use this to decide whether bytes may be
 * sent to the server or written to the child's disk, and "nothing here vouches for it" is a reason
 * to refuse, not a reason to wave it through.
 */
export function isValidStoredValue(name: string, raw: string): boolean {
  const shape = syncedShape(name)
  return shape !== null && shape(raw)
}
