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

## What is not modelled

GoTrue itself (sign-up, JWT issuance, OTP), PostgREST's request handling and
its `role`/`request.jwt.claims` plumbing beyond the GUC the tests set by hand,
Realtime, Storage, and the dashboard-only settings listed in
`supabase/README.md`. Those need `supabase start` or the real project.
