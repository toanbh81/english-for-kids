-- Phase 11 — policy & merge tests for 0001_profiles_sync.sql.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and hit Run
-- (or `psql -f supabase/tests/rls.test.sql "$DB_URL"`). It runs inside ONE
-- transaction and ends with ROLLBACK, so it leaves no rows behind — it is safe
-- against a project that already has real data.
--
-- Every check is an ASSERT: the run stops at the first failure with the
-- message below it. Reaching the final SELECT means everything passed.
--
-- The interesting half of this file is the DENIALS. A children's app that
-- leaks one family's profile to another is the worst bug this codebase can
-- have, so each table is probed from the WRONG user for every verb.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two unrelated families.
-- ---------------------------------------------------------------------------
reset role;

-- (instance_id/aud/role are spelled out because some Supabase versions expect
-- them; the values are the ones GoTrue itself writes.)
insert into auth.users (id, instance_id, aud, role, email)
values ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'parent-one@test.invalid'),
       ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'parent-two@test.invalid');

-- --- family one, acting as itself -------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
                  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

insert into public.profiles (id, owner_id, name)
values ('aaaaaaaa-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111', 'Bé Một');

insert into public.kv (profile_id, key, value, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'stars', '{"sword:cat": 2, "sword:dog": 1}', 100),
       ('aaaaaaaa-0000-4000-8000-000000000001', 'band', '{"level": 3}', 100);

insert into public.events (profile_id, ts, kind, item_id, score)
values ('aaaaaaaa-0000-4000-8000-000000000001', 1000, 'word', 'cat', 70);

insert into public.recovery_codes (user_id) values ('11111111-1111-4111-8111-111111111111');

do $$
declare c text;
begin
  select code into c from public.recovery_codes
  where user_id = '11111111-1111-4111-8111-111111111111';
  assert c ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$',
    'recovery code should be 8 chars of the no-look-alike alphabet, got: ' || coalesce(c, '<null>');
end $$;

