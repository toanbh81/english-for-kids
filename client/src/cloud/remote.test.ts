import { describe, it, expect, beforeEach, vi } from 'vitest'

const cloud = vi.hoisted(() => ({ client: null as unknown }))
const auth = vi.hoisted(() => ({ currentUserId: vi.fn(async (): Promise<string | null> => 'user-1') }))

vi.mock('./supabase', () => ({
  getSupabase: async () => cloud.client,
  isCloudConfigured: () => cloud.client !== null,
}))
vi.mock('./auth', () => auth)

import { fetchRemoteStats, toActivityEvents } from './remote'

type Reply = { data: unknown; error: { message: string } | null }

/**
 * Only the shape `fetchRemoteStats` actually calls: `.from('events').select(...).eq(...).order(...)
 * .limit(...)`, resolving to `{ data, error }`. Mirrors the light client in `profileState.test.ts`.
 */
function makeClient(reply: Reply = { data: [], error: null }) {
  const from = vi.fn(() => {
    const chain = {
      select: () => chain,
      eq: () => chain,
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

  it('returns null — not a zero-stats object — when the server refuses the read', async () => {
    cloud.client = makeClient({ data: null, error: { message: 'permission denied' } })
    expect(await fetchRemoteStats('p1')).toBeNull()
  })

  it('returns null when the client throws outright', async () => {
    cloud.client = { from: () => { throw new Error('network') } }
    expect(await fetchRemoteStats('p1')).toBeNull()
  })

  it('returns a real, honest zero for a profile that has genuinely never practised', async () => {
    cloud.client = makeClient({ data: [], error: null })
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
      data: [
        { ts: BASE, kind: 'speak', item_id: 's1', score: 80 },
        { ts: BASE, kind: 'speak', item_id: 's2', score: 60 },
        { ts: BASE - DAY, kind: 'speak', item_id: 's3', score: 90 },
      ],
      error: null,
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

  it('never counts a day done via a lesson record — the legacy counters only', async () => {
    // Five speaks in one day is enough to satisfy the legacy per-day counters (1 story, 5 speak,
    // 3 word) ONLY when every threshold is met; a lone speak, with no story and no word, must not
    // count as a completed day by either rule available to a remote fetch (it has no lesson kv
    // row to consult at all, by design — see the long comment on `fetchRemoteStats`).
    vi.useFakeTimers({ now: BASE })
    cloud.client = makeClient({ data: [{ ts: BASE, kind: 'speak', item_id: 's1', score: 80 }], error: null })
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
    cloud.client = makeClient({ data: rows, error: null })
    const stats = await fetchRemoteStats('p1')
    expect(stats?.streak).toBe(1)
    vi.useRealTimers()
  })

  it('surfaces weak phonemes from the fetched rows, via weakPhonemes unmodified', async () => {
    cloud.client = makeClient({
      data: [
        { ts: BASE, kind: 'word', item_id: 'w1', phonemes: [{ phoneme: 'th', score: 30 }] },
        { ts: BASE + 1, kind: 'word', item_id: 'w2', phonemes: [{ phoneme: 'th', score: 50 }] },
      ],
      error: null,
    })
    const stats = await fetchRemoteStats('p1')
    expect(stats?.weak).toEqual([{ phoneme: 'th', avg: 40, count: 2 }])
  })
})
