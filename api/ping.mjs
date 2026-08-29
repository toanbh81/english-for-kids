// GET /api/ping — the daily heartbeat (vercel.json → crons).
//
// A free Supabase project pauses after 7 days with no database activity, and a
// paused project means a child's iPad silently stops syncing. One write a day
// keeps it awake. That is the whole job.
//
// It writes to `heartbeat`, the one table no user can touch (no policy, no
// grant), using the service role. Plain .mjs with no imports, like the other
// functions here. Unit tests: server/src/api-ping.test.mjs.

export async function ping({ env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = env.SUPABASE_SERVICE_ROLE || ''
  if (!url || !serviceKey) return { status: 500, body: { error: 'Supabase not configured' } }

  try {
    const res = await fetchImpl(`${url}/rest/v1/heartbeat`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{ id: 1, at: now().toISOString() }]),
    })
    if (!res.ok) return { status: 502, body: { error: `Heartbeat failed: ${res.status}` } }
    return { status: 200, body: { ok: true } }
  } catch (e) {
    return { status: 502, body: { error: e instanceof Error ? e.message : 'heartbeat failed' } }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  // Vercel signs cron invocations with CRON_SECRET when that env var is set.
  // Set it (supabase/README.md says so too): without it this is a write anyone
  // can trigger. The blast radius is one fixed row and no data comes back, but
  // an open write on a free project is not something to leave lying around.
  const expected = process.env.CRON_SECRET
  if (expected && req.headers?.authorization !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { status, body } = await ping({})
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json(body)
}
