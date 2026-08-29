import {
  ACTIVE_PROFILE_KEY,
  PROFILES_KEY,
  activeProfileId,
  isProfileId,
  migrateKeysInto,
  setActiveProfileId,
} from '../progress/storageKeys'
import type { BootstrapOptions } from './auth'
import { currentUserId, ensureRecoveryCode, startAnonymousSession } from './auth'
import { getSupabase } from './supabase'

/**
 * The children on this iPad (spec flow 6), and the storage namespace each of them owns.
 *
 * The one decision everything else here follows from: **a profile id is generated on the device,
 * as a UUID, and is the same id the server row gets.** `profiles.id` has a default in the
 * migration, but the client passes its own instead, which buys three things:
 *
 *  - The localStorage namespace is chosen once and never renamed. There is no "pseudo id" to
 *    re-parent when the account finally appears, so there is no second migration to get wrong —
 *    and no window where a child's stars are under a key nothing reads.
 *  - The app works identically with no cloud configured at all. The namespace does not depend on
 *    a server ever answering; a device that is offline for a month has a perfectly good profile.
 *  - Sync (Phase 11 task 3) can name the profile in an outbox op the moment the child earns a
 *    star, long before the row exists server-side.
 *
 * RLS makes this safe: `profiles_insert_own` only lets a caller create rows with
 * `owner_id = auth.uid()`, so choosing an id grants nothing (and a UUID4 collision with another
 * family's profile would surface as a failed insert, not as shared data).
 */

export type Profile = { id: string; name: string; avatar: string; created: number }

/** Matching the migration's column defaults, so a row created either side looks the same. */
export const DEFAULT_PROFILE_NAME = 'Bé'
export const DEFAULT_PROFILE_AVATAR = '🦊'

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 1
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * `crypto.randomUUID` needs a secure context, which the app always has (HTTPS, or localhost in
 * dev) — but an id that fails to generate would mean a child with no namespace, so the fallbacks
 * are real ones rather than a throw. `Math.random` is the last of them and is only ever reached in
 * an environment with no WebCrypto at all; a profile id is not a secret, only unique.
 */
function newProfileId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* fall through to the next source of randomness */ }
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)))
    }
  } catch { /* fall through */ }
  const bytes = new Uint8Array(16)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return uuidFromBytes(bytes)
}

// ---------------------------------------------------------------------------
// The roster (localStorage, device-level)
// ---------------------------------------------------------------------------

/**
 * A stored entry is repaired rather than dropped whenever its id is intact: the id is the pointer
 * to a whole namespace of the child's progress, and throwing the entry away over a missing avatar
 * would be throwing that away with it.
 */
function toProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null
  const { id, name, avatar, created } = value as Partial<Profile>
  if (!isProfileId(id)) return null
  return {
    id,
    name: typeof name === 'string' && name.trim() ? name : DEFAULT_PROFILE_NAME,
    avatar: typeof avatar === 'string' && avatar ? avatar : DEFAULT_PROFILE_AVATAR,
    created: typeof created === 'number' && Number.isFinite(created) ? created : 0,
  }
}

/** Corrupt or unavailable storage must not crash the app: no roster reads as "no children yet". */
export function listProfiles(): Profile[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map(toProfile).filter((p): p is Profile => p !== null)
  } catch {
    return []
  }
}

function writeProfiles(profiles: Profile[]): boolean {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
    return true
  } catch {
    return false
  }
}

/** The child whose namespace the app is currently reading, or null before the first boot. */
export function activeProfile(): Profile | null {
  const id = activeProfileId()
  return id ? listProfiles().find(p => p.id === id) ?? null : null
}

export { activeProfileId }

/** Add a child. Does not switch to them — the parent screen decides when that happens. */
export function addProfile(name?: string, avatar?: string): Profile {
  const profile: Profile = {
    id: newProfileId(),
    name: name?.trim() || DEFAULT_PROFILE_NAME,
    avatar: avatar || DEFAULT_PROFILE_AVATAR,
    created: Date.now(),
  }
  writeProfiles([...listProfiles(), profile])
  return profile
}

/**
 * Guarantee this device has an active profile, and that the pre-Phase-11 keys are under it.
 *
 * The order is deliberate and is the only ordering that cannot lose data:
 *
 *   1. write the roster, 2. point `speakup.profile` at the child, 3. move the legacy keys.
 *
 * Step 2 is what switches `storageKey()` over to the namespace, so it has to be the step that can
 * fail cheaply: if storage refuses it, nothing moves and the app keeps reading the legacy keys
 * exactly as it did before this phase. Doing it the other way round — move first, switch second —
 * would leave a full or read-only store holding a namespace nothing was reading, which looks to a
 * child exactly like their progress being wiped.
 *
 * Safe to call on every launch: the migration is idempotent, and re-running it also repairs a
 * device where an old cached bundle wrote a legacy key after the first migration.
 */
