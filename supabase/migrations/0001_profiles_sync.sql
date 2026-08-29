-- Phase 11 — cloud profiles & sync.
-- Spec: docs/superpowers/specs/2026-08-29-phase11-cloud-profiles-design.md (§Schema is exact).
--
-- What this migration establishes, and why each piece is shaped the way it is:
--
--   * A child never has an account. `auth.users` is always a PARENT (or, before
--     linking, an anonymous user on the child's iPad); `profiles` are the
--     children hanging off it. Every other table hangs off a profile, so one
--     ownership rule — "the profile's owner is auth.uid()" — covers all data.
--   * Row Level Security is the ONLY thing standing between two families'
--     children. Every table below has RLS enabled; `heartbeat` deliberately has
--     no policy at all (service role only). There are no public reads anywhere.
--   * The app is local-first: the device is the source of truth and the server
--     receives replays of the same writes, out of order, for months. So every
--     write path here is idempotent, and `merge_kv` is written so that an old
--     write can never lower a star the child already earned.
--
-- Apply with `supabase db push`, or paste into the SQL editor. See
-- supabase/README.md. Tests: supabase/tests/rls.test.sql.

-- gen_random_uuid() is core Postgres since 13 (Supabase runs 15+), so no
-- extension is required here.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  name text not null default 'Bé',
  avatar text not null default '🦊',
  created_at timestamptz not null default now()
);
create index if not exists profiles_owner_idx on public.profiles (owner_id);

-- The activity log. The primary key IS the dedupe rule: the client replays its
-- outbox freely and an upsert of an event it already sent is a no-op.
create table if not exists public.events (
  profile_id uuid not null references public.profiles on delete cascade,
  ts bigint not null,                 -- client epoch ms (matches localStorage)
  kind text not null,                 -- 'story' | 'speak' | 'word' | 'sentence'
  item_id text not null,
  score int,
  phonemes jsonb,                     -- only the WEAK ones; the client trims first
  primary key (profile_id, ts, kind, item_id)
);
create index if not exists events_profile_ts_idx on public.events (profile_id, ts desc);

-- The mirror of the child's localStorage values (stars, leitner, band, …).
-- `updated_at` is the CLIENT's clock: it is a merge input, never a trusted time.
create table if not exists public.kv (
  profile_id uuid not null references public.profiles on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at bigint not null,
  primary key (profile_id, key)
);

-- One code per user, shown once in the parent screen ("chụp màn hình lại nhé").
-- Readable by its owner; REDEEMED only server-side (api/recover.mjs, service role).
create table if not exists public.recovery_codes (
  user_id uuid primary key references auth.users on delete cascade,
  code text unique not null,          -- default added below, once its generator exists
  created_at timestamptz not null default now()
);

-- Touched daily by /api/ping so the free project is never idle for 7 days.
-- Service role only — no policy is granted below, on purpose.
create table if not exists public.heartbeat (
  id int primary key,
  at timestamptz
);

-- ---------------------------------------------------------------------------
-- The kv merge contract (data-driven on purpose)
-- ---------------------------------------------------------------------------
--
-- kv keys are the client's localStorage keys with the `speakup.` prefix (and
-- the profile namespace) stripped:
--
--     speakup.<profileId>.stars         -> 'stars'          (map cardId -> 1..3)
--     speakup.<profileId>.leitner       -> 'leitner'
--     speakup.<profileId>.band          -> 'band'
--     speakup.<profileId>.lesson.<day>  -> 'lesson.<day>'
--     speakup.<profileId>.limit.minutes -> 'limit.minutes'
--
-- Merge semantics per key:
--
--   'max'  — the value is an object of id -> number and the merge takes the
--            per-entry MAXIMUM, ignoring updated_at entirely. This is the star
--            rule: a device that has been offline for a week must not be able
--            to push `{"sword:cat": 1}` over a 3 the child earned since. Stars
--            only ever go up, so max is both correct and replay-proof.
--   'lww'  — last write wins by the client-supplied updated_at (ties go to the
--            incoming write). Everything else: leitner boxes, band, lessons.
--
-- Which keys are 'max' lives in this TABLE, not in the function body, so
-- Phase 12 can add a key (e.g. a group's earned-badge map) with one INSERT and
-- no change to merge_kv. A rule matches its key exactly or as a `prefix.`
-- namespace: 'stars' covers 'stars' and 'stars.anything'.
create table if not exists public.kv_merge_rules (
  prefix text primary key,
  strategy text not null check (strategy in ('max', 'lww'))
);
insert into public.kv_merge_rules (prefix, strategy)
values ('stars', 'max')
on conflict (prefix) do update set strategy = excluded.strategy;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- 8 characters from a 32-symbol alphabet with no look-alikes (no O/0, I/1, L),
-- because a parent reads this off a screenshot and types it on an iPad.
-- 32^8 = 2^40 codes; the redemption endpoint is rate-limited because that is
-- the only thing standing between a guesser and someone else's child data.
-- Randomness comes from gen_random_uuid(), which is CSPRNG-backed in PG13+.
create or replace function public.gen_recovery_code()
returns text
language sql
volatile
set search_path = public, pg_catalog
as $$
  select string_agg(
           substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(u.bytes, i) & 31), 1),
           '' order by i)
  from (select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as bytes) u,
       generate_series(0, 7) as i;
