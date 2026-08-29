import { lessonDayInName } from './lessonStore'

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

export const SYNCED_KEYS: ReadonlyMap<string, StoredForm> = new Map<string, StoredForm>([
  ['stars', 'json'],           // progress/store.ts        — { [cardId]: 1 | 2 | 3 }
  ['leitner', 'json'],         // progress/leitner.ts      — { [wordId]: { box, due } }
  ['band', 'json'],            // progress/band.ts         — { value, mode }
  ['limit.minutes', 'text'],   // progress/limit.ts        — String(n), e.g. "20"
  ['lesson.length', 'text'],   // progress/lessonStore.ts  — "short" | "medium" | "long"
])

/**
 * How this name is stored, or null if it is not mirrored at all.
 *
 * The one family that is not a fixed name is the lesson records, `lesson.<day>` — and the shape of
 * that tail is `lessonStore`'s to know, so it is asked rather than restated here.
 */
export function syncedForm(name: string): StoredForm | null {
  const known = SYNCED_KEYS.get(name)
  if (known) return known
  return lessonDayInName(name) === null ? null : 'json'
}

/** Is this one of the child's values the cloud is allowed to hold? */
export const isSyncedName = (name: string): boolean => syncedForm(name) !== null
