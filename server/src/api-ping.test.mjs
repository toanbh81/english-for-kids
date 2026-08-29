// Tests for ../../api/ping.mjs — the daily cron that keeps the free Supabase
// project from pausing (and with it, every child's sync).
import { describe, it, expect, vi } from 'vitest'
import { ping } from '../../api/ping.mjs'
import handler from '../../api/ping.mjs'

const env = { SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_SERVICE_ROLE: 'svc-test' }
const at = () => new Date('2026-08-29T03:00:00.000Z')

describe('GET /api/ping', () => {
  it('upserts the single heartbeat row', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 201 }))
    expect(await ping({ env, fetchImpl, now: at })).toEqual({ status: 200, body: { ok: true } })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://demo.supabase.co/rest/v1/heartbeat')
    expect(init.method).toBe('POST')
    // merge-duplicates makes the daily write an upsert of row 1 rather than a
    // table that grows forever.
    expect(init.headers.prefer).toContain('resolution=merge-duplicates')
    expect(JSON.parse(init.body)).toEqual([{ id: 1, at: '2026-08-29T03:00:00.000Z' }])
  })

  it('reports an unconfigured deployment instead of pretending it pinged', async () => {
    const fetchImpl = vi.fn()
    expect(await ping({ env: {}, fetchImpl })).toEqual({
      status: 500, body: { error: 'Supabase not configured' },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('turns an upstream failure into 502, never an unhandled rejection', async () => {
    expect(await ping({ env, fetchImpl: async () => ({ ok: false, status: 401 }) }))
      .toEqual({ status: 502, body: { error: 'Heartbeat failed: 401' } })
    expect(await ping({ env, fetchImpl: async () => { throw new Error('dns') } }))
      .toEqual({ status: 502, body: { error: 'dns' } })
  })
})

describe('the Vercel handler wrapper', () => {
  const fakeRes = () => {
    const res = { headers: {}, statusCode: 0, payload: undefined }
    res.setHeader = (k, v) => { res.headers[k] = v }
    res.status = (s) => { res.statusCode = s; return res }
    res.json = (p) => { res.payload = p; return res }
    return res
  }

  it('refuses methods a cron would never use', async () => {
    const res = fakeRes()
    await handler({ method: 'DELETE', headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })

  it('demands the cron secret when the deployment sets one', async () => {
    const previous = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'shh'
    try {
      const res = fakeRes()
      await handler({ method: 'GET', headers: { authorization: 'Bearer wrong' } }, res)
      expect(res.statusCode).toBe(401)
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = previous
    }
  })
})
