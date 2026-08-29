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
| `tests/harness/` | Runs both of the above on a throwaway Postgres (PGlite). No Docker, no project, no keys. |

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

Re-pasting the whole file is also how you *repair* a project that was set up
from an older copy of it: every privilege statement in it revokes before it
grants, so a re-run converges on the intended set rather than adding to
whatever is already there. Apply it as `postgres` — the SQL editor does — or
the `auth.users` trigger cannot be created and the migration says so with a
warning rather than an error.

## Environment variables

| Variable | Where it lives | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `client/.env`, Vercel | No — compiled into the bundle |
| `VITE_SUPABASE_ANON_KEY` | `client/.env`, Vercel | No — public by design |
| `SUPABASE_URL` | `server/.env`, Vercel | No |
| `SUPABASE_SERVICE_ROLE` | `server/.env`, Vercel | **YES.** Bypasses every policy below |
| `CRON_SECRET` | Vercel — **set it** | Yes. Without it `/api/ping` is open to anyone |

The anon key is safe in the browser *because* of the policies in the migration —
it is a ticket to the API, not to the data. The service-role key is the
opposite: it ignores RLS entirely, so it exists only inside `api/*.mjs` on the
server. `scripts/check-secrets.sh` blocks a commit that contains one (both the
`sb_secret_…` format and the legacy JWT shape, including the nasty case of a
service key pasted into a variable named like the anon key). Its one known
blind spot: an unrecognised opaque secret written on a line that itself
contains a placeholder word ("example", "your-key", …) is exempted. A file's
NAME no longer buys any exemption — `.env.example` files are scanned like every
other file.

## The security model in one paragraph

A child never has an account. `auth.users` is always the parent — or, before
the parent links an email, the anonymous user created silently on the child's
iPad. `profiles` (the children) hang off that user, and everything else hangs
off a profile. So a single rule, *"the profile's owner is `auth.uid()`"*,
protects every row, and it is enforced by RLS in the database rather than by
any check in the client. `heartbeat` has RLS on and no policy at all: only the
service role can touch it. There are no public reads anywhere in this phase.

RLS is the rule about *rows*; the grants underneath it are the rule about
*verbs*, and they are not redundant. RLS is never consulted for a `TRUNCATE`,
and a column grant is inert while the table-level grant it was meant to narrow
still stands — so the migration revokes everything from `anon` and
`authenticated` before granting anything back, and `tests/rls.test.sql` ends by
asserting that the two roles hold exactly that set and nothing more.

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

**Client clocks are input, not truth.** `updated_at` and `events.ts` are capped
at 24 hours ahead of the server (`clamp_client_ts`, applied inside `merge_kv`
and by a trigger on `events`). An iPad set to 2030 would otherwise freeze every
LWW key for ever — nothing would ever be "newer" — and park its events at the
top of the pruning order for a decade. The cap is quantised to the hour so a
replayed event still lands on the same primary key instead of multiplying, and
it is applied by triggers on `kv` and `events` as well as inside `merge_kv` —
owners hold INSERT/UPDATE on those tables, so guarding only the RPC would guard
only the door.

Residual, stated plainly: a poisoned clock can still evict up to the full
2000-row window for that profile, because every clamped event sorts above the
real ones. It self-heals within 24 hours — once real time passes the ceiling,
genuine events outrank the poisoned ones again and the device re-uploads its
own log — instead of lasting until whatever year the clock was set to.

**Resetting a child's progress is a DELETE, not a merge.** There is no
tombstone verb: stars merge by max, so an "empty" write would simply be
out-merged by the next device to sync and the stars would come back. A reset is

```sql
delete from public.kv     where profile_id = '<profile>';
delete from public.events where profile_id = '<profile>';
```

which the owner's grants and policies already allow (and which Task 3's sync
layer calls alongside clearing localStorage). Deleting the profile row cascades
to both and is the "remove this child" case.

