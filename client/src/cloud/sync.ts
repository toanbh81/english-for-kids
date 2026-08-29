import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityEvent } from '../progress/activity'
import { KEEP_DAYS, lessonDayInName } from '../progress/lessonStore'
import { isSyncedName, isValidStoredValue, syncedShape } from '../progress/synced'
import {
  ACTIVITY_CAP,
  ROOT,
  eventIdentity,
  isProfileId,
  mergeStored,
  mergeStoredValue,
  profilePrefix,
  profileStorageKey,
  storageName,
  subscribeStoreWrites,
} from '../progress/storageKeys'
import { currentUserId, subscribeAuth } from './auth'
import { activeProfileId, ensureRemoteProfiles, listProfiles } from './profileState'
import { getSupabase, isCloudConfigured } from './supabase'

/**
 * The mirror: an outbox that carries a child's progress up, and a pull that brings it back down.
 *
 * Everything here is built on one promise — **localStorage is the truth and this is a mirror** — and
 * the promise is what dictates the shape:
 *
 *  - Nothing on a screen ever awaits this module. Every exported function resolves; none of them
 *    reject, and a total network failure is indistinguishable, from the child's side, from a device
 *    that has never had a cloud at all.
 *  - **With no Supabase env vars, `startSync()` is a no-op that subscribes to nothing.** No outbox
 *    key is written, no listener is attached, and the app behaves byte for byte as it did before
 *    Phase 11 — which is what CI and a contributor's clone run.
 *  - Delivery is **at least once**. Every write path server-side is idempotent (the events primary
 *    key dedupes, `merge_kv` takes the max for stars and last-write-wins for the rest), so replaying
 *    an op is free and losing one is not. A partial failure therefore keeps the ops it could not
 *    send rather than clearing the queue.
 *  - iOS has no Background Sync API. The flush triggers are the whole strategy: app start, the
 *    `online` event, `visibilitychange` → hidden, and a debounced flush after writes (≤1 per 30 s).
 *  - **Voice recordings never leave the device.** Scores and weak-phoneme stats ride along in the
 *    event rows; the audio blobs live in IndexedDB and this module never opens it.
 *
 * The outbox lives in `speakup.outbox` — a device key, never namespaced (see storageKeys.ts), since
 * one queue serves every child on the iPad and each op names the profile it belongs to.
 */

// ---------------------------------------------------------------------------
// The outbox
// ---------------------------------------------------------------------------

const OUTBOX_KEY = `${ROOT}outbox`

/**
 * A kv op is a **dirty marker, not a value**: it names the key, and the value is read out of
 * localStorage at flush time.
 *
 * That is the difference between an outbox that is a few hundred bytes and one that is megabytes.
 * A child earning ten stars in a minute writes the whole star map ten times; carrying the value
 * would queue ten copies of it, and the first nine would be stale before the flush. Reading at
 * flush time collapses the burst into one push of the only version that matters — and makes a
 * replay after a partial failure re-read rather than re-send something the child has since improved.
 *
 * An event op is the same idea for the activity log: it says "this child has new events", and the
 * flush works out which ones by comparing the log against the delivered identities below.
 */
type KvOp = { id: number; t: 'kv'; p: string; n: string; u: number }
type EventOp = { id: number; t: 'ev'; p: string }
type Op = KvOp | EventOp

/**
 * Per-profile bookkeeping that must OUTLIVE the ops (a flush empties `ops`, never this).
 *
 *  - `done` — the IDENTITIES `(ts, kind, id)` of the events the server is known to hold, pruned on
 *    every write to the ones still in the local log, so it can never outgrow the log.
 *
 *    It used to be a high-water mark on `ts`, which is smaller and wrong. Two events logged in the
 *    same millisecond share a ts, so the second one falls below the mark the first one set and is
 *    never sent; and a mark seeded from a server row written by a device with a fast clock sits in
 *    the future and hides every event after it. Both end with `syncStatus()` reporting "Đã đồng bộ
 *    ✓" over events that are provably not on the server — and that line is the one thing the spec
 *    puts in front of a parent before they wipe a device. Identity is the only thing that cannot
 *    lie about it.
 *
 *  - `clock` — when this device last wrote each kv key, which is the local half of last-write-wins
 *    on pull. A key with no entry is one this device has never written since sync existed; the pull
 *    keeps the local value and SEEDS the clock from the server's, so the next genuinely newer
 *    remote write wins instead of losing to a timestamp this device invented for itself.
 *
 *  - `mirrored` — the kv names this device knows have REACHED the server (pushed, or seen coming
 *    back from it). Distinct from `clock`, and the distinction is the whole of N3.
 *
 *    "There is no row for this key" and "this key has never been mirrored" are different facts, and
 *    reading the first as the second is what let a completed reset undo itself: the parent resets,
 *    both tables are emptied, the local half fails (a full store, or the halves ordered the other
 *    way), and the next launch finds a server with no rows and re-uploads everything the reset had
 *    just deleted. `clock` cannot stand in for this — it is stamped when the child WRITES a key,
 *    which is before anything has been sent, and the op carrying it can still be dropped by a full
 *    store. Only a fact recorded when the server actually answered can tell a reset apart from a
 *    key that never made it.
 */
type Meta = { done: string[]; mirrored: string[]; clock: Record<string, number> }

type Outbox = { v: 1; next: number; ops: Op[]; meta: Record<string, Meta> }

/** One op per key per profile, so a burst of writes cannot grow the queue without bound. */
const MAX_OPS = 500
/** Roughly a year of lesson records plus every other key — a ceiling, not a working size. */
const MAX_CLOCK_ENTRIES = 200
/** `kv_value_size` in the migration. A value over it would make the whole merge_kv call fail. */
const MAX_KV_BYTES = 16384
/** `events_kind_len`, `events_item_len`, `events_phonemes_size`. */
const MAX_KIND_LEN = 24
const MAX_ITEM_LEN = 128
const MAX_PHONEMES_BYTES = 8192
/** One upsert per this many events: 2000 rows in a single request is a payload, not a batch. */
const EVENT_BATCH = 500
/** Spec: at most one flush every 30 s off the back of writes. */
const DEBOUNCE_MS = 30_000