$$;

-- The client may therefore `insert into recovery_codes (user_id) values (…)`
-- and read its own code back, without ever generating one in JavaScript.
alter table public.recovery_codes
  alter column code set default public.gen_recovery_code();

-- The strategy for a key: longest matching rule prefix, defaulting to 'lww'.
-- SECURITY DEFINER so the contract cannot be bent by a future policy change on
-- kv_merge_rules; it only ever reads that admin-owned table.
create or replace function public.kv_strategy(k text)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce((
    select r.strategy
    from public.kv_merge_rules r
    where k = r.prefix
       or left(k, length(r.prefix) + 1) = r.prefix || '.'   -- not LIKE: prefixes are literal
    order by length(r.prefix) desc
    limit 1
  ), 'lww');
$$;

-- The whole merge decision for one key, as a pure function, so it can be used
-- inside a single atomic INSERT … ON CONFLICT DO UPDATE (no read-then-write
-- race between two devices flushing at the same moment).
create or replace function public.kv_merge_value(
  strategy text,
  old_value jsonb, old_updated_at bigint,
  new_value jsonb, new_updated_at bigint
)
returns jsonb
language sql
immutable
as $$
  select case
    -- Anything but 'max', or a shape that is not a map of numbers on both
    -- sides (a corrupt or migrated value), falls back to last-write-wins.
    when strategy is distinct from 'max'
      or jsonb_typeof(old_value) is distinct from 'object'
      or jsonb_typeof(new_value) is distinct from 'object'
    then case when new_updated_at >= old_updated_at then new_value else old_value end
    else coalesce((
      select jsonb_object_agg(k, v)
      from (
        select ks.k,
               case
                 -- both numeric: the higher star wins, whatever the clocks say
                 when jsonb_typeof(old_value -> ks.k) = 'number'
                  and jsonb_typeof(new_value -> ks.k) = 'number'
                   then case when (old_value -> ks.k)::numeric >= (new_value -> ks.k)::numeric
                             then old_value -> ks.k else new_value -> ks.k end
                 when old_value -> ks.k is null then new_value -> ks.k
                 when new_value -> ks.k is null then old_value -> ks.k
                 -- present on both but not both numbers: fall back to the clock
                 else case when new_updated_at >= old_updated_at
                           then new_value -> ks.k else old_value -> ks.k end
               end as v
        from (
          select k from jsonb_object_keys(old_value) k
          union
          select k from jsonb_object_keys(new_value) k
        ) ks
      ) merged
    ), '{}'::jsonb)
  end;
$$;

-- merge_kv(profile, entries)
--   entries: [{"key":"stars","value":{...},"updated_at":1724880000000}, …]
--
-- SECURITY INVOKER on purpose: RLS decides whether the caller may touch this
-- profile's rows. A caller passing someone else's profile id gets a permission
-- error, never a row and never a hint that the profile exists.
--
-- Entries are applied one statement per key, so a batch that repeats a key
-- folds correctly (the second application merges against the first) instead of
-- hitting "cannot affect row a second time".
create or replace function public.merge_kv(profile uuid, entries jsonb)
returns setof public.kv
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  entry jsonb;
  k text;
  v jsonb;
  u bigint;
begin
  if jsonb_typeof(entries) is distinct from 'array' then
    raise exception 'merge_kv: entries must be a JSON array of {key, value, updated_at}'
      using errcode = '22023';
  end if;

  -- Same message whether the profile belongs to someone else or does not
  -- exist: RLS hides it either way and so does this.
  if not exists (select 1 from public.profiles p where p.id = profile) then
    raise exception 'merge_kv: profile is not accessible' using errcode = '42501';
  end if;

  for entry in select * from jsonb_array_elements(entries) loop
    k := entry ->> 'key';
    v := entry -> 'value';
    u := nullif(entry ->> 'updated_at', '')::bigint;
    if k is null or v is null or jsonb_typeof(v) = 'null' or u is null then
      raise exception 'merge_kv: every entry needs key, value and updated_at'
        using errcode = '22023';
    end if;

    insert into public.kv as t (profile_id, key, value, updated_at)
    values (profile, k, v, u)
    on conflict (profile_id, key) do update
      set value = public.kv_merge_value(
            public.kv_strategy(excluded.key),
            t.value, t.updated_at,
            excluded.value, excluded.updated_at),
          -- the row's clock only ever moves forward, so a replayed old write
          -- cannot make the next old write look fresh
          updated_at = greatest(t.updated_at, excluded.updated_at);
  end loop;

  return query
    select * from public.kv where profile_id = profile
    order by key;
end;
$$;

