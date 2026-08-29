import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * The cloud client is mocked; the SERVER is not.
 *
 * `makeServer()` below is a working stand-in for the migration: the events primary key really does
 * dedupe, `merge_kv` really does take the max for stars and last-write-wins for everything else,
 * `clamp_client_ts` really does cap a client clock, and a foreign profile really is a 403. Every
 * failure mode this suite is about — a replay, a partial flush, a clamped timestamp, a star that
 * must not go backwards — is a claim about what the app does against THAT behaviour, and a mock
 * that just recorded calls could not make any of them.
 */
const cloud = vi.hoisted(() => ({ client: null as unknown, configured: false }))
vi.mock('./supabase', () => ({
  getSupabase: async () => cloud.client,
  isCloudConfigured: () => cloud.configured,
  resetSupabaseClient: () => undefined,
}))

import { logActivity } from '../progress/activity'
import { getBand, setBandValue } from '../progress/band'
import { promote } from '../progress/leitner'
import { KEEP_DAYS, getLessonLength, saveLesson, setLessonLength } from '../progress/lessonStore'
import { getLimitMinutes, setLimitMinutes } from '../progress/limit'
import { getStars, setStars } from '../progress/store'
import { resetAuthState } from './auth'
import { resetProfilesForTest } from './profileState'
import {
  flush,
  forgetProfile,
  pullProfile,
  resetRemoteProgress,
  resetSyncForTest,
  startSync,
  stopSync,
  subscribeSyncStatus,
  syncNow,
  syncStatus,
} from './sync'

// ---------------------------------------------------------------------------
// A Supabase-shaped stand-in for the real schema
// ---------------------------------------------------------------------------

type Json = unknown
type EventRow = { profile_id: string; ts: number; kind: string; item_id: string; score: number | null; phonemes: Json }
type KvRow = { profile_id: string; key: string; value: Json; updated_at: number }
type Reply = { data: unknown; error: { message: string; code?: string } | null }

const ok = (data: unknown = null): Reply => ({ data, error: null })
const fail = (message: string, code?: string): Reply => ({ data: null, error: { message, code } })

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const PROFILE = '11111111-2222-4333-8444-555555555555'
const OTHER = '99999999-8888-4777-8666-555555555555'

function makeServer() {
  const profiles = new Map<string, string>()
  const events: EventRow[] = []
  const kv = new Map<string, KvRow>()

  const state = {
    userId: 'user-1' as string | null,
    /** `clamp_client_ts`'s ceiling. Infinity = a server whose clock agrees with the device. */
    ceiling: Number.POSITIVE_INFINITY,
    failEvents: null as string | null,
    failKv: null as string | null,
    failPull: null as string | null,
  }
  const calls: { op: string; count: number }[] = []
  const record = (op: string) => {
    const last = calls[calls.length - 1]
    if (last?.op === op) last.count++
    else calls.push({ op, count: 1 })
  }
  const countOf = (op: string) => calls.filter(c => c.op === op).reduce((n, c) => n + c.count, 0)

  const clamp = (ts: number) => Math.max(0, Math.min(ts, state.ceiling))
  const owns = (profileId: string) => state.userId !== null && profiles.get(profileId) === state.userId
  const eventKey = (r: { profile_id: string; ts: number; kind: string; item_id: string }) =>
    `${r.profile_id}|${r.ts}|${r.kind}|${r.item_id}`

  function upsertEvents(rows: EventRow[]): Reply {
    record('events.upsert')
    if (state.failEvents) return fail(state.failEvents)
    // `Prefer: return=representation` with `resolution=ignore-duplicates`: only the rows actually
    // INSERTED come back, and they come back as the database stored them — clamp and all. A row
    // that merely conflicted returns nothing at all, which is the case the reconciliation has to
    // not mistake for a clamp.
    const inserted: EventRow[] = []
    for (const row of rows) {
      // The foreign key, and RLS on top of it: a profile this user does not own is not reachable.
      if (!owns(row.profile_id)) return fail('insert or update on table "events" violates foreign key constraint', '23503')
      if (typeof row.score === 'number' && !Number.isInteger(row.score)) return fail('invalid input syntax for type integer', '22P02')
      if (typeof row.score === 'number' && (row.score < 0 || row.score > 100)) return fail('violates check constraint "events_score_range"', '23514')
      if (row.kind.length > 24) return fail('violates check constraint "events_kind_len"', '23514')
      if (row.item_id.length > 128) return fail('violates check constraint "events_item_len"', '23514')
      const stored = { ...row, ts: clamp(row.ts) }
      // `on conflict do nothing` — the primary key IS the dedupe rule.
      if (events.some(e => eventKey(e) === eventKey(stored))) continue
      events.push(stored)
      inserted.push(stored)
    }
    // The prune trigger, mirrored.
    events.sort((a, b) => a.ts - b.ts)
    if (events.length > 2000) events.splice(0, events.length - 2000)
    return ok(inserted.map(({ ts, kind, item_id }) => ({ ts, kind, item_id })))
  }

  function mergeKv(profile: string, entries: { key: string; value: Json; updated_at: number }[]): Reply {
    record('merge_kv')
    if (state.failKv) return fail(state.failKv)
    if (!owns(profile)) return fail('merge_kv: profile is not accessible', '42501')
    if (!Array.isArray(entries)) return fail('merge_kv: entries must be a JSON array', '22023')
    for (const entry of entries) {
      if (typeof entry.key !== 'string' || entry.value === undefined || entry.value === null) {
        return fail('merge_kv: every entry needs key, value and updated_at', '22023')
      }
      if (JSON.stringify(entry.value).length > 16384) return fail('violates check constraint "kv_value_size"', '23514')
      const at = clamp(entry.updated_at)
      const id = `${profile}|${entry.key}`
      const old = kv.get(id)
      if (!old) {
        kv.set(id, { profile_id: profile, key: entry.key, value: entry.value, updated_at: at })
        continue
      }
      const max = entry.key === 'stars' || entry.key.startsWith('stars.')
      let value: Json
      if (max && isObj(old.value) && isObj(entry.value)) {
        const merged: Record<string, unknown> = { ...old.value }
        for (const [k, v] of Object.entries(entry.value)) {
          const cur = merged[k]
          if (cur === undefined) merged[k] = v
          else if (typeof cur === 'number' && typeof v === 'number') merged[k] = Math.max(cur, v)
          else merged[k] = at >= old.updated_at ? v : cur
        }
        value = merged
      } else {
        value = at >= old.updated_at ? entry.value : old.value
      }
      kv.set(id, { profile_id: profile, key: entry.key, value, updated_at: Math.max(old.updated_at, at) })
    }
    return ok([...kv.values()].filter(r => r.profile_id === profile))
  }

  const from = (table: string) => {
    const q: { verb: string; payload?: unknown; options?: unknown; filters: Record<string, unknown>; limit?: number } =
      { verb: 'select', filters: {} }

    const run = async (): Promise<Reply> => {
      if (table === 'profiles') {
        if (q.verb === 'upsert') {
          for (const row of q.payload as { id: string; owner_id: string }[]) {
            if (!profiles.has(row.id)) profiles.set(row.id, row.owner_id)
          }
          return ok(null)
        }
        const ids = (q.filters.in as string[] | undefined) ?? []
        return ok(ids.filter(id => owns(id)).map(id => ({ id })))
      }
      if (table === 'events') {
        if (q.verb === 'upsert') return upsertEvents(q.payload as EventRow[])
        if (q.verb === 'delete') {
          record('events.delete')
          const profile = String(q.filters.profile_id)
          if (!owns(profile)) return fail('permission denied', '42501')
          for (let i = events.length - 1; i >= 0; i--) if (events[i].profile_id === profile) events.splice(i, 1)
          return ok(null)
        }
        record('events.select')
        if (state.failPull) return fail(state.failPull)
        const profile = String(q.filters.profile_id)
        if (!owns(profile)) return ok([])
        const rows = events
          .filter(e => e.profile_id === profile)
          .sort((a, b) => b.ts - a.ts)
          .slice(0, q.limit ?? 2000)
          .map(({ ts, kind, item_id, score, phonemes }) => ({ ts, kind, item_id, score, phonemes }))
        return ok(rows)
      }
      if (table === 'kv') {
        if (q.verb === 'delete') {
          record('kv.delete')
          const profile = String(q.filters.profile_id)
          if (!owns(profile)) return fail('permission denied', '42501')
          for (const [id, row] of [...kv]) if (row.profile_id === profile) kv.delete(id)
          return ok(null)
        }
        record('kv.select')
        if (state.failPull) return fail(state.failPull)
        const profile = String(q.filters.profile_id)
        if (!owns(profile)) return ok([])
        return ok([...kv.values()].filter(r => r.profile_id === profile)
          .map(({ key, value, updated_at }) => ({ key, value, updated_at })))
      }
      return fail(`no table ${table}`)
    }

    const chain = {
      select: () => chain,
      insert: (payload: unknown) => { q.verb = 'insert'; q.payload = payload; return chain },
      upsert: (payload: unknown, options?: unknown) => { q.verb = 'upsert'; q.payload = payload; q.options = options; return chain },
      delete: () => { q.verb = 'delete'; return chain },
      eq: (column: string, value: unknown) => { q.filters[column] = value; return chain },
      in: (_column: string, values: unknown) => { q.filters.in = values; return chain },
      order: () => chain,
      limit: (n: number) => { q.limit = n; return chain },
      single: run,
      maybeSingle: run,
      then: (onOk: (r: Reply) => unknown, onErr?: (e: unknown) => unknown) => run().then(onOk, onErr),
    }
    return chain
  }

  const auth = {
    getSession: async () => ({
      data: { session: state.userId ? { user: { id: state.userId, is_anonymous: true } } : null },
      error: null,
    }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>): Promise<Reply> => {
    if (name !== 'merge_kv') return fail(`no function ${name}`)
    return mergeKv(String(args.profile), args.entries as { key: string; value: Json; updated_at: number }[])
  })

  return { auth, from, rpc, profiles, events, kv, state, calls, countOf }
}

