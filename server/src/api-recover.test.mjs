// Tests for ../../api/recover.mjs — the Vercel function that redeems a
// recovery code. It lives here because this package is the repo's node-side
// test runner (the same way server/src/token.ts mirrors api/speech-token.mjs);
// the function itself has no dependencies, so `fetch` is injected instead of
// mocking a Supabase client object.
//
// Everything below is written from the attacker's side: the happy path is one
// test, the refusals are the rest, and each refusal also asserts that NOTHING
// was written — a 401 that still re-parented a child would be the worst kind
// of pass.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recover, rateLimitCheck, resetRateLimit } from '../../api/recover.mjs'
import handler from '../../api/recover.mjs'

const env = { SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_SERVICE_ROLE: 'svc-test' }
const CALLER = '99999999-9999-4999-8999-999999999999'
const OLD_USER = '11111111-1111-4111-8111-111111111111'

const ok = (json) => ({ ok: true, status: 200, json: async () => json })
const fail = (status) => ({ ok: false, status, json: async () => ({}) })

/** A fake Supabase HTTP surface. `overrides` replaces any single leg. */
function fakeFetch(overrides = {}) {
  const calls = []
  const impl = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET'
    calls.push({ url, method, body: init.body, headers: init.headers })
    if (url.includes('/auth/v1/user')) return overrides.user ?? ok({ id: CALLER, role: 'authenticated' })
    // the claim: deleting the row IS the lock on it
    if (url.includes('/rest/v1/recovery_codes') && method === 'DELETE')
      return overrides.claim ?? ok([{ user_id: OLD_USER, code: 'ABC23XYZ' }])
    if (url.includes('/rest/v1/recovery_codes') && method === 'POST')
      return overrides.restore ?? ok(null)
    if (url.includes('/auth/v1/admin/users/') && method === 'GET')
      return overrides.owner ?? ok({ id: OLD_USER, is_anonymous: true, identities: [] })
    if (url.includes('/rest/v1/profiles')) return overrides.move ?? ok([{ id: 'p1' }, { id: 'p2' }])
    if (url.includes('/auth/v1/admin/users/') && method === 'DELETE')
      return overrides.deleteUser ?? ok(null)
    throw new Error(`unexpected call: ${method} ${url}`)
  })
  impl.calls = calls
  impl.wrote = () => calls.filter(c => c.method !== 'GET')
  impl.restored = () => calls.some(c => c.method === 'POST' && c.url.includes('recovery_codes'))
  impl.deletedUser = () => calls.some(c => c.method === 'DELETE' && c.url.includes('/admin/users/'))
  impl.moved = () => calls.some(c => c.method === 'PATCH')
  return impl
}

const auth = 'Bearer header.payload.signature'

