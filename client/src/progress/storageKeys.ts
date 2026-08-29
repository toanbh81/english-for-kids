/**
 * The one place a stored key gets its name.
 *
 * Until Phase 11 every module owned a fixed string — `speakup.stars`, `speakup.activity`,
 * `speakup.lesson.<day>`. Two children sharing one iPad would have shared one set of stars, so
 * each child's data now lives under their own profile: `speakup.<profileId>.stars`. Rather than
 * teach a dozen modules about profiles, they all ask this module for their key and keep reading
 * and writing exactly as before.
 *
 * Two rules make that safe:
 *
 *  1. **The prefix is resolved per call, never captured.** A module-level `const KEY` would be
 *     computed when the module is imported, which is before the app has decided which child is
 *     using it — the whole point of the seam would be lost on the first render.
 *  2. **No profile means no namespace.** With nothing in `speakup.profile` the keys are the
 *     legacy ones, byte for byte. That is what a device looks like for the microseconds before
 *     `bootstrapProfiles()` runs (and what every existing unit test sees), so the app before
 *     migration and the app after it are reading the same bytes at every moment.
 *
 * The migration itself (`migrateKeysInto`) renames the legacy keys into the first profile's
 * namespace exactly once, and is written to lose nothing if it is interrupted, re-run, or run on
 * a device whose storage is full or unavailable.
 *
 * This module deliberately knows nothing about the cloud: it is plain localStorage, so the
 * progress modules stay free of `cloud/` (and of `supabase-js`) entirely. `cloud/profileState.ts`
 * is the one caller that drives it.
 */

/** Everything Speak Up! has ever written to localStorage starts with this. */
export const ROOT = 'speakup.'

/** Which child is using the iPad right now. Device-level: it must not move into a namespace. */
export const ACTIVE_PROFILE_KEY = `${ROOT}profile`

/** The roster of children on this device. Also device-level. */
export const PROFILES_KEY = `${ROOT}profiles`

/**
 * First segments that belong to the DEVICE or the PARENT rather than to a child, and are
 * therefore never namespaced and never migrated:
 *
 *   `speakup.profile`   which child is active (this module)
 *   `speakup.profiles`  the roster (cloud/profileState.ts)
 *   `speakup.auth`      the Supabase session — one account per device (cloud/supabase.ts)
 *   `speakup.parent`    the parent gate's "unlocked at" stamp (screens/ParentGate.tsx)
 *   `speakup.outbox`    the sync queue — one per device, it names its own profile per op
 *   `speakup.migrate.*` the migration's own unfinished business (below)
 *
 * Anything else under `speakup.` is a child's progress and gets migrated, including keys this
 * file has never heard of: a value left behind by an older version of the app is still that
 * child's, and moving it is how a returning child keeps it.
 */
const DEVICE_SEGMENTS = new Set(['profile', 'profiles', 'auth', 'parent', 'outbox', 'migrate'])

/**
 * The legacy keys a previous migration run could not move (a full store, a store that threw).
 *
 * Without this list the retry is worse than useless. Say the copy of `speakup.stars` fails: the
 * app carries on, reads the namespaced key, finds nothing, and writes a fresh default over it —
 * and from then on the namespaced value and the legacy value differ, which is exactly the shape of
 * "an old bundle wrote a stale key", so the guard below would protect the empty default for ever
 * and the child's stars would never come home. Being on this list is the difference: it says the
 * legacy value is unfinished business, not a straggler, and it wins.
 */
const PENDING_KEY = `${ROOT}migrate.pending`

function readPending(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [])
  } catch {
    return new Set()
  }
}

function writePending(keys: Set<string>): void {
  try {
    if (keys.size === 0) localStorage.removeItem(PENDING_KEY)
    else localStorage.setItem(PENDING_KEY, JSON.stringify([...keys]))
  } catch { /* ignore: the same storage that would not take the value */ }
}

/**
 * Profile ids are UUIDs, and this is the only shape accepted anywhere. A hand-edited or
 * half-written `speakup.profile` therefore reads as "no profile" — the child sees the legacy
 * keys, which is the same data the app had before Phase 11 — instead of scattering their stars
 * under whatever text was in there.
 */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isProfileId(value: unknown): value is string {
  return typeof value === 'string' && ID_RE.test(value)
}

/** The active profile id, or null when this device has not chosen one yet. */
export function activeProfileId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_PROFILE_KEY)
    return isProfileId(raw) ? raw : null
  } catch {
    // Storage unavailable (private mode): the app runs on the legacy keys, which is exactly what
    // it did before profiles existed.
    return null
  }
}