/**
 * What may be mirrored is an ALLOWLIST, and it does not live here — `progress/synced.ts` holds it,
 * next to the stores that own the keys, so a store author meets it while writing the store.
 *
 * This module used to decide by exclusion: everything under the child's namespace minus a two-name
 * denylist. `migrateKeysInto` deliberately sweeps keys this codebase has never heard of into that
 * namespace, so exclusion meant uploading whatever any past or future version had left behind, with
 * no module owning it — and the spec's promise is that a child's voice never leaves the device. A
 * key nobody registered now simply does not sync, which is the direction this is allowed to fail in.
 *
 * The activity log is the one value that is mirrored but is NOT a kv key: it goes to the `events`
 * table, one row per attempt, because it outgrows kv's 16 KB ceiling.
 */
const MAX_KV_NAME_LEN = 64 // `kv_key_len` in the migration

const emptyOutbox = (): Outbox => ({ v: 1, next: 1, ops: [], meta: {} })

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const finite = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * An epoch-ms column read back off the wire, or null.
 *
 * `events.ts` and `kv.updated_at` are `bigint`. PostgREST returns those as JSON numbers today —
 * epoch milliseconds are nowhere near 2^53, so nothing is lost — but a project configured to
 * serialize int8 as a string would otherwise make every pulled event fail the type check and be
 * dropped in silence, which is a restore that quietly returns nothing. Accepting both is three
 * lines; finding that bug on someone's iPad is not.
 */
function toEpoch(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toOp(value: unknown): Op | null {
  if (!isRecord(value)) return null
  const { id, t, p, n, u } = value
  if (typeof id !== 'number' || !Number.isFinite(id)) return null
  if (typeof p !== 'string' || !isProfileId(p)) return null
  if (t === 'ev') return { id, t: 'ev', p }
  if (t === 'kv' && typeof n === 'string' && n) return { id, t: 'kv', p, n, u: finite(u) }
  return null
}

const emptyMeta = (): Meta => ({ done: [], mirrored: [], clock: {} })

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function toMeta(value: unknown): Meta {
  if (!isRecord(value)) return emptyMeta()
  const clock: Record<string, number> = {}
  if (isRecord(value.clock)) {
    for (const [name, at] of Object.entries(value.clock)) {
      if (typeof at === 'number' && Number.isFinite(at)) clock[name] = at
    }
  }
  return { done: stringList(value.done), mirrored: stringList(value.mirrored), clock }
}

/**
 * The outbox, whatever is actually in that key.
 *
 * A corrupt outbox is a queue, not the child's progress: hand-edited JSON, a half-written value
 * from a tab iOS killed mid-`setItem`, or a shape from a future version. Every one of those reads
 * as "nothing queued" — the local data is untouched, the next write starts a fresh queue, and the
 * only cost is one round of ops that never made it up. Throwing here would take the app down at
 * launch for a queue.
 */
function readOutbox(): Outbox {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    if (!raw) return emptyOutbox()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return emptyOutbox()
    const ops = Array.isArray(parsed.ops)
      ? parsed.ops.map(toOp).filter((op): op is Op => op !== null)
      : []
    const meta: Record<string, Meta> = {}
    if (isRecord(parsed.meta)) {
      for (const [id, value] of Object.entries(parsed.meta)) {
        if (isProfileId(id)) meta[id] = toMeta(value)
      }
    }
    const next = Math.max(finite(parsed.next), ...ops.map(op => op.id + 1), 1)
    return { v: 1, next, ops: ops.slice(-MAX_OPS), meta }
  } catch {
    return emptyOutbox()
  }
}

function writeOutbox(box: Outbox): void {
  // A build with no cloud has no queue at all — not an empty one. `startSync` never subscribes
  // there, but the parent screen's reset path is callable regardless, and it must not be the thing
  // that puts a key in a no-cloud device's storage.
  if (!isCloudConfigured()) return
  // The oldest ops go first when the queue is over its cap: a write from a week ago has already
  // been superseded by the same key's newer op, and dropping the NEWEST would throw away the thing
  // the child just did.
  if (box.ops.length > MAX_OPS) box.ops = box.ops.slice(-MAX_OPS)
  for (const meta of Object.values(box.meta)) {
    const names = Object.keys(meta.clock)
    if (names.length > MAX_CLOCK_ENTRIES) {
      // Oldest clocks first: a stale entry only costs a "prefer the local value" that would have
      // been the answer anyway, since a missing clock reads the same way.
      const doomed = names.sort((a, b) => meta.clock[a] - meta.clock[b]).slice(0, names.length - MAX_CLOCK_ENTRIES)
      for (const name of doomed) delete meta.clock[name]
    }
    // `mirrored` tracks the same key space, so the same ceiling holds it. Dropping the front costs
    // one redundant re-push of a key the server already has, which the merge rules make harmless.
    if (meta.mirrored.length > MAX_CLOCK_ENTRIES) meta.mirrored = meta.mirrored.slice(-MAX_CLOCK_ENTRIES)
  }
  // A full store must not lose the child's progress to the queue that mirrors it, so the queue is
  // the thing that gives way: the newest half of the ops, then none of them, then the meta alone.
  //
  // Each step has to be strictly smaller than the one before or the retry is the write that just
  // failed. `slice(-Math.floor(n / 2))` was not: at n = 1 that is `slice(-0)`, which is `slice(0)`,
  // which is the whole array — the one case where the fallback mattered most.
  const attempts: Outbox[] = [
    box,
    { ...box, ops: box.ops.slice(Math.ceil(box.ops.length / 2)) },
    { ...box, ops: [] },
    // `clock` and `done` outlive the ops and are what stop the next pull regressing a value and the
    // next flush re-sending the log, so they are the last thing dropped, not the first.
    { v: 1, next: box.next, ops: [], meta: {} },
  ]
  for (const attempt of attempts) {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(attempt))
      return
    } catch { /* try a smaller one */ }
  }
  // The mirror is the first thing to go, and the last thing that matters. What was dropped here is
  // picked up again by the pull, which queues every local key the server has never seen.
}

/** Read-modify-write in one synchronous turn — as close to atomic as localStorage offers. */
function updateOutbox(change: (box: Outbox) => void): Outbox {
  const box = readOutbox()
  change(box)
  writeOutbox(box)
  return box
}