-- The server mirrors the client's 2000-event cap. Statement-level (not per
-- row) and one window pass, so a 200-event flush prunes once.
-- SECURITY DEFINER so pruning does not depend on the caller having a DELETE
-- policy; its scope is only profiles that just received an insert, which RLS
-- already gated.
create or replace function public.prune_events()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from public.events e
  using (
    select ranked.profile_id, ranked.ts, ranked.kind, ranked.item_id
    from (
      select ev.profile_id, ev.ts, ev.kind, ev.item_id,
             row_number() over (
               partition by ev.profile_id
               order by ev.ts desc, ev.kind, ev.item_id
             ) as rn
      from public.events ev
      where ev.profile_id in (select distinct nr.profile_id from new_rows nr)
    ) ranked
    where ranked.rn > 2000
  ) doomed
  where e.profile_id = doomed.profile_id
    and e.ts = doomed.ts
    and e.kind = doomed.kind
    and e.item_id = doomed.item_id;
  return null;
end;
$$;

drop trigger if exists events_prune on public.events;
create trigger events_prune
after insert on public.events
referencing new table as new_rows
for each statement execute function public.prune_events();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.events         enable row level security;
alter table public.kv             enable row level security;
alter table public.recovery_codes enable row level security;
alter table public.heartbeat      enable row level security;
alter table public.kv_merge_rules enable row level security;

-- profiles: a user sees and edits only their own children.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (owner_id = (select auth.uid()));

-- USING and WITH CHECK both: a user may not hand a profile to another account
-- (re-parenting is a service-role operation in api/recover.mjs).
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (owner_id = (select auth.uid()));

-- events / kv: reachable only through a profile the caller owns. The EXISTS
-- subquery is itself subject to profiles' RLS, so a foreign profile is not
-- merely unowned, it is invisible — two independent reasons to say no.
drop policy if exists events_own on public.events;
create policy events_own on public.events
  for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = events.profile_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p
                      where p.id = events.profile_id and p.owner_id = (select auth.uid())));

drop policy if exists kv_own on public.kv;
create policy kv_own on public.kv
  for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = kv.profile_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p
                      where p.id = kv.profile_id and p.owner_id = (select auth.uid())));

-- recovery_codes: read your own (the parent screen shows it) and create your
-- own at sign-up. No UPDATE and no DELETE policy exists: redemption runs
-- server-side with the service role, which bypasses RLS.
drop policy if exists recovery_codes_select_own on public.recovery_codes;
create policy recovery_codes_select_own on public.recovery_codes
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists recovery_codes_insert_own on public.recovery_codes;
create policy recovery_codes_insert_own on public.recovery_codes
  for insert to authenticated with check (user_id = (select auth.uid()));

-- The merge contract is public knowledge, not data: readable, never writable.
drop policy if exists kv_merge_rules_read on public.kv_merge_rules;
create policy kv_merge_rules_read on public.kv_merge_rules
  for select to authenticated using (true);

-- heartbeat: no policy. Only the service role (which bypasses RLS) touches it.

-- ---------------------------------------------------------------------------
-- Grants — belt as well as braces. RLS already restricts rows; these restrict
-- the tables themselves, so an unauthenticated `anon` request is refused
-- before any policy is even consulted.
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.events, public.kv,
              public.recovery_codes, public.heartbeat, public.kv_merge_rules
  from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.profiles, public.events, public.kv,
                  public.recovery_codes, public.heartbeat, public.kv_merge_rules
      from anon;
    revoke execute on function public.merge_kv(uuid, jsonb) from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete
      on public.profiles, public.events, public.kv to authenticated;
    -- Recovery codes are read-only to their owner, and — note the column list —
    -- a client may insert ONLY the user_id, never the code itself. Letting a
    -- client choose the code would turn the UNIQUE constraint into an oracle:
    -- a unique violation would confirm somebody else's code, and that guessing
    -- game would run entirely inside the database, out of reach of the rate
    -- limit on /api/recover. With this grant the code can only come from the
    -- column default, i.e. gen_recovery_code().
    grant select on public.recovery_codes to authenticated;
    grant insert (user_id) on public.recovery_codes to authenticated;
    grant select on public.kv_merge_rules to authenticated;
    revoke all on public.heartbeat from authenticated;
    grant execute on function public.merge_kv(uuid, jsonb) to authenticated;
    grant execute on function public.gen_recovery_code() to authenticated;
  end if;

  -- The Vercel functions (api/recover.mjs, api/ping.mjs) run as this role and
  -- bypass RLS by design; the grants are spelled out rather than inherited
  -- from whatever default privileges the project happens to have.
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.profiles, public.events, public.kv,
                 public.recovery_codes, public.heartbeat, public.kv_merge_rules
      to service_role;
    grant execute on function public.merge_kv(uuid, jsonb) to service_role;
    grant execute on function public.gen_recovery_code() to service_role;
  end if;
end
$$;

-- merge_kv is reachable by PUBLIC by default; make the grant list explicit.
revoke execute on function public.merge_kv(uuid, jsonb) from public;
revoke execute on function public.prune_events() from public;