/** Point this device at a profile. The caller reloads; see `switchProfile` in profileState. */
export function setActiveProfileId(id: string): boolean {
  if (!isProfileId(id)) return false
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id)
    return true
  } catch {
    return false
  }
}

/** `speakup.` or `speakup.<profileId>.` — everything below is built from this. */
export function namespacePrefix(): string {
  return profilePrefix(activeProfileId())
}

/**
 * The prefix a given child's keys live under — the active one or any other.
 *
 * The sync engine needs this half: an outbox op names the profile it was written for, and it may
 * still be waiting when another child is using the iPad. Building the key from the op's own profile
 * id (rather than from whoever is active at flush time) is what keeps one child's stars out of the
 * other's namespace, and it stays here so the format lives in exactly one file.
 */
export function profilePrefix(profileId: string | null): string {
  return isProfileId(profileId) ? `${ROOT}${profileId}.` : ROOT
}

/**
 * The full localStorage key for one of a child's values.
 *
 *     storageKey('stars')          // speakup.<profileId>.stars
 *     storageKey('lesson.') + day  // speakup.<profileId>.lesson.2026-08-29
 */
export function storageKey(name: string): string {
  return `${namespacePrefix()}${name}`
}

/** `storageKey`, for a child who is not the one currently using the iPad. */
export function profileStorageKey(profileId: string, name: string): string {
  return `${profilePrefix(profileId)}${name}`
}

/**
 * The inverse: the name inside a full key, or null when the key belongs to another child, to the
 * device, or to another app entirely.
 *
 * The sync engine needs exactly this — the server's `kv` rows are keyed by the name with the
 * namespace stripped (`stars`, `lesson.2026-08-29`) — and it needs it to be the same rule that
 * built the key in the first place, rather than a second copy of it that can drift.
 */
export function storageName(key: string): string | null {
  const prefix = namespacePrefix()
  if (!key.startsWith(prefix)) return null
  const name = key.slice(prefix.length)
  if (!name) return null
  // With no active profile the prefix is the bare root, so another child's key would otherwise
  // come back as `<uuid>.stars`.
  const dot = name.indexOf('.')
  const head = dot === -1 ? name : name.slice(0, dot)
  if (isProfileId(head) || DEVICE_SEGMENTS.has(head)) return null
  return name
}

// ---------------------------------------------------------------------------
// The write seam
// ---------------------------------------------------------------------------

/**
 * The ONE place the app announces that a child's stored value changed.
 *
 * Every progress module already imports this file for its key, so the announcement costs each of
 * them one line next to the `setItem` they were already making — and, crucially, there is exactly
 * one of them per module. The alternative (the sync engine reaching into a dozen call sites, or a
 * `setItem` wrapper each store had to remember to use) is a seam that goes stale the first time
 * somebody adds a store and forgets.
 *
 * It stays in `progress/` and knows nothing about the cloud: `cloud/sync.ts` subscribes to it. That
 * keeps the direction of the dependency the same as it has always been — progress never imports
 * cloud, so no build without Supabase env vars pays for a mirror it does not have. With nobody
 * subscribed (every existing test, and every build with no cloud configured) this is a loop over an
 * empty array.
 *
 * Deliberately NOT announced: removals. A `clearActivity()`/`clearStars()` is a parent resetting the
 * child, and a reset is a DELETE of the server rows, not a merge of an empty value — max-merge would
 * resurrect exactly what was reset. `cloud/sync.ts` owns that path (`resetRemoteProgress`).
 */
type StoreWriteListener = (key: string) => void

const storeWriteListeners = new Set<StoreWriteListener>()

/** Called by the stores, right after a successful write. Never throws into the caller. */
export function onStoreWrite(key: string): void {
  if (storeWriteListeners.size === 0) return
  for (const listener of [...storeWriteListeners]) {
    try { listener(key) } catch { /* a mirror must never break the write it was mirroring */ }
  }
}

/** Subscribe to those writes. Returns the unsubscribe. */
export function subscribeStoreWrites(listener: StoreWriteListener): () => void {
  storeWriteListeners.add(listener)
  return () => { storeWriteListeners.delete(listener) }
}

/**
 * Put `value` at `to` and say whether it is there.
 *
 * A copy, and only ever a copy: the original stays put until the copy has been verified. An
 * earlier version freed room by removing the original first when the store was full, which is a
 * trade this data cannot make — between that removal and the write, another document of the same
 * app (a second tab, the one this device's parent left open) can take the space, and the child's
 * stars are then gone with nothing to restore them from. A full store is simply a migration that
 * happens on the next launch instead, and the pending list is what makes that retry authoritative.
 */