// ---------------------------------------------------------------------------
// Queueing
// ---------------------------------------------------------------------------

function enqueueKv(profileId: string, name: string, at: number): void {
  // The allowlist, at the one door every kv op comes through.
  if (!isSyncedName(name) || name.length > MAX_KV_NAME_LEN) return
  updateOutbox(box => {
    // One op per (profile, key). The value is read at flush time, so a second op for the same key
    // would only push the same bytes twice.
    box.ops = box.ops.filter(op => !(op.t === 'kv' && op.p === profileId && op.n === name))
    box.ops.push({ id: box.next++, t: 'kv', p: profileId, n: name, u: at })
    const meta = (box.meta[profileId] ??= emptyMeta())
    meta.clock[name] = at
  })
  notifyStatus()
}

function enqueueEvents(profileId: string): void {
  updateOutbox(box => {
    if (box.ops.some(op => op.t === 'ev' && op.p === profileId)) return
    box.ops.push({ id: box.next++, t: 'ev', p: profileId })
    box.meta[profileId] ??= emptyMeta()
  })
  notifyStatus()
}

/** Drop only the ops that were actually delivered — by id, so a write during the flush survives. */
function removeOps(delivered: Set<number>): void {
  if (!delivered.size) return
  updateOutbox(box => { box.ops = box.ops.filter(op => !delivered.has(op.id)) })
}

function updateMeta(profileId: string, change: (meta: Meta) => void): void {
  updateOutbox(box => { change(box.meta[profileId] ??= emptyMeta()) })
}

function readMeta(profileId: string): Meta {
  return readOutbox().meta[profileId] ?? emptyMeta()
}

/** The write seam's listener. One subscription for the whole app — see progress/storageKeys.ts. */
function recordWrite(key: string): void {
  const profileId = activeProfileId()
  // No active profile means no namespace and no server row to mirror into: the legacy shape, which
  // is what every pre-Phase-11 test and the first microseconds of a launch look like.
  if (!profileId) return
  const name = storageName(key)
  if (!name) return
  if (name === 'activity') enqueueEvents(profileId)
  else enqueueKv(profileId, name, Date.now())
  scheduleFlush()
}

// ---------------------------------------------------------------------------
// Values on the wire
// ---------------------------------------------------------------------------

/**
 * localStorage holds strings; `kv.value` is jsonb. Every value the stores write is JSON except two
 * bare scalars — `limit.minutes` ("20") and `lesson.length` ("medium") — so a value that does not
 * parse travels as a JSON string and comes back as one.
 */
const encodeValue = (raw: string): unknown => {
  try { return JSON.parse(raw) as unknown } catch { return raw }
}

const decodeValue = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value)

/** The server's limits are `octet_length`, and this app's ids and labels are full of Vietnamese. */
const byteLength = (value: string): number => {
  try { return new TextEncoder().encode(value).length } catch { return value.length * 3 }
}

const readRaw = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}

const writeRaw = (key: string, value: string): boolean => {
  try { localStorage.setItem(key, value); return true } catch { return false }
}

function readLocalEvents(profileId: string): ActivityEvent[] {
  try {
    const parsed: unknown = JSON.parse(readRaw(profileStorageKey(profileId, 'activity')) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e): e is ActivityEvent =>
      isRecord(e) && typeof e.ts === 'number' && Number.isFinite(e.ts)
      && typeof e.kind === 'string' && typeof e.id === 'string')
  } catch {
    return []
  }
}

type EventRow = {
  profile_id: string
  ts: number
  kind: string
  item_id: string
  score: number | null
  phonemes: unknown
}

/**
 * One local event as a row, or null when the server's own CHECK constraints would refuse it.
 *
 * Dropping the offender is the point: a single bad row — a score of 101 from a scorer that changed
 * its scale, an id longer than the column — fails the whole batch, and every flush after it, for
 * ever. The child's local log keeps the event either way; only the mirror skips it.
 */
function toEventRow(profileId: string, e: ActivityEvent): EventRow | null {
  if (!Number.isFinite(e.ts) || e.ts < 0) return null
  const kind = e.kind
  if (!kind || kind.length > MAX_KIND_LEN) return null
  const itemId = e.id
  if (!itemId || itemId.length > MAX_ITEM_LEN) return null
  // `score` is an int column; a fractional score is a 400, not a rounding.
  const score = typeof e.score === 'number' && Number.isFinite(e.score)
    ? Math.min(100, Math.max(0, Math.round(e.score)))
    : null
  let phonemes: unknown = Array.isArray(e.phonemes) ? e.phonemes : null
  if (phonemes !== null && byteLength(JSON.stringify(phonemes)) > MAX_PHONEMES_BYTES) phonemes = null
  return { profile_id: profileId, ts: Math.floor(e.ts), kind, item_id: itemId, score, phonemes }
}

// ---------------------------------------------------------------------------
// Status (the parent dashboard's one line)
// ---------------------------------------------------------------------------

/**
 * `off` — no cloud configured, so the dashboard shows no sync line at all.
 * `offline` — "Ngoại tuyến". `pending` — "Chưa đồng bộ n mục". `synced` — "Đã đồng bộ ✓".
 */
export type SyncState = 'off' | 'offline' | 'pending' | 'synced'

export type SyncStatus = {
  state: SyncState
  /** Queued ops — one per dirty key plus one per child with unsent events. */
  pending: number
  /** When a flush last completed with nothing left to send, or null. */
  lastSyncedAt: number | null
  /** Diagnostic only. The child never sees it, and the parent line does not print it. */
  lastError: string | null
  syncing: boolean
}

let lastSyncedAt: number | null = null
let lastError: string | null = null
let syncing = false

const statusListeners = new Set<(status: SyncStatus) => void>()

const isOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false

/**
 * Every child this device might be holding data for: the ones the outbox remembers, plus whoever is
 * using the iPad now (whose meta may not exist yet on a first launch).
 */
function trackedProfiles(box: Outbox): string[] {
  const ids = new Set(Object.keys(box.meta))
  const active = activeProfileId()
  if (active) ids.add(active)
  return [...ids]
}

