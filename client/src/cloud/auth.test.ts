import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The cloud client is the one thing mocked here: every test below is about what `auth.ts` does
 * with it — including the case that matters most, which is having no client at all.
 */
const cloud = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('./supabase', () => ({
  getSupabase: () => cloud.client,
  isCloudConfigured: () => cloud.client !== null,
  resetSupabaseClient: () => undefined,
}))

import {
  currentEmail,
  currentUserId,
  ensureRecoveryCode,
  getRecoveryCode,
  isAnonymous,
  linkEmail,
  resetAuthState,
  signInWithEmail,
  signOut,
  startAnonymousSession,
  subscribeAuth,
  verifyEmailOtp,
} from './auth'

type User = { id: string; is_anonymous?: boolean; email?: string }
type Reply = { data: unknown; error: { message: string } | null }
type Query = { table: string; verb: string; payload?: unknown; options?: unknown }
type TableScript = Record<string, (payload?: unknown, options?: unknown) => Reply>

const ok = (data: unknown = null): Reply => ({ data, error: null })
const bad = (message: string): Reply => ({ data: null, error: { message } })

/**
 * A Supabase stand-in: the auth calls this module actually makes, and a query builder that
 * records what was asked of which table. `then` is what makes an unterminated chain awaitable,
 * exactly as PostgREST's builder is.
 */
function makeClient(tables: Record<string, TableScript> = {}) {
  const state = { session: null as { user: User } | null }
  const queries: Query[] = []

  const auth = {
    getSession: vi.fn(async () => ({ data: { session: state.session }, error: null })),
    signInAnonymously: vi.fn(async () => {
      state.session = { user: { id: 'anon-1', is_anonymous: true } }
      return { data: { user: state.session.user }, error: null as { message: string } | null }
    }),
    updateUser: vi.fn(async (_attrs: { email?: string }) => ({ data: {}, error: null as { message: string } | null })),
    signInWithOtp: vi.fn(async (_args: unknown) => ({ data: {}, error: null as { message: string } | null })),
    verifyOtp: vi.fn(async ({ email, type }: { email: string; token: string; type: string }) => {
      if (type === 'email_change' && !state.session) return { data: null, error: { message: 'no session' } }
      const user: User = { id: state.session?.user.id ?? 'user-new', is_anonymous: false, email }
      state.session = { user }
      return { data: { user }, error: null as { message: string } | null }
    }),
    signOut: vi.fn(async () => {
      state.session = null
      return { error: null as { message: string } | null }
    }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }

  const from = vi.fn((table: string) => {
    const entry: Query = { table, verb: 'select' }
    const run = async (): Promise<Reply> => {
      queries.push({ ...entry })
      const script = tables[table]?.[entry.verb]
      return script ? script(entry.payload, entry.options) : bad(`no script for ${table}.${entry.verb}`)
    }
    const chain = {
      select: () => chain,
      eq: () => chain,
      insert: (payload: unknown) => { entry.verb = 'insert'; entry.payload = payload; return chain },
      upsert: (payload: unknown, options?: unknown) => { entry.verb = 'upsert'; entry.payload = payload; entry.options = options; return chain },
      maybeSingle: run,
      single: run,
      then: (onOk: (r: Reply) => unknown, onErr?: (e: unknown) => unknown) => run().then(onOk, onErr),
    }
    return chain
  })

  return { auth, from, state, queries }
}

const use = (client: ReturnType<typeof makeClient> | null) => { cloud.client = client }

beforeEach(() => {
  resetAuthState()
  cloud.client = null
  vi.clearAllMocks()
})

describe('with no cloud configured', () => {
  // The contract every screen depends on: a build with no Supabase env vars is a working app, and
  // nothing in here is allowed to throw on the way to doing nothing.
  it('does nothing, quietly, in every direction', async () => {
    await expect(startAnonymousSession()).resolves.toBeUndefined()
    expect(await currentUserId()).toBeNull()
    expect(await currentEmail()).toBeNull()
    expect(await isAnonymous()).toBe(false)
    expect(await ensureRecoveryCode()).toBeNull()
    expect(await getRecoveryCode()).toBeNull()
    expect(await linkEmail('bome@example.com')).toEqual({ ok: false, error: 'cloud-unconfigured' })
    expect(await signInWithEmail('bome@example.com')).toEqual({ ok: false, error: 'cloud-unconfigured' })
    expect(await verifyEmailOtp('bome@example.com', '123456')).toEqual({ ok: false, error: 'cloud-unconfigured' })
    expect(await signOut()).toEqual({ ok: false, error: 'cloud-unconfigured' })
    expect(() => subscribeAuth(() => undefined)()).not.toThrow()
  })
})

describe('the silent anonymous bootstrap', () => {
  it('signs in once, however many callers ask', async () => {
    const client = makeClient()
    use(client)

    await Promise.all([startAnonymousSession(), startAnonymousSession(), startAnonymousSession()])

    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(await currentUserId()).toBe('anon-1')
    expect(await isAnonymous()).toBe(true)
  })

  it('does not sign in again for a device that already has a session', async () => {
    const client = makeClient()
    client.state.session = { user: { id: 'anon-old', is_anonymous: true } }
    use(client)

    await startAnonymousSession()

    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()
    expect(await currentUserId()).toBe('anon-old')
  })

  it('backs off exponentially and then gives up without a sound', async () => {
    const client = makeClient()
    client.auth.signInAnonymously.mockResolvedValue({ data: { user: { id: '' } }, error: { message: 'network' } })
    use(client)

    const slept: number[] = []
    await expect(startAnonymousSession({
      attempts: 4,
      baseDelayMs: 10,
      sleep: async (ms: number) => { slept.push(ms) },
    })).resolves.toBeUndefined()

    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(4)
    expect(slept).toEqual([10, 20, 40])
    expect(await currentUserId()).toBeNull()
  })

  it('keeps trying after a failure and stops as soon as it works', async () => {
    const client = makeClient()
    const real = client.auth.signInAnonymously.getMockImplementation()!
    client.auth.signInAnonymously
      .mockRejectedValueOnce(new Error('offline for a moment'))
      .mockResolvedValueOnce({ data: { user: { id: '' } }, error: { message: 'still no' } })
      .mockImplementationOnce(real)
    use(client)

    await startAnonymousSession({ attempts: 5, baseDelayMs: 1, sleep: async () => undefined })

    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(3)
    expect(await currentUserId()).toBe('anon-1')
  })

  it('stays completely silent while offline, and signs in when the network returns', async () => {
    const client = makeClient()
    use(client)
    let online = false

    await startAnonymousSession({ online: () => online, sleep: async () => undefined })
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()

    online = true
    window.dispatchEvent(new Event('online'))

    await vi.waitFor(() => expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1))
  })
})