function copyValue(to: string, value: string): boolean {
  try {
    localStorage.setItem(to, value)
    return true
  } catch {
    return false
  }
}

/**
 * Move every legacy `speakup.*` key under `speakup.<profileId>.`, once.
 *
 * Guarantees, in the order they matter:
 *
 *  - **Nothing is lost.** A key is only ever copied, and only removed after the namespaced copy has
 *    been read back and compared to the original string. A key that cannot be copied (full or
 *    unavailable storage) stays exactly where it is, is written down as pending, and is retried on
 *    the next launch.
 *  - **Nothing is clobbered.** If the namespaced key already holds a *different* value — an old
 *    cached bundle that wrote a legacy key after the migration — the namespaced value is the one
 *    the app has been using, so it wins and the legacy key is left alone rather than overwritten in
 *    either direction. The one exception is a key on the pending list, where the namespaced value
 *    is a default written over a hole this migration left, and the child's own value wins.
 *  - **Idempotent by shape, not by a flag.** Keys that are already namespaced (their first
 *    segment is a UUID) and device keys are skipped, so a second run has nothing to do. There is
 *    no "migrated" marker to get out of step with reality.
 *  - **One bad key cannot stop the rest**, and the key list is taken before any mutation, since
 *    `localStorage.key(i)` walks an index that removals shift underneath it.
 *
 * Returns how many keys were moved (for the tests and nothing else).
 */
export function migrateKeysInto(profileId: string): number {
  if (!isProfileId(profileId)) return 0
  const prefix = `${ROOT}${profileId}.`

  const legacy: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(ROOT)) continue
      const rest = key.slice(ROOT.length)
      if (!rest) continue
      const dot = rest.indexOf('.')
      const head = dot === -1 ? rest : rest.slice(0, dot)
      if (DEVICE_SEGMENTS.has(head) || isProfileId(head)) continue
      legacy.push(key)
    }
  } catch {
    return 0
  }

  const pending = readPending()
  const before = pending.size
  let moved = 0

  for (const key of legacy) {
    try {
      const value = localStorage.getItem(key)
      if (value === null) { pending.delete(key); continue }
      const target = `${prefix}${key.slice(ROOT.length)}`
      const existing = localStorage.getItem(target)

      // The namespaced value wins over a legacy one that differs — UNLESS this key is unfinished
      // business from a run that could not move it, in which case what is sitting in the namespace
      // is a default the app wrote over the hole, and the child's real value is still here.
      if (existing !== null && existing !== value && !pending.has(key)) continue

      if (existing !== value && !copyValue(target, value)) { pending.add(key); continue }
      if (localStorage.getItem(target) !== value) { pending.add(key); continue }

      localStorage.removeItem(key)
      pending.delete(key)
      moved++
    } catch {
      // This key stays legacy and is retried — with authority — on the next launch.
      pending.add(key)
    }
  }

  if (pending.size !== before || pending.size > 0) writePending(pending)
  return moved
}

// ---------------------------------------------------------------------------
// Orphan rescue
// ---------------------------------------------------------------------------

/**
 * Mirrors the cap in `activity.ts`: the event log never grows past this, and a merge is a write
 * like any other.
 */
const ACTIVITY_CAP = 2000

const isMap = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * Stars only ever go up. A star the child earned in one namespace cannot be lowered by an older
 * value from another, whatever the clocks say — the same rule the server's `merge_kv` applies, for
 * the same reason.
 */
function mergeStars(existing: string, incoming: string): string {
  try {
    const mine: unknown = JSON.parse(existing)
    const theirs: unknown = JSON.parse(incoming)
    if (!isMap(mine) || !isMap(theirs)) return existing
    const out: Record<string, unknown> = { ...mine }
    for (const [id, value] of Object.entries(theirs)) {
      const current = out[id]
      if (current === undefined) { out[id] = value; continue }
      if (typeof value === 'number' && typeof current === 'number' && value > current) out[id] = value
    }
    return JSON.stringify(out)
  } catch {
    return existing
  }
}

/** One event is the same event in both namespaces when its (ts, kind, id) match — the server's
 * primary key, so a rescue and a sync agree about what a duplicate is. */
const eventKey = (event: unknown): string => {
  if (!isMap(event)) return JSON.stringify(event)
  return `${String(event.ts)}|${String(event.kind)}|${String(event.id)}`
}