describe('POST /api/recover', () => {
  beforeEach(() => resetRateLimit())

  it('moves the old user\'s profiles onto the caller from the TOKEN, not the body', async () => {
    const f = fakeFetch()
    const r = await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f })
    expect(r).toEqual({ status: 200, body: { profiles: 2, oldUserDeleted: true } })

    const patch = f.calls.find(c => c.method === 'PATCH')
    expect(patch.url).toContain(`owner_id=eq.${OLD_USER}`)
    expect(JSON.parse(patch.body)).toEqual({ owner_id: CALLER })

    // the code is claimed by deleting it, the old account is proved anonymous,
    // and only then is the emptied user removed
    const order = f.calls.map(c => `${c.method} ${c.url.split('demo.supabase.co')[1].split('?')[0]}`)
    expect(order).toEqual([
      'GET /auth/v1/user',
      'DELETE /rest/v1/recovery_codes',
      `GET /auth/v1/admin/users/${OLD_USER}`,
      'PATCH /rest/v1/profiles',
      `DELETE /auth/v1/admin/users/${OLD_USER}`,
    ])
    expect(f.restored()).toBe(false)
  })

  // The finding that made this fix urgent: a code screenshotted before the
  // parent linked their email must not open the linked account afterwards.
  it.each([
    ['an email', { id: OLD_USER, email: 'parent@example.invalid' }],
    ['a phone', { id: OLD_USER, phone: '+84900000000' }],
    ['a pending email change', { id: OLD_USER, new_email: 'parent@example.invalid' }],
    ['is_anonymous false', { id: OLD_USER, is_anonymous: false }],
    ['a google identity', { id: OLD_USER, identities: [{ provider: 'google' }] }],
  ])('refuses a code whose account has %s, and puts the code back', async (_label, owner) => {
    const f = fakeFetch({ owner: ok(owner) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 403, body: { error: 'Code belongs to a linked account' } })
    expect(f.moved()).toBe(false)
    expect(f.deletedUser()).toBe(false)
    expect(f.restored()).toBe(true)
  })

  it('never deletes an account it did not prove anonymous', async () => {
    const f = fakeFetch({ owner: fail(500) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 502, body: { error: 'Lookup failed' } })
    expect(f.deletedUser()).toBe(false)
    expect(f.restored()).toBe(true)
  })

  it('gives the code to exactly one of two racing requests', async () => {
    // the loser's DELETE comes back empty: the row was already claimed
    const f = fakeFetch({ claim: ok([]) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 404, body: { error: 'Unknown code' } })
    expect(f.moved()).toBe(false)
    expect(f.deletedUser()).toBe(false)
  })

  it('accepts a code the way a parent types it off a screenshot', async () => {
    const f = fakeFetch()
    const r = await recover({ code: ' abc2-3xyz ', authorization: auth, env, fetchImpl: f })
    expect(r.status).toBe(200)
    expect(f.calls[1]).toMatchObject({ method: 'DELETE' })
    expect(f.calls[1].url).toContain('code=eq.ABC23XYZ')
  })

  it('refuses without a bearer token, before touching anything', async () => {
    const f = fakeFetch()
    expect(await recover({ code: 'ABC23XYZ', authorization: undefined, env, fetchImpl: f }))
      .toEqual({ status: 401, body: { error: 'Missing bearer token' } })
    expect(await recover({ code: 'ABC23XYZ', authorization: 'Basic abc', env, fetchImpl: f }))
      .toMatchObject({ status: 401 })
    expect(f).not.toHaveBeenCalled()
  })

  it('refuses a token Supabase does not recognise', async () => {
    const f = fakeFetch({ user: fail(401) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 401, body: { error: 'Invalid session' } })
    expect(f.wrote()).toEqual([])
  })

  it('refuses a service-role token pretending to be a user', async () => {
    const f = fakeFetch({ user: ok({ id: null, role: 'service_role' }) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 401, body: { error: 'Invalid session' } })
    expect(f.wrote()).toEqual([])
  })

  it('refuses a code that is not in the alphabet, without a network round trip', async () => {
    const f = fakeFetch()
    for (const code of ['', 'ABC', 'ABC23XYZ9', 'ABC23XY!', 'ABC0IL23', undefined, 42]) {
      expect(await recover({ code, authorization: auth, env, fetchImpl: f }))
        .toEqual({ status: 400, body: { error: 'Invalid code' } })
    }
    expect(f).not.toHaveBeenCalled()
  })

  it('refuses an unknown code and changes nothing', async () => {
    const f = fakeFetch({ claim: ok([]) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 404, body: { error: 'Unknown code' } })
    expect(f.moved()).toBe(false)
    expect(f.deletedUser()).toBe(false)
  })

  it('refuses the caller\'s own code and hands it straight back', async () => {
    const f = fakeFetch({ claim: ok([{ user_id: CALLER, code: 'ABC23XYZ' }]) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 409, body: { error: 'Code already yours' } })
    expect(f.moved()).toBe(false)
    expect(f.deletedUser()).toBe(false)
    // the claim deleted it; a refusal must not cost the parent their code
    const put = f.calls.find(c => c.method === 'POST' && c.url.includes('recovery_codes'))
    expect(JSON.parse(put.body)).toEqual([{ user_id: CALLER, code: 'ABC23XYZ' }])
  })

  it('keeps the old user when re-parenting fails — data first, tidiness never', async () => {
    const f = fakeFetch({ move: fail(500) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 502, body: { error: 'Re-parenting failed' } })
    expect(f.deletedUser()).toBe(false)
    expect(f.restored()).toBe(true)
  })

  it('reports a rescue that worked even if deleting the empty user did not', async () => {
    const f = fakeFetch({ deleteUser: fail(500) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 200, body: { profiles: 2, oldUserDeleted: false } })
  })

  it('survives a network error instead of throwing at the caller', async () => {
    const f = vi.fn(async () => { throw new Error('offline') })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 502, body: { error: 'offline' } })
  })

  it('says it is unconfigured rather than half-working', async () => {
    const f = fakeFetch()
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env: {}, fetchImpl: f }))
      .toEqual({ status: 500, body: { error: 'Supabase not configured' } })
    expect(f).not.toHaveBeenCalled()
  })
})

describe('recover rate limit', () => {
  beforeEach(() => resetRateLimit())

  it('allows a parent to fat-finger the code a few times, then stops guessing', () => {
    const t = Date.now()
    for (let i = 0; i < 8; i++) expect(rateLimitCheck('1.2.3.4', t + i)).toBe(true)
    expect(rateLimitCheck('1.2.3.4', t + 9)).toBe(false)
  })

  it('counts each address on its own, and forgets after the window', () => {
    const t = Date.now()
    for (let i = 0; i < 9; i++) rateLimitCheck('1.2.3.4', t + i)
    expect(rateLimitCheck('5.6.7.8', t)).toBe(true)
    expect(rateLimitCheck('1.2.3.4', t + 11 * 60 * 1000)).toBe(true)
  })
})

describe('the Vercel handler wrapper', () => {
  beforeEach(() => resetRateLimit())

  const fakeRes = () => {
    const res = { headers: {}, statusCode: 0, payload: undefined }
    res.setHeader = (k, v) => { res.headers[k] = v }
    res.status = (s) => { res.statusCode = s; return res }
    res.json = (p) => { res.payload = p; return res }
    return res
  }

  it('answers only POST', async () => {
    const res = fakeRes()
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('POST')
  })

  it('turns away a flood from one address with 429', async () => {
    const req = { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }, body: {} }
    for (let i = 0; i < 8; i++) await handler(req, fakeRes())
    const res = fakeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
  })
})
