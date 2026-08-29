# Supabase — cloud profiles & sync (Phase 11)

The app is **local-first**. localStorage is the source of truth; this database
is a mirror that lets progress survive a cache wipe and show up on the parent's
phone. Everything in `client/` works with the two `VITE_SUPABASE_*` variables
missing — that is a hard rule, tested in `client/src/cloud/supabase.test.ts`.

Spec: `docs/superpowers/specs/2026-08-29-phase11-cloud-profiles-design.md`.

## What is here

| File | What it is |
| --- | --- |
| `migrations/0001_profiles_sync.sql` | Schema, RLS policies, the `merge_kv` RPC, the 2000-event prune trigger. Idempotent — safe to re-run. |
| `tests/rls.test.sql` | The policy and merge tests. One transaction, ends in `ROLLBACK`, leaves no rows. |

## Applying it

**With the CLI** (from the repo root, once `supabase link` has been run):

```bash
supabase db push
```

**Without the CLI**: open the project's SQL editor, paste the whole of
`migrations/0001_profiles_sync.sql`, Run. Then paste `tests/rls.test.sql` and
Run that too — it should end with `ALL RLS + MERGE TESTS PASSED`. The tests
create two throwaway users inside a transaction and roll back, so running them
against the real project is safe. (If `auth.users` rejects the fixture insert on
a future Supabase version, add whatever column it names — the fixture already
spells out `instance_id`, `aud` and `role`.)

## Environment variables

| Variable | Where it lives | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `client/.env`, Vercel | No — compiled into the bundle |
| `VITE_SUPABASE_ANON_KEY` | `client/.env`, Vercel | No — public by design |
| `SUPABASE_URL` | `server/.env`, Vercel | No |
| `SUPABASE_SERVICE_ROLE` | `server/.env`, Vercel | **YES.** Bypasses every policy below |
| `CRON_SECRET` | Vercel (optional) | Yes-ish; only guards `/api/ping` |

The anon key is safe in the browser *because* of the policies in the migration —
it is a ticket to the API, not to the data. The service-role key is the
opposite: it ignores RLS entirely, so it exists only inside `api/*.mjs` on the
server. `scripts/check-secrets.sh` blocks a commit that contains one (both the
`sb_secret_…` format and the legacy JWT shape, including the nasty case of a
service key pasted into a variable named like the anon key). Its one known
blind spot: an unrecognised 20-character opaque secret on a line that also
contains the word "example" is exempted by the placeholder rule.

## The security model in one paragraph

A child never has an account. `auth.users` is always the parent — or, before
the parent links an email, the anonymous user created silently on the child's
iPad. `profiles` (the children) hang off that user, and everything else hangs
off a profile. So a single rule, *"the profile's owner is `auth.uid()`"*,
protects every row, and it is enforced by RLS in the database rather than by
any check in the client. `heartbeat` has RLS on and no policy at all: only the
service role can touch it. There are no public reads anywhere in this phase.

## The kv merge contract

`kv` mirrors the child's localStorage values. Keys are the localStorage keys
with the `speakup.` prefix and the profile namespace stripped:

| localStorage | `kv.key` | merge |
| --- | --- | --- |
| `speakup.<profile>.stars` | `stars` | per-entry **max** |
| `speakup.<profile>.leitner` | `leitner` | last write wins |
| `speakup.<profile>.band` | `band` | last write wins |
| `speakup.<profile>.lesson.<day>` | `lesson.<day>` | last write wins |
| `speakup.<profile>.limit.minutes` | `limit.minutes` | last write wins |

Stars merge by **maximum per entry, ignoring the clock**. An iPad that was
offline for a week must not be able to push `{"sword:cat": 1}` over the 3 the
child earned yesterday; stars only ever go up, which also makes replays of the
sync outbox free. Everything else is last-write-wins on the client-supplied
`updated_at` (ties go to the incoming write).

Which keys are "stars family" lives in the **`kv_merge_rules` table**, not in
the function body: a rule matches its key exactly or as a `prefix.` namespace,
so `stars` covers `stars.week` too, and Phase 12 can add a key with

```sql
insert into public.kv_merge_rules (prefix, strategy) values ('badges', 'max');
```

and no change to `merge_kv`.

Events are plain upserts — the primary key `(profile_id, ts, kind, item_id)`
*is* the dedupe rule — and a statement-level trigger prunes each profile's log
to the newest 2000 rows, mirroring the client's own cap.

## The serverless functions

- `api/ping.mjs` — the daily cron in `vercel.json` (`0 3 * * *`, i.e. 10:00 giờ
  Việt Nam). A free Supabase project pauses after 7 idle days, and a paused
  project means every iPad silently stops syncing; one upsert a day prevents
  that. Vercel's free plan allows one cron run per day.
- `api/recover.mjs` — redeems a recovery code (spec flow 4: cache wiped, email
  never linked). The caller must send **their own** Supabase JWT; profiles are
  re-parented to whoever that token says they are, never to an id in the body.
  Rate-limited per IP in memory, which is per lambda instance and resets on a
  cold start — enough against a hand-typed 2^40 code, and the place to harden
  first (a counter in Postgres) if this ever faces real traffic.

Both are plain `.mjs` with no imports, like `api/speech-token.mjs`; Vercel
functions in this repo carry no dependencies. Their tests live in
`server/src/api-*.test.mjs` (this repo's node-side test runner) with `fetch`
injected.

## Running the SQL tests locally without a project

`tests/rls.test.sql` needs Supabase's `auth` schema and the `anon` /
`authenticated` roles. Against a bare Postgres, create a stand-in first:

```sql
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema if not exists auth;
create table auth.users (id uuid primary key, instance_id uuid, aud varchar(255),
                         role varchar(255), email text unique,
                         is_anonymous boolean not null default false,
                         created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;
grant usage on schema auth to anon, authenticated, service_role;
```

…then run the migration and the test file. (`supabase start` gives you the real
thing instead, if Docker is available.)