-- --- family two, acting as itself -------------------------------------------
select set_config('request.jwt.claims',
                  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

insert into public.profiles (id, owner_id, name)
values ('bbbbbbbb-0000-4000-8000-000000000002',
        '22222222-2222-4222-8222-222222222222', 'Bé Hai');

-- ---------------------------------------------------------------------------
-- 1. Owner-only reads. (Still acting as family two.)
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select count(*) from public.profiles) = 1,
    'family two must see exactly its own profile';
  assert (select count(*) from public.profiles
          where id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0,
    'SECURITY FAIL: family two can read family one''s profile';
  assert (select count(*) from public.events
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0,
    'SECURITY FAIL: family two can read family one''s events';
  assert (select count(*) from public.kv
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0,
    'SECURITY FAIL: family two can read family one''s kv';
  assert (select count(*) from public.recovery_codes) = 0,
    'SECURITY FAIL: family two can read another user''s recovery code';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Cross-user WRITES are refused on every table.
--    A blocked INSERT raises 42501; a blocked UPDATE/DELETE simply matches no
--    rows, because the row is invisible. Both are asserted.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  -- profiles: cannot create a child under someone else's account
  begin
    insert into public.profiles (owner_id, name)
    values ('11111111-1111-4111-8111-111111111111', 'kẻ trộm');
    assert false, 'SECURITY FAIL: family two created a profile owned by family one';
  exception when insufficient_privilege then null;
  end;

  -- profiles: cannot steal one either
  update public.profiles set owner_id = '22222222-2222-4222-8222-222222222222'
  where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two re-parented family one''s profile';

  update public.profiles set name = 'đổi tên'
  where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two renamed family one''s child';

  delete from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two deleted family one''s profile';

  -- profiles: cannot hand its OWN profile to another account
  begin
    update public.profiles set owner_id = '11111111-1111-4111-8111-111111111111'
    where id = 'bbbbbbbb-0000-4000-8000-000000000002';
    assert false, 'SECURITY FAIL: a profile was given away to another account';
  exception when insufficient_privilege then null;
  end;

  -- events
  begin
    insert into public.events (profile_id, ts, kind, item_id)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 2000, 'word', 'stolen');
    assert false, 'SECURITY FAIL: family two wrote an event into family one''s profile';
  exception when insufficient_privilege then null;
  end;
  update public.events set score = 0
  where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two edited family one''s events';
  delete from public.events where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two deleted family one''s events';

  -- kv
  begin
    -- a key family one does not have, so only the policy can refuse this
    insert into public.kv (profile_id, key, value, updated_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'stolen', '{"sword:cat": 0}', 999);
    assert false, 'SECURITY FAIL: family two wrote kv into family one''s profile';
  exception when insufficient_privilege then null;
  end;
  update public.kv set value = '{}'
  where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two overwrote family one''s stars';

  -- …and the sideways version of the same attack: own a row, then push it into
  -- the other family's profile. The policies carry WITH CHECK for exactly this.
  -- (a key family one does NOT have, so a failure here is the policy talking
  -- and not a primary-key collision)
  insert into public.kv (profile_id, key, value, updated_at)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 'smuggled', '{"level": 1}', 1);
  begin
    update public.kv set profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    where profile_id = 'bbbbbbbb-0000-4000-8000-000000000002';
    assert false, 'SECURITY FAIL: a kv row was smuggled into another family''s profile';
  exception when insufficient_privilege then null;
  end;
  insert into public.events (profile_id, ts, kind, item_id)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 5, 'word', 'own');
  begin
    update public.events set profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    where profile_id = 'bbbbbbbb-0000-4000-8000-000000000002';
    assert false, 'SECURITY FAIL: an event was smuggled into another family''s profile';
  exception when insufficient_privilege then null;
  end;
  -- tidy the two decoys away so the counts later in the file stay obvious
  delete from public.kv where profile_id = 'bbbbbbbb-0000-4000-8000-000000000002';
  delete from public.events where profile_id = 'bbbbbbbb-0000-4000-8000-000000000002';

  -- merge_kv on a foreign profile: refused, and it must not reveal whether the
  -- profile exists (same error as for a made-up uuid).
  begin
    perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001',
                            '[{"key":"stars","value":{"sword:cat":0},"updated_at":9999}]'::jsonb);
    assert false, 'SECURITY FAIL: merge_kv accepted a foreign profile';
  exception when insufficient_privilege then null;
  end;

  -- recovery_codes: cannot mint one for another user…
  begin
    insert into public.recovery_codes (user_id)
    values ('11111111-1111-4111-8111-111111111111');
    assert false, 'SECURITY FAIL: family two minted a recovery code for family one';
  exception when insufficient_privilege then null;
  end;

  -- …and cannot CHOOSE a code at all. If it could, the unique constraint would
  -- answer "is this somebody's code?" for free, and the guessing would happen
  -- inside the database where /api/recover's rate limit cannot see it.
  begin
    insert into public.recovery_codes (user_id, code)
    values ('22222222-2222-4222-8222-222222222222', 'ABCD2345');
    assert false, 'SECURITY FAIL: a client picked its own recovery code (code oracle)';
  exception when insufficient_privilege then null;
  end;
  -- …and a code is never EDITED. Rotation is delete-then-insert, which is what
  -- keeps every code a value gen_recovery_code() drew.
  insert into public.recovery_codes (user_id) values ('22222222-2222-4222-8222-222222222222');
  begin
    update public.recovery_codes set code = 'AAAAAAAA'
    where user_id = '22222222-2222-4222-8222-222222222222';
    assert false, 'a recovery code must not be updatable from the client';
  exception when insufficient_privilege then null;
  end;

  -- deleting someone ELSE's code does nothing (the row is invisible)…
  delete from public.recovery_codes where user_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two deleted family one''s recovery code';

  -- …while rotating your own works, and draws a different code.
  declare old_code text; new_code text;
  begin
    select code into old_code from public.recovery_codes
    where user_id = '22222222-2222-4222-8222-222222222222';
    delete from public.recovery_codes where user_id = '22222222-2222-4222-8222-222222222222';
    get diagnostics n = row_count;
    assert n = 1, 'an owner must be able to throw away their own code';
    insert into public.recovery_codes (user_id) values ('22222222-2222-4222-8222-222222222222');
    select code into new_code from public.recovery_codes
    where user_id = '22222222-2222-4222-8222-222222222222';
    assert new_code is not null and new_code <> old_code, 'rotation drew the same code back';
  end;

  assert (select count(*) from public.recovery_codes) = 1,
    'family two should still hold exactly its own code';

  -- heartbeat is service-role-only: the grant itself is gone.
  begin
    perform 1 from public.heartbeat;
    assert false, 'SECURITY FAIL: an authenticated user can read heartbeat';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 3. merge_kv — the star rule and the LWW rule.