type Server = ReturnType<typeof makeServer>

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const useServer = (server: Server | null) => {
  cloud.client = server
  cloud.configured = server !== null
}

/** A device with one child on it, exactly as `ensureLocalProfile` would have left it. */
function bootProfile(id = PROFILE): string {
  localStorage.setItem('speakup.profiles', JSON.stringify([{ id, name: 'Bé', avatar: '🦊', created: 1 }]))
  localStorage.setItem('speakup.profile', id)
  return id
}

const key = (name: string, profileId = PROFILE) => `speakup.${profileId}.${name}`
const outbox = (): { ops: { id: number; t: string; p: string; n?: string }[]; meta: Record<string, { sent: number; clock: Record<string, number> }> } =>
  JSON.parse(localStorage.getItem('speakup.outbox') ?? '{"ops":[],"meta":{}}')

let server: Server

beforeEach(() => {
  localStorage.clear()
  resetAuthState()
  resetProfilesForTest()
  resetSyncForTest()
  server = makeServer()
  server.profiles.set(PROFILE, 'user-1')
  useServer(server)
})

afterEach(() => {
  stopSync()
  resetSyncForTest()
  useServer(null)
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------

describe('with no cloud configured', () => {
  // The contract every existing test and every contributor's clone depends on: without the env
  // vars this module is not a quiet mirror, it is no mirror at all — nothing subscribed, nothing
  // written, not even a queue.
  it('attaches nothing, writes nothing, and reports itself off', async () => {
    useServer(null)
    bootProfile()

    const stop = startSync()
    setStars('sword:cat', 3)
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    setLimitMinutes(30)

    expect(localStorage.getItem('speakup.outbox')).toBeNull()
    expect(syncStatus()).toEqual({ state: 'off', pending: 0, lastSyncedAt: null, lastError: null, syncing: false })
    await expect(syncNow()).resolves.toBeUndefined()
    await expect(pullProfile(PROFILE)).resolves.toBe(false)
    await expect(resetRemoteProgress(PROFILE)).resolves.toBe(false)
    expect(() => stop()).not.toThrow()

    // …and the child's own data is exactly where it always was.
    expect(getStars('sword:cat')).toBe(3)
    expect(localStorage.getItem('speakup.outbox')).toBeNull()
  })

  it('leaves a device with no profile alone even when a cloud exists', async () => {
    // No `speakup.profile`: the legacy shape, which is what the first microseconds of a launch and
    // every pre-Phase-11 test look like. There is no namespace to name in an op.
    startSync()
    setStars('sword:cat', 2)
    await flush()

    expect(outbox().ops).toEqual([])
    expect(server.events).toEqual([])
  })
})

describe('the outbox', () => {
  it('queues one op per key however many times the child writes it', () => {
    bootProfile()
    startSync()

    for (let i = 1; i <= 20; i++) setStars(`sword:${i}`, 3)
    setLimitMinutes(25)
    setLimitMinutes(30)

    const ops = outbox().ops
    expect(ops.filter(o => o.n === 'stars')).toHaveLength(1)
    expect(ops.filter(o => o.n === 'limit.minutes')).toHaveLength(1)
    expect(ops).toHaveLength(2)
  })

  it('sends one row per activity event and one merge for the rest', async () => {
    bootProfile()
    startSync()

    setStars('sword:cat', 3)
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    logActivity({ ts: 2000, kind: 'speak', id: 'p-1', score: 80 })
    setBandValue(3)

    await flush()

    expect(server.events).toHaveLength(2)
    expect(server.events.map(e => e.item_id).sort()).toEqual(['p-1', 'sword:cat'])
    expect(server.kv.get(`${PROFILE}|stars`)?.value).toEqual({ 'sword:cat': 3 })
    expect(server.kv.get(`${PROFILE}|band`)?.value).toEqual({ value: 3, mode: 'manual' })
    // The event log is the `events` table, never a kv value — it outgrows kv's 16 KB ceiling.
    expect(server.kv.get(`${PROFILE}|activity`)).toBeUndefined()
    expect(outbox().ops).toEqual([])
    expect(syncStatus().state).toBe('synced')
  })

  it('survives every shape of corrupt outbox without losing the child anything', async () => {
    bootProfile()
    startSync()

    for (const corrupt of ['not json at all', '{', '[]', '{"ops":"nope"}', 'null', '{"ops":[1,2,{"t":"kv"}],"meta":7}']) {
      localStorage.setItem('speakup.outbox', corrupt)
      expect(() => syncStatus()).not.toThrow()
      expect(syncStatus().pending).toBe(0)
      await expect(flush()).resolves.toBeUndefined()

      // A fresh queue starts from the next write, and the data itself was never in the queue.
      setStars('sword:cat', 3)
      expect(outbox().ops.filter(o => o.n === 'stars')).toHaveLength(1)
      expect(getStars('sword:cat')).toBe(3)
      localStorage.removeItem(`speakup.${PROFILE}.stars`)
    }
  })

  it('drops the oldest ops rather than growing without bound', () => {
    bootProfile()
    startSync()

    // 600 ops that cannot collapse into each other: each lesson day is its own key. (Writes to the
    // SAME key already collapse to one op, which is why this uses a store that writes many.)
    for (let i = 0; i < 600; i++) {
      saveLesson({ day: `2026-01-${String(i).padStart(3, '0')}`, created: i, band: 1, items: [] })
    }
    setLimitMinutes(30)

    const ops = outbox().ops
    expect(ops.length).toBeLessThanOrEqual(500)
    // The newest survive: the limit the parent just set is still queued.
    expect(ops.some(o => o.n === 'limit.minutes')).toBe(true)
  })

  it('skips a value the server would refuse rather than jamming the whole queue behind it', async () => {
    bootProfile()
    startSync()

    // Bigger than kv_value_size. A single oversized key must not stop the child's stars syncing.
    localStorage.setItem(key('leitner'), JSON.stringify({ big: 'x'.repeat(20000) }))
    promote('word-1') // a real write through the store, so the op is queued the real way
    localStorage.setItem(key('leitner'), JSON.stringify({ big: 'x'.repeat(20000) }))
    setStars('sword:cat', 3)

    await flush()

    expect(server.kv.get(`${PROFILE}|leitner`)).toBeUndefined()
    expect(server.kv.get(`${PROFILE}|stars`)?.value).toEqual({ 'sword:cat': 3 })
    expect(outbox().ops).toEqual([])
    expect(syncStatus().lastError).toBeNull()
  })
})

describe('at-least-once delivery', () => {
  it('is idempotent under replay: the same flush twice leaves one row and one value', async () => {
    bootProfile()
    startSync()
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    setStars('sword:cat', 3)

    await flush()
    // Replay the identical ops — the shape of a device that pushed, lost the reply, and tried again.
    localStorage.setItem('speakup.outbox', JSON.stringify({
      v: 1, next: 99, ops: [{ id: 90, t: 'ev', p: PROFILE }, { id: 91, t: 'kv', p: PROFILE, n: 'stars', u: 5 }], meta: {},
    }))
    await flush()
    await flush()

    expect(server.events).toHaveLength(1)
    expect(server.kv.get(`${PROFILE}|stars`)?.value).toEqual({ 'sword:cat': 3 })
    expect(outbox().ops).toEqual([])
  })

  it('never sends the same event twice inside one batch', async () => {
    bootProfile()
    startSync()
    // `logActivity` appends without looking, so the local log really can hold a duplicate — and a
    // batch that conflicts with itself is an error, not a dedupe.
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })

    await flush()

    expect(server.events).toHaveLength(1)
    expect(syncStatus().lastError).toBeNull()
  })

  it('keeps the ops it could not send and delivers them on the next flush', async () => {
    bootProfile()
    startSync()
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    setStars('sword:cat', 3)

    server.state.failKv = 'network unreachable'
    await flush()

    // The events went; the kv op is still queued, and the status says so.
    expect(server.events).toHaveLength(1)
    expect(server.kv.size).toBe(0)
    expect(outbox().ops.map(o => o.t)).toEqual(['kv'])
    expect(syncStatus()).toMatchObject({ state: 'pending', pending: 1, lastError: 'network unreachable' })

    server.state.failKv = null
    await flush()

    expect(server.kv.get(`${PROFILE}|stars`)?.value).toEqual({ 'sword:cat': 3 })
    expect(outbox().ops).toEqual([])
    expect(syncStatus()).toMatchObject({ state: 'synced', lastError: null })
  })

  it('keeps events queued when the events table is the half that fails', async () => {
    bootProfile()
    startSync()
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    setStars('sword:cat', 3)

    server.state.failEvents = 'timeout'
    await flush()

    expect(server.kv.get(`${PROFILE}|stars`)?.value).toEqual({ 'sword:cat': 3 })
    expect(outbox().ops.map(o => o.t)).toEqual(['ev'])
    // The watermark did NOT move: an event that was not delivered must still be in the tail.
    expect(outbox().meta[PROFILE]?.sent ?? 0).toBe(0)

    server.state.failEvents = null
    await flush()
    expect(server.events).toHaveLength(1)
  })

  it('holds everything until there is a session, then sends it all', async () => {
    bootProfile()
    server.state.userId = null
    startSync()
    setStars('sword:cat', 3)
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })

    await flush()
    expect(server.events).toEqual([])
    expect(outbox().ops).toHaveLength(2)

    server.state.userId = 'user-1'
    await flush()
    expect(server.events).toHaveLength(1)
    expect(outbox().ops).toEqual([])
  })

  it('leaves a foreign profile\'s ops queued instead of crashing on the 403', async () => {
    // A namespace belonging to an account this device has left: RLS answers 42501 from the RPC and
    // a foreign-key violation from the table, and neither may reach a screen.
    bootProfile(OTHER)
    server.profiles.set(OTHER, 'somebody-else')
    startSync()
    setStars('sword:cat', 3)
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })

    await expect(flush()).resolves.toBeUndefined()

    expect(server.kv.size).toBe(0)
    expect(outbox().ops).toHaveLength(2)
    expect(syncStatus().lastError).toMatch(/foreign key|not accessible/)
  })
})