**Floors under a modified client.** `kv` keys are ≤ 64 chars and values ≤ 16 KB,
`events.item_id` ≤ 128 chars, `kind` ≤ 24, `score` within 0–100, phoneme blobs
≤ 8 KB, and one account may hold at most 10 profiles. These are not validation
— the client validates — they stop one authenticated account filling a free
project's disk and taking every family's sync down with it.

## The serverless functions

- `api/ping.mjs` — the daily cron in `vercel.json` (`0 3 * * *`, i.e. 10:00 giờ
  Việt Nam). A free Supabase project pauses after 7 idle days, and a paused
  project means every iPad silently stops syncing; one upsert a day prevents
  that. Vercel's free plan allows one cron run per day.
- `api/recover.mjs` — redeems a recovery code (spec flow 4: cache wiped, email
  never linked). The caller must send **their own** Supabase JWT; profiles are
  re-parented to whoever that token says they are, never to an id in the body.
  It claims the code by DELETEing it (so two racing requests cannot both win)
  and puts it back on every refusal. Rate-limited per IP in memory, which is
  per lambda instance and resets on a cold start — enough against a hand-typed
  2^40 code, and the place to harden first (a counter in Postgres) if this ever
  faces real traffic.

## The recovery code is only ever an ANONYMOUS account's credential

A code is a way into an account that has no password. The moment a parent links
an email, the email becomes the way back in and the code must stop being one —
otherwise a screenshot in a class group chat is enough to take the family's
account over and delete the parent's login with it. Three layers say so:

1. `api/recover.mjs` refuses a code whose account has an email, a phone, a
   pending email change, `is_anonymous: false`, or any non-anonymous identity,
   and never deletes an account it has not proved anonymous.
2. A trigger on `auth.users` (`on_auth_user_email_linked`) deletes the code the
   moment the account gains an email or phone — this layer does not depend on
   any app version being deployed. **It needs the migration to be applied as
   `postgres`**; the migration raises a warning instead of failing if it could
   not create it, so watch for that line.
3. The owner can rotate at will: delete their `recovery_codes` row and insert a
   new one (`insert into public.recovery_codes (user_id) values (auth.uid())`).
   There is no UPDATE path, so a code is always a value the server drew.

## Settings to apply in the Supabase dashboard (not expressible in SQL)

- **Auth → Providers → Anonymous sign-ins**: on (the app depends on it), with
  **CAPTCHA enabled** — otherwise anonymous sign-up is an open endpoint that
  anyone can loop.
- **Auth → Rate limits**: keep the defaults or lower them, especially "anonymous
  sign-ins per hour" and "OTP/email sent per hour". A free project's email quota
  is small and shared with the parents who actually need it.
- **Auth → Email**: OTP only; magic-link redirect URLs are unused by this app.
- Set `CRON_SECRET` in Vercel, or `/api/ping` is a write anyone can trigger.

Both are plain `.mjs` with no imports, like `api/speech-token.mjs`; Vercel
functions in this repo carry no dependencies. Their tests live in
`server/src/api-*.test.mjs` (this repo's node-side test runner) with `fetch`
injected.

## Running the SQL tests locally without a project

```sh
cd supabase/tests/harness
pnpm install --ignore-workspace
node run.mjs
```

That applies the migration, applies it twice more (re-runnability is the repair
path for a live project, so it is tested rather than assumed) and runs
`tests/rls.test.sql`, ending in one `PASS`/`FAIL` line. `node run.mjs --audit`
also prints everything `anon` and `authenticated` hold in `public`.
(`supabase start` gives you the real thing instead, if Docker is available.)

`tests/harness/shim.sql` is the stand-in for the project: the three roles, the
`auth` schema, `auth.uid()` — **and the default privileges a real project
already has**. That last part is not decoration. Supabase ships with

```sql
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
```

(and the same for functions and sequences), so every object a migration creates
here is *born* with `ALL` for the client roles. A migration that only grants
therefore changes nothing; `0001` revokes from `anon` and `authenticated`
first and then hands back exactly what each needs. A shim without those lines
made three real holes invisible — `TRUNCATE` on every family's rows (RLS never
sees a `TRUNCATE`), a writable `kv_merge_rules`, and a client free to choose
its own recovery code. See `tests/harness/README.md`.