--    Back to family one, which owns the kv rows seeded above.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
                  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare v jsonb; u bigint;
begin
  -- A stale device pushes a LOWER star for cat and a higher one for dog, plus a
  -- brand new word. Per-entry max wins and the clock is ignored.
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"stars","value":{"sword:cat":1,"sword:dog":3,"sword:fish":2},"updated_at":50}
  ]$j$::jsonb);

  select value, updated_at into v, u from public.kv
  where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001' and key = 'stars';
  assert v -> 'sword:cat' = '2'::jsonb, 'a late low write clobbered an earned star: ' || v::text;
  assert v -> 'sword:dog' = '3'::jsonb, 'a higher star did not win: ' || v::text;
  assert v -> 'sword:fish' = '2'::jsonb, 'a new star entry was dropped: ' || v::text;
  assert u = 100, 'the row clock must never move backwards, got ' || u;

  -- Replaying the exact same call changes nothing (idempotence).
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"stars","value":{"sword:cat":1,"sword:dog":3,"sword:fish":2},"updated_at":50}
  ]$j$::jsonb);
  assert (select value from public.kv
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001' and key = 'stars')
         = v, 'a replay of the same merge changed the result';

  -- Two entries for the same key in ONE call fold instead of erroring.
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"stars","value":{"sword:bird":1},"updated_at":110},
    {"key":"stars","value":{"sword:bird":3},"updated_at":111},
    {"key":"stars","value":{"sword:bird":2},"updated_at":112}
  ]$j$::jsonb);
  assert (select value -> 'sword:bird' from public.kv
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001' and key = 'stars')
         = '3'::jsonb, 'duplicate keys in one call must fold by max, not by order';

  -- The rule is a namespace, not one key: 'stars.<anything>' merges by max too,
  -- which is what lets Phase 12 add keys without touching the function.
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"stars.week","value":{"mon":3},"updated_at":200}
  ]$j$::jsonb);
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"stars.week","value":{"mon":1,"tue":2},"updated_at":100}
  ]$j$::jsonb);
  assert (select value from public.kv
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001' and key = 'stars.week')
         = '{"mon": 3, "tue": 2}'::jsonb, 'the stars.* namespace did not merge by max';

  -- LWW: a newer write replaces wholesale…
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"band","value":{"level":5},"updated_at":150}
  ]$j$::jsonb);
  assert (select value from public.kv
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001' and key = 'band')
         = '{"level": 5}'::jsonb, 'a newer LWW write did not win';

  -- …and an older one is ignored, value and clock both.
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"band","value":{"level":1},"updated_at":120}
  ]$j$::jsonb);
  select value, updated_at into v, u from public.kv
  where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001' and key = 'band';
  assert v = '{"level": 5}'::jsonb, 'a stale LWW write overwrote a newer value';
  assert u = 150, 'a stale LWW write moved the clock backwards';

  -- An unknown key is LWW by default (no rule row needed to sync it).
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"leitner","value":{"cat":2},"updated_at":10}
  ]$j$::jsonb);
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"leitner","value":{"cat":1},"updated_at":20}
  ]$j$::jsonb);
  assert (select value from public.kv
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001' and key = 'leitner')
         = '{"cat": 1}'::jsonb, 'an unlisted key must be last-write-wins';

  -- A star value of the wrong shape (hand-edited storage) must not explode; it
  -- degrades to LWW.
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"stars.broken","value":"nonsense","updated_at":10}
  ]$j$::jsonb);
  perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', $j$[
    {"key":"stars.broken","value":{"a":1},"updated_at":20}
  ]$j$::jsonb);
  assert (select value from public.kv
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001' and key = 'stars.broken')
         = '{"a": 1}'::jsonb, 'a malformed star value should fall back to LWW';

  -- Malformed input is rejected outright rather than half-applied.
  begin
    perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001',
                            '{"key":"stars"}'::jsonb);
    assert false, 'merge_kv accepted a non-array payload';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001',
                            '[{"key":"stars","value":{"a":1}}]'::jsonb);
    assert false, 'merge_kv accepted an entry without updated_at';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Events: the primary key IS the dedupe, so replays are free.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.events (profile_id, ts, kind, item_id, score)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 1000, 'word', 'cat', 70)
  on conflict (profile_id, ts, kind, item_id) do update set score = excluded.score;
  assert (select count(*) from public.events
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'
            and ts = 1000 and kind = 'word' and item_id = 'cat') = 1,
    'replaying an event created a duplicate row';

  insert into public.events (profile_id, ts, kind, item_id, score)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 1000, 'word', 'cat', 95)
  on conflict (profile_id, ts, kind, item_id) do update set score = excluded.score;
  assert (select score from public.events
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'
            and ts = 1000 and kind = 'word' and item_id = 'cat') = 95,
    'an upsert of the same event did not update the score';
