// Applies supabase/migrations/*.sql to a throwaway Postgres that imitates a
// real Supabase project (see shim.sql), then runs supabase/tests/rls.test.sql
// under TWO scenarios on two fresh databases:
//
//   1. stock project    — Automatic RLS on, no remediation. rls.test.sql MUST
//                          FAIL here, naming rls_auto_enable — that object is
//                          Supabase's, not this migration's, and re-pasting
//                          the migration does not touch it. A PASS in this
//                          scenario is itself a harness failure: it means the
//                          §11 guard stopped seeing platform objects.
//   2. remediated project — same, then the exact statement
//                          supabase/README.md documents (kept in
//                          rls_auto_enable_remediation.sql so the two cannot
//                          drift) is applied. rls.test.sql MUST PASS here.
//
// The harness passes only if BOTH scenarios land as expected. See
// supabase/README.md, "Expected findings the first time you run rls.test.sql
// on a real project", and tests/harness/README.md for why scenario 1 is
// supposed to fail.
//
//   node supabase/tests/harness/run.mjs            # both scenarios
//   node supabase/tests/harness/run.mjs --audit    # …plus the grant table
//   node supabase/tests/harness/run.mjs --migration <path>   # e.g. an old one
//
// Run `pnpm install` in this directory first; PGlite lives here and not in the
// workspace so it never reaches the client bundle or `pnpm test`.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const argv = process.argv.slice(2)
const audit = argv.includes('--audit')
const migrationArg = argv[argv.indexOf('--migration') + 1]
const migration = argv.includes('--migration')
  ? resolve(process.cwd(), migrationArg)
  : resolve(repo, 'supabase/migrations/0001_profiles_sync.sql')
const tests = resolve(repo, 'supabase/tests/rls.test.sql')
const shim = resolve(here, 'shim.sql')
const remediation = resolve(here, 'rls_auto_enable_remediation.sql')
const read = (p) => readFileSync(p, 'utf8')

// One db + its own pass/fail bookkeeping, so the two scenarios never share
// state. `step` returns whether it (and everything before it) is still clean.
function makeSteps(db) {
  let failed = null
  const step = async (label, sql) => {
    if (failed) return
    try {
      await db.exec(sql)
      console.log(`    ok    ${label}`)
    } catch (e) {
      failed = { label, e }
      console.log(`    FAIL  ${label}`)
      for (const k of ['message', 'detail', 'hint', 'where']) {
        if (e[k]) console.log(`          ${k}: ${String(e[k]).split('\n').join('\n          ')}`)
      }
    }
  }
  return { step, current: () => failed }
}

async function printAudit(db) {
  console.log('\n  privileges held by anon / authenticated in schema public:')
  const rows = async (sql) => (await db.query(sql)).rows
  for (const r of await rows(`
    select c.relname as name, g.grantee,
           string_agg(distinct g.privilege_type, ',' order by g.privilege_type) as privs
    from pg_class c
    join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a on true
    join lateral (select pg_get_userbyid(a.grantee) as grantee, a.privilege_type) g on true
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','m','p','S')
      and g.grantee in ('anon', 'authenticated')
    group by 1, 2 order by 1, 2`)) {
    console.log(`    table  ${r.name.padEnd(16)} ${r.grantee.padEnd(14)} ${r.privs}`)
  }
  for (const r of await rows(`
    select c.relname || '.' || a.attname as name, g.grantee,
           string_agg(distinct g.privilege_type, ',' order by g.privilege_type) as privs
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join lateral aclexplode(a.attacl) ac on true
    join lateral (select pg_get_userbyid(ac.grantee) as grantee, ac.privilege_type) g on true
    where c.relnamespace = 'public'::regnamespace and g.grantee in ('anon', 'authenticated')
    group by 1, 2 order by 1, 2`)) {
    console.log(`    column ${r.name.padEnd(16)} ${r.grantee.padEnd(14)} ${r.privs}`)
  }
  for (const r of await rows(`
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as name,
           coalesce(string_agg(distinct g.grantee, ',' order by g.grantee), '-') as grantees
    from pg_proc p
    left join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a on true
    left join lateral (select pg_get_userbyid(a.grantee) as grantee, a.privilege_type) g
         on g.privilege_type = 'EXECUTE' and g.grantee in ('anon', 'authenticated')
    where p.pronamespace = 'public'::regnamespace
    group by 1 order by 1`)) {
    console.log(`    exec   ${r.name.padEnd(60)} ${r.grantees}`)
  }
  console.log()
}