## Expected findings the first time you run `rls.test.sql` on a real project

`tests/rls.test.sql` §11 asserts the *exact* privilege inventory of schema
`public` — not "nothing we know is dangerous", but "nothing beyond this named
list". That is deliberately stricter than listing known holes, and strictness
is the point: it is what catches the next object born wide open. It also means
§11 fires on objects this migration does not own — Supabase's own
platform-managed objects in `public`. Two are expected on a stock project.
Re-pasting `0001_profiles_sync.sql` does not fix either one, because neither
object is this migration's to revoke; both fixes below are one-off statements
you run yourself, as `postgres`.

### `PUBLIC`/`anon`/`authenticated` hold `EXECUTE` on `rls_auto_enable`

```
SECURITY FAIL: privileges nobody asked for ...: PUBLIC holds EXECUTE on function rls_auto_enable;
anon holds EXECUTE on function rls_auto_enable; authenticated holds EXECUTE on function rls_auto_enable
```

`public.rls_auto_enable()` is Supabase's "Automatic RLS": an event trigger
(`ensure_rls`, on `ddl_command_end`, owned by `postgres`) that turns row level
security on for every table created in `public`, so a migration that forgets
to enable it does not leave a table exposed. The platform installs it, not
this repo — `0001_profiles_sync.sql` never created it and has no business
revoking it silently.

**It is untidy, not exploitable.** Calling it directly —
`select public.rls_auto_enable()`, or `perform`ing it inside a `do` block —
refuses with `0A000 trigger functions can only be called as triggers`,
*regardless* of who holds `EXECUTE`. Postgres itself restricts an
event-trigger function to firing as a trigger; the grant was never a way in.
§11 is right to name it anyway: an unnecessary grant on a `SECURITY DEFINER`
function is exactly the shape of thing this assertion exists to catch, and
"turned out to be harmless this time" is not a reason to weaken the guard for
the next one.

**The fix, run once as `postgres`:**

```sql
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
```

This is safe and proven, not just plausible: after this revoke, a client
still creating a table still gets RLS auto-enabled on it (the event trigger
fires at DDL time regardless of the caller's `EXECUTE` privilege on the
function it invokes — the check that matters happened back when `ensure_rls`
was created, by whoever ran `create event trigger`, not on every table
creation after), while a direct call now fails with `42501 permission denied`
instead of `0A000`. The revoke turns an impostor's refusal into a privilege
refusal without disabling the feature — the exact standard `0001` already
applies to its own trigger functions (`prune_events`, `enforce_profile_cap`,
etc. — see §9c of the test file).

This finding can return: if Supabase ever re-provisions or reinstalls
Automatic RLS on this project, `EXECUTE` may come back. Re-running
`rls.test.sql` is how you would notice.

### `authenticated` holds `CREATE` on schema `public`

```
SECURITY FAIL: privileges nobody asked for ...: authenticated holds CREATE on schema public
```

Some older Supabase project templates granted `CREATE` on `public` to the
client roles more generously than current ones do. If your project is one of
them, this is a true finding: with `CREATE`, a client can build its own table
or function in `public`, which reopens the `TRIGGER` and `REFERENCES` routes
`0001` otherwise closes (a client-owned object can be the thing a trigger is
attached to, or the thing a foreign key points at). It is project
configuration this migration does not own, so re-pasting it does not fix this
either. **The fix, run once as `postgres`:**

```sql
revoke create on schema public from anon, authenticated;
```

## Known limitation of §11's strictness

Neither finding above gets an allowlist entry in §11, and none should: an
allowlist for "platform objects" would give the *next* platform object a free
pass too, which defeats the assertion's whole purpose. The cost is that a
fresh real-project run of `rls.test.sql` is expected to fail here until you
apply the two revokes above — that is a feature of a strict guard, not a bug
in it.