describe('a clock the server does not believe', () => {
  it('adopts the ts the server actually stored, so one attempt stays one row', async () => {
    bootProfile()
    startSync()
    // The device's whole clock is 400 days fast, so the server caps everything it sends — the
    // event's ts AND the kv updated_at — at its own now + 24 h.
    const ceiling = Date.now() - 1000
    server.state.ceiling = ceiling
    const future = Date.now() + 400 * 24 * 60 * 60 * 1000
    logActivity({ ts: future, kind: 'word', id: 'sword:cat', score: 90 })
    setStars('sword:cat', 3)

    await flush()

    expect(server.events).toHaveLength(1)
    expect(server.events[0].ts).toBe(ceiling)
    expect(server.kv.get(`${PROFILE}|stars`)?.updated_at).toBe(ceiling)
    expect(syncStatus()).toMatchObject({ state: 'synced', lastError: null })
    // The local log now carries the server's ts. The two copies are one event, not two.
    expect(JSON.parse(localStorage.getItem(key('activity'))!)).toEqual([
      { ts: ceiling, kind: 'word', id: 'sword:cat', score: 90 },
    ])
  })

  it('converges: five cycles against a moving ceiling leave one row on each side', async () => {
    // The compounding failure, run to ground. Before the reconciliation, each cycle produced a NEW
    // clamped row — the local copy never matched, so the pull read it as a new event and the flush
    // read the local one as still unsent — inflating the child's streak and minutes and eventually
    // evicting real history through the 2000-row cap at both ends.
    bootProfile()
    startSync()
    server.state.ceiling = Date.now() - 1000
    logActivity({ ts: Date.now() + 400 * 24 * 60 * 60 * 1000, kind: 'word', id: 'sword:cat', score: 90 })

    for (let cycle = 0; cycle < 5; cycle++) {
      server.state.ceiling += 3_600_000 // the server's clock moves on between launches
      await pullProfile(PROFILE) // a fresh launch: pull, then flush
      await flush()
    }

    expect(server.events).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(key('activity'))!)).toHaveLength(1)
    expect(syncStatus()).toMatchObject({ state: 'synced', pending: 0, lastError: null })
  })

  it('drops a single event the constraints refuse instead of jamming every flush behind it', async () => {
    bootProfile()
    startSync()
    logActivity({ ts: 1000, kind: 'word', id: 'x'.repeat(200), score: 90 })
    logActivity({ ts: 2000, kind: 'word', id: 'sword:cat', score: 90 })

    await flush()

    expect(server.events.map(e => e.item_id)).toEqual(['sword:cat'])
    expect(outbox().ops).toEqual([])
    expect(syncStatus().lastError).toBeNull()
  })

  it('rounds a fractional score, which the int column would have rejected', async () => {
    bootProfile()
    startSync()
    logActivity({ ts: 1000, kind: 'speak', id: 'p-1', score: 87.6 })

    await flush()

    expect(server.events).toHaveLength(1)
    expect(server.events[0].score).toBe(88)
    expect(syncStatus().lastError).toBeNull()
  })
})