end $$;

-- ---------------------------------------------------------------------------
-- 5. The 2000-event cap, mirroring the client's own log cap.
-- ---------------------------------------------------------------------------
do $$
declare kept int; oldest bigint;
begin
  insert into public.events (profile_id, ts, kind, item_id, score)
  select 'aaaaaaaa-0000-4000-8000-000000000001', g, 'word', 'w' || g, 50
  from generate_series(100000, 102099) g;   -- 2100 events at once

  select count(*), min(ts) into kept, oldest from public.events
  where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  assert kept = 2000, 'the event log should be pruned to 2000, found ' || kept;
  assert oldest = 100100, 'pruning must drop the OLDEST events, oldest kept is ' || oldest;
end $$;

-- Pruning is per profile: family two's log is untouched by family one's flood.
select set_config('request.jwt.claims',
                  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
begin
  insert into public.events (profile_id, ts, kind, item_id)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 1, 'story', 'intro');
  assert (select count(*) from public.events) = 1,
    'family two should see exactly its own single event';
end $$;

-- ---------------------------------------------------------------------------
-- 6. Client clocks are input, not truth.
--    An iPad set to 2030 must not be able to freeze a key forever or park its
--    events decades ahead of every real one.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
                  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare
  p3 constant uuid := 'cccccccc-0000-4000-8000-000000000003';
  year_2100 constant bigint := 4102444800000;
  cap bigint;
  u bigint;
  stored bigint;
