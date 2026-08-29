// Applies supabase/migrations/*.sql to a throwaway Postgres that imitates a
// real Supabase project (see shim.sql), applies it twice more to prove it is
// re-runnable, then runs supabase/tests/rls.test.sql. One PASS/FAIL line.
//
//   node supabase/tests/harness/run.mjs            # the whole thing
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
const read = (p) => readFileSync(p, 'utf8')

const db = new PGlite()
let failed = null

const step = async (label, sql) => {
  if (failed) return
  try {
    await db.exec(sql)
    console.log(`  ok    ${label}`)
  } catch (e) {
    failed = { label, e }
    console.log(`  FAIL  ${label}`)
    for (const k of ['message', 'detail', 'hint', 'where']) {
      if (e[k]) console.log(`        ${k}: ${String(e[k]).split('\n').join('\n        ')}`)
    }
  }
}

console.log(`migration: ${migration}`)
await step('supabase shim (roles, auth schema, default privileges)', read(resolve(here, 'shim.sql')))
await step('apply migration', read(migration))
// Twice more: the user's repair path is "paste the same file again", and the
// bug this harness exists for was fixed by adding revokes — a revoke that ran
// after its own grant on the second pass would be worse than the disease.
await step('re-apply migration (idempotent)', read(migration))
await step('re-apply migration again (still idempotent)', read(migration))

if (audit && !failed) {
  console.log('\nprivileges held by anon / authenticated in schema public:')
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
    console.log(`  table  ${r.name.padEnd(16)} ${r.grantee.padEnd(14)} ${r.privs}`)
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
    console.log(`  column ${r.name.padEnd(16)} ${r.grantee.padEnd(14)} ${r.privs}`)
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
    console.log(`  exec   ${r.name.padEnd(60)} ${r.grantees}`)
  }
  console.log()
}

await step('rls.test.sql', read(tests))
await db.close()

console.log(failed ? `\nFAIL — ${failed.label}` : '\nPASS — migration applies, re-applies, and all RLS + merge tests pass')
process.exitCode = failed ? 1 : 0