describe('what counts as sent', () => {
  it('sees an event logged in the same millisecond as one already pushed', async () => {
    // A timestamp high-water mark cannot: the second event is not ABOVE the mark the first one set,
    // so it is invisible for the rest of the session while the status line reads "Đã đồng bộ ✓".
    bootProfile()
    startSync()
    const ts = 1_700_000_000_000
    logActivity({ ts, kind: 'word', id: 'a', score: 90 })
    setStars('sword:cat', 3)

    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const realRpc = server.rpc.getMockImplementation()!
    server.rpc.mockImplementationOnce(async (name, args) => {
      // Logged WHILE the flush is running: it finds an `ev` op already queued and adds nothing, and
      // that op is about to be removed as delivered.
      logActivity({ ts, kind: 'word', id: 'b', score: 70 })
      await gate
      return realRpc(name, args)
    })

    const running = flush()
    release!()
    await running

    expect(server.events.map(e => e.item_id).sort()).toEqual(['a', 'b'])
    expect(syncStatus()).toMatchObject({ state: 'synced', pending: 0 })
  })

  it('is not blinded by a server row dated in this device\'s future', async () => {
    // Another iPad with a fast clock wrote an event dated next week. A watermark seeded from the
    // pull would sit in the future and hide every event this device logged afterwards.
    server.events.push({
      profile_id: PROFILE, ts: Date.now() + 7 * 86_400_000,
      kind: 'word', item_id: 'next-week', score: 90, phonemes: null,
    })
    bootProfile()
    startSync()

    await pullProfile(PROFILE)
    logActivity({ ts: Date.now(), kind: 'word', id: 'today', score: 80 })
    await flush()

    expect(server.events.map(e => e.item_id).sort()).toEqual(['next-week', 'today'])
    expect(syncStatus()).toMatchObject({ state: 'synced', pending: 0 })
  })

  it('never reports synced while the log holds something the server does not', async () => {
    bootProfile()
    startSync()
    logActivity({ ts: 1000, kind: 'word', id: 'a', score: 90 })
    server.state.failEvents = 'timeout'

    await flush()

    expect(syncStatus().state).toBe('pending')
    expect(syncStatus().lastSyncedAt).toBeNull()
  })

  it('does not call an empty outbox an empty mailbox when the store refused the op', async () => {
    // The last version of the lie F3 was raised about: a full store drops the `ev` op, the flush
    // finds nothing queued and calls it a day, and the parent reads "Đã đồng bộ ✓" over a session
    // the server has never seen — then wipes the device.
    bootProfile()
    startSync()
    localStorage.setItem('speakup.outbox', JSON.stringify({ v: 1, next: 1, ops: [], meta: {} }))
    // The event is on disk; the queue that should have named it is not.
    localStorage.setItem(key('activity'), JSON.stringify([{ ts: 1000, kind: 'word', id: 'a', score: 90 }]))

    expect(syncStatus()).toMatchObject({ state: 'pending', pending: 1 })

    await flush()

    expect(server.events).toHaveLength(1)
    expect(syncStatus()).toMatchObject({ state: 'synced', pending: 0 })
  })
})

describe('a store with no room left', () => {
  it('retries with something strictly smaller, at every size including one', () => {
    bootProfile()
    startSync()

    const attempts: number[] = []
    const real = Storage.prototype.setItem
    const spy = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (this: Storage, name: string, value: string) {
        if (name !== 'speakup.outbox') { real.call(this, name, value); return }
        attempts.push((JSON.parse(value) as { ops: unknown[] }).ops.length)
        throw new DOMException('exceeded the quota', 'QuotaExceededError')
      })

    setBandValue(3) // the queue would hold exactly one op
    spy.mockRestore()

    // `slice(-Math.floor(n / 2))` at n = 1 is `slice(-0)`, which is `slice(0)`, which is the whole
    // array: the retry was byte-identical to the write that had just failed, in the one case where
    // the fallback was the only thing left.
    expect(attempts.length).toBeGreaterThan(1)
    expect(attempts[1]).toBeLessThan(attempts[0])
  })
})

describe('two flushes at once', () => {
  it('share one run: nothing is sent twice and nothing queued meanwhile is lost', async () => {
    bootProfile()
    startSync()
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    setStars('sword:cat', 3)

    // A second trigger lands while the first is mid-request — the exact shape of `visibilitychange`
    // firing on top of the debounced flush the child's last star started.
    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const realRpc = server.rpc.getMockImplementation()!
    server.rpc.mockImplementationOnce(async (name, args) => {
      // Queued while the flush is in flight: it must survive to a second round.
      setLimitMinutes(45)
      await gate
      return realRpc(name, args)
    })

    const first = flush()
    const second = flush()
    release!()
    await Promise.all([first, second])

    expect(server.countOf('merge_kv')).toBe(2) // the first round, then the round for the late write
    expect(server.countOf('events.upsert')).toBe(1) // the events were sent exactly once
    expect(server.events).toHaveLength(1)
    expect(server.kv.get(`${PROFILE}|limit.minutes`)?.value).toBe(45)
    expect(outbox().ops).toEqual([])
  })
})