function mergeActivity(existing: string, incoming: string): string {
  try {
    const mine: unknown = JSON.parse(existing)
    const theirs: unknown = JSON.parse(incoming)
    if (!Array.isArray(mine) || !Array.isArray(theirs)) return existing
    const seen = new Set<string>()
    const merged: unknown[] = []
    for (const event of [...mine, ...theirs]) {
      const key = eventKey(event)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(event)
    }
    merged.sort((a, b) => (isMap(a) && typeof a.ts === 'number' ? a.ts : 0) - (isMap(b) && typeof b.ts === 'number' ? b.ts : 0))
    return JSON.stringify(merged.slice(-ACTIVITY_CAP))
  } catch {
    return existing
  }
}

/**
 * What one stored value becomes when a second copy of it turns up.
 *
 * **This is the app's merge contract, and the only copy of it.** Two callers need it and must never
 * drift apart: the orphan rescue below (a namespace the roster lost) and `cloud/sync.ts`'s pull (a
 * namespace the server has). It is also the same contract the server's `merge_kv` applies, for the
 * same reasons — see supabase/migrations/0001_profiles_sync.sql.
 *
 *  - `stars` — per-entry **maximum**. A star the child earned is never lowered, whatever the clocks
 *    say. Stars only ever go up, which makes max both correct and replay-proof.
 *  - `activity` — **union**, deduped on `(ts, kind, id)` (the server's primary key), sorted, capped
 *    at the 2000 `activity.ts` already enforces.
 *  - everything else — **last write wins**, and `preferIncoming` is that decision. The rescue leaves
 *    it false: an orphaned namespace carries no clock, and the value the child has been using is the
 *    better guess. The pull passes the comparison of the two `updated_at`s.
 *
 * Where there is no existing value at all the incoming one is taken outright — that is the restore
 * after a wiped cache, and it is the one case that has nothing to weigh.
 */
export function mergeStoredValue(
  name: string,
  existing: string | null,
  incoming: string,
  preferIncoming = false,
): string {
  if (existing === null) return incoming
  if (name === 'stars') return mergeStars(existing, incoming)
  if (name === 'activity') return mergeActivity(existing, incoming)
  return preferIncoming ? incoming : existing
}

/**
 * Bring home any child's data left under a profile id the roster no longer knows.
 *
 * The race this exists for: two documents of the app boot the same update at the same moment, both
 * read an empty roster before either has written one, and the second write replaces the first. The
 * loser's id is then gone from the roster while its namespace — which may already hold everything
 * the child ever earned, migrated a moment earlier — is still on disk, addressed by nothing. What
 * the parent sees is a child with no stars. localStorage has no compare-and-swap, so that window
 * can be narrowed but never closed; this is the net under it, and it is what makes the race
 * harmless rather than merely unlikely.
 *
 * It runs on every launch, costs one key scan, and is idempotent: with nothing orphaned it does
 * nothing at all. Each rescued value is written and read back before the orphan is deleted, so a
 * store that refuses the write keeps both copies and tries again next launch.
 *
 * **The roster is the authority on what is not an orphan.** Anything adding a profile — a restore,
 * a picker, a pull from the server — must put it in the roster BEFORE writing a single key into
 * its namespace, or this will read that namespace as abandoned and fold it into the active child.
 */
export function rescueOrphanNamespaces(activeId: string, knownIds: string[]): number {
  if (!isProfileId(activeId)) return 0
  const known = new Set(knownIds.filter(isProfileId).map(id => id.toLowerCase()))
  known.add(activeId.toLowerCase())

  const orphans: { key: string; name: string }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(ROOT)) continue
      const rest = key.slice(ROOT.length)
      const dot = rest.indexOf('.')
      if (dot === -1) continue
      const head = rest.slice(0, dot)
      // Only a namespace can be orphaned: device keys have no profile id in them, and a profile
      // the roster still knows is somebody's child, not litter.
      if (!isProfileId(head) || known.has(head.toLowerCase())) continue
      const name = rest.slice(dot + 1)
      if (name) orphans.push({ key, name })
    }
  } catch {
    return 0
  }

  const prefix = `${ROOT}${activeId}.`
  let rescued = 0
  for (const { key, name } of orphans) {
    try {
      const incoming = localStorage.getItem(key)
      if (incoming === null) continue
      const target = `${prefix}${name}`
      const existing = localStorage.getItem(target)
      const merged = mergeStoredValue(name, existing, incoming)
      if (merged !== existing && !copyValue(target, merged)) continue
      if (localStorage.getItem(target) !== merged) continue
      localStorage.removeItem(key)
      rescued++
    } catch { /* leave this one where it is; the next launch tries again */ }
  }
  return rescued
}
