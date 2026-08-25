# Phase 8 — Mission flow & practice polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The daily mission reads as grouped steps (per the design prototype), practice screens know they are inside the mission (numbering, back, next, celebration), and the three scoring UX bugs are fixed at the root.

**Spec:** `docs/superpowers/specs/2026-08-24-phase8-mission-flow-design.md` (authority).

## Global Constraints
- Branch `phase8-mission-flow`. Commit per task; secret hooks; no `--no-verify`.
- Free-play behavior unchanged wherever `location.state?.mission !== true` — every mission-aware change is gated on that flag (except §5 scoring resilience and §6–§8 WordCard changes, which apply everywhere).
- Reuse UI kit, Foxy, outer/inner pattern; tap ≥ 64 px; Vietnamese child copy; tests/lint/typecheck/build green; no act() warnings; no `Math.random`.

### Task 1: Scoring resilience (spec §5)
**Files:** Modify `client/src/scoring/createScorer.ts` (+test), `client/src/speaking/useSpeakingAttempt.ts` (+test), `client/src/screens/SoundPractice.tsx` (+test).
- createScorer: one retry after 700 ms backoff on token-fetch failure; then webspeech.
- useSpeakingAttempt.startRecording: if scorer.engine === 'webspeech' && navigator.onLine, await createScorer() and adopt the result if azure — before opening the mic/recognizer.
- SoundPractice UNSCORED split per spec §5 (two copies, keyed off `attempt.engine`); no "Azure" in child copy.
- Tests: token fetch fails once then succeeds → azure; fails twice → webspeech; webspeech attempt with token endpoint recovered → next attempt is azure; SoundPractice shows the webspeech copy vs the azure-no-phoneme copy.
- Commit `fix(scoring): retry the token, never pin a card to web speech`.

### Task 2: Grouped mission + CTA wording + mission celebration (spec §1, §2, §9)
**Files:** Modify `client/src/screens/DailyMission.tsx` (+test), `client/src/components/MissionCard.tsx` (+test).
**Interfaces (produces):** groups derived in DailyMission from `lessonStatus().items` by `kind` (order of first appearance); mission-originated Links/CTA carry `state: { mission: true }`.
- Group cards per spec §1 table (progress x/N, Bước i, teal ring + "bắt đầu ở đây!", ✓ Xong, link to first undone item of the group); sticky CTA kept; band chip + doneCount/total header kept; celebration navigate on mount with the same `speakup.celebrated` day-guard Home uses.
- MissionCard + DailyMission CTA wording per spec §2.
- Tests: grouping counts for a seeded lesson; ring on first incomplete group; group link href = first undone item route and carries state; CTA label switches Bắt đầu/Tiếp tục; mount celebration once per day; done group shows ✓ Xong.
- Commit `feat(mission): grouped steps like the prototype`.

### Task 3: Mission session — numbering, back, next (spec §3)
**Files:** Create `client/src/progress/missionNav.ts` (+test); Modify `client/src/screens/SoundPractice.tsx`, `PracticeCard.tsx`, `PairPractice.tsx`, `StarPractice.tsx`, `VoicePractice.tsx`, `WordCard.tsx`, `SentenceBuilder.tsx` (+tests each, small).
**Interfaces:** `missionPosition(pathname, now?)` per spec §3 exactly.
- Each screen, when `location.state?.mission === true`: position chip (labels per spec §3), BackButton → `/mission` ("Nhiệm vụ"), next/finish CTA → `nextRoute` with state forwarded, null → `/mission`. Without the flag: byte-identical behavior (assert by leaving existing tests untouched and green).
- SoundPractice special case: its internal 3-word run keeps its own "Từ n/3" flow; the mission chip counts sounds ("Âm i/N"), and its finish CTA (after stars) targets nextRoute.
- Tests: missionPosition unit tests (group boundaries, next across groups, null on free routes/lesson done); per-screen: chip text, back href, next href with state; free-play regression guard (no chip without state).
- Commit `feat(mission): screens know their place in the lesson`.

### Task 4: SoundPractice two-row layout (spec §4)
**Files:** Modify `client/src/screens/SoundPractice.tsx` (+test).
- Grid per spec §4; verify alignment + fold with DOM geometry at 1194×834 (`vite --mode nossl --port 5174`, report mic bottom).
- Commit `feat(sound): aligned sound and word rows`.

### Task 5: WordCard polish (spec §6, §7, §8)
**Files:** Modify `client/src/screens/WordCard.tsx` (+test), `client/tailwind.config.ts` (peek keyframe), `client/src/styles.css` if needed.
- Remove face chips + flip buttons; card `role="button"`/`tabIndex`/`aria-label`; peek animation per spec §6; Stars + "Điểm: NN" + HintCard per spec §7; praise per spec §8.
- Tests: no MẶT TRƯỚC/MẶT SAU text, no Lật thẻ buttons; card has role button and flips on Enter; peek class present before first flip, gone after; result renders stars + score chip (and hides the chip when overall is missing); praise text and its auto-clear (fake timers).
- Commit `feat(words): tap-hint flip card that shows its score`.

### Task 6: Docs + status
**Files:** Modify `README.md` (Phase 8 section + iPad rows: grouped mission, numbering/back/next, sound layout, word card hint + score, scoring retry), spec status line, brief §2.5 note.
- Commit `docs: phase 8 mission flow`.

## Self-Review
Spec §1/§2/§9 → T2; §3/§10 → T3; §4 → T4; §5 → T1; §6–§8 → T5. T3 consumes T2's `state: { mission: true }` convention and spec §3's missionPosition; SoundPractice touched by T1 (copy), T3 (chip/back/next), T4 (layout) — sequential tasks, no parallel dispatch for those three.
