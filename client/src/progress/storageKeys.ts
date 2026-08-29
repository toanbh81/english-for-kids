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
 *
 * Anything else under `speakup.` is a child's progress and gets migrated, including keys this
 * file has never heard of: a value left behind by an older version of the app is still that
 * child's, and moving it is how a returning child keeps it.
 */
const DEVICE_SEGMENTS = new Set(['profile', 'profiles', 'auth', 'parent', 'outbox'])

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
  const id = activeProfileId()
  return id ? `${ROOT}${id}.` : ROOT
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

/**
 * Does this store accept writes at all?
 *
 * The question matters because a store that is FULL and a store that is READ-ONLY (Safari private
 * browsing, some kiosk modes) both answer a `setItem` with the same exception, and the two want
 * opposite handling: freeing room and retrying fixes the first and destroys data in the second.
 * A one-byte probe tells them apart. The key deliberately has no dot after `speakup`, so it can
 * never be mistaken for a child's value if the cleanup below fails too.
 */
function storageAcceptsWrites(): boolean {
  const probe = 'speakup-migrate-probe'
  try {
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/**
 * Put `value` at `to` and give the caller back whether it is there.
 *
 * The straight copy is tried first, because a copy leaves the original in place if anything goes
 * wrong. It can fail for exactly one interesting reason — the store is full, and the copy needs
 * room for a second copy of a value that is already in there — and only then, and only once a
 * probe has confirmed the store takes writes at all, is the original moved instead. Even that
 * puts the original back if the write still fails; the removal freed precisely the room the write
 * needs, so it is the one write that cannot fail.
 */
function copyValue(from: string, to: string, value: string): boolean {
  try {
    localStorage.setItem(to, value)
    return true
  } catch {
    if (!storageAcceptsWrites()) return false
    try {
      localStorage.removeItem(from)
      localStorage.setItem(to, value)
      return true
    } catch {
      try { localStorage.setItem(from, value) } catch { /* ignore: storage unavailable */ }
      return false
    }
  }
}

/**
 * Move every legacy `speakup.*` key under `speakup.<profileId>.`, once.
 *
 * Guarantees, in the order they matter:
 *
 *  - **Nothing is lost.** A key is only removed after the namespaced copy has been read back and
 *    compared to the original string. A key that cannot be copied (full or unavailable storage)
 *    stays exactly where it is and is retried on the next launch.
 *  - **Nothing is clobbered.** If the namespaced key already holds a *different* value — a
 *    half-finished earlier run, or an old cached bundle that wrote a legacy key after the
 *    migration — the namespaced value is the one the app has been using, so it wins and the
 *    legacy key is left alone rather than overwritten in either direction.
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

  let moved = 0
  for (const key of legacy) {
    try {
      const value = localStorage.getItem(key)
      if (value === null) continue
      const target = `${prefix}${key.slice(ROOT.length)}`
      const existing = localStorage.getItem(target)
      if (existing === null && !copyValue(key, target, value)) continue
      if (existing !== null && existing !== value) continue
      if (localStorage.getItem(target) !== value) continue
      localStorage.removeItem(key)
      moved++
    } catch { /* ignore: this key stays legacy and is retried next launch */ }
  }
  return moved
}
