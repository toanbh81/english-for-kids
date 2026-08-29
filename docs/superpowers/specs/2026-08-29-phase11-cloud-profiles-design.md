# Phase 11 — Cloud profiles & sync (Supabase)

Approved by the user 2026-08-29 after a two-track research pass (product patterns: Duolingo/ClassDojo/Khan Kids/Prodigy/Clever; platforms: Supabase vs Firebase vs self-hosted — briefs summarized in the conversation record). Decisions locked: **Supabase**; leaderboards (Phase 12) rank effort, never pronunciation scores; **child voice recordings never leave the device**.

**Status: implemented 2026-08-29 on branch `phase11-cloud-profiles` (tasks 1–6).** All seven flows
ship, including flow 6's app-start avatar picker ("tap your face, no password") — worth stating
plainly because it very nearly did not: task 4's own report recorded it as scoped out and "not wired
in", but a later fix round (`5631ae8`) built and wired `client/src/screens/ProfileGate.tsx` into
`client/src/main.tsx` after all, and the code, not that superseded report, is what shipped. See the
README's Phase 11 section for environment setup, the honest-persistence story and how to run the live
smoke test (`scripts/cloud-smoke.mjs`); `supabase/README.md` for the schema/RLS/grants detail this
spec leaves at "exact"; and `.superpowers/sdd/2026-08-29-phase11-cloud-profiles/task-6-report.md` for
the one place task reports and shipped code were found to disagree, and why the code wins.

## What this phase delivers

1. Progress survives a cache wipe and appears on other devices, without making login mandatory.
2. A parent can sign in from any device and see the child's results.
3. The groundwork (accounts, profiles, sync) that Phase 12's class groups build on.

## Non-negotiable principles

- **Local-first, offline unchanged.** localStorage stays the source of truth the app reads synchronously; the cloud is a mirror. Every current offline behaviour keeps working with the network off. Sync is additive — no screen may block on it.
- **Use first, link later, lose nothing.** The app silently creates a Supabase **anonymous user** on first online use and mirrors progress continuously. Linking a parent email later **upgrades the same user id** (`updateUser({ email })` after OTP), so every row already belongs to the upgraded account — no migration.
- **The child owns no credentials.** Only a parent email ever touches the system. No child email/phone fields exist anywhere. When a parent links, one consent line is shown ("Tiến độ học của bé sẽ được lưu trên tài khoản của bạn").
- **Voice audio stays local** (IndexedDB, last 20, as today). Scores, phoneme stats, events sync; blobs do not.
- **Honesty about persistence.** Until linked, the app may say progress is mirrored, but recovery needs the recovery code; the banner never claims more safety than exists. Non-installed Safari PWAs lose all storage after 7 days unused (WebKit ITP) — the app nudges Add to Home Screen once, dismissible.
  **[Shipped, task 6]** The milestone banner (`client/src/screens/Home.tsx`) fires at streak ≥ 3
  while still anonymous and says only "Tiến độ mới lưu trên máy này — nhờ bố mẹ liên kết email để
  giữ an toàn" — never that anything is already lost. The A2HS nudge is gated on the iOS-Safari
  heuristic alone, independent of `isCloudConfigured()`, because ITP is a fact about `localStorage`
  with no cloud involved. One elaboration this bullet did not originally spell out, found true during
  implementation and worth stating here rather than only in `client/src/cloud/sync.ts`'s comments: a
  parent-initiated reset is honest about *timing*, not just about safety — it is a server DELETE
  queued while offline, so it can carry away a different device's pushes made in the interim once it
  finally runs, and the parent screen says the deletion is still owed for as long as it is rather than
  claiming it happened the moment it was asked for. See the README's "honest persistence story" for
  the full, current list of these caveats in one place.

## Architecture

- `client/src/cloud/` — new module family: `supabase.ts` (client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; both are public-by-design publishable values, NOT secrets), `auth.ts` (session/anonymous/upgrade/OTP), `sync.ts` (outbox + pull/merge), `profileState.ts` (active child profile).
- `supabase/migrations/*.sql` — schema + RLS, committed to the repo.
- `api/recover.mjs`, `api/ping.mjs` — Vercel functions using `SUPABASE_SERVICE_ROLE` (a REAL secret: `server/.env` locally + Vercel env only; the secret scanner patterns must cover it; it must never appear in client code or docs).
- `vercel.json` gains a daily cron → `/api/ping` (keeps the free Supabase project from pausing after 7 idle days).