/**
 * Children with events the server does not hold and **no queued op saying so**.
 *
 * This is the last place the status line could lie. The queue is not the only measure of what is
 * waiting: a full store can refuse the `ev` op (`writeOutbox` drops ops precisely when there is no
 * room), and the flush would then find an empty queue, call it a day, and report "Đã đồng bộ ✓" over
 * a log the server has never seen — the exact failure F3 was raised about, one layer down.
 */
function unrepresented(box: Outbox): string[] {
  return trackedProfiles(box).filter(profileId =>
    undelivered(profileId) > 0 && !box.ops.some(op => op.t === 'ev' && op.p === profileId))
}

export function syncStatus(): SyncStatus {
  if (!isCloudConfigured()) return { state: 'off', pending: 0, lastSyncedAt: null, lastError: null, syncing: false }
  const box = readOutbox()
  // `synced` has to mean nothing is waiting by EVERY measure this module has, not just by the one
  // that happens to be cheapest to read.
  const pending = box.ops.length + unrepresented(box).length
  const state: SyncState = !isOnline() ? 'offline' : pending > 0 ? 'pending' : 'synced'
  return { state, pending, lastSyncedAt, lastError, syncing }
}

/** For the dashboard line, which has to re-render when a flush finishes. */
export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  statusListeners.add(listener)
  return () => { statusListeners.delete(listener) }
}

