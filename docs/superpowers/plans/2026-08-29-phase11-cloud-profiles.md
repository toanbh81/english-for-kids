# Phase 11 — Cloud profiles & sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Progress survives cache wipes and reaches other devices via Supabase, with login optional and the offline app unchanged.

**Spec:** `docs/superpowers/specs/2026-08-29-phase11-cloud-profiles-design.md` (authority — schema, RLS, merge rules, flows are exact there).

**Model per task (user requirement — recorded here and used in dispatches):** security- and data-integrity-critical tasks run on **opus**; UI and docs tasks run on **sonnet**. Reviews: opus for T1–T3, sonnet for T4–T6.

## Global Constraints
- Branch `phase11-cloud-profiles`. Commit per task; secret hooks; no `--no-verify`.
- `SUPABASE_SERVICE_ROLE` is a secret: `server/.env` + Vercel env only, never client/ or docs; extend `scripts/check-secrets.sh` FIRST (T1) so a leak cannot land. `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are public-by-design and live in `client/.env` (git-ignored) + Vercel env.
- The app must behave byte-identically with cloud env vars absent (no-op cloud module) — every existing test runs without them.
- Local-first: no screen blocks on the network; sync errors are silent to the child.
- Vietnamese copy; tap ≥64px; tests/lint/typecheck/build green; 0 act() warnings.
- Live verification against the real Supabase project happens when the user provides credentials; tasks are structured so authoring and unit tests do not wait for them.

---

### Task 1 (model: **opus**): Foundation — schema, RLS, serverless, secret guard
**Files:** Create `supabase/migrations/0001_profiles_sync.sql` (schema + RLS + `merge_kv` RPC + prune trigger, exactly per spec), `supabase/README.md` (how to apply: `supabase db push` or SQL editor paste), `api/recover.mjs` (POST {code} → re-parent profiles to the caller's user, delete old user; auth: caller's JWT + service role), `api/ping.mjs` (heartbeat upsert), `client/src/cloud/supabase.ts` (client factory; returns null when env absent); Modify `vercel.json` (daily cron → /api/ping), `scripts/check-secrets.sh` (patterns for service-role keys; allowlist the anon key/URL shape), `server/.env.example`-equivalent docs if present.
- Tests: SQL policy tests as `supabase/tests/rls.test.sql` (pgTAP-style or plain assertions runnable in the SQL editor) covering: owner-only profile read/write, cross-user denial, merge_kv stars-max vs LWW, event dedupe; a node unit test for the supabase.ts null-when-unconfigured contract; api/recover.mjs unit-tested with mocked service client (deny without valid JWT, deny bad code, re-parent happy path).
- Commit `feat(cloud): supabase schema, policies and serverless glue`.

### Task 2 (model: **opus**): Auth & profile state
**Files:** Create `client/src/cloud/auth.ts` (+test), `client/src/cloud/profileState.ts` (+test); Modify `client/src/main.tsx` or App bootstrap minimally.
- Silent `signInAnonymously()` when online + configured (backoff retry, never throws to UI); recovery-code generation on first sign-up (insert via RLS-allowed self-row); `linkEmail(email)` → `updateUser` OTP flow + `verifyOtp`; `signInWithEmail(email)` for the returning/other-device case; session persistence via supabase-js defaults; `profileState`: active profile id in localStorage, `ensureProfile()` auto-create, list/add profiles, and the one-time localStorage namespacing migration (`speakup.*` → `speakup.<profileId>.*`) — THIS TOUCHES EVERY STORE READ: implement as a key-prefix helper in ONE place (progress modules import it) rather than editing every call site.
- Tests: anonymous bootstrap (mocked client), upgrade keeps uid, namespacing migration idempotent + preserves every existing key, absent-env no-op.
- Commit `feat(cloud): anonymous-first auth and child profiles`.

### Task 3 (model: **opus**): Sync engine
**Files:** Create `client/src/cloud/sync.ts` (+extensive test); Modify `client/src/progress/activity.ts` + stores only via a small write-hook seam (one exported `onStoreWrite(key)` subscription — do not scatter sync calls).
- Outbox per spec; flush triggers (start, online, visibilitychange-hidden, debounced writes); push = events upsert batch + merge_kv; pull-on-start/sign-in merging into localStorage with stars-max/LWW/union — reuse the exact merge rules by importing them, not re-implementing; at-least-once + idempotent replays; a `syncStatus()` accessor for the dashboard line.
- Tests: replay idempotence; pull never regresses a local higher star; interleaved offline writes then flush; partial-failure retains ops; corrupt outbox tolerated; absent-env no-op.
- Commit `feat(cloud): the outbox that mirrors progress`.

### Task 4 (model: **sonnet**): Parent-facing auth UI
**Files:** Modify `client/src/screens/ParentDashboard.tsx` (+test), `client/src/screens/Home.tsx` (banner + A2HS nudge, +test); Create `client/src/screens/CloudStart.tsx` (+test) and route (the "Đã dùng Speak Up rồi?" entry on first-run when cloud configured), profile picker component.
- Parent screen gains a "Tài khoản" card: link email (OTP input), signed-in state (email shown, sign out), recovery code display with the screenshot hint, "Thêm hồ sơ" + profile list; consent line at link time per spec. CloudStart: email+OTP restore path and recovery-code path calling api/recover, then pull + reload. Home: milestone banner (streak ≥3, dismissible, honest wording) + one-time A2HS nudge. Child screens gain NOTHING.
- Tests: each flow with mocked cloud modules; banner trigger/dismiss; picker shows at >1 profile; all hidden when env absent.
- Commit `feat(cloud): the parent links, restores and manages profiles`.

### Task 5 (model: **sonnet**): Remote parent dashboard
**Files:** Modify `client/src/screens/ParentDashboard.tsx` (+test), small data adapter in `client/src/cloud/remote.ts` (+test).
- When signed in with >0 profiles and the ACTIVE device profile differs or a "xem từ xa" toggle is chosen: per-profile read-only stats (streak, minutes, weekly scores, weak phonemes) computed from pulled events via the existing aggregate helpers — reuse `activity.ts` queries against a fetched event array rather than new analytics.
- Tests: adapter maps server rows → the existing helpers' shapes; remote mode renders with mocked data; absent-env hides it.
- Commit `feat(cloud): parents see progress from any device`.

### Task 6 (model: **sonnet**; review opus for the checklist accuracy): Docs + live verification script
**Files:** `README.md` (Phase 11 section: architecture, env setup, the honest persistence story, iPad checklist rows incl. the cross-device and cache-wipe drills), spec status line, brief §2.5 note; Create `scripts/cloud-smoke.mjs` (node script the controller runs once real credentials exist: sign in anon, write, merge, pull, recover — printing PASS/FAIL per step; reads env from `server/.env`).
- Commit `docs: phase 11 cloud profiles` (+`test(cloud): live smoke script`).

## Self-Review
Spec §Schema/§RLS → T1; §Sync → T3; flows 1–2 → T2+T4; 3–4 → T4 (+T1 recover); 5 → T5; 6–7 → T2+T4. The namespacing migration (T2) is the riskiest hidden dependency — it must land before T3's sync keys anything, hence strict T2→T3 order. T4/T5 depend on T2/T3 mocks only, may run in parallel after T3. Live smoke (T6 script) is the controller's gate before merge, once the user's Supabase project exists.