export function ensureLocalProfile(): Profile {
  const roster = listProfiles()
  const active = activeProfileId()
  let profile = (active ? roster.find(p => p.id === active) : undefined) ?? roster[0]

  if (!profile) {
    profile = { id: newProfileId(), name: DEFAULT_PROFILE_NAME, avatar: DEFAULT_PROFILE_AVATAR, created: Date.now() }
    if (!writeProfiles([profile])) return profile
  }

  if (!setActiveProfileId(profile.id)) return profile
  migrateKeysInto(profile.id)
  return profile
}

/**
 * Hand the iPad to another child.
 *
 * The reload is not laziness, it is the cheap correctness: every screen reads localStorage
 * synchronously while it renders, React state and module-level caches hold the previous child's
 * numbers, and the lesson currently on screen belongs to them. Re-mounting the document is the one
 * move that guarantees nothing of theirs survives into the next child's session, and the app is a
 * cached PWA, so it costs a blink. Tests pass `{ reload: false }`.
 */
export function switchProfile(id: string, options: { reload?: boolean } = {}): boolean {
  if (!listProfiles().some(p => p.id === id)) return false
  if (!setActiveProfileId(id)) return false
  if (options.reload !== false) {
    try { location.reload() } catch { /* no document to reload (tests, a worker) */ }
  }
  return true
}

/**
 * Merge profiles that came from the server into the roster (flows 3 and 4, driven by the parent
 * screen). Ids are the join, so a profile this device already knows keeps its local name and its
 * local namespace; one it has never seen is added, ready to be pulled into.
 */
export function adoptProfiles(remote: Profile[]): Profile[] {
  const roster = listProfiles()
  const known = new Set(roster.map(p => p.id))
  const merged = [...roster, ...remote.filter(p => isProfileId(p.id) && !known.has(p.id))]
  writeProfiles(merged)
  return merged
}

// ---------------------------------------------------------------------------
// The server side
// ---------------------------------------------------------------------------

/**
 * Make sure every local child has a row of their own on the server, with the id this device chose.
 *
 * `ignoreDuplicates` — an `on conflict do nothing` — because this runs on every launch: a row that
 * exists is right, and re-sending the local name would undo a rename made from another device.
 */
export async function ensureRemoteProfiles(): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const userId = await currentUserId()
  if (!userId) return false
  const rows = listProfiles().map(p => ({ id: p.id, owner_id: userId, name: p.name, avatar: p.avatar }))
  if (!rows.length) return false
  try {
    const { error } = await sb.from('profiles').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    return !error
  } catch {
    return false
  }
}

/** The children this account owns, as the server sees them. RLS scopes the select to them. */
export async function fetchRemoteProfiles(): Promise<Profile[]> {
  const sb = getSupabase()
  if (!sb) return []
  const userId = await currentUserId()
  if (!userId) return []
  try {
    const { data, error } = await sb
      .from('profiles')
      .select('id, name, avatar, created_at')
      .eq('owner_id', userId)
    if (error || !Array.isArray(data)) return []
    return data
      .map(row => toProfile({
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        created: Date.parse(String(row.created_at)) || 0,
      }))
      .filter((p): p is Profile => p !== null)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Everything the cloud does at launch, in the background and in total silence: sign in (only when
 * online and configured), make sure the children have rows, make sure a recovery code exists for
 * the parent screen to show later. Nothing here is awaited by a screen and nothing here can throw
 * into one.
 */
export async function connectCloud(options: BootstrapOptions = {}): Promise<void> {
  try {
    if (!getSupabase()) return
    await startAnonymousSession(options)
    if ((await currentUserId()) === null) return
    await ensureRemoteProfiles()
    await ensureRecoveryCode()
  } catch { /* the cloud is a mirror; the child's app never hears about it */ }
}

/**
 * The app's first line (`main.tsx`), before React renders.
 *
 * The local half is synchronous on purpose: `storageKey()` must already be answering with the
 * child's namespace by the time the first screen reads a star. The cloud half is fired and
 * forgotten.
 */
export function bootstrapProfiles(options: BootstrapOptions = {}): Profile {
  const profile = ensureLocalProfile()
  void connectCloud(options)
  return profile
}

/** Test seam: forget which child is active and who lives on this device. */
export function resetProfilesForTest(): void {
  try {
    localStorage.removeItem(ACTIVE_PROFILE_KEY)
    localStorage.removeItem(PROFILES_KEY)
  } catch { /* ignore: storage unavailable */ }
}
