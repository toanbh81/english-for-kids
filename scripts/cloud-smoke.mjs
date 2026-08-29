#!/usr/bin/env node
// Usage: node scripts/cloud-smoke.mjs
//
// A one-shot, human-run integration test against a REAL Supabase project — not a mock, not the
// PGlite harness in supabase/tests/harness/. Everything else in this repo that touches the cloud
// (client/src/cloud/*.test.ts, supabase/tests/rls.test.sql) proves its claims against a stand-in;
// this is the one thing that asks the actual project the honest-persistence story depends on.
//
// It reads credentials from client/.env and server/.env (see supabase/README.md for what belongs
// in each), NEVER PRINTS ANY OF THEM, creates two throwaway "family" accounts under the project,
// exercises the paths this phase's honesty rests on, and deletes every account it created —
// cascading every row those accounts own — in a `finally`, whether the run passed or failed. This
// runs against the family's real database: nothing here touches an existing row, but treat a
// failed cleanup line as something to go clean up by hand (Supabase dashboard → Authentication),
// not something to ignore.
//
// What each step proves, and why it is the one worth checking against the real thing rather than
// trusting the mock: anonymous sign-in exercises the actual GoTrue anonymous-sign-in *setting*
// (Auth → Providers), which nothing else in this repo can turn on or off. Profile insert exercises
// the real `profiles_insert_own` RLS policy. `merge_kv` and the event upsert exercise the real
// `merge_kv` RPC and the real `events` primary key, not `client/src/cloud/sync.test.ts`'s working
// stand-in for them. The ts clamp depends on the SERVER's clock, which only the server has. The
// recovery-code steps exercise the real column-level grant (`insert (user_id)` only) that stands
// between a client and choosing its own credential. Cross-family isolation exercises RLS itself,
// end to end, the same way a second family's iPad would hit it.
//
// The user has already run an equivalent of every one of these by hand against this project and
// watched all of them pass — this script exists to make that repeatable, not to go looking for a
// new bug. If a step fails, suspect this script (a stale RPC name, a v2 supabase-js signature
// change) before suspecting the schema.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = new URL('../', import.meta.url)
const repoPath = p => fileURLToPath(new URL(p, ROOT))

