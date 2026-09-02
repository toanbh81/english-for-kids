import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * The cloud client is the one thing mocked here: every test below is about what `auth.ts` does
 * with it — including the case that matters most, which is having no client at all.
 */
const cloud = vi.hoisted(() => ({ client: null as unknown }))
// Resolved, not returned: the real one loads supabase-js on demand, so every caller in auth.ts
// awaits it and a mock that answered synchronously would be testing an easier module.
vi.mock('./supabase', () => ({
  getSupabase: async () => cloud.client,
  isCloudConfigured: () => cloud.client !== null,
  resetSupabaseClient: () => undefined,
}))

import {
  currentAccessToken,
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
/** `status` is what tells a wrong-kind refusal from a rate limit; the real AuthError carries it. */
type Fail = { message: string; status?: number }
type Reply = { data: unknown; error: Fail | null }
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
  const state = { session: null as { user: User; access_token?: string } | null }
  const queries: Query[] = []

  const auth = {
    getSession: vi.fn(async () => ({ data: { session: state.session }, error: null })),
    signInAnonymously: vi.fn(async () => {
      state.session = { user: { id: 'anon-1', is_anonymous: true } }
      return { data: { user: state.session.user }, error: null as Fail | null }
    }),
    updateUser: vi.fn(async (_attrs: { email?: string }) => ({ data: {}, error: null as Fail | null })),
    signInWithOtp: vi.fn(async (_args: unknown) => ({ data: {}, error: null as Fail | null })),
    verifyOtp: vi.fn(async ({ email, type }: { email: string; token: string; type: string }) => {
      if (type === 'email_change' && !state.session) return { data: null, error: { message: 'no session' } as Fail }
      const user: User = { id: state.session?.user.id ?? 'user-new', is_anonymous: false, email }
      state.session = { user }
      return { data: { user }, error: null as Fail | null }
    }),
    signOut: vi.fn(async () => {
      state.session = null
      return { error: null as Fail | null }
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
  localStorage.clear()
  vi.clearAllMocks()
})

describe('with no cloud configured', () => {
  // The contract every screen depends on: a build with no Supabase env vars is a working app, and
  // nothing in here is allowed to throw on the way to doing nothing.
  it('does nothing, quietly, in every direction', async () => {
    await expect(startAnonymousSession()).resolves.toBeUndefined()
    expect(await currentUserId()).toBeNull()
    expect(await currentAccessToken()).toBeNull()
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

describe('the current device\'s own access token', () => {
  // Task 4's /api/recover call authenticates as "whoever this JWT says" — never a stored email —
  // so this is the one thing that has to come off the CURRENT session, not out of a form field.
  it('is null with no session, and the session\'s own token once signed in', async () => {
    const client = makeClient()
    use(client)
    expect(await currentAccessToken()).toBeNull()

    client.state.session = { user: { id: 'anon-1', is_anonymous: true }, access_token: 'jwt-abc' }
    expect(await currentAccessToken()).toBe('jwt-abc')
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

  it('hands the returning network back to the caller\'s whole sequence, not just the sign-in', async () => {
    // Signing in is a third of connecting: the profile rows and the recovery code have to follow,
    // and a device that booted offline has had none of it done. So the retry runs what the launch
    // would have run — `connectCloud`, from profileState — rather than a sign-in on its own.
    const client = makeClient()
    use(client)
    const retry = vi.fn()

    await startAnonymousSession({ online: () => false, retry, sleep: async () => undefined })
    expect(retry).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('online'))

    await vi.waitFor(() => expect(retry).toHaveBeenCalledTimes(1))
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()
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
    client.state.session = { user: { id: 'anon-1', is_anonymous: true } }
    use(client)

    expect(await ensureRecoveryCode()).toBe('RACE9WIN')
  })

  it('mints nothing once the parent has linked an email', async () => {
    // The database drops the code when the account gains an email, and /api/recover refuses to
    // redeem for anything but an anonymous user. A code minted here would be dead on arrival, and
    // the parent screen would present it as a way home.
    const client = makeClient(codeTable(null))
    client.state.session = { user: { id: 'user-1', is_anonymous: false, email: 'bome@example.com' } }
    use(client)

    expect(await ensureRecoveryCode()).toBeNull()
    expect(client.queries.some(q => q.verb === 'insert')).toBe(false)
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

  it('reads an empty-string email from GoTrue as "nobody has linked yet"', async () => {
    // Not a hypothetical: a live anonymous sign-in returns `email: ""`, not null or undefined.
    // The mocks in this file omitted the field entirely, so `?? null` looked correct for the whole
    // phase while production drew the LINKED branch of the parent screen for every anonymous
    // child — an empty address beside a "Đăng xuất" button, with the link form and the recovery
    // code both hidden. Pin the server's real shape, not a convenient one.
    const client = makeClient()
    client.state.session = { user: { id: 'anon-1', is_anonymous: true, email: '' } }
    use(client)

    expect(await currentEmail()).toBeNull()
    expect(await isAnonymous()).toBe(true)
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
    // `shouldCreateUser: false`, and it is not a detail. This is the door labelled "Tôi có email
    // đã liên kết": with `true`, a mistyped or never-linked address silently minted a brand-new
    // empty account, the anonymous one holding the family's mirrored progress was abandoned in the
    // same flow, and nothing could reach it again — the recovery code is owner-read-only and was
    // now being read as the new user.
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'bome@example.com',
      options: { shouldCreateUser: false },
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

  it('gives up with the FIRST message when neither kind is accepted', async () => {
    // The first message is the answer for the flow the parent was actually in; the second is what
    // a flow they were never in thinks of their code, and telling them that would be nonsense.
    const client = makeClient()
    client.auth.verifyOtp
      .mockResolvedValueOnce({ data: null, error: { message: 'Token has expired or is invalid' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'Email link is invalid' } })
    use(client)

    expect(await verifyEmailOtp('bome@example.com', '000000'))
      .toEqual({ ok: false, error: 'Token has expired or is invalid' })
    expect(client.auth.verifyOtp).toHaveBeenCalledTimes(2)
  })

  it('does not spend a second attempt on a refusal that is not about the kind', async () => {
    // A rate limit says nothing about which flow the code belongs to, and asking again would burn
    // one more of the few attempts the parent has left.
    const client = makeClient()
    client.auth.verifyOtp.mockResolvedValue({
      data: null,
      error: { message: 'For security purposes, you can only request this after 51 seconds', status: 429 },
    })
    use(client)

    expect(await verifyEmailOtp('bome@example.com', '000000')).toEqual({
      ok: false,
      error: 'For security purposes, you can only request this after 51 seconds',
    })
    expect(client.auth.verifyOtp).toHaveBeenCalledTimes(1)
  })

  /**
   * The other half of `shouldCreateUser: false`: what the parent is told. An address with no
   * account has to come back as its own answer — not as a raw Supabase string the screen would
   * translate into "có lỗi xảy ra, thử lại nhé", which is advice that can only fail again.
   */
  it('reports a never-linked email as exactly that, whichever way the server words it', async () => {
    for (const error of [
      { message: 'Signups not allowed for otp', status: 422 },
      { message: 'something else entirely', code: 'otp_disabled', status: 422 },
    ]) {
      const client = makeClient()
      client.auth.signInWithOtp.mockResolvedValue({ data: {}, error })
      use(client)

      expect(await signInWithEmail('never@example.com')).toEqual({ ok: false, error: 'email-not-linked' })
    }
  })

  it('does not mistake a real server failure for a never-linked email', async () => {
    const client = makeClient()
    client.auth.signInWithOtp.mockResolvedValue({ data: {}, error: { message: 'Failed to fetch' } })
    use(client)

    expect(await signInWithEmail('bome@example.com')).toEqual({ ok: false, error: 'Failed to fetch' })
  })

  it('forgets a flow the server refused to start', async () => {
    const client = makeClient()
    use(client)

    expect(await signInWithEmail('bome@example.com')).toEqual({ ok: true, userId: null })
    client.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'rate limited' } })
    client.state.session = { user: { id: 'anon-1', is_anonymous: true } }
    expect((await linkEmail('bome@example.com')).ok).toBe(false)

    // No code was sent for the link, so the sign-in flow recorded earlier must not be what the
    // next code the parent types is checked against: with nothing pending it is inferred fresh.
    await verifyEmailOtp('bome@example.com', '123456')
    expect(client.auth.verifyOtp.mock.calls[0][0].type).toBe('email_change')
  })

  it('refuses to sign in over a child who is already on this iPad', async () => {
    // The anonymous account holding that child would be stranded: its rows owned by a user id
    // nothing can reach, its recovery code the only way back, and the child's local namespace
    // invisible to whoever signs in. Task 4 offers linking instead — and only passes the flag
    // below once the parent has said this iPad's progress is not what they are after.
    const client = makeClient()
    client.state.session = { user: { id: 'anon-1', is_anonymous: true } }
    use(client)
    localStorage.setItem('speakup.profile', '11111111-2222-4333-8444-555555555555')

    expect(await signInWithEmail('bome@example.com')).toEqual({ ok: false, error: 'anonymous-session-in-use' })
    expect(client.auth.signInWithOtp).not.toHaveBeenCalled()

    expect(await signInWithEmail('bome@example.com', { abandonAnonymous: true })).toEqual({ ok: true, userId: 'anon-1' })
    expect(client.auth.signInWithOtp).toHaveBeenCalledTimes(1)
  })

  it('lets a device with nothing on it sign in freely', async () => {
    const client = makeClient()
    use(client)
    // A wiped cache: a profile exists locally but the session is not anonymous-with-history — and
    // a fresh device with no session at all is the returning-parent case flow 3 is named after.
    expect(await signInWithEmail('bome@example.com')).toEqual({ ok: true, userId: null })
    expect(client.auth.signInWithOtp).toHaveBeenCalledTimes(1)
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
