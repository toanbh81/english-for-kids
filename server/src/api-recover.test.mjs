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
    calls.push({ url, method: init.method ?? 'GET', body: init.body, headers: init.headers })
    if (url.includes('/auth/v1/user')) return overrides.user ?? ok({ id: CALLER, role: 'authenticated' })
    if (url.includes('/rest/v1/recovery_codes') && (init.method ?? 'GET') === 'GET')
      return overrides.code ?? ok([{ user_id: OLD_USER }])
    if (url.includes('/rest/v1/recovery_codes')) return overrides.burn ?? ok(null)
    if (url.includes('/rest/v1/profiles')) return overrides.move ?? ok([{ id: 'p1' }, { id: 'p2' }])
    if (url.includes('/auth/v1/admin/users/')) return overrides.deleteUser ?? ok(null)
    throw new Error(`unexpected call: ${url}`)
  })
  impl.calls = calls
  impl.wrote = () => calls.filter(c => c.method !== 'GET')
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

    // the code is burned, and only then is the emptied user removed
    const order = f.calls.map(c => `${c.method} ${c.url.split('demo.supabase.co')[1].split('?')[0]}`)
    expect(order).toEqual([
      'GET /auth/v1/user',
      'GET /rest/v1/recovery_codes',
      'PATCH /rest/v1/profiles',
      'DELETE /rest/v1/recovery_codes',
      `DELETE /auth/v1/admin/users/${OLD_USER}`,
    ])
  })

  it('accepts a code the way a parent types it off a screenshot', async () => {
    const f = fakeFetch()
    const r = await recover({ code: ' abc2-3xyz ', authorization: auth, env, fetchImpl: f })
    expect(r.status).toBe(200)
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

  it('refuses an unknown code and writes nothing', async () => {
    const f = fakeFetch({ code: ok([]) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 404, body: { error: 'Unknown code' } })
    expect(f.wrote()).toEqual([])
  })

  it('refuses the caller\'s own code, so nobody deletes the account they are in', async () => {
    const f = fakeFetch({ code: ok([{ user_id: CALLER }]) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 409, body: { error: 'Code already yours' } })
    expect(f.wrote()).toEqual([])
  })

  it('keeps the old user when re-parenting fails — data first, tidiness never', async () => {
    const f = fakeFetch({ move: fail(500) })
    expect(await recover({ code: 'ABC23XYZ', authorization: auth, env, fetchImpl: f }))
      .toEqual({ status: 502, body: { error: 'Re-parenting failed' } })
    expect(f.calls.some(c => c.url.includes('/auth/v1/admin/users/'))).toBe(false)
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