## Schema (exact)

```sql
profiles(id uuid pk default gen_random_uuid(),
         owner_id uuid not null references auth.users on delete cascade,
         name text not null default 'Bé', avatar text not null default '🦊',
         created_at timestamptz default now())
events(profile_id uuid references profiles on delete cascade,
       ts bigint not null, kind text not null, item_id text not null,
       score int, phonemes jsonb,
       primary key (profile_id, ts, kind, item_id))          -- upsert = dedupe
kv(profile_id uuid references profiles on delete cascade,
   key text not null, value jsonb not null, updated_at bigint not null,
   primary key (profile_id, key))
recovery_codes(user_id uuid pk references auth.users on delete cascade,
               code text unique not null, created_at timestamptz default now())
heartbeat(id int pk, at timestamptz)                          -- for /api/ping
```

- **RLS**: a user selects/updates only profiles where `owner_id = auth.uid()`, and events/kv only for profiles they own. `recovery_codes`: owner-read-only; redemption happens server-side. No public reads anywhere in this phase.
- **Merge rules live server-side too**: an RPC `merge_kv(profile uuid, entries jsonb)` applies per-key semantics — keys under `stars` merge **per-entry max** (a late low write must not clobber a higher star); every other key is LWW by the client-supplied `updated_at`. Events are plain upserts (the PK dedupes).
- The event log mirrors the local cap: a trigger or the RPC prunes to the newest 2000 rows per profile.

## Sync engine

- **Outbox** in localStorage (`speakup.outbox`): every `logActivity` and every store write appends a compact op. Flush: on app start, on `online`, on `visibilitychange` → hidden, and debounced (≤1/30 s) after writes. iOS has no Background Sync API — these foreground triggers are the whole strategy.
- **Push**: batch events upsert + one `merge_kv` call. Partial failure keeps the ops in the outbox (at-least-once; the PK/merge rules make replays idempotent).
- **Pull** on app start (and after sign-in/recovery): fetch events + kv for the active profile, merge INTO localStorage with the same rules the app already defines (stars max-wins, leitner/band/lesson LWW, events union by `(ts,kind,id)`). Pull must never regress a local value that is ahead.
- Sync state surfaces in ONE place only: a small line in the parent dashboard ("Đã đồng bộ ✓ / Chưa đồng bộ n mục / Ngoại tuyến"). The child never sees sync UI.

## Flows (all approved in the proposal)

1. **First use** — unchanged UX. Silent `signInAnonymously()` when online (retry with backoff; total silence when offline); auto-create one profile. Milestone banner (streak ≥ 3 days): "Tiến độ mới lưu trên máy này — nhờ bố mẹ liên kết email để giữ an toàn" → deep-link to the parent screen.
2. **Parent links** — Parent screen (behind the math gate): enter email → 6-digit OTP → done. Anonymous user upgraded in place; profile now reachable from any device.
3. **Cache wiped, linked** — start screen offers "Đã dùng Speak Up rồi?" → email + OTP → profile picker → pull restores everything.
4. **Cache wiped, not linked** — same entry offers "Tôi có mã khôi phục" → 8-char code → `/api/recover` re-parents the old user's profiles onto the current anonymous user (service role; old user deleted) → pull. No code → honest fresh start.
5. **Parent on another device** — same email OTP → parent dashboard in read-only remote mode: per-profile streak, minutes, weekly scores, weak phonemes (from synced events, reusing the existing dashboard components).
6. **Two children, one iPad** — parent can add profiles ("Thêm hồ sơ") in the parent screen; if >1 profile exists, app start shows an avatar picker (tap your face — no password, per the research). Each profile's local data is namespaced (`speakup.<profileId>.*` — migration renames existing keys to the first profile's namespace once).
7. **Recovery code** — shown in the parent screen with "chụp màn hình lại nhé"; generated at anonymous sign-up.

## Rules

Vietnamese copy; child screens never show auth/sync concepts; tap ≥64px; existing tests stay green and every existing screen works with Supabase env vars ABSENT (cloud module no-ops without config — CI and contributors without keys must pass); no secrets in client or repo (scanner extended for `SUPABASE_SERVICE_ROLE` and `sb_secret`-style keys; the anon key and URL are explicitly allowed); tests/lint/typecheck/build green; 0 act() warnings.

## Out of scope (Phase 12)

Groups, invite codes, join approval, leaderboards. The schema above deliberately avoids painting them into a corner (profiles are the unit a group will reference).
