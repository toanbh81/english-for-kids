-- A stand-in for the parts of a REAL Supabase project that the migration and
-- rls.test.sql lean on. Its job is imitation, not minimalism: anything a real
-- project has and this file does not is a bug the harness will be blind to.
--
-- That is not hypothetical. The first version of this shim created the three
-- roles and stopped there, so every table in the harness was born with no
-- grants at all — while on the real project the default privileges below hand
-- every new table to `anon` and `authenticated` with ALL. The migration's
-- grants therefore looked like they were doing something locally and were
-- doing nothing at all in production: TRUNCATE on every family's data, a
-- writable merge contract, and a client free to pick its own recovery code.
-- Everything was green here and open there. Hence the second half of this file.

-- --- roles ------------------------------------------------------------------
-- PostgREST switches into `anon` for a request with no JWT and `authenticated`
-- for one with a session (Supabase's "anonymous sign-in" users are ordinary
-- GoTrue users and also arrive as `authenticated`). `service_role` is what the
-- Vercel functions use, and it bypasses RLS.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- --- the auth schema --------------------------------------------------------
-- Only the columns this migration and its tests touch. `email`/`phone` are
-- unique because the on_auth_user_email_linked trigger fires on them, and
-- `is_anonymous` exists because api/recover.mjs reads it.
create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  instance_id uuid,
  aud varchar(255),
  role varchar(255),
  email text unique,
  phone text unique,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

-- The real one reads the JWT that PostgREST puts in request.jwt.claims, and so
-- does this: the tests set that GUC to act as one family or the other.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;

-- A stock project names the client roles on `public` explicitly rather than
-- leaving them to inherit PUBLIC's USAGE. USAGE only — CREATE on this schema
-- would let a client build its own tables and functions, and rls.test.sql's
-- inventory fails if it ever finds that.
grant usage on schema public to anon, authenticated, service_role;

-- --- the part that matters --------------------------------------------------
-- A real Supabase project ships with these three lines already in place, so
-- every table, function and sequence a migration creates in `public` is born
-- with ALL privileges for `anon` and `authenticated`. A migration that only
-- ADDS grants is a migration that changes nothing; the migration has to revoke
-- first. Deleting these three lines makes the harness lie the way the old one
-- did — leave them.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- --- Automatic RLS ----------------------------------------------------------
-- A stock Supabase project also ships this: an event trigger that turns RLS on
-- for every table created in `public`, whether or not the migration that
-- creates it remembers to. It is Supabase's feature, not this migration's —
-- installed by the platform, owned by its superuser — and it is exactly the
-- kind of thing this shim exists to imitate rather than omit, the same way the
-- default-privilege lines above are. Its own privileges are untidy rather than
-- exploitable (see supabase/README.md, "PUBLIC/anon/authenticated hold EXECUTE
-- on rls_auto_enable" for the full story and the one-line fix): calling it
-- directly refuses with `trigger functions can only be called as triggers`
-- regardless of who holds EXECUTE, because Postgres itself restricts an
-- event-trigger function to firing as a trigger.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  obj record;
begin
  for obj in select * from pg_event_trigger_ddl_commands() loop
    if obj.command_tag = 'CREATE TABLE' and obj.schema_name = 'public' then
      execute format('alter table %s enable row level security', obj.object_identity);
    end if;
  end loop;
end;
$$;

create event trigger ensure_rls
  on ddl_command_end
  execute function public.rls_auto_enable();