describe('the recovery code', () => {
  const codeTable = (rows: { code: string } | null, onInsert?: (payload: unknown) => Reply): Record<string, TableScript> => {
    let stored = rows
    return {
      recovery_codes: {
        select: () => ok(stored),
        insert: (payload) => {
          if (onInsert) return onInsert(payload)
          stored = { code: 'K7QMB2XF' }
          return ok(stored)
        },
      },
    }
  }

  it('creates the row with the user id ALONE — the code comes from the database', async () => {
    const client = makeClient(codeTable(null))
    client.state.session = { user: { id: 'anon-1', is_anonymous: true } }
    use(client)

    expect(await ensureRecoveryCode()).toBe('K7QMB2XF')

    const insert = client.queries.find(q => q.verb === 'insert')
    expect(insert?.table).toBe('recovery_codes')
    // The column grant in the migration allows exactly this one column; sending a `code` would be
    // rejected, and generating one in JavaScript would be a guessing oracle.
    expect(insert?.payload).toEqual({ user_id: 'anon-1' })
  })

  it('does not create a second one', async () => {
    const client = makeClient(codeTable({ code: 'ALREADY24' }))
    client.state.session = { user: { id: 'anon-1' } }
    use(client)

    expect(await ensureRecoveryCode()).toBe('ALREADY24')
    expect(client.queries.some(q => q.verb === 'insert')).toBe(false)
  })

  it('reads back the winner when another device inserted first', async () => {
    // Two devices of the same family, both freshly signed in: the primary key lets one insert win
    // and the other must end up holding that same code, not nothing.
    let stored: { code: string } | null = null
    const client = makeClient({
      recovery_codes: {
        select: () => ok(stored),
        insert: () => { stored = { code: 'RACE9WIN' }; return bad('duplicate key value violates unique constraint') },
      },
    })
    client.state.session = { user: { id: 'anon-1' } }
    use(client)

    expect(await ensureRecoveryCode()).toBe('RACE9WIN')
  })

  it('is null rather than an error when there is no session or the table says no', async () => {
    const client = makeClient({ recovery_codes: { select: () => bad('permission denied') } })
    use(client)
    expect(await ensureRecoveryCode()).toBeNull()

    client.state.session = { user: { id: 'anon-1' } }
    expect(await getRecoveryCode()).toBeNull()
  })
})