begin
  cap := public.clamp_client_ts(year_2100);   -- the ceiling: this hour + 24h
  assert cap < year_2100, 'clamp_client_ts is not clamping at all';

  insert into public.profiles (id, owner_id, name)
  values (p3, '11111111-1111-4111-8111-111111111111', 'Bé Ba');

  -- kv: a wild updated_at is capped on the way in…
  perform public.merge_kv(p3, jsonb_build_array(jsonb_build_object(
    'key', 'band', 'value', jsonb_build_object('level', 9), 'updated_at', year_2100)));
  select updated_at into u from public.kv where profile_id = p3 and key = 'band';
  assert u = cap, 'a far-future client clock was stored as given: ' || u;

  -- …so the key is frozen for at most a day, not for ever: a write dated at
  -- the ceiling still wins.
  perform public.merge_kv(p3, jsonb_build_array(jsonb_build_object(
    'key', 'band', 'value', jsonb_build_object('level', 1), 'updated_at', cap)));
  assert (select value from public.kv where profile_id = p3 and key = 'band')
         = '{"level": 1}'::jsonb, 'a far-future write froze an LWW key permanently';

  -- …and the ceiling guards the TABLE, not just the RPC. Owners hold INSERT
  -- and UPDATE on kv (the reset path needs them), so a modified client could
  -- otherwise skip merge_kv entirely and write a wild clock straight through
  -- PostgREST.
  insert into public.kv (profile_id, key, value, updated_at)
  values (p3, 'leitner', '{"cat": 1}', 253402300799000);   -- year 9999
  select updated_at into u from public.kv where profile_id = p3 and key = 'leitner';
  assert u = cap, 'a direct kv insert kept its far-future clock: ' || u;

  update public.kv set updated_at = 253402300799000
  where profile_id = p3 and key = 'leitner';
  select updated_at into u from public.kv where profile_id = p3 and key = 'leitner';
  assert u = cap, 'a direct kv update kept its far-future clock: ' || u;

  perform public.merge_kv(p3, jsonb_build_array(jsonb_build_object(
    'key', 'leitner', 'value', jsonb_build_object('cat', 2), 'updated_at', cap)));
  assert (select value from public.kv where profile_id = p3 and key = 'leitner')
         = '{"cat": 2}'::jsonb,
    'a direct far-future write froze the row against every later merge';

  -- events: the same ceiling, applied by a trigger before the primary key is
  -- decided, so a replay of the poisoned event still lands on the same row
  -- instead of multiplying.
  insert into public.events (profile_id, ts, kind, item_id)
  values (p3, year_2100, 'word', 'future');
  select ts into stored from public.events where profile_id = p3 and item_id = 'future';
  assert stored = cap, 'a far-future event kept its timestamp: ' || stored;

  insert into public.events (profile_id, ts, kind, item_id)
  values (p3, year_2100, 'word', 'future')
  on conflict (profile_id, ts, kind, item_id) do nothing;
  assert (select count(*) from public.events where profile_id = p3 and item_id = 'future') = 1,
    'a replayed far-future event created a second row instead of deduping';

  -- and genuine events keep their places next to it
  insert into public.events (profile_id, ts, kind, item_id)
  select p3, g, 'word', 'real' || g from generate_series(1000, 1002) g;
  assert (select count(*) from public.events where profile_id = p3) = 4,
    'a far-future event evicted genuine ones';
end $$;

-- ---------------------------------------------------------------------------
-- 7. Resetting a child's progress is a plain DELETE by the owner.
--    (There is no tombstone verb: stars merge by max, so an "empty" write
--    would just be out-merged. Task 3 calls exactly these statements.)
-- ---------------------------------------------------------------------------
do $$
declare
  p3 constant uuid := 'cccccccc-0000-4000-8000-000000000003';
  n int;
begin
  delete from public.kv where profile_id = p3;
  get diagnostics n = row_count;
  assert n > 0, 'an owner must be able to delete their own kv rows (progress reset)';
  delete from public.events where profile_id = p3;
  get diagnostics n = row_count;
  assert n = 4, 'an owner must be able to delete their own events (progress reset)';
  assert (select count(*) from public.profiles where id = p3) = 1,
    'a reset must not take the profile with it';
end $$;

