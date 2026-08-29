import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityEvent } from '../progress/activity'
import {
  ROOT,
  isProfileId,
  mergeStoredValue,
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
 * flush works out which ones from the log and the watermark below.
 */
type KvOp = { id: number; t: 'kv'; p: string; n: string; u: number }
type EventOp = { id: number; t: 'ev'; p: string }
type Op = KvOp | EventOp

/**
 * Per-profile bookkeeping that must OUTLIVE the ops (a flush empties `ops`, never this).
 *
 *  - `sent` — the highest event `ts` this device has pushed. Events at or below it are on the
 *    server, so a flush only ever carries the tail.
 *  - `clock` — when this device last wrote each kv key, which is the local half of last-write-wins
 *    on pull. A key with no entry reads as "written at an unknown time", and the pull then keeps
 *    the local value: the child has been using it, and guessing is how progress goes backwards.
 */
type Meta = { sent: number; clock: Record<string, number> }

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
/** Mirrors `activity.ts` and the server's prune trigger. */
const ACTIVITY_CAP = 2000
/** Spec: at most one flush every 30 s off the back of writes. */
const DEBOUNCE_MS = 30_000

/**
 * The activity log is NOT a kv value. It is the `events` table — one row per attempt, deduped by
 * the primary key — and it routinely outgrows kv's 16 KB ceiling. Anything else the stores write
 * goes up as kv.
 */
const NEVER_KV = new Set(['activity'])

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

function toMeta(value: unknown): Meta {
  if (!isRecord(value)) return { sent: 0, clock: {} }
  const clock: Record<string, number> = {}
  if (isRecord(value.clock)) {
    for (const [name, at] of Object.entries(value.clock)) {
      if (typeof at === 'number' && Number.isFinite(at)) clock[name] = at
    }
  }
  return { sent: finite(value.sent), clock }
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
    if (names.length <= MAX_CLOCK_ENTRIES) continue
    // Oldest clocks first: a stale entry only costs a "prefer the local value" that would have been
    // the answer anyway, since a missing clock reads the same way.
    const doomed = names.sort((a, b) => meta.clock[a] - meta.clock[b]).slice(0, names.length - MAX_CLOCK_ENTRIES)
    for (const name of doomed) delete meta.clock[name]
  }
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(box))
  } catch {
    // A full store must not lose the child's progress to the queue that mirrors it. Half the ops go
    // — replays are idempotent and the local data is untouched either way — and if even that will
    // not fit, the queue is abandoned in silence.
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify({ ...box, ops: box.ops.slice(-Math.floor(box.ops.length / 2)) }))
    } catch { /* the mirror is the first thing to go, and the last thing that matters */ }
  }
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
  if (NEVER_KV.has(name) || name.length > 64) return
  updateOutbox(box => {
    // One op per (profile, key). The value is read at flush time, so a second op for the same key
    // would only push the same bytes twice.
    box.ops = box.ops.filter(op => !(op.t === 'kv' && op.p === profileId && op.n === name))
    box.ops.push({ id: box.next++, t: 'kv', p: profileId, n: name, u: at })
    const meta = (box.meta[profileId] ??= { sent: 0, clock: {} })
    meta.clock[name] = at
  })
  notifyStatus()
}

function enqueueEvents(profileId: string): void {
  updateOutbox(box => {
    if (box.ops.some(op => op.t === 'ev' && op.p === profileId)) return
    box.ops.push({ id: box.next++, t: 'ev', p: profileId })
    box.meta[profileId] ??= { sent: 0, clock: {} }
  })
  notifyStatus()
}

/** Drop only the ops that were actually delivered — by id, so a write during the flush survives. */
function removeOps(delivered: Set<number>): void {
  if (!delivered.size) return
  updateOutbox(box => { box.ops = box.ops.filter(op => !delivered.has(op.id)) })
}

function updateMeta(profileId: string, change: (meta: Meta) => void): void {
  updateOutbox(box => { change(box.meta[profileId] ??= { sent: 0, clock: {} }) })
}

