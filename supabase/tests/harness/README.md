# Running the Supabase SQL against a throwaway Postgres

```sh
cd supabase/tests/harness
pnpm install --ignore-workspace   # PGlite, once
node run.mjs                      # or: node run.mjs --audit
```

`--ignore-workspace` is not optional: this directory is deliberately outside
`pnpm-workspace.yaml`, so a plain `pnpm install` here installs the workspace
root and leaves this one empty. Staying outside is the point — PGlite is a
whole Postgres, and it has no business anywhere near `pnpm test` or the client
bundle.

It runs **two scenarios**, each on its own fresh database, and only prints
`PASS` (exit code 0) if both land as expected:

1. **Stock project** — `shim.sql` (Automatic RLS on, see below) and the
   migration, nothing else. `rls.test.sql` is *expected* to **FAIL** here,
   naming `rls_auto_enable`. That is not a bug in the harness — it is the
   regression test for the §11 guard's reach, proving it still notices a
   platform object this migration does not own. A PASS in this scenario would
   mean the guard stopped seeing it.
2. **Remediated project** — the same, plus the migration applied twice more
   (the repair path for an already-live project is "paste the same file
   again", so re-runnability is tested, not assumed), plus
   `rls_auto_enable_remediation.sql` — the exact statement
   `supabase/README.md` tells a real operator to run. `rls.test.sql` must
   **PASS** here.

`--audit` also prints every privilege `anon` and `authenticated` hold in
`public`, for both scenarios — the fastest way to see what a change to the
grant block (or the remediation) did.

No Docker, no project, no keys. `--migration <path>` runs a different file —
useful for proving a new test actually fails against the old SQL:

```sh
git show HEAD:supabase/migrations/0001_profiles_sync.sql > /tmp/old.sql
node run.mjs --migration /tmp/old.sql
```

## Why the shim is the point

`shim.sql` stands in for the parts of a real Supabase project the SQL depends
on. Its job is to **imitate a real project**, not to be the smallest thing that
makes the tests run — and the difference between those two is exactly how this
directory came to exist.

An earlier throwaway version of the shim created the `anon` / `authenticated` /
`service_role` roles, the `auth` schema and `auth.uid()`, and stopped. What it
did not copy was the three lines every real project already has:

```sql
alter default privileges in schema public
  grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
```

Under those, every table the migration creates is **born** with table-wide
`ALL` for `anon` and `authenticated`. A migration that only adds grants adds
nothing; it has to revoke first. Without the three lines the harness created
tables with no grants at all, so the migration's `grant select, insert, …`
lines looked load-bearing locally while in production they were noise on top of
`ALL`. Three real holes hid behind that: `TRUNCATE` on every family's rows
(which RLS does not police — it is not a `DELETE`, so no policy is consulted),
a writable `kv_merge_rules` (flip `stars` from `max` to `lww` and a stale write
erases a child's earned stars), and a client free to pick its own
`recovery_codes.code` (a column grant cannot narrow a table-level `INSERT`),
turning the `UNIQUE` index into a code oracle inside the database where
`/api/recover`'s rate limit cannot see it.

So: when this shim and a real project disagree, the shim is wrong. If you find
another such difference, add it here rather than working around it in a test.

`shim.sql` also installs `rls_auto_enable()` and the `ensure_rls` event
trigger — Supabase's "Automatic RLS" feature, which turns RLS on for every
table created in `public` whether or not the migration that creates it
remembers to. It changes nothing observable about RLS itself: every table
`0001_profiles_sync.sql` creates, `heartbeat` and `kv_merge_rules` included,
already carries its own explicit `enable row level security` statement, so
`ensure_rls` firing first is redundant, not corrective (confirmed by querying
`pg_class.relrowsecurity` for all six tables with and without the trigger
installed — identical, all `true`).

What it *does* change is `rls.test.sql` §11: `rls_auto_enable()` is born with
`EXECUTE` for `PUBLIC`/`anon`/`authenticated` like every function in this
schema, and nobody revokes it — this migration does not own the function, so
it has no business revoking it silently, and a real operator has to run
`rls_auto_enable_remediation.sql`'s statement themselves. §11 is strict enough
to name it, which is exactly why this harness now runs the two scenarios
above instead of one: scenario 1 turns that `FAIL` into the proof that the
guard still reaches platform objects, and scenario 2 turns the README's fix
into something executed, not just written down. See `supabase/README.md`,
"Expected findings the first time you run `rls.test.sql` on a real project",
for the full story of why the grant is untidy rather than exploitable.

**On determinism.** §11 is not a loop of per-object assertions that could stop
at the first violation and never reach `rls_auto_enable` — it is a single
`do $$ … $$` block computing one `extra` value via a 4-way `union all`
(table, column, function, and schema privileges) fed through one
`string_agg(... order by h.obj, h.priv)`, followed by exactly one
`assert extra is null`. Every violation that exists gets collected into that
one string before the assert ever runs, so as long as `rls_auto_enable` is a
violation at all, its name is in the message — there is no code path where
§11 "gets stuck" on a different object first. `run.mjs` matches on the
substring `rls_auto_enable`, not the full message, so a future wording change
to the assertion's text will not make scenario 1 flaky either.

## One artifact that looks alarming and is not

In this harness `set role postgres` succeeds from any role, because PGlite runs
everything as a superuser and a superuser may become anybody. That is the
embedded engine, not the schema: on a real project the role is chosen by
PostgREST from the JWT before your SQL is parsed, `authenticated` is `nologin`
and `nosuperuser`, and there is no statement a PostgREST client can send that
switches it. Do not read a successful `set role` here as a finding — but do
remember that it means **a probe written as `set role x; …` proves nothing in
this harness unless the role was reached the way a request would reach it.**
The tests set `request.jwt.claims` and use `set local role`, which is the same
pair PostgREST sets, and that is as close as this gets.

## What is not modelled

GoTrue itself (sign-up, JWT issuance, OTP), PostgREST's request handling and
its `role`/`request.jwt.claims` plumbing beyond the GUC the tests set by hand,
Realtime, Storage, and the dashboard-only settings listed in
`supabase/README.md`. Those need `supabase start` or the real project.
