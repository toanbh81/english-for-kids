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

It applies `supabase/migrations/0001_profiles_sync.sql`, applies it twice more
(the repair path for an already-live project is "paste the same file again", so
re-runnability is a property worth testing, not assuming), then runs
`supabase/tests/rls.test.sql`. One `PASS` / `FAIL` line at the end, exit code to
match. `--audit` also prints every privilege `anon` and `authenticated` hold in
`public`, which is the fastest way to see what a change to the grant block did.

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
remembers to. It changes nothing observable here: every table
`0001_profiles_sync.sql` creates, `heartbeat` and `kv_merge_rules` included,
already carries its own explicit `enable row level security` statement, so
`ensure_rls` firing first is redundant, not corrective (confirmed by querying
`pg_class.relrowsecurity` for all six tables with and without the trigger
installed — identical, all `true`). What it *does* change is `rls.test.sql`
§11: `rls_auto_enable()` is born with `EXECUTE` for `PUBLIC`/`anon`/
`authenticated` like every function in this schema, nobody revokes it because
this migration does not own it, and §11 is strict enough to name it. That is
this harness correctly reproducing a real finding rather than a harness bug —
see `supabase/README.md`, "Expected findings the first time you run
`rls.test.sql` on a real project", for the full story and why it is untidy
rather than exploitable. **This means `node run.mjs` no longer ends in `PASS`
as of that shim addition** — the `FAIL` at §11 naming `rls_auto_enable` is the
harness telling the truth about a stock project's first-run state, not
something to route around here.

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