// Scenario 1: a stock project. Automatic RLS is on (shim.sql installs it) and
// nobody has run the README's remediation. rls.test.sql's §11 is expected to
// FAIL here, and specifically to name rls_auto_enable — that is the guard
// correctly seeing a platform object this migration does not own, which is
// the live finding this harness exists to keep catching. Matched on the
// object name rather than the whole message, so a wording change to the
// assertion's text does not make this brittle.
async function runStock() {
  const name = 'scenario 1 — stock project (Automatic RLS on, no remediation)'
  console.log(`\n${name}`)
  const db = new PGlite()
  const { step, current } = makeSteps(db)

  await step('supabase shim (roles, auth schema, default privileges, Automatic RLS)', read(shim))
  await step('apply migration', read(migration))

  if (audit && !current()) await printAudit(db)

  let outcome
  if (!current()) {
    try {
      await db.exec(read(tests))
      outcome = { passed: true }
    } catch (e) {
      outcome = { passed: false, e }
    }
  }
  await db.close()

  const setupFailure = current()
  if (setupFailure) {
    console.log(`    FAIL  setup failed before rls.test.sql could run (${setupFailure.label})`)
    return { name, ok: false, reason: `setup failed at "${setupFailure.label}": ${setupFailure.e.message}` }
  }
  if (outcome.passed) {
    console.log('    FAIL  rls.test.sql PASSED — expected it to fail naming rls_auto_enable')
    return { name, ok: false, reason: 'rls.test.sql unexpectedly PASSED on a stock project — the §11 guard stopped seeing platform objects' }
  }
  const message = String(outcome.e?.message || '')
  if (!message.includes('rls_auto_enable')) {
    console.log(`    FAIL  rls.test.sql failed, but not on rls_auto_enable`)
    console.log(`          message: ${message}`)
    return { name, ok: false, reason: `rls.test.sql failed for the wrong reason (expected it to name rls_auto_enable): ${message}` }
  }
  console.log('    ok    rls.test.sql FAILED naming rls_auto_enable, as expected')
  return { name, ok: true, reason: 'rls.test.sql correctly refuses a stock project on the platform-owned rls_auto_enable() grant' }
}

// Scenario 2: the same project, but remediated exactly as the README says to.
// Keeps the apply / re-apply / re-apply idempotence proof (the user's repair
// path is "paste the same file again", and a revoke that ran after its own
// grant on the second pass would be worse than the disease), then applies
// rls_auto_enable_remediation.sql and expects a clean PASS.
async function runRemediated() {
  const name = 'scenario 2 — remediated project (README fix applied)'
  console.log(`\n${name}`)
  const db = new PGlite()
  const { step, current } = makeSteps(db)

  await step('supabase shim (roles, auth schema, default privileges, Automatic RLS)', read(shim))
  await step('apply migration', read(migration))
  await step('re-apply migration (idempotent)', read(migration))
  await step('re-apply migration again (still idempotent)', read(migration))
  await step('apply the README remediation for rls_auto_enable', read(remediation))

  if (audit && !current()) await printAudit(db)

  await step('rls.test.sql', read(tests))
  await db.close()

  const failure = current()
  if (failure) {
    return { name, ok: false, reason: `expected a clean PASS; failed at "${failure.label}": ${failure.e.message}` }
  }
  return { name, ok: true, reason: 'migration applies, re-applies, remediation applies, and all RLS + merge tests pass' }
}

console.log(`migration: ${migration}`)
const results = [await runStock(), await runRemediated()]

console.log('\n=== summary ===')
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.reason}`)

const allOk = results.every((r) => r.ok)
console.log(
  allOk
    ? '\nPASS — the stock project correctly fails naming rls_auto_enable, and the documented remediation makes it pass'
    : '\nFAIL — see the scenario(s) above'
)
process.exitCode = allOk ? 0 : 1