describe('pull', () => {
  it('restores a wiped device and pushes nothing back up', async () => {
    // The server holds a child's whole history; this device has just been cleared.
    server.kv.set(`${PROFILE}|stars`, { profile_id: PROFILE, key: 'stars', value: { 'sword:cat': 3 }, updated_at: 500 })
    server.kv.set(`${PROFILE}|band`, { profile_id: PROFILE, key: 'band', value: { value: 4, mode: 'auto' }, updated_at: 500 })
    server.kv.set(`${PROFILE}|limit.minutes`, { profile_id: PROFILE, key: 'limit.minutes', value: 30, updated_at: 500 })
    server.events.push({ profile_id: PROFILE, ts: 1000, kind: 'word', item_id: 'sword:cat', score: 90, phonemes: null })
    bootProfile()
    startSync()

    expect(await pullProfile(PROFILE)).toBe(true)

    expect(getStars('sword:cat')).toBe(3)
    expect(getBand()).toEqual({ value: 4, mode: 'auto' })
    expect(localStorage.getItem(key('limit.minutes'))).toBe('30')
    expect(JSON.parse(localStorage.getItem(key('activity'))!)).toEqual([
      { ts: 1000, kind: 'word', id: 'sword:cat', score: 90 },
    ])
    // Nothing local was ahead, so there is nothing to mirror back — a restore is not a round trip.
    expect(outbox().ops).toEqual([])
    const before = server.countOf('events.upsert')
    await flush()
    expect(server.countOf('events.upsert')).toBe(before)
  })

  it('never lowers a star the child has already earned', async () => {
    // The regression this test exists for: the server's copy is older and smaller. A pull written
    // as "write what the server said" hands the child a 1 where they earned a 3.
    bootProfile()
    startSync()
    setStars('sword:cat', 3)
    setStars('sword:dog', 2)
    server.kv.set(`${PROFILE}|stars`, {
      profile_id: PROFILE, key: 'stars', value: { 'sword:cat': 1, 'sword:fish': 2 }, updated_at: Date.now() + 60_000,
    })

    expect(await pullProfile(PROFILE)).toBe(true)

    expect(getStars('sword:cat')).toBe(3) // ours, higher, kept — even though the server's write is newer
    expect(getStars('sword:dog')).toBe(2) // ours, unknown to the server, kept
    expect(getStars('sword:fish')).toBe(2) // theirs, unknown to us, taken
  })

  it('keeps a local value the server has never heard of, and takes one it is newer about', async () => {
    bootProfile()
    startSync()
    setBandValue(2) // this device's clock for `band` is now

    server.kv.set(`${PROFILE}|band`, {
      profile_id: PROFILE, key: 'band', value: { value: 5, mode: 'auto' }, updated_at: Date.now() + 60_000,
    })
    server.kv.set(`${PROFILE}|leitner`, {
      profile_id: PROFILE, key: 'leitner', value: { 'w-1': { box: 2, due: 1 } }, updated_at: 10,
    })

    await pullProfile(PROFILE)

    expect(getBand()).toEqual({ value: 5, mode: 'auto' }) // server's write is newer than ours
    expect(JSON.parse(localStorage.getItem(key('leitner'))!)).toEqual({ 'w-1': { box: 2, due: 1 } }) // we had none
  })

  it('keeps a clockless local value, and SEEDS its clock rather than inventing one', async () => {
    // An upgrading device: the value was written by a version that had no outbox, so there is no
    // local timestamp to weigh. Preferring the value the child has been using is the conservative
    // half of last-write-wins — but claiming it is NEWER, with a timestamp this device made up, is
    // how the other iPad's real change gets overwritten. The clock is seeded from the server's
    // instead, and nothing is pushed.
    bootProfile()
    localStorage.setItem(key('band'), JSON.stringify({ value: 4, mode: 'manual' }))
    startSync()
    const remoteAt = Date.now() - 60_000
    server.kv.set(`${PROFILE}|band`, {
      profile_id: PROFILE, key: 'band', value: { value: 1, mode: 'auto' }, updated_at: remoteAt,
    })

    await pullProfile(PROFILE)

    expect(getBand()).toEqual({ value: 4, mode: 'manual' }) // local-first held
    expect(outbox().ops.some(o => o.n === 'band')).toBe(false) // nothing claimed upward
    expect(outbox().meta[PROFILE].clock.band).toBe(remoteAt) // seeded, not forged
    await flush()
    expect(server.kv.get(`${PROFILE}|band`)?.value).toEqual({ value: 1, mode: 'auto' })

    // …and the seed is what makes the OTHER device's next change land, instead of losing for ever
    // to a `Date.now()` this one wrote into its own clock.
    server.kv.set(`${PROFILE}|band`, {
      profile_id: PROFILE, key: 'band', value: { value: 5, mode: 'auto' }, updated_at: remoteAt + 1000,
    })
    await pullProfile(PROFILE)
    expect(getBand()).toEqual({ value: 5, mode: 'auto' })
  })

  it('unions the event log and pushes only what the server was missing', async () => {
    bootProfile()
    startSync()
    logActivity({ ts: 1000, kind: 'word', id: 'a', score: 90 })
    logActivity({ ts: 3000, kind: 'word', id: 'c', score: 70 })
    server.events.push(
      { profile_id: PROFILE, ts: 2000, kind: 'speak', item_id: 'b', score: 80, phonemes: null },
      { profile_id: PROFILE, ts: 1000, kind: 'word', item_id: 'a', score: 90, phonemes: null },
    )

    await pullProfile(PROFILE)

    const local = JSON.parse(localStorage.getItem(key('activity'))!) as { ts: number; id: string }[]
    expect(local.map(e => e.id)).toEqual(['a', 'b', 'c']) // union, deduped on (ts, kind, id), sorted
    await flush()
    expect(server.events).toHaveLength(3)
    expect(server.events.map(e => e.item_id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('reads a bigint column back whether it arrives as a number or a string', async () => {
    // `events.ts` and `kv.updated_at` are int8. PostgREST sends them as numbers today; a project
    // that serialized them as strings would otherwise drop every event on the floor, silently, and
    // a "restore" would give the child back nothing.
    server.kv.set(`${PROFILE}|stars`, {
      profile_id: PROFILE, key: 'stars', value: { 'sword:cat': 3 }, updated_at: '1700000000000' as unknown as number,
    })
    server.events.push({
      profile_id: PROFILE, ts: '1700000000000' as unknown as number,
      kind: 'word', item_id: 'sword:cat', score: 90, phonemes: null,
    })
    bootProfile()
    startSync()

    expect(await pullProfile(PROFILE)).toBe(true)

    expect(getStars('sword:cat')).toBe(3)
    expect(JSON.parse(localStorage.getItem(key('activity'))!)).toEqual([
      { ts: 1700000000000, kind: 'word', id: 'sword:cat', score: 90 },
    ])
  })

  it('never pushes local bytes that could not be read over the server\'s good copy', async () => {
    // The exact shape `storageKeys.ts` cites for `copyValue`: an iOS tab killed mid-`setItem`. The
    // merge cannot be computed, and "could not be computed" is NOT "the local side is newer" — the
    // cloud copy is the only thing left that can give the child their stars back.
    bootProfile()
    startSync()
    setStars('sword:cat', 3) // gives the key a local clock, so LWW would say local is current
    localStorage.setItem(key('stars'), '{"sword:cat":3,"sword:d')
    server.kv.set(`${PROFILE}|stars`, {
      profile_id: PROFILE, key: 'stars', value: { 'sword:cat': 3, 'sword:dog': 2 }, updated_at: 1,
    })

    await pullProfile(PROFILE)
    await flush()

    // The cloud copy is intact. This is the assertion that matters: it was the only thing left
    // that could give the child their stars back.
    expect(server.kv.get(`${PROFILE}|stars`)?.value).toEqual({ 'sword:cat': 3, 'sword:dog': 2 })
    expect(getStars('sword:cat')).toBe(3)
    expect(getStars('sword:dog')).toBe(2) // recovered from the cloud, which is the point
  })

  it('does the same for a damaged LWW value, not just for stars', async () => {
    bootProfile()
    startSync()
    setBandValue(4)
    localStorage.setItem(key('band'), '{"value":4,"mo')
    server.kv.set(`${PROFILE}|band`, {
      profile_id: PROFILE, key: 'band', value: { value: 3, mode: 'auto' }, updated_at: 1,
    })

    await pullProfile(PROFILE)
    await flush()

    expect(server.kv.get(`${PROFILE}|band`)?.value).toEqual({ value: 3, mode: 'auto' })
    expect(getBand()).toEqual({ value: 3, mode: 'auto' })
  })

  it('leaves both sides alone when neither copy can be read', async () => {
    bootProfile()
    startSync()
    setStars('sword:cat', 3)
    localStorage.setItem(key('stars'), '{"sword:cat":3,"sword:d')
    server.kv.set(`${PROFILE}|stars`, { profile_id: PROFILE, key: 'stars', value: 'also broken', updated_at: 1 })

    await pullProfile(PROFILE)

    expect(localStorage.getItem(key('stars'))).toBe('{"sword:cat":3,"sword:d')
    expect(server.kv.get(`${PROFILE}|stars`)?.value).toBe('also broken')
  })

  it('does not write back lesson records the local prune would delete on sight', async () => {
    // A year-old account: the server keeps every lesson record (the dashboard wants the history),
    // the client keeps thirty. Writing all of them back is churn the child pays for in quota — and
    // a full store is where `store.ts`'s swallowed setItem silently drops a star.
    bootProfile()
    startSync()
    for (let i = 1; i <= 40; i++) {
      const day = `2026-03-${String(i).padStart(2, '0')}`
      server.kv.set(`${PROFILE}|lesson.${day}`, {
        profile_id: PROFILE, key: `lesson.${day}`, value: { v: 1, day, created: i, band: 1, items: [] }, updated_at: i,
      })
    }

    await pullProfile(PROFILE)

    const written = Object.keys(localStorage).filter(k => k.startsWith(key('lesson.2026-')))
    expect(written).toHaveLength(KEEP_DAYS)
    // The newest thirty, which is the set `saveLesson` would have kept.
    expect(written.some(k => k.endsWith('2026-03-10'))).toBe(false)
    expect(written.some(k => k.endsWith('2026-03-11'))).toBe(true)
    // …and nothing outside the window is queued for a pointless round trip either.
    expect(outbox().ops.some(o => o.n?.startsWith('lesson.2026-03-0'))).toBe(false)
  })

  it('mirrors a write-once key the server has never seen', async () => {
    // The recovery path for F6: an op dropped by a full store. `lesson.length` is written once and
    // never again, so if the pull only ever re-queued keys the SERVER already had, this key would
    // never be mirrored in the child's lifetime.
    bootProfile()
    startSync()
    setLessonLength('long')
    localStorage.removeItem('speakup.outbox') // the queue the full store could not hold

    await pullProfile(PROFILE)
    await flush()

    expect(server.kv.get(`${PROFILE}|lesson.length`)?.value).toBe('long')
  })

  it('heals a wrong-shaped local star map instead of pushing it over the server\'s', async () => {
    // The M1 end state, end to end. `[]` parses, so it was never "damaged"; it is not a map, so it
    // could not be merged — and the old stalemate left it in place. The child then reads 0 stars
    // (`store.ts` casts without checking), `setStars` writes a non-index property onto the array,
    // `JSON.stringify` still gives `[]`, and `merge_kv` gets an array against an object: no
    // per-entry max is possible, it falls to last-write-wins, and the server's map becomes `[]`.
    bootProfile()
    startSync()
    setStars('sword:cat', 3) // a real clock for the key, so LWW would call the local value current
    localStorage.setItem(key('stars'), '[]')
    server.kv.set(`${PROFILE}|stars`, {
      profile_id: PROFILE, key: 'stars', value: { 'sword:cat': 3, 'sword:dog': 2 }, updated_at: 1,
    })

    await pullProfile(PROFILE)
    await flush()

    // The cloud copy is intact…
    expect(server.kv.get(`${PROFILE}|stars`)?.value).toEqual({ 'sword:cat': 3, 'sword:dog': 2 })
    // …and the device is HEALED, not left reading zero. Leaving it broken is not a resting state.
    expect(localStorage.getItem(key('stars'))).not.toBe('[]')
    expect(getStars('sword:cat')).toBe(3)
    expect(getStars('sword:dog')).toBe(2)
  })

  it('keeps a good local value when the SERVER is the wrong shape, however new its clock', async () => {
    // The two `text` keys, which the json-only test never covered. A newer server row must not be
    // able to talk the device into a `limit.minutes` its own screen reads as NaN.
    bootProfile()
    startSync()
    setLimitMinutes(45)
    setLessonLength('short')
    const future = Date.now() + 60_000
    server.kv.set(`${PROFILE}|limit.minutes`, {
      profile_id: PROFILE, key: 'limit.minutes', value: { minutes: 15 }, updated_at: future,
    })
    server.kv.set(`${PROFILE}|lesson.length`, {
      profile_id: PROFILE, key: 'lesson.length', value: ['medium'], updated_at: future,
    })

    await pullProfile(PROFILE)

    expect(localStorage.getItem(key('limit.minutes'))).toBe('45')
    expect(getLimitMinutes()).toBe(45)
    expect(getLessonLength()).toBe('short')

    // …and the junk up there is replaced, so the other iPad does not heal FROM it.
    await flush()
    expect(server.kv.get(`${PROFILE}|limit.minutes`)?.value).toBe(45)
    expect(server.kv.get(`${PROFILE}|lesson.length`)?.value).toBe('short')
  })

  it('touches neither side when both copies fail the shape', async () => {
    bootProfile()
    startSync()
    setStars('sword:cat', 3)
    localStorage.setItem(key('stars'), '[]')
    server.kv.set(`${PROFILE}|stars`, { profile_id: PROFILE, key: 'stars', value: 'nonsense', updated_at: 1 })

    await pullProfile(PROFILE)
    await flush()

    expect(localStorage.getItem(key('stars'))).toBe('[]')
    expect(server.kv.get(`${PROFILE}|stars`)?.value).toBe('nonsense')
  })

  it('refuses to send a wrong-shaped value with no pull involved at all', async () => {
    // The push-side guard on its own: the merge is not the only thing that queues an op, and a local
    // value can be the wrong shape without the server ever having been consulted.
    bootProfile()
    startSync()
    setStars('sword:cat', 3)     // queues a `stars` op the honest way
    setBandValue(3)              // and one for a key that is fine
    localStorage.setItem(key('stars'), '[]') // …then the value under it goes wrong

    await flush()

    expect(server.kv.get(`${PROFILE}|stars`)).toBeUndefined()
    expect(server.kv.get(`${PROFILE}|band`)?.value).toEqual({ value: 3, mode: 'manual' })
    // The op is finished, not retried for ever: it can never succeed, and the pull is what heals.
    expect(outbox().ops).toEqual([])
    expect(syncStatus()).toMatchObject({ state: 'synced', lastError: null })
  })

  it('never uploads a key no store registered', async () => {
    // `migrateKeysInto` deliberately sweeps keys this codebase has never heard of into the child's
    // namespace — a value an older build wrote is still that child's. Under a denylist every one of
    // them was uploaded, with no module owning it, against a spec that says a child's voice never
    // leaves the device.
    bootProfile()
    startSync()
    localStorage.setItem(key('voice.lastTranscript'), JSON.stringify({ text: 'my name is Bo' }))
    localStorage.setItem(key('some.future.key'), 'anything')
    setStars('sword:cat', 3) // one key that IS registered, so the flush really runs

    await pullProfile(PROFILE)
    await flush()

    expect([...server.kv.values()].map(r => r.key)).toEqual(['stars'])
    expect(outbox().ops).toEqual([])
    // …and the unregistered keys are untouched on disk. Not synced is not the same as not kept.
    expect(localStorage.getItem(key('voice.lastTranscript'))).toBe('{"text":"my name is Bo"}')
  })

  it('does not write a server row for a key no store registered either', async () => {
    bootProfile()
    startSync()
    server.kv.set(`${PROFILE}|voice.lastTranscript`, {
      profile_id: PROFILE, key: 'voice.lastTranscript', value: { text: 'from somewhere' }, updated_at: 1,
    })

    await pullProfile(PROFILE)

    expect(localStorage.getItem(key('voice.lastTranscript'))).toBeNull()
  })

  it('mirrors exactly the keys the stores registered', async () => {
    bootProfile()
    startSync()
    setStars('sword:cat', 3)
    promote('w-1')
    setBandValue(3)
    setLimitMinutes(45)
    setLessonLength('long')
    saveLesson({ day: '2026-08-29', created: 1, band: 1, items: [] })
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })

    await flush()

    expect([...server.kv.values()].map(r => r.key).sort()).toEqual([
      'band', 'leitner', 'lesson.2026-08-29', 'lesson.length', 'limit.minutes', 'stars',
    ])
    // The event log is rows, not a kv value.
    expect(server.events).toHaveLength(1)
  })

  it('refuses a profile the roster has not adopted yet', async () => {
    // Writing into a namespace the roster does not name would have `rescueOrphanNamespaces` fold it
    // into the active child at the next launch. adoptProfiles first, then pull — always.
    bootProfile()
    startSync()
    server.profiles.set(OTHER, 'user-1')
    server.kv.set(`${OTHER}|stars`, { profile_id: OTHER, key: 'stars', value: { 'sword:cat': 3 }, updated_at: 1 })

    expect(await pullProfile(OTHER)).toBe(false)
    expect(localStorage.getItem(key('stars', OTHER))).toBeNull()
  })

  it('is quiet about a failure and leaves the child\'s data untouched', async () => {
    bootProfile()
    startSync()
    setStars('sword:cat', 3)
    server.state.failPull = 'gateway timeout'

    expect(await pullProfile(PROFILE)).toBe(false)
    expect(getStars('sword:cat')).toBe(3)
    expect(syncStatus().lastError).toBe('gateway timeout')
  })

  it('runs once per session, and once for two callers arriving together', async () => {
    bootProfile()
    startSync()

    await Promise.all([syncNow(), syncNow()])
    await syncNow()

    expect(server.countOf('kv.select')).toBe(1)
  })
})

describe('the offline day', () => {
  it('collapses a day of writes into one flush when the network returns', async () => {
    bootProfile()
    startSync()
    server.state.userId = null // offline: no session, nothing goes anywhere

    for (let day = 0; day < 3; day++) {
      for (let i = 0; i < 5; i++) {
        logActivity({ ts: 1000 + day * 86_400_000 + i, kind: 'word', id: `w-${day}-${i}`, score: 80 })
        setStars(`sword:w-${day}-${i}`, 3)
      }
      promote(`w-${day}`)
      setBandValue(((day % 5) + 1) as 1 | 2 | 3 | 4 | 5)
    }
    await flush()
    expect(server.events).toEqual([])

    // One op per key plus one for the whole event log — 15 events and 20 writes, four ops.
    expect(outbox().ops.map(o => o.n ?? o.t).sort()).toEqual(['band', 'ev', 'leitner', 'stars'])

    server.state.userId = 'user-1'
    await flush()

    expect(server.events).toHaveLength(15)
    expect(Object.keys(server.kv.get(`${PROFILE}|stars`)?.value as object)).toHaveLength(15)
    expect(server.countOf('merge_kv')).toBe(1)
    expect(outbox().ops).toEqual([])
  })

  it('pushes a child\'s ops from their own namespace after the iPad changed hands', async () => {
    // The second child is using the iPad by the time the first child's ops flush. Reading the value
    // from whoever is ACTIVE would put one child's stars in the other's row.
    const first = bootProfile()
    server.profiles.set(OTHER, 'user-1')
    startSync()
    setStars('sword:cat', 3)

    // Hand over: the roster gains the sibling and the active pointer moves.
    localStorage.setItem('speakup.profiles', JSON.stringify([
      { id: first, name: 'A', avatar: '🦊', created: 1 },
      { id: OTHER, name: 'B', avatar: '🐼', created: 2 },
    ]))
    localStorage.setItem('speakup.profile', OTHER)
    setStars('sword:dog', 1)

    await flush()

    expect(server.kv.get(`${first}|stars`)?.value).toEqual({ 'sword:cat': 3 })
    expect(server.kv.get(`${OTHER}|stars`)?.value).toEqual({ 'sword:dog': 1 })
  })
})

describe('triggers', () => {
  it('flushes at start, on online, and when the app goes to the background', async () => {
    bootProfile()
    startSync()
    await vi.waitFor(() => expect(server.countOf('kv.select')).toBe(1)) // the start pull

    setStars('sword:cat', 3)
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(server.kv.size).toBe(1))

    setBandValue(3)
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(server.kv.get(`${PROFILE}|band`)).toBeDefined())
    hidden.mockRestore()
  })

  it('ignores a visibilitychange that is the app coming BACK', async () => {
    bootProfile()
    startSync()
    await vi.waitFor(() => expect(server.countOf('kv.select')).toBe(1))

    const before = server.countOf('merge_kv')
    setStars('sword:cat', 3)
    document.dispatchEvent(new Event('visibilitychange')) // jsdom is 'visible'
    await Promise.resolve()

    expect(server.countOf('merge_kv')).toBe(before)
  })

  it('debounces writes to one flush per window', async () => {
    vi.useFakeTimers()
    bootProfile()
    startSync({ debounceMs: 30_000 })
    await vi.advanceTimersByTimeAsync(1)

    // The launch flush has just run, so the window is open and a burst of writes waits it out
    // rather than each one becoming a request — which is the whole point on a metered iPad.
    const before = server.countOf('merge_kv')
    setStars('sword:cat', 3)
    setStars('sword:dog', 3)
    setBandValue(3)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(server.countOf('merge_kv')).toBe(before)

    setLimitMinutes(45)
    await vi.advanceTimersByTimeAsync(25_001)
    expect(server.countOf('merge_kv')).toBe(before + 1) // four writes, one merge
    expect(server.kv.get(`${PROFILE}|limit.minutes`)?.value).toBe(45)
    expect(server.kv.get(`${PROFILE}|stars`)?.value).toEqual({ 'sword:cat': 3, 'sword:dog': 3 })

    // …and the next write after the window has passed goes straight out.
    setLimitMinutes(50)
    await vi.advanceTimersByTimeAsync(30_001)
    expect(server.countOf('merge_kv')).toBe(before + 2)
  })

  it('stops cleanly: no listener, no timer, no further traffic', async () => {
    bootProfile()
    const stop = startSync({ debounceMs: 0 })
    await vi.waitFor(() => expect(server.countOf('kv.select')).toBe(1))
    stop()

    const before = server.countOf('merge_kv')
    setStars('sword:cat', 3)
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()

    expect(outbox().ops).toEqual([]) // the write seam is detached, so nothing was even queued
    expect(server.countOf('merge_kv')).toBe(before)
  })
})

