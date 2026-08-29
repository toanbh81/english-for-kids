// POST /api/recover  { code: "ABC23XYZ" }   → { profiles: n }
//
// The "cache wiped, never linked an email" rescue (spec flow 4). The child's
// iPad has already signed in anonymously as a BRAND NEW user; this endpoint
// moves the OLD user's profiles onto that new user and deletes the old user.
//
// Three things make it safe to expose:
//   1. The caller must present their own Supabase JWT. Profiles are moved TO
//      whoever that token says they are — never to an id in the request body.
//   2. The code is 2^40 possibilities and every attempt is rate-limited.
//   3. It redeems ONLY anonymous accounts. Once a parent has linked an email,
//      the email is the way back in and the code must stop being one: a
//      screenshot in a class group chat would otherwise be enough to take the
//      family's account over and delete the parent's login with it. The
//      database enforces the same rule from the other side (a trigger drops
//      the code when a user gains an email), so neither layer is load-bearing
//      alone.
//
// It needs the service role because re-parenting is exactly what RLS forbids a
// user to do. That key lives in server/.env locally and in Vercel env in
// production; it must never reach the client (scripts/check-secrets.sh guards
// this). Written as a plain .mjs with no imports, like api/speech-token.mjs —
// Vercel functions here carry no dependencies.
//
// Unit tests: server/src/api-recover.test.mjs (fetch is injected).

const CODE_ALPHABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/

// --- naive per-IP rate limit ------------------------------------------------
// In-memory, so it is per lambda instance: a distributed attacker gets one
// budget per warm instance, and a cold start resets the counter. At this
// scale (a handful of families, a code entered by hand on an iPad) that is
// enough to make guessing 2^40 codes hopeless. If this ever needs to be real,
// move the counter into Postgres — do not raise the limit.
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8
const MAX_TRACKED_IPS = 5000
const attempts = new Map()

export function rateLimitCheck(ip, now = Date.now()) {
  const key = ip || 'unknown'
  const fresh = (attempts.get(key) ?? []).filter(t => now - t < WINDOW_MS)
  fresh.push(now)
  attempts.set(key, fresh)
  // Bound memory: drop whoever has the oldest activity once the map is large.
  if (attempts.size > MAX_TRACKED_IPS) {
    for (const [k, v] of attempts) {
      if (now - (v[v.length - 1] ?? 0) > WINDOW_MS) attempts.delete(k)
    }
  }
  return fresh.length <= MAX_ATTEMPTS
}

export function resetRateLimit() { attempts.clear() }

// --- the work ---------------------------------------------------------------

const jsonHeaders = (serviceKey) => ({
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  'content-type': 'application/json',
})

// "Anonymous" means: nothing else can sign this account in. Anything that
// could — an email, a phone, an OAuth identity — makes the code a second,
// weaker credential for a real account, which is exactly what we refuse.
// `is_anonymous` is only trusted when it says false; an older GoTrue that
// omits it falls back to the absence of every other credential.
function isAnonymousUser(user) {
  if (!user || user.is_anonymous === false) return false
  if (user.email || user.new_email || user.phone) return false
  const identities = Array.isArray(user.identities) ? user.identities : []
  return identities.every(i => !i?.provider || i.provider === 'anonymous')
}

/**
 * @returns {Promise<{ status: number, body: object }>} never throws
 */