function notifyStatus(): void {
  if (!statusListeners.size) return
  const status = syncStatus()
  for (const listener of [...statusListeners]) {
    try { listener(status) } catch { /* a status line must never break a sync */ }
  }
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

let profilesEnsured: Promise<string[]> | null = null

/**
 * Both tables hang off `profiles` by foreign key, so a push before the row exists is a 409 that
 * repeats for ever. `connectCloud()` normally has it done by launch; this covers a flush that beats
 * it there, and costs one upsert per session because `ensureRemoteProfiles` is `do nothing`.
 */
function ensureProfilesOnce(): Promise<string[]> {
  profilesEnsured ??= ensureRemoteProfiles().catch(() => [])
  return profilesEnsured
}

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'sync-failed'

/** The `ts` the server actually stored, for rows it did not store under the ts we sent. */
type Rewrite = { identity: string; to: number }

/**
 * What the server stored, against what we sent — the whole of "the clamp converges".
 *
 * `clamp_client_ts` caps a ts more than a day past the SERVER's clock, and a device whose own clock
 * is wrong cannot compute that ceiling: its `now` is the wrong clock. So the ceiling is not guessed,
 * it is READ — `Prefer: return=representation` on the upsert hands back the rows as stored — and the
 * local log adopts the server's ts as canonical for those events.
 *
 * Without this the two copies never meet and the damage compounds once per launch: the clamped row
 * never matches the local identity, so the pull sees it as a new event and the flush sees the local
 * one as still unsent, re-sending it into a server whose clock has moved on, which clamps it to a
 * NEW ts and inserts a second row. Three cycles, four rows, one real attempt — inflating the streak
 * and the minutes the parent reads, and eventually evicting real history through the 2000-row cap at
 * both ends. A child moving the iPad's date forward to get past `limit.minutes` is all it takes.
 *
 * A returned row that matches something we sent is unremarkable. One that does not is the server's
 * version of the rows we sent for that same `(kind, item_id)` whose ts came back nowhere — and only
 * those ABOVE it, because a clamp lowers a ts (or raises a negative one to zero). Without that guard
 * an ordinary row that merely conflicted — `on conflict do nothing` returns nothing for it — would
 * be mistaken for a clamped one and a real event would be rewritten to the wrong day.
 */
function reconcileStored(sent: EventRow[], stored: EventRow[]): Rewrite[] {
  const sentIdentities = new Set(sent.map(r => eventIdentity(r.ts, r.kind, r.item_id)))
  const storedIdentities = new Set(stored.map(r => eventIdentity(r.ts, r.kind, r.item_id)))
  const rewrites = new Map<string, number>()

  for (const row of stored) {
    if (sentIdentities.has(eventIdentity(row.ts, row.kind, row.item_id))) continue
    for (const mine of sent) {
      if (mine.kind !== row.kind || mine.item_id !== row.item_id) continue
      const identity = eventIdentity(mine.ts, mine.kind, mine.item_id)
      if (storedIdentities.has(identity)) continue
      // Only in the direction a clamp moves. Two future events for one item collapse onto the same
      // stored ts, and rewriting both is exactly right: they were one row on the server all along.
      if (mine.ts > row.ts || mine.ts < 0) rewrites.set(identity, row.ts)
    }
  }
  return [...rewrites].map(([identity, to]) => ({ identity, to }))
}

/**
 * Move the local log onto the timestamps the server actually stored.
 *
 * Rewriting the child's own log is not a step taken lightly — but the ts being replaced is one the
 * server refused, so keeping it means keeping two copies of one attempt for ever. The clamped value
 * is also the more honest of the two: it came from a clock that is right.
 */
function adoptStoredTimestamps(profileId: string, rewrites: Rewrite[]): void {
  if (!rewrites.length) return
  const key = profileStorageKey(profileId, 'activity')
  const log = readLocalEvents(profileId)
  const to = new Map(rewrites.map(r => [r.identity, r.to]))

  const seen = new Set<string>()
  const next: ActivityEvent[] = []
  for (const event of log) {
    const moved = to.get(eventIdentity(event.ts, event.kind, event.id))
    const settled = moved === undefined ? event : { ...event, ts: moved }
    const identity = eventIdentity(settled.ts, settled.kind, settled.id)
    if (seen.has(identity)) continue // two clamped copies of one attempt are one attempt
    seen.add(identity)
    next.push(settled)
  }
  next.sort((a, b) => a.ts - b.ts)
  writeRaw(key, JSON.stringify(next.slice(-ACTIVITY_CAP)))
}

/**
 * Push one child's events. Throws if anything was refused, so the caller keeps the op.
 *
 * Candidates are chosen by IDENTITY, never by a timestamp watermark — see `Meta.done`. An event the
 * constraints refuse is recorded as done too: it will never become sendable, and leaving it a
 * candidate would mean `syncStatus()` never reaching "synced" again.
 */
async function pushEvents(sb: SupabaseClient, profileId: string): Promise<void> {
  const done = new Set(readMeta(profileId).done)
  const candidates = readLocalEvents(profileId).filter(e => !done.has(eventIdentity(e.ts, e.kind, e.id)))
  if (!candidates.length) return

  const seen = new Set<string>()
  const rows: EventRow[] = []
  for (const e of candidates) {
    const identity = eventIdentity(e.ts, e.kind, e.id)
    // The local log can hold the same (ts, kind, id) twice — `logActivity` appends without looking.
    // Sending both would be a batch that conflicts with itself.
    if (seen.has(identity)) continue
    seen.add(identity)
    const row = toEventRow(profileId, e)
    if (!row) { done.add(identity); continue }
    rows.push(row)
  }

  const rewrites: Rewrite[] = []
  for (let i = 0; i < rows.length; i += EVENT_BATCH) {
    const batch = rows.slice(i, i + EVENT_BATCH)
    const { data, error } = await sb
      .from('events')
      // `ignoreDuplicates` — an `on conflict do nothing`. An event is immutable, so a replay is
      // meant to be a no-op rather than a rewrite, and DO NOTHING is the version of that which
      // cannot fail on a batch that repeats a key — including a batch whose keys only collide
      // AFTER the server's clamp has run over them.
      .upsert(batch, { onConflict: 'profile_id,ts,kind,item_id', ignoreDuplicates: true })
      // …and the representation is what makes the clamp converge rather than compound.
      .select('ts, kind, item_id')
    if (error) throw new Error(error.message)
    const stored = (Array.isArray(data) ? data : []).map(row => ({
      ...(row as RemoteEventRow),
      ts: toEpoch((row as RemoteEventRow).ts) ?? Number.NaN,
      kind: String((row as RemoteEventRow).kind),
      item_id: String((row as RemoteEventRow).item_id),
    })).filter(row => Number.isFinite(row.ts)) as EventRow[]
    rewrites.push(...reconcileStored(batch, stored))
  }

  for (const row of rows) {
    const identity = eventIdentity(row.ts, row.kind, row.item_id)
    const moved = rewrites.find(r => r.identity === identity)
    done.add(moved ? eventIdentity(moved.to, row.kind, row.item_id) : identity)
  }
  adoptStoredTimestamps(profileId, rewrites)
  rememberDelivered(profileId, done)
}

/**
 * Record what the server holds, pruned to what the local log still contains.
 *
 * The prune is what bounds it: `done` can never be longer than the log, which is itself capped, and
 * an event that has rotated out of the log can never be a candidate again anyway.
 */
function rememberDelivered(profileId: string, delivered: Set<string>): void {
  const present = new Set(readLocalEvents(profileId).map(e => eventIdentity(e.ts, e.kind, e.id)))
  updateMeta(profileId, meta => {
    meta.done = [...delivered].filter(identity => present.has(identity))
  })
}

/** The events in the local log the server is not known to hold. Drives the honest status line. */
function undelivered(profileId: string): number {
  const done = new Set(readMeta(profileId).done)
  return readLocalEvents(profileId).filter(e => !done.has(eventIdentity(e.ts, e.kind, e.id))).length
}

/** Push one child's dirty kv keys. Returns the op ids that are now safely mirrored. */
async function pushKv(sb: SupabaseClient, profileId: string, ops: KvOp[]): Promise<Set<number>> {
  const done = new Set<number>()
  const entries: { key: string; value: unknown; updated_at: number }[] = []
  const included: number[] = []

  for (const op of ops) {
    const raw = readRaw(profileStorageKey(op.p, op.n))
    // Gone since the write: a parent reset (which is a DELETE server-side, never a merge) or a
    // pruned lesson record. There is nothing to mirror, so the op is finished, not failed.
    if (raw === null) { done.add(op.id); continue }
    // The server's kv_value_size CHECK would refuse the whole call. Skipping one key keeps the rest
    // of the child's progress syncing.
    if (byteLength(raw) > MAX_KV_BYTES) { done.add(op.id); continue }
    // **A value that fails its own declared shape is never sent.** Belt as well as braces: the merge
    // already refuses to queue one, but the merge is not the only thing that queues an op — a plain
    // store write does too, and a local value can be the wrong shape without a pull ever having run
    // (`setStars` writing onto an array leaves `[]`, which serialises as an array and would reach
    // `merge_kv` as one, where no per-entry max is possible and the child's whole star map on the
    // server becomes `[]`). The op is finished rather than retried: it can never succeed, and the
    // next pull is what heals the local value.
    if (!isValidStoredValue(op.n, raw)) { done.add(op.id); continue }
    entries.push({ key: op.n, value: encodeValue(raw), updated_at: op.u })
    included.push(op.id)
  }

  if (entries.length) {
    const { error } = await sb.rpc('merge_kv', { profile: profileId, entries })
    if (error) throw new Error(error.message)
    // The server answered, so these names have REACHED it — the fact `mirrored` records, and the
    // one that lets a later pull tell "deleted by a reset" from "never sent".
    const names = entries.map(entry => entry.key)
    updateMeta(profileId, meta => { meta.mirrored = [...new Set([...meta.mirrored, ...names])] })
  }
  for (const id of included) done.add(id)
  return done
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

let running: Promise<void> | null = null
let rerun = false

/**
 * Send everything queued, once.
 *
 * Two callers arriving together share ONE run and one set of requests — a second concurrent flush
 * would push the same ops again — and a flush that starts while one is in progress is not dropped
 * either: it raises `rerun`, and the loop below goes round again over the ops that arrived
 * meanwhile. Both callers await the same promise, so "the flush has finished" means the same thing
 * to both of them.
 */
export function flush(): Promise<void> {
  if (running) { rerun = true; return running }
  running = (async () => {
    try {
      do {
        rerun = false
        await runFlush()
      } while (rerun)
    } finally {
      running = null
    }
  })()
  return running
}

async function runFlush(): Promise<void> {
  lastFlushAt = Date.now()
  const sb = await getSupabase()
  if (!sb) return
  // `navigator.onLine === false` is the reliable half of that flag: it really does mean no network.
  // Anything else is attempted, because "true" only ever meant an interface is up.
  if (!isOnline()) return

  // Re-open a queue for anything the outbox has lost track of but the log still owes — an `ev` op a
  // full store refused, or one consumed by a flush that was running when the event was logged.
  // Doing it here, before the queue is read, is what stops an empty outbox being mistaken for an
  // empty mailbox.
  for (const profileId of unrepresented(readOutbox())) enqueueEvents(profileId)

  const ops = readOutbox().ops
  if (!ops.length) { lastSyncedAt = Date.now(); notifyStatus(); return }

  // No session yet (first launch, still signing in, or offline since install): the ops wait. They
  // are the child's progress on its way up, not something to drop for want of an account.
  if (!(await currentUserId())) return

  syncing = true
  notifyStatus()
  try {
    await ensureProfilesOnce()

    const byProfile = new Map<string, Op[]>()
    for (const op of ops) {
      const list = byProfile.get(op.p)
      if (list) list.push(op)
      else byProfile.set(op.p, [op])
    }

    const delivered = new Set<number>()
    let failure: string | null = null

    for (const [profileId, profileOps] of byProfile) {
      // Events and kv are pushed independently so one failing table cannot hold the other's ops
      // hostage — and so a profile whose row is missing cannot stall the child who is using the iPad.
      const eventOps = profileOps.filter((op): op is EventOp => op.t === 'ev')
      if (eventOps.length) {
        try {
          await pushEvents(sb, profileId)
          for (const op of eventOps) delivered.add(op.id)
        } catch (e) { failure ??= errorMessage(e) }
      }
      const kvOps = profileOps.filter((op): op is KvOp => op.t === 'kv')
      if (kvOps.length) {
        try {
          for (const id of await pushKv(sb, profileId, kvOps)) delivered.add(id)
        } catch (e) { failure ??= errorMessage(e) }
      }
    }

    removeOps(delivered)

    // An event logged WHILE this flush was pushing found an `ev` op already queued and added
    // nothing — and that op has just been removed as delivered, which would leave the event unsent
    // with the status line reading "Đã đồng bộ ✓" over the top of it. The queue is re-opened here
    // instead, and the loop in `flush()` sends it before this call returns.
    for (const profileId of byProfile.keys()) {
      if (!undelivered(profileId)) continue
      if (readOutbox().ops.some(op => op.t === 'ev' && op.p === profileId)) continue
      enqueueEvents(profileId)
      if (!failure) rerun = true
    }

    lastError = failure
    if (!failure && !readOutbox().ops.length) lastSyncedAt = Date.now()
  } catch (e) {
    // Nothing was removed, so nothing was lost: the whole queue is still there for the next trigger.
    lastError = errorMessage(e)
  } finally {
    syncing = false
    notifyStatus()
  }
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

type KvRow = { key?: unknown; value?: unknown; updated_at?: unknown }
type RemoteEventRow = { ts?: unknown; kind?: unknown; item_id?: unknown; score?: unknown; phonemes?: unknown }

const pulled = new Set<string>()
const pulling = new Map<string, Promise<boolean>>()

/**
 * Bring one child's cloud copy down and merge it INTO localStorage.
 *
 * The merge rules are not re-implemented here: `mergeStoredValue` in progress/storageKeys.ts is the
 * app's one copy of them (stars max, activity union, everything else last-write-wins) and the
 * orphan rescue uses the same function. A pull can therefore never lower a star or shorten the
 * event log, whatever the server says — which is the whole of "pull must not regress a local value
 * that is ahead".
 *
 * **The profile must already be in the roster.** Until it is, `rescueOrphanNamespaces` reads the
 * keys written here as abandoned and folds them into the active child; the refusal below makes that
 * ordering a rule rather than a note. Flows 3 and 4: `adoptProfiles(await fetchRemoteProfiles())`
 * first, then this.
 */
export async function pullProfile(profileId: string): Promise<boolean> {
  if (!isProfileId(profileId)) return false
  if (!listProfiles().some(p => p.id === profileId)) return false
  const inFlight = pulling.get(profileId)
  if (inFlight) return inFlight
  const run = runPull(profileId).finally(() => { pulling.delete(profileId) })
  pulling.set(profileId, run)
  return run
}

async function runPull(profileId: string): Promise<boolean> {
  const sb = await getSupabase()
  if (!sb) return false
  if (!isOnline()) return false
  if (!(await currentUserId())) return false

  try {
    const kv = await sb.from('kv').select('key, value, updated_at').eq('profile_id', profileId)
    if (kv.error) throw new Error(kv.error.message)
    const events = await sb
      .from('events')
      .select('ts, kind, item_id, score, phonemes')
      .eq('profile_id', profileId)
      .order('ts', { ascending: false })
      .limit(ACTIVITY_CAP)
    if (events.error) throw new Error(events.error.message)

    mergeKvRows(profileId, Array.isArray(kv.data) ? (kv.data as KvRow[]) : [])
    mergeEventRows(profileId, Array.isArray(events.data) ? (events.data as RemoteEventRow[]) : [])
    pulled.add(profileId)
    lastError = null
    notifyStatus()
    return true
  } catch (e) {
    lastError = errorMessage(e)
    notifyStatus()
    return false
  }
}

/**
 * The child's mirrorable values that are on disk — **allowlisted names only**.
 *
 * It exists for the keys the server has never heard of. A key whose op was dropped by a full store
 * (see `writeOutbox`) would otherwise never be mirrored at all if it is one the app writes ONCE —
 * `lesson.length`, `limit.minutes` — because the only other thing that queues a key is the pull, and
 * the pull could only ever queue keys the server already had.
 *
 * `isSyncedName` is what stops that reach turning into "upload everything under the namespace":
 * `migrateKeysInto` puts keys from versions this code has never seen in there too.
 */
function localKvNames(profileId: string): string[] {
  const prefix = profilePrefix(profileId)
  const names: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      const name = key.slice(prefix.length)
      if (!name || !isSyncedName(name) || name.length > MAX_KV_NAME_LEN) continue
      names.push(name)
    }
  } catch { /* storage unavailable: nothing to mirror */ }
  return names
}

/**
 * Which `lesson.<day>` names may be written to disk, given everything both sides know about.
 *
 * `saveLesson` keeps the newest `KEEP_DAYS` records and deletes the rest. The server has no such
 * prune — deliberately, so the parent dashboard keeps its history — so a year-old account hands
 * back a year of lesson records on every launch, `saveLesson` deletes all but thirty on the next
 * write, and the two ping-pong for ever. On an iPad near its quota that churn is what makes the
 * swallowed `setItem` in `store.ts` drop a star.
 *
 * **A deletion the client made on purpose is not the same as a value it has never seen.** The
 * retention policy is the client's, so it applies to what comes down too.
 */
function retainedLessonDays(remoteNames: string[], profileId: string): Set<string> {
  const days = new Set<string>()
  for (const name of [...remoteNames, ...localKvNames(profileId)]) {
    const day = lessonDayInName(name)
    if (day) days.add(day)
  }
  // Day keys sort lexicographically the same way they sort chronologically — the assumption
  // `saveLesson` already prunes by.
  return new Set([...days].sort().slice(-KEEP_DAYS))
}

function mergeKvRows(profileId: string, rows: KvRow[]): void {
  const meta = readMeta(profileId)
  const clock = meta.clock
  const accepted: Record<string, number> = {}
  const ahead: { name: string; at: number }[] = []
  const seenRemotely = new Set<string>()
  const keepDays = retainedLessonDays(
    rows.map(row => (typeof row.key === 'string' ? row.key : '')),
    profileId,
  )

  for (const row of rows) {
    const name = typeof row.key === 'string' ? row.key : ''
    // A row for a key this app does not own — an older version's, or a newer one's. It is not
    // written to disk and it is not counted as anything.
    if (!name || !isSyncedName(name)) continue
    seenRemotely.add(name)
    if (row.value === undefined || row.value === null) continue
    // Outside the local retention window: writing it would only give `saveLesson` something to
    // delete. It stays on the server, where the dashboard can still read it.
    const day = lessonDayInName(name)
    if (day && !keepDays.has(day)) continue

    const incoming = decodeValue(row.value)
    const remoteAt = toEpoch(row.updated_at) ?? 0
    const localAt = clock[name]
    const key = profileStorageKey(profileId, name)
    const existing = readRaw(key)

    // A key this device has never written since sync existed carries no clock. The local value
    // still wins — the child has been using it — but the clock is SEEDED from the server's rather
    // than invented, so a genuinely newer write from the other iPad wins next time instead of
    // losing to a timestamp this device made up for itself.
    const shape = syncedShape(name)
    const preferIncoming = localAt !== undefined && remoteAt >= localAt
    const { value: merged, source } = mergeStored(name, existing, incoming, preferIncoming, shape ?? undefined)

    if (source === 'stalemate') {
      // Neither copy passes the key's own shape. Nothing is written and nothing is pushed: there is
      // nothing to heal from and nothing worth sending.
      continue
    }
    if (merged !== existing && !writeRaw(key, merged)) continue

    // The server's row is not the shape this key holds — an older or newer build wrote it. Our copy
    // is good (or `mergeStored` would have said stalemate), so it goes up regardless of clocks, and
    // with one that wins: leaving junk up there means every other device heals FROM it.
    const remoteIsJunk = shape !== null && !shape(incoming)

    if (remoteIsJunk) {
      ahead.push({ name, at: Math.max(localAt ?? 0, remoteAt) })
    } else if (source === 'existing' && localAt !== undefined) {
      // A real local value with a real clock, and it is the newer one. Say so, with its own clock:
      // it already beats the remote, so nothing has to be forged for the decision to stick.
      ahead.push({ name, at: localAt })
    } else if (source === 'merged') {
      // Neither side had the result (a higher star, a longer log). `stars` merges by MAX server-side
      // and ignores the clock entirely, so this only has to be a sane timestamp, not a winning one.
      ahead.push({ name, at: Math.max(localAt ?? 0, remoteAt) })
    } else {
      // 'incoming' — the server already holds everything this device does.
      // 'existing' with no clock — kept locally, and the seed here is the whole point of F5.
      // 'damaged'  — the local value failed its own shape and the server's did not. The server's
      //              copy has been adopted (the device is healed rather than left unreadable) and
      //              NOTHING is pushed: bytes that fail their shape are not news.
      accepted[name] = remoteAt
    }
  }

  // A row that came back is a row the server holds — the second of the two facts `mirrored` keeps
  // apart from `clock`.
  updateMeta(profileId, m => {
    Object.assign(m.clock, accepted)
    m.mirrored = [...new Set([...m.mirrored, ...seenRemotely])]
  })
  for (const { name, at } of ahead) enqueueKv(profileId, name, at)

  // Anything on disk the server has never seen AND this device has never sent. Queued last, so a
  // key that is both unknown remotely and outside the lesson window is not queued twice.
  //
  // The second half of that condition is what stops a completed reset undoing itself. After
  // `resetRemoteProgress` the server legitimately has no rows, and the local half may not have run
  // — but every one of those keys is on `mirrored`, so "there is no row" reads as "it was deleted",
  // not as "it was never mirrored". A key whose op a full store dropped was never on `mirrored` in
  // the first place, so it still goes up. Two different facts, told apart.
  const known = new Set(readMeta(profileId).mirrored)
  for (const name of localKvNames(profileId)) {
    if (seenRemotely.has(name) || known.has(name)) continue
    const day = lessonDayInName(name)
    if (day && !keepDays.has(day)) continue
    // There is no remote value here to regress, so `Date.now()` cannot lose the child anything —
    // it is this device asserting a key the server does not have at all.
    enqueueKv(profileId, name, clock[name] ?? Date.now())
  }
}

function mergeEventRows(profileId: string, rows: RemoteEventRow[]): void {
  const remote: ActivityEvent[] = []
  for (const row of rows) {
    const ts = toEpoch(row.ts)
    if (ts === null) continue
    if (typeof row.kind !== 'string' || typeof row.item_id !== 'string') continue
    const event: ActivityEvent = { ts, kind: row.kind as ActivityEvent['kind'], id: row.item_id }
    if (typeof row.score === 'number' && Number.isFinite(row.score)) event.score = row.score
    if (Array.isArray(row.phonemes)) event.phonemes = row.phonemes as ActivityEvent['phonemes']
    remote.push(event)
  }

  const key = profileStorageKey(profileId, 'activity')
  const existing = readRaw(key)
  const merged = mergeStoredValue('activity', existing, JSON.stringify(remote))
  if (merged !== existing) writeRaw(key, merged)

  // Every row the server just sent is, by definition, a row the server holds. Recording them is
  // what stops a device that has restored from a wiped cache pushing the entire log straight back —
  // and it is exact, where the old "watermark at the newest row" was merely usually right.
  const delivered = new Set(readMeta(profileId).done)
  for (const event of remote) delivered.add(eventIdentity(event.ts, event.kind, event.id))
  rememberDelivered(profileId, delivered)

  // Whatever is left is local-only and has to go up. `pushEvents` works out which, from the same
  // set; this only has to open a queue for it.
  if (undelivered(profileId)) enqueueEvents(profileId)
}

// ---------------------------------------------------------------------------
// Reset (a DELETE, never a merge)
// ---------------------------------------------------------------------------

/**
 * Wipe one child's cloud copy, for the parent screen's "reset progress".
 *
 * It has to be a DELETE. A reset expressed as an empty value would be out-merged the moment any
 * device flushed — stars merge by MAX — and the parent would watch the stars come back. The caller
 * clears localStorage; this clears the mirror.
 *
 * The queue is dropped FIRST, in the same turn, so no op left over from before the reset can push
 * the deleted rows back up.
 */
export async function resetRemoteProgress(profileId: string): Promise<boolean> {
  if (!isProfileId(profileId)) return false
  forgetProfile(profileId)
  const sb = await getSupabase()
  if (!sb) return false
  if (!(await currentUserId())) return false
  try {
    const kv = await sb.from('kv').delete().eq('profile_id', profileId)
    if (kv.error) throw new Error(kv.error.message)
    const events = await sb.from('events').delete().eq('profile_id', profileId)
    if (events.error) throw new Error(events.error.message)
    settleAfterReset(profileId)
    return true
  } catch (e) {
    lastError = errorMessage(e)
    notifyStatus()
    return false
  }
}

/**
 * Write down that this device has nothing to send for anything the child currently holds.
 *
 * The reset succeeded; the local half is the caller's and may not have run — a full store, or a
 * parent screen that clears localStorage second. Either way the next launch must not read an empty
 * server as "none of this was ever mirrored" and upload the lot, which is the standing ruling
 * (a reset is a DELETE, not a merge) undone by the back door.
 *
 * So every key and every event that is on disk RIGHT NOW is recorded as accounted for. Anything the
 * child does after this is a new write, gets an op like any other, and syncs normally.
 */
function settleAfterReset(profileId: string): void {
  const names = localKvNames(profileId)
  const identities = readLocalEvents(profileId).map(e => eventIdentity(e.ts, e.kind, e.id))
  updateMeta(profileId, meta => {
    meta.mirrored = [...new Set([...meta.mirrored, ...names])]
    meta.done = [...new Set([...meta.done, ...identities])]
  })
  notifyStatus()
}

/** Forget everything queued and remembered for one child (a reset, or a profile being removed). */
export function forgetProfile(profileId: string): void {
  updateOutbox(box => {
    box.ops = box.ops.filter(op => op.p !== profileId)
    delete box.meta[profileId]
  })
  pulled.delete(profileId)
  notifyStatus()
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

export type SyncOptions = {
  /** At most one write-driven flush per this many ms (spec: 30 s). */
  debounceMs?: number
}

let started = false
let debounceMs = DEBOUNCE_MS
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastFlushAt = 0
let detach: (() => void)[] = []

function scheduleFlush(): void {
  if (debounceTimer !== null) return
  const wait = Math.max(0, lastFlushAt + debounceMs - Date.now())
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flush()
  }, wait)
}