function readMeta(profileId: string): Meta {
  return readOutbox().meta[profileId] ?? { sent: 0, clock: {} }
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

const eventIdentity = (ts: number, kind: string, itemId: string): string => `${ts}|${kind}|${itemId}`

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

export function syncStatus(): SyncStatus {
  if (!isCloudConfigured()) return { state: 'off', pending: 0, lastSyncedAt: null, lastError: null, syncing: false }
  const pending = readOutbox().ops.length
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

/**
 * Push one child's events. Throws if anything was refused, so the caller keeps the op.
 *
 * The watermark moves only on success, and only to the highest ts we CONSIDERED — including rows
 * the constraints made us skip, which will never become sendable and must not pin the tail open.
 * Moving it any earlier is how an event gets lost: the next flush would see nothing above the
 * watermark, decide there is nothing to send, and drop the op that was still carrying it.
 */
async function pushEvents(sb: SupabaseClient, profileId: string): Promise<void> {
  const sent = readMeta(profileId).sent
  const candidates = readLocalEvents(profileId).filter(e => e.ts > sent)
  if (!candidates.length) return

  const seen = new Set<string>()
  const rows: EventRow[] = []
  for (const e of candidates) {
    const row = toEventRow(profileId, e)
    if (!row) continue
    // The local log can hold the same (ts, kind, id) twice — `logActivity` appends without looking.
    // Sending both would be a batch that conflicts with itself.
    const identity = eventIdentity(row.ts, row.kind, row.item_id)
    if (seen.has(identity)) continue
    seen.add(identity)
    rows.push(row)
  }

  for (let i = 0; i < rows.length; i += EVENT_BATCH) {
    const { error } = await sb
      .from('events')
      // `ignoreDuplicates` — an `on conflict do nothing`. An event is immutable, so a replay is
      // meant to be a no-op rather than a rewrite, and DO NOTHING is the version of that which
      // cannot fail on a batch that repeats a key.
      .upsert(rows.slice(i, i + EVENT_BATCH), {
        onConflict: 'profile_id,ts,kind,item_id',
        ignoreDuplicates: true,
      })
    if (error) throw new Error(error.message)
  }

  // The server CLAMPS a ts more than a day ahead of its own clock (clamp_client_ts), so the row it
  // stored may not carry the ts we sent. That is not an error and must not be treated as one: the
  // watermark is OUR clock, so nothing here re-sends, retries or loops over the difference.
  const high = candidates.reduce((max, e) => (e.ts > max ? e.ts : max), sent)
  updateMeta(profileId, meta => { meta.sent = high })
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
    entries.push({ key: op.n, value: encodeValue(raw), updated_at: op.u })
    included.push(op.id)
  }

  if (entries.length) {
    const { error } = await sb.rpc('merge_kv', { profile: profileId, entries })
    if (error) throw new Error(error.message)
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

function mergeKvRows(profileId: string, rows: KvRow[]): void {
  const clock = readMeta(profileId).clock
  const accepted: Record<string, number> = {}
  const ahead: { name: string; at: number }[] = []

  for (const row of rows) {
    const name = typeof row.key === 'string' ? row.key : ''
    if (!name || NEVER_KV.has(name)) continue
    if (row.value === undefined || row.value === null) continue
    const incoming = decodeValue(row.value)
    const remoteAt = toEpoch(row.updated_at) ?? 0
    const localAt = clock[name]
    const key = profileStorageKey(profileId, name)
    const existing = readRaw(key)

    // A key this device has never written carries no clock, so the local value wins by default —
    // the conservative half of last-write-wins, and the same choice the orphan rescue makes.
    const preferIncoming = localAt !== undefined && remoteAt >= localAt
    const merged = mergeStoredValue(name, existing, incoming, preferIncoming)

    if (merged !== existing && !writeRaw(key, merged)) continue
    if (merged === incoming) {
      // What is on disk is now exactly what the server holds; its clock is the honest one.
      accepted[name] = remoteAt
    } else {
      // Either the local value won outright or the merge produced something neither side had (a
      // higher star, a longer log). Either way the server is behind and the next flush says so —
      // and it has to say so with a clock that WINS, or the decision made here would be quietly
      // reversed by the server's own last-write-wins and the two ends would never converge. Ties go
      // to the incoming write in `merge_kv`, so matching the remote clock is enough; no forging a
      // timestamp past it.
      ahead.push({ name, at: Math.max(localAt ?? 0, remoteAt, Date.now()) })
    }
  }

  if (Object.keys(accepted).length) {
    updateMeta(profileId, meta => { Object.assign(meta.clock, accepted) })
  }
  for (const { name, at } of ahead) enqueueKv(profileId, name, at)
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
  const local = readLocalEvents(profileId)
  const merged = mergeStoredValue('activity', existing, JSON.stringify(remote))
  if (merged !== existing) writeRaw(key, merged)

  // What the server is missing, exactly: the events it did not send back. Moving the watermark to
  // just below the oldest of them is what puts them in the next flush without replaying the whole
  // restored log; with nothing missing the watermark jumps to the newest row the server holds, so a
  // device that has just restored from a wiped cache pushes nothing at all.
  const known = new Set(remote.map(e => eventIdentity(e.ts, e.kind, e.id)))
  const missing = local.filter(e => !known.has(eventIdentity(e.ts, e.kind, e.id)))
  const newestRemote = remote.reduce((max, e) => (e.ts > max ? e.ts : max), 0)

  if (!missing.length) {
    updateMeta(profileId, meta => { if (newestRemote > meta.sent) meta.sent = newestRemote })
    return
  }
  const oldestMissing = missing.reduce((min, e) => (e.ts < min ? e.ts : min), missing[0].ts)
  updateMeta(profileId, meta => { meta.sent = Math.max(0, Math.min(meta.sent, oldestMissing - 1)) })
  enqueueEvents(profileId)
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
    return true
  } catch (e) {
    lastError = errorMessage(e)
    notifyStatus()
    return false
  }
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