export async function recover({ code, authorization, env = process.env, fetchImpl = fetch }) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = env.SUPABASE_SERVICE_ROLE || ''
  if (!url || !serviceKey) return { status: 500, body: { error: 'Supabase not configured' } }

  const jwt = /^bearer\s+(.+)$/i.exec(String(authorization ?? '').trim())?.[1]
  if (!jwt) return { status: 401, body: { error: 'Missing bearer token' } }

  const cleaned = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!CODE_ALPHABET.test(cleaned)) return { status: 400, body: { error: 'Invalid code' } }

  try {
    // 1. Who is asking? The token is verified by Supabase itself; we never
    //    trust a user id from the request body.
    const meRes = await fetchImpl(`${url}/auth/v1/user`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${jwt}` },
    })
    if (!meRes.ok) return { status: 401, body: { error: 'Invalid session' } }
    const me = await meRes.json()
    // A service-role token has no user behind it; refuse it explicitly rather
    // than letting it act as "some user".
    if (!me?.id || me.role === 'service_role') {
      return { status: 401, body: { error: 'Invalid session' } }
    }

    // 2. CLAIM the code by deleting it. Reading it first and deleting it later
    //    would leave a window in which two requests both believe they own it;
    //    the delete is atomic, so exactly one caller gets the row back. Every
    //    refusal below therefore has to put the row back — a parent whose
    //    rescue was refused must not lose their code because of it.
    const claimRes = await fetchImpl(
      `${url}/rest/v1/recovery_codes?code=eq.${encodeURIComponent(cleaned)}`,
      {
        method: 'DELETE',
        headers: { ...jsonHeaders(serviceKey), prefer: 'return=representation' },
      },
    )
    if (!claimRes.ok) return { status: 502, body: { error: 'Lookup failed' } }
    const rows = await claimRes.json()
    const claimed = Array.isArray(rows) && rows.length === 1 ? rows[0] : null
    if (!claimed?.user_id) return { status: 404, body: { error: 'Unknown code' } }
    const oldUserId = claimed.user_id

    const restore = () => fetchImpl(`${url}/rest/v1/recovery_codes`, {
      method: 'POST',
      headers: { ...jsonHeaders(serviceKey), prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([claimed]),
    }).catch(() => {})

    // Redeeming your own code would delete the account you are signed into.
    if (oldUserId === me.id) {
      await restore()
      return { status: 409, body: { error: 'Code already yours' } }
    }

    // 3. Only anonymous accounts may be rescued this way (see the header).
    const ownerRes = await fetchImpl(
      `${url}/auth/v1/admin/users/${encodeURIComponent(oldUserId)}`,
      { headers: jsonHeaders(serviceKey) },
    )
    if (!ownerRes.ok) {
      await restore()
      return { status: 502, body: { error: 'Lookup failed' } }
    }
    if (!isAnonymousUser(await ownerRes.json())) {
      await restore()
      return { status: 403, body: { error: 'Code belongs to a linked account' } }
    }

    // 4. Re-parent the children. This is the only step that must not be lost,
    //    so the old account is not touched until it has succeeded.
    const moveRes = await fetchImpl(
      `${url}/rest/v1/profiles?owner_id=eq.${encodeURIComponent(oldUserId)}`,
      {
        method: 'PATCH',
        headers: { ...jsonHeaders(serviceKey), prefer: 'return=representation' },
        body: JSON.stringify({ owner_id: me.id }),
      },
    )
    if (!moveRes.ok) {
      await restore()
      return { status: 502, body: { error: 'Re-parenting failed' } }
    }
    const moved = await moveRes.json()
    const profiles = Array.isArray(moved) ? moved.length : 0

    // 5. The old account is now empty AND provably anonymous, so removing it
    //    takes nobody's way in with it.
    const delRes = await fetchImpl(
      `${url}/auth/v1/admin/users/${encodeURIComponent(oldUserId)}`,
      { method: 'DELETE', headers: jsonHeaders(serviceKey) },
    )

    // The rescue has already worked at this point; a failed cleanup leaves an
    // orphan user, not lost progress, so it is reported rather than raised.
    return { status: 200, body: { profiles, oldUserDeleted: !!delRes?.ok } }
  } catch (e) {
    return { status: 502, body: { error: e instanceof Error ? e.message : 'recover failed' } }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const ip = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()
    || req.socket?.remoteAddress || ''
  if (!rateLimitCheck(ip)) {
    return res.status(429).json({ error: 'Too many attempts, try again later' })
  }
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const { status, body: payload } = await recover({
    code: body?.code,
    authorization: req.headers?.authorization,
  })
  res.setHeader('Cache-Control', 'no-store')
  return res.status(status).json(payload)
}