const onOnline = (): void => { void syncNow() }

const onHidden = (): void => {
  // iOS gives no promise that anything runs after this, which is exactly why it is a trigger: the
  // child putting the iPad down is the last reliable moment to get their lesson up.
  if (typeof document === 'undefined' || document.visibilityState === 'hidden') void flush()
}

/**
 * Pull what is missing, then push what is queued.
 *
 * The pull happens once per profile per session — it is a restore, not a poll. Task 4 forces
 * another one after a sign-in or a recovery by calling `pullProfile` directly.
 */
export async function syncNow(): Promise<void> {
  const profileId = activeProfileId()
  if (profileId && !pulled.has(profileId)) await pullProfile(profileId)
  await flush()
}

/**
 * Attach the mirror to the app. Called once, from `main.tsx`, after `bootstrapProfiles()`.
 *
 * **With no cloud configured this attaches nothing and returns.** No store-write listener, no
 * window listeners, no outbox key — a build without the env vars must be the app it was before this
 * phase, down to what is in localStorage.
 */
export function startSync(options: SyncOptions = {}): () => void {
  if (started) return stopSync
  if (!isCloudConfigured()) return () => undefined
  started = true
  debounceMs = options.debounceMs ?? DEBOUNCE_MS

  detach.push(subscribeStoreWrites(recordWrite))
  detach.push(subscribeAuth(event => {
    // A sign-in is a new account's data arriving, so the once-per-session pull is offered again.
    if (event === 'SIGNED_IN') pulled.clear()
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') void syncNow()
  }))

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline)
    detach.push(() => window.removeEventListener('online', onOnline))
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onHidden)
    detach.push(() => document.removeEventListener('visibilitychange', onHidden))
  }

  void syncNow()
  return stopSync
}

export function stopSync(): void {
  for (const off of detach) {
    try { off() } catch { /* already gone */ }
  }
  detach = []
  if (debounceTimer !== null) { clearTimeout(debounceTimer); debounceTimer = null }
  started = false
}

/** Test seam: forget the listeners, the in-flight work and everything remembered this session. */
export function resetSyncForTest(): void {
  stopSync()
  running = null
  rerun = false
  profilesEnsured = null
  pulled.clear()
  pulling.clear()
  statusListeners.clear()
  lastSyncedAt = null
  lastError = null
  syncing = false
  lastFlushAt = 0
  debounceMs = DEBOUNCE_MS
}
