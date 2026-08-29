import { describe, it, expect, beforeEach, vi } from 'vitest'

const cloud = vi.hoisted(() => ({ client: null as unknown }))
const auth = vi.hoisted(() => ({ currentUserId: vi.fn(async (): Promise<string | null> => 'user-1') }))

vi.mock('./supabase', () => ({
  getSupabase: async () => cloud.client,
  isCloudConfigured: () => cloud.client !== null,
}))
vi.mock('./auth', () => auth)

import { dayKey } from '../progress/activity'
import { fetchRemoteStats, toActivityEvents } from './remote'

type Reply = { data: unknown; error: { message: string } | null }

const DEFAULT_REPLY: Reply = { data: [], error: null }

/**
 * The two tables `fetchRemoteStats` actually calls: `events` (`.select().eq().order().limit()`) and
 * `kv` (`.select().eq().like()`), each resolving independently to `{ data, error }`. Mirrors the
 * light client in `profileState.test.ts`, extended to route by table name since this module now
 * talks to two of them.
 */
function makeClient(replies: { events?: Reply; kv?: Reply } = {}) {
  const events = replies.events ?? DEFAULT_REPLY
  const kv = replies.kv ?? DEFAULT_REPLY
  const from = vi.fn((table: string) => {
    const reply = table === 'kv' ? kv : events
    const chain = {
      select: () => chain,
      eq: () => chain,
      like: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (onOk: (r: Reply) => unknown, onErr?: (e: unknown) => unknown) => Promise.resolve(reply).then(onOk, onErr),
    }
    return chain
  })
  return { from }
}

beforeEach(() => {
  cloud.client = null
  auth.currentUserId.mockReset().mockResolvedValue('user-1')
})

const BASE = new Date('2026-08-23T10:00:00').getTime() // Sunday
const DAY = 24 * 60 * 60 * 1000
const BASE_DAY = dayKey(BASE)

/** A stored lesson value exactly as `saveLesson` writes it — the shape `parseLesson` validates. */
function lessonRow(day: string, overrides: Record<string, unknown> = {}) {
  return {
    key: `lesson.${day}`,
    value: {
      v: 1,
      day,
      created: BASE,
      band: 1,
      items: [
        { kind: 'listen', activity: 'story', id: 'story1', route: '/story/1', label: 'Story', emoji: '📖' },
        { kind: 'speak', activity: 'speak', id: 'speak1', route: '/speak/1', label: 'Speak', emoji: '🗣️' },
      ],
      ...overrides,
    },
  }
}

/** The events that complete `lessonRow`'s two items — well under the legacy 5-speak/3-word bar. */
const LESSON_COMPLETING_EVENTS = [
  { ts: BASE, kind: 'story', item_id: 'story1' },
  { ts: BASE + 1, kind: 'speak', item_id: 'speak1', score: 85 },
]

describe('toActivityEvents — mapping server rows to activity.ts\'s shape', () => {
  it('maps a full row, including phonemes, into an ActivityEvent', () => {
    const events = toActivityEvents([
      { ts: BASE, kind: 'word', item_id: 'w1', score: 80, phonemes: [{ phoneme: 'th', score: 40 }] },
    ])
    expect(events).toEqual([{ ts: BASE, kind: 'word', id: 'w1', score: 80, phonemes: [{ phoneme: 'th', score: 40 }] }])
  })

  it('accepts a bigint ts serialised as a string', () => {
    const events = toActivityEvents([{ ts: String(BASE), kind: 'speak', item_id: 's1' }])
    expect(events).toEqual([{ ts: BASE, kind: 'speak', id: 's1' }])
  })

  it('drops score and phonemes when absent, rather than writing null/undefined fields', () => {
    const events = toActivityEvents([{ ts: BASE, kind: 'story', item_id: 's1' }])
    expect(events[0]).toEqual({ ts: BASE, kind: 'story', id: 's1' })
    expect('score' in events[0]).toBe(false)
    expect('phonemes' in events[0]).toBe(false)
  })

  it('drops rows with no usable timestamp, kind or item id, keeping the rest', () => {
    const events = toActivityEvents([
      { ts: null, kind: 'word', item_id: 'w1' },
      { ts: BASE, kind: '', item_id: 'w2' },
      { ts: BASE, kind: 'word', item_id: '' },
      { ts: BASE, kind: 'word', item_id: 'good' },
    ])
    expect(events).toEqual([{ ts: BASE, kind: 'word', id: 'good' }])
  })

  it('sorts by ts ascending regardless of the order rows arrive in', () => {
    const events = toActivityEvents([
      { ts: BASE + 10, kind: 'word', item_id: 'b' },
      { ts: BASE, kind: 'word', item_id: 'a' },
    ])
    expect(events.map(e => e.id)).toEqual(['a', 'b'])
  })
})