describe('linking a parent email', () => {
  it('upgrades the SAME user, so nothing the child has synced moves', async () => {
    const client = makeClient()
    client.state.session = { user: { id: 'anon-1', is_anonymous: true } }
    use(client)
    const before = await currentUserId()

    expect(await linkEmail('  BoMe@Example.COM ')).toEqual({ ok: true, userId: 'anon-1' })
    expect(client.auth.updateUser).toHaveBeenCalledWith({ email: 'bome@example.com' })

    const verified = await verifyEmailOtp('bome@example.com', ' 123456 ')
    expect(verified).toEqual({ ok: true, userId: 'anon-1' })
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'bome@example.com', token: '123456', type: 'email_change' })

    expect(await currentUserId()).toBe(before)
    expect(await currentEmail()).toBe('bome@example.com')
    expect(await isAnonymous()).toBe(false)
  })

  it('refuses an obvious typo without asking the server', async () => {
    const client = makeClient()
    use(client)

    expect(await linkEmail('bome@')).toEqual({ ok: false, error: 'invalid-email' })
    expect(await signInWithEmail('nothing')).toEqual({ ok: false, error: 'invalid-email' })
    expect(await verifyEmailOtp('bome@example.com', '  ')).toEqual({ ok: false, error: 'invalid-token' })
    expect(client.auth.updateUser).not.toHaveBeenCalled()
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('reports a refusal from the server instead of throwing it at the parent', async () => {
    const client = makeClient()
    client.state.session = { user: { id: 'anon-1', is_anonymous: true } }
    client.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'email đã dùng' } })
    use(client)

    expect(await linkEmail('bome@example.com')).toEqual({ ok: false, error: 'email đã dùng' })
  })
})

describe('signing in on another device', () => {
  it('sends a code and verifies it as a sign-in, not an upgrade', async () => {
    const client = makeClient()
    use(client)

    expect(await signInWithEmail('bome@example.com')).toEqual({ ok: true, userId: null })
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'bome@example.com',
      options: { shouldCreateUser: true },
    })

    const verified = await verifyEmailOtp('bome@example.com', '654321')
    expect(verified).toEqual({ ok: true, userId: 'user-new' })
    expect(client.auth.verifyOtp).toHaveBeenCalledTimes(1)
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'bome@example.com', token: '654321', type: 'email' })
  })

  it('tries the other kind of code when the app was reloaded mid-flow', async () => {
    // The parent left to read the email and iOS discarded the tab: nothing remembers which flow
    // asked for the code, and telling them their correct code is wrong is not an option.
    const client = makeClient()
    client.state.session = { user: { id: 'anon-1', is_anonymous: true } }
    use(client)

    const verified = await verifyEmailOtp('bome@example.com', '111222')

    expect(verified).toEqual({ ok: true, userId: 'anon-1' })
    expect(client.auth.verifyOtp.mock.calls.map(c => c[0].type)).toEqual(['email_change'])
  })

  it('gives up with the last message when neither kind is accepted', async () => {
    const client = makeClient()
    client.auth.verifyOtp.mockResolvedValue({ data: null, error: { message: 'Token has expired' } })
    use(client)

    expect(await verifyEmailOtp('bome@example.com', '000000')).toEqual({ ok: false, error: 'Token has expired' })
    expect(client.auth.verifyOtp).toHaveBeenCalledTimes(2)
  })
})

describe('signing out', () => {
  it('ends the session', async () => {
    const client = makeClient()
    client.state.session = { user: { id: 'user-1', email: 'bome@example.com' } }
    use(client)

    expect(await signOut()).toEqual({ ok: true, userId: null })
    expect(await currentUserId()).toBeNull()
  })

  it('reports a refusal rather than throwing', async () => {
    const client = makeClient()
    client.auth.signOut.mockRejectedValue(new Error('no network'))
    use(client)

    expect(await signOut()).toEqual({ ok: false, error: 'no network' })
  })
})