describe('reset', () => {
  it('deletes both tables and drops what was queued, so nothing resurrects', async () => {
    bootProfile()
    startSync()
    setStars('sword:cat', 3)
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    await flush()
    expect(server.kv.size).toBe(1)

    // A star written after the flush but before the reset: it must go with the rest, not survive as
    // a queued op that pushes the child's old progress back up a moment later.
    setStars('sword:dog', 2)
    localStorage.removeItem(key('stars'))
    localStorage.removeItem(key('activity'))

    expect(await resetRemoteProgress(PROFILE)).toBe(true)

    expect(server.kv.size).toBe(0)
    expect(server.events).toEqual([])
    expect(outbox().ops).toEqual([])

    await flush()
    expect(server.kv.size).toBe(0)
    expect(server.events).toEqual([])
  })

  it('stays reset even when the local half never ran', async () => {
    // The parent screen clears localStorage and the cloud; the local half can fail (a full store) or
    // simply run second. The reset is still a reset — and the next launch must not read an empty
    // server as "none of this was ever mirrored" and upload it all again, which is the standing
    // ruling (a reset is a DELETE, never a merge) undone through the back door.
    bootProfile()
    startSync()
    setStars('sword:cat', 3)
    logActivity({ ts: 1000, kind: 'word', id: 'sword:cat', score: 90 })
    await flush()
    expect(server.kv.size).toBe(1)

    expect(await resetRemoteProgress(PROFILE)).toBe(true)
    expect(server.kv.size).toBe(0)
    expect(server.events).toEqual([])
    // The local half did NOT run: the child's stars and log are still on disk.
    expect(getStars('sword:cat')).toBe(3)

    // …and a key that was never mirrored at all — its op dropped by a full store — is a DIFFERENT
    // fact from a key the reset deleted, even though the server has no row for either. Both are on
    // disk, both are absent server-side, and only one of them may go up.
    setLessonLength('long')
    localStorage.setItem('speakup.outbox', JSON.stringify({
      ...outbox(),
      ops: [], // the queue the full store could not hold
    }))

    // Relaunch.
    resetSyncForTest()
    startSync()
    await syncNow()
    await flush()

    expect([...server.kv.values()].map(r => r.key)).toEqual(['lesson.length'])
    expect(server.kv.get(`${PROFILE}|stars`)).toBeUndefined() // the reset stands
    expect(server.events).toEqual([]) // and so does it for the event log
    expect(syncStatus()).toMatchObject({ state: 'synced', pending: 0 })
  })

  it('forgets a profile without touching the others', () => {
    bootProfile()
    startSync()
    setStars('sword:cat', 3)
    localStorage.setItem('speakup.profile', OTHER)
    localStorage.setItem('speakup.profiles', JSON.stringify([
      { id: PROFILE, name: 'A', avatar: '🦊', created: 1 },
      { id: OTHER, name: 'B', avatar: '🐼', created: 2 },
    ]))
    setStars('sword:dog', 3)

    forgetProfile(OTHER)

    expect(outbox().ops.map(o => o.p)).toEqual([PROFILE])
  })
})

describe('the parent dashboard line', () => {
  it('reports offline, then pending, then synced', async () => {
    bootProfile()
    startSync()
    const online = vi.spyOn(navigator, 'onLine', 'get')

    online.mockReturnValue(false)
    setStars('sword:cat', 3)
    expect(syncStatus().state).toBe('offline')
    await flush()
    expect(outbox().ops).toHaveLength(1) // nothing was attempted, nothing was lost

    online.mockReturnValue(true)
    expect(syncStatus()).toMatchObject({ state: 'pending', pending: 1 })

    await flush()
    expect(syncStatus()).toMatchObject({ state: 'synced', pending: 0 })
    expect(syncStatus().lastSyncedAt).toBeGreaterThan(0)
    online.mockRestore()
  })

  it('tells its subscribers when the queue changes', async () => {
    bootProfile()
    startSync()
    const states: string[] = []
    const off = subscribeSyncStatus(s => states.push(`${s.state}:${s.pending}`))

    setStars('sword:cat', 3)
    await flush()
    off()
    const settled = states.length
    setBandValue(3)

    expect(states).toContain('pending:1')
    expect(states[states.length - 1]).toBe('synced:0')
    expect(states).toHaveLength(settled) // unsubscribed means unsubscribed
  })
})