// --- env: client/.env + server/.env, never process.env ----------------------------------------
// Deliberately not `dotenv` (or any dependency): a five-line parser is easier to audit for "does
// this ever print what it reads" than a dependency is, and this script's whole point is to be
// trustworthy with the one file in the repo that holds a real secret.
function loadEnvFile(relPath) {
  const file = repoPath(relPath)
  if (!existsSync(file)) return {}
  const out = {}
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const clientEnv = loadEnvFile('client/.env')
const serverEnv = loadEnvFile('server/.env')

const SUPABASE_URL = (serverEnv.SUPABASE_URL || clientEnv.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const ANON_KEY = clientEnv.VITE_SUPABASE_ANON_KEY || ''
const serviceKey = serverEnv.SUPABASE_SERVICE_ROLE || ''

if (!SUPABASE_URL || !ANON_KEY || !serviceKey) {
  console.error('cloud-smoke: missing configuration. This script needs all three of:')
  console.error('  client/.env  ->  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
  console.error('  server/.env  ->  SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE')
  console.error('See supabase/README.md. Nothing was contacted; nothing was created.')
  process.exit(1)
}

// --- @supabase/supabase-js: a client/ dependency, resolved the way client/ itself resolves it --
// This script has no package.json of its own and the repo root has no dependencies at all (see
// package.json) — the client workspace is the one place this library is actually installed.
// `createRequire` anchored at client/package.json makes Node resolve it exactly as `pnpm install`
// laid it out, without adding a second copy of the dependency anywhere in the repo.
let createClient
try {
  const require = createRequire(repoPath('client/package.json'))
  ;({ createClient } = require('@supabase/supabase-js'))
} catch {
  console.error('cloud-smoke: could not load @supabase/supabase-js from client/node_modules.')
  console.error('Run `pnpm install` from the repo root first.')
  process.exit(1)
}

function freshClient(key) {
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// --- reporting: PASS/FAIL per step, nothing else on the line that could be a key ---------------
const results = []
function record(name, ok, detail) {
  results.push({ name, ok })
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function step(name, fn) {
  try {
    const detail = await fn()
    record(name, true, detail)
    return true
  } catch (e) {
    record(name, false, e instanceof Error ? e.message : String(e))
    return false
  }
}

function anonHint(error) {
  const msg = error?.message || String(error)
  if (error?.status === 422 || /anonymous/i.test(msg)) {
    return `${msg} (check Auth → Providers → “Allow anonymous sign-ins” is ON — see supabase/README.md)`
  }
  return msg
}

async function mergeKv(sb, profile, key, value, updated_at) {
  const { error } = await sb.rpc('merge_kv', { profile, entries: [{ key, value, updated_at }] })
  if (error) throw new Error(error.message)
}

async function readKv(sb, profile, key) {
  const { data, error } = await sb.from('kv').select('value').eq('profile_id', profile).eq('key', key).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.value ?? null
}

// --- the run --------------------------------------------------------------------------------

async function main() {
  console.log('Speak Up! — cloud smoke test (live project, not a mock)')
  console.log(`Project: ${SUPABASE_URL}`)
  console.log('')

  const sbA = freshClient(ANON_KEY)
  const sbB = freshClient(ANON_KEY)
  const sbAdmin = freshClient(serviceKey)
  /** Every auth user this run created. Deleting one cascades its profiles, kv, events and
   * recovery code away (the migration's `on delete cascade`s) — this array is the whole cleanup
   * plan, and it is built as accounts are created, not guessed at the end. */
  const createdUsers = []

  let userA = null
  let userB = null
  const profileA = crypto.randomUUID()
  const now = Date.now()

  try {
    const okA = await step('1. anonymous sign-in (family A)', async () => {
      const { data, error } = await sbA.auth.signInAnonymously()
      if (error) throw new Error(anonHint(error))
      if (!data?.user?.id) throw new Error('no user id came back')
      if (data.user.is_anonymous !== true) throw new Error('signed-in user is not anonymous')
      userA = data.user
      createdUsers.push({ label: 'family A', id: userA.id })
      return `user ${userA.id}`
    })

    const okProfile = await step('2. profile insert (family A)', async () => {
      if (!okA) throw new Error('skipped: step 1 produced no session')
      const { error } = await sbA
        .from('profiles')
        .insert({ id: profileA, owner_id: userA.id, name: 'Cloud Smoke A', avatar: '🧪' })
      if (error) throw new Error(error.message)
      const { data, error: readErr } = await sbA.from('profiles').select('id, name').eq('id', profileA).maybeSingle()
      if (readErr) throw new Error(readErr.message)
      if (!data || data.id !== profileA) throw new Error('the inserted row did not read back')
      return `profile ${profileA}`
    })

    await step('3. merge_kv — stars merge by per-entry max, never by the clock', async () => {
      if (!okProfile) throw new Error('skipped: step 2 produced no profile')
      const t1 = now
      const t2 = now + 1000 // a LATER clock carrying a LOWER value
      const t0 = now - 1000 // an EARLIER clock carrying a brand-new key

      await mergeKv(sbA, profileA, 'stars', { c1: 3 }, t1)
      await mergeKv(sbA, profileA, 'stars', { c1: 1 }, t2)
      const afterLow = await readKv(sbA, profileA, 'stars')
      if (afterLow?.c1 !== 3) {
        throw new Error(`a newer-but-lower write changed c1 to ${afterLow?.c1} (expected 3 to survive)`)
      }

      await mergeKv(sbA, profileA, 'stars', { c1: 2, c2: 5 }, t0)
      const afterEarlier = await readKv(sbA, profileA, 'stars')
      if (afterEarlier?.c1 !== 3) throw new Error(`an earlier-clock write still lowered c1, to ${afterEarlier?.c1}`)
      if (afterEarlier?.c2 !== 5) throw new Error('a brand-new key on an earlier-clock write was dropped, not merged in')

      return 'c1 stayed at 3 through a later-but-lower write and an earlier-but-new key arrived alongside it'
    })

    await step('4. events — replaying the same attempt twice dedupes to one row', async () => {
      if (!okProfile) throw new Error('skipped: step 2 produced no profile')
      const row = { profile_id: profileA, ts: now, kind: 'speak', item_id: 'cloud-smoke-dedupe', score: 88, phonemes: null }
      for (let i = 0; i < 2; i++) {
        const { error } = await sbA
          .from('events')
          .upsert(row, { onConflict: 'profile_id,ts,kind,item_id', ignoreDuplicates: true })
        if (error) throw new Error(error.message)
      }
      const { count, error } = await sbA
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileA)
        .eq('kind', 'speak')
        .eq('item_id', 'cloud-smoke-dedupe')
      if (error) throw new Error(error.message)
      if (count !== 1) throw new Error(`expected exactly 1 row after two identical upserts, found ${count}`)
      return '2 upserts of the same (ts, kind, item_id) left 1 row'
    })

    await step('5. events — a client clock far in the future is clamped server-side', async () => {
      if (!okProfile) throw new Error('skipped: step 2 produced no profile')
      const wildTs = now + 10 * 24 * 60 * 60 * 1000 // 10 days ahead of this device's own clock
      // Mirrors clamp_client_ts in the migration: the ceiling is the SERVER's clock, hour-quantised,
      // plus 24h — this script's own clock is not assumed to agree with it, only to be far under it.
      const ceilingMs = (Math.floor(Date.now() / 1000 / 3600) * 3600 + 86400) * 1000
      const row = { profile_id: profileA, ts: wildTs, kind: 'speak', item_id: 'cloud-smoke-clamp', score: 50, phonemes: null }
      const { data, error } = await sbA
        .from('events')
        .upsert(row, { onConflict: 'profile_id,ts,kind,item_id', ignoreDuplicates: true })
        .select('ts')
      if (error) throw new Error(error.message)
      const storedTs = Number(data?.[0]?.ts)
      if (!Number.isFinite(storedTs)) throw new Error('no ts came back on the insert (Prefer: return=representation)')
      if (storedTs === wildTs) throw new Error('a timestamp 10 days ahead was stored unchanged — the clamp did not run')
      if (storedTs > ceilingMs) throw new Error(`stored ts ${storedTs} is still past the ~24h ceiling ${ceilingMs}`)
      return `sent ${wildTs}, server stored ${storedTs} (at or under the ceiling)`
    })

    const okB = await step('6. anonymous sign-in (family B)', async () => {
      const { data, error } = await sbB.auth.signInAnonymously()
      if (error) throw new Error(anonHint(error))
      userB = data.user
      createdUsers.push({ label: 'family B', id: userB.id })
      return `user ${userB.id}`
    })

    await step('7. recovery code — a client-chosen code is refused; a server-drawn one is not', async () => {
      if (!okB) throw new Error('skipped: step 6 produced no session')
      const { error: chosenErr } = await sbB.from('recovery_codes').insert({ user_id: userB.id, code: 'ZZZZZZZZ' })
      if (!chosenErr) throw new Error('inserting a client-chosen code SUCCEEDED — this must be impossible')

      const { data, error } = await sbB.from('recovery_codes').insert({ user_id: userB.id }).select('code').single()
      if (error) throw new Error(`the legitimate insert (user_id only) also failed: ${error.message}`)
      const code = data?.code
      if (typeof code !== 'string' || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
        throw new Error('the server-drawn code is not 8 characters from the expected no-look-alikes alphabet')
      }
      if (code === 'ZZZZZZZZ') throw new Error('the refused chosen code was persisted anyway')
      // The code itself is a credential (spec: "chụp màn hình lại nhé") — never printed, only judged.
      return 'chosen code refused; server-drawn code is 8 chars from the right alphabet (value not printed)'
    })

    await step("8. cross-family isolation — family B cannot read or write family A's data", async () => {
      if (!okProfile || !okB) throw new Error('skipped: missing a profile or a second family from earlier steps')

      const { data: seenProfile, error: profErr } = await sbB.from('profiles').select('id').eq('id', profileA)
      if (profErr) throw new Error(`profiles select errored instead of returning empty: ${profErr.message}`)
      if ((seenProfile ?? []).length !== 0) throw new Error("family B could see family A's profile row")

      const { error: mergeErr } = await sbB.rpc('merge_kv', {
        profile: profileA,
        entries: [{ key: 'stars', value: { c1: 99 }, updated_at: Date.now() }],
      })
      if (!mergeErr) throw new Error("family B was able to call merge_kv on family A's profile")

      const { data: seenCode, error: codeErr } = await sbB.from('recovery_codes').select('code').eq('user_id', userA.id)
      if (codeErr) throw new Error(`recovery_codes select errored instead of returning empty: ${codeErr.message}`)
      if ((seenCode ?? []).length !== 0) throw new Error("family B could read family A's recovery code row")

      return 'profile read empty, merge_kv refused, recovery code unreadable — none of the three leaked existence via an error'
    })
  } finally {
    console.log('')
    console.log(`cleaning up — deleting ${createdUsers.length} account(s) this run created (cascades every row with it)...`)
    for (const { label, id } of createdUsers) {
      try {
        const { error } = await sbAdmin.auth.admin.deleteUser(id)
        console.log(`  ${error ? 'FAIL' : 'ok  '}  delete ${label} (${id})${error ? ` — ${error.message}` : ''}`)
      } catch (e) {
        console.log(`  FAIL  delete ${label} (${id}) — ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  console.log('')
  const failed = results.filter(r => !r.ok)
  if (failed.length === 0) {
    console.log(`PASS — all ${results.length} steps passed`)
  } else {
    console.log(`FAIL — ${failed.length} of ${results.length} steps failed: ${failed.map(f => f.name).join('; ')}`)
    process.exitCode = 1
  }
}

await main()
// A safety net, not the usual exit path: supabase-js should leave no open handles once every
// client here has `autoRefreshToken: false`, but a hung fetch keep-alive must not turn a finished,
// reported run into a script that never returns control to whoever ran it.
process.exit(process.exitCode ?? 0)