-- …and the same DELETE aimed at another family does nothing at all.
select set_config('request.jwt.claims',
                  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
declare n int;
begin
  delete from public.kv where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two reset family one''s kv';
  delete from public.events where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'SECURITY FAIL: family two reset family one''s events';
  assert (select count(*) from public.events
          where profile_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0,
    'family two can still not see family one''s events (count is RLS-filtered)';
end $$;

-- ---------------------------------------------------------------------------
-- 8. Floors under a modified client: sizes, ranges and a profile cap.
-- ---------------------------------------------------------------------------
do $$
declare i int;
begin
  begin
    insert into public.kv (profile_id, key, value, updated_at)
    values ('bbbbbbbb-0000-4000-8000-000000000002', repeat('k', 65), '{}', 1);
    assert false, 'an over-long kv key was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.kv (profile_id, key, value, updated_at)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'fat',
            jsonb_build_object('blob', repeat('x', 20000)), 1);
    assert false, 'a 20KB kv value was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.events (profile_id, ts, kind, item_id, score)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 9, 'word', 'x', 5000);
    assert false, 'a score outside 0..100 was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.events (profile_id, ts, kind, item_id)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 9, 'word', repeat('i', 129));
    assert false, 'an over-long item_id was accepted';
  exception when check_violation then null;
  end;

  -- family two holds one profile; nine more reach the cap, the eleventh does not
  for i in 2 .. 10 loop
    insert into public.profiles (owner_id, name)
    values ('22222222-2222-4222-8222-222222222222', 'Bé ' || i);
  end loop;
  assert (select count(*) from public.profiles) = 10, 'the cap test did not set up 10 profiles';
  begin
    insert into public.profiles (owner_id, name)
    values ('22222222-2222-4222-8222-222222222222', 'Bé 11');
    assert false, 'a single account created an eleventh profile';
  exception when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 9. The unauthenticated role reaches nothing, and RLS is actually ON.
-- ---------------------------------------------------------------------------
set local role anon;
do $$
declare t text;
begin
  foreach t in array array['profiles', 'events', 'kv', 'recovery_codes', 'heartbeat'] loop
    begin
      execute format('select 1 from public.%I limit 1', t);
      assert false, 'SECURITY FAIL: the anon role can read ' || t;
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    perform public.merge_kv('aaaaaaaa-0000-4000-8000-000000000001', '[]'::jsonb);
    assert false, 'SECURITY FAIL: the anon role can call merge_kv';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
do $$
begin
  -- the heartbeat is the cron's alone, in both directions
  begin
    insert into public.heartbeat (id, at) values (2, now());
    assert false, 'SECURITY FAIL: an authenticated user can write the heartbeat';
  exception when insufficient_privilege then null;
  end;

  -- the merge contract is readable but not editable: a user who could add a
  -- rule could turn stars into last-write-wins and erase them.
  assert (select count(*) from public.kv_merge_rules where prefix = 'stars') = 1,
    'the stars rule should be readable by the client';
  begin
    insert into public.kv_merge_rules (prefix, strategy) values ('stars2', 'lww');
    assert false, 'SECURITY FAIL: a user rewrote the merge contract';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.kv_merge_rules set strategy = 'lww' where prefix = 'stars';
    assert false, 'SECURITY FAIL: a user turned the star rule into LWW';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 10. The recovery code dies the moment the account gains a real credential.
--     A screenshot of the code must not be a way into a LINKED family account
--     (api/recover.mjs refuses too — this is the layer that does not depend on
--     any app version being deployed).
-- ---------------------------------------------------------------------------
reset role;
do $$
declare anon_user constant uuid := '33333333-3333-4333-8333-333333333333';
begin
  insert into auth.users (id, instance_id, aud, role)
  values (anon_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.recovery_codes (user_id) values (anon_user);
  assert (select count(*) from public.recovery_codes where user_id = anon_user) = 1,
    'the anonymous user should start with a recovery code';

  -- the parent links their email
  update auth.users set email = 'linked@test.invalid' where id = anon_user;
  assert (select count(*) from public.recovery_codes where user_id = anon_user) = 0,
    'SECURITY FAIL: the recovery code outlived the email link — a screenshot '
    'could still take over the parent''s account';
end $$;

do $$
declare unprotected text;
begin
  select string_agg(relname, ', ') into unprotected
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relkind = 'r'
    and relname in ('profiles', 'events', 'kv', 'recovery_codes', 'heartbeat', 'kv_merge_rules')
    and not relrowsecurity;
  assert unprotected is null, 'SECURITY FAIL: row level security is off on: ' || unprotected;
end $$;

select 'ALL RLS + MERGE TESTS PASSED' as result;

rollback;