describe('fetchRemoteStats', () => {
  it('returns null with no cloud configured', async () => {
    cloud.client = null
    expect(await fetchRemoteStats('p1')).toBeNull()
  })

  it('returns null with no live session, and never calls the server', async () => {
    const client = makeClient()
    cloud.client = client
    auth.currentUserId.mockResolvedValue(null)
    expect(await fetchRemoteStats('p1')).toBeNull()
    expect(client.from).not.toHaveBeenCalled()
  })

  // F3 (review): the two halves of `if (error || !Array.isArray(data)) return null` need
  // independent coverage — a single case with BOTH `data: null` and an `error` set is caught by
  // either half alone, so it does not actually prove the `error` half does anything.
  it('returns null when the server reports an error, even alongside a well-formed (empty) rows array', async () => {
    cloud.client = makeClient({ events: { data: [], error: { message: 'permission denied' } } })
    expect(await fetchRemoteStats('p1')).toBeNull()
  })

  it('returns null when the response is not an array, even with no error reported', async () => {
    cloud.client = makeClient({ events: { data: null, error: null } })
    expect(await fetchRemoteStats('p1')).toBeNull()
  })

  it('returns null when the client throws outright', async () => {
    cloud.client = { from: () => { throw new Error('network') } }
    expect(await fetchRemoteStats('p1')).toBeNull()
  })

  it('returns a real, honest zero for a profile that has genuinely never practised', async () => {
    cloud.client = makeClient({ events: { data: [], error: null } })
    const stats = await fetchRemoteStats('p1')
    expect(stats).toEqual({
      streak: 0,
      weekMinutes: 0,
      averages: { story: null, speak: null, word: null, sentence: null },
      weak: [],
      eventCount: 0,
    })
  })

  it('computes streak, minutes and averages via activity.ts, from the fetched rows alone', async () => {
    vi.useFakeTimers({ now: BASE })
    cloud.client = makeClient({
      events: {
        data: [
          { ts: BASE, kind: 'speak', item_id: 's1', score: 80 },
          { ts: BASE, kind: 'speak', item_id: 's2', score: 60 },
          { ts: BASE - DAY, kind: 'speak', item_id: 's3', score: 90 },
        ],
        error: null,
      },
    })
    const stats = await fetchRemoteStats('p1')
    expect(stats?.eventCount).toBe(3)
    // 70 = average of 80 and 60 (today); yesterday's row is a different day but the SAME kind
    // average, which `averageScoreByKind` computes over all events regardless of day — exactly
    // the all-time figure the local dashboard's score tiles already show.
    expect(stats?.averages.speak).toBeCloseTo((80 + 60 + 90) / 3)
    expect(stats?.weekMinutes).toBeGreaterThan(0)
    vi.useRealTimers()
  })

  it('does not count a day done when neither the legacy counters nor any remote lesson record say so', async () => {
    // A lone speak, with no story and no word, meets neither rule available to a remote fetch when
    // there is genuinely no lesson kv row for that day (the default empty `kv` reply below).
    vi.useFakeTimers({ now: BASE })
    cloud.client = makeClient({ events: { data: [{ ts: BASE, kind: 'speak', item_id: 's1', score: 80 }], error: null } })
    const stats = await fetchRemoteStats('p1')
    expect(stats?.streak).toBe(0)
    vi.useRealTimers()
  })

  it('reports a real streak when the legacy per-day counters are actually met', async () => {
    vi.useFakeTimers({ now: BASE })
    const rows = [
      { ts: BASE, kind: 'story', item_id: 'st' },
      ...Array.from({ length: 5 }, (_, i) => ({ ts: BASE + i, kind: 'speak', item_id: `sp${i}` })),
      ...Array.from({ length: 3 }, (_, i) => ({ ts: BASE + i, kind: 'word', item_id: `w${i}` })),
    ]
    cloud.client = makeClient({ events: { data: rows, error: null } })
    const stats = await fetchRemoteStats('p1')
    expect(stats?.streak).toBe(1)
    vi.useRealTimers()
  })

  it('surfaces weak phonemes from the fetched rows, via weakPhonemes unmodified', async () => {
    cloud.client = makeClient({
      events: {
        data: [
          { ts: BASE, kind: 'word', item_id: 'w1', phonemes: [{ phoneme: 'th', score: 30 }] },
          { ts: BASE + 1, kind: 'word', item_id: 'w2', phonemes: [{ phoneme: 'th', score: 50 }] },
        ],
        error: null,
      },
    })
    const stats = await fetchRemoteStats('p1')
    expect(stats?.weak).toEqual([{ phoneme: 'th', avg: 40, count: 2 }])
  })

  // --- Review round 2, finding 2: the streak-honesty fix -----------------------------------------

  describe('day-completion via this profile\'s own remote lesson record', () => {
    it('counts a day done via a remote lesson record, even when the legacy counters alone are not met', async () => {
      vi.useFakeTimers({ now: BASE })
      cloud.client = makeClient({
        events: { data: LESSON_COMPLETING_EVENTS, error: null },
        kv: { data: [lessonRow(BASE_DAY)], error: null },
      })
      const stats = await fetchRemoteStats('p1')
      expect(stats?.streak).toBe(1)
      vi.useRealTimers()
    })

    it('ignores a lesson kv row that fails its own shape, rather than trusting it', async () => {
      vi.useFakeTimers({ now: BASE })
      cloud.client = makeClient({
        events: { data: LESSON_COMPLETING_EVENTS, error: null },
        // Wrong version stamp — `parseLesson` refuses it, exactly as `lessonForDay` would locally.
        kv: { data: [lessonRow(BASE_DAY, { v: 2 })], error: null },
      })
      const stats = await fetchRemoteStats('p1')
      expect(stats?.streak).toBe(0)
      vi.useRealTimers()
    })

    it('ignores a kv row whose key is not a lesson day (e.g. lesson.length)', async () => {
      vi.useFakeTimers({ now: BASE })
      cloud.client = makeClient({
        events: { data: LESSON_COMPLETING_EVENTS, error: null },
        kv: { data: [{ key: 'lesson.length', value: 'medium' }], error: null },
      })
      const stats = await fetchRemoteStats('p1')
      expect(stats?.streak).toBe(0)
      vi.useRealTimers()
    })

    it('falls back to the legacy counters alone when the lesson kv fetch itself fails — the read still succeeds', async () => {
      vi.useFakeTimers({ now: BASE })
      cloud.client = makeClient({
        events: { data: LESSON_COMPLETING_EVENTS, error: null },
        kv: { data: null, error: { message: 'timeout' } },
      })
      const stats = await fetchRemoteStats('p1')
      // Not null: a failed SECOND query degrades the streak, it does not turn the whole answer
      // into "unknown" — only the `events` read gates that.
      expect(stats).not.toBeNull()
      expect(stats?.streak).toBe(0)
      vi.useRealTimers()
    })

    it('never reads this device\'s localStorage while building the remote lesson lookup', async () => {
      vi.useFakeTimers({ now: BASE })
      cloud.client = makeClient({
        events: { data: LESSON_COMPLETING_EVENTS, error: null },
        kv: { data: [lessonRow(BASE_DAY)], error: null },
      })
      const getItem = vi.spyOn(Storage.prototype, 'getItem')
      const stats = await fetchRemoteStats('p1')
      // The positive half: the remote lesson record really was used (this is not a vacuous "nothing
      // happened" negative assertion below).
      expect(stats?.streak).toBe(1)
      expect(getItem).not.toHaveBeenCalled()
      getItem.mockRestore()
      vi.useRealTimers()
    })
  })
})
