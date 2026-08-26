# Phase 10 — Phone layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app is usable on an iPhone — every screen's primary action is reachable without scrolling at 390×844 — without changing anything at the iPad breakpoint.

**Spec:** `docs/superpowers/specs/2026-08-26-phase10-mobile-layout-design.md` (decisions + rules).
**Numbers:** `docs/design/2026-08-25-mobile-handoff-brief.md` (per-frame structure, measurements, per-file deltas, risks). Both are authority; the brief wins on measurements, the spec wins on decisions.

## Global Constraints
- Branch `phase10-mobile-layout`. Commit per task; secret hooks; no `--no-verify`.
- Phone rules are UNPREFIXED Tailwind; tablet is `md:`; iPad landscape moves from `lg:` to the new `ipad:` screen (Task 1 adds it). Never change a shared component's base size to fix a phone — add a breakpoint-prefixed override or a variant prop.
- Brief §15 (iPad-breaking risks) is binding: do not touch `MicButton`'s 150/190 defaults, `Button`'s SIZE map, `ScoreBars`' horizontal row, or `Home`'s `SLOTS`/`TRAIL` except behind a breakpoint.
- Verification for every UI task: DOM geometry with the dev server (`pnpm --filter client exec vite --mode nossl --port 5174`, stop after) at **390×844**, **375×667** and **1194×834**, reporting per screen: `main.scrollHeight` vs viewport, the primary action's box, and (at 1194) proof the iPad layout is byte-identical in behaviour. No horizontal scroll at 320 px either.
- Tap ≥64 px; mic ≥120 px; Vietnamese child copy; tests/lint/typecheck/build green; 0 act() warnings.

---

### Task 1: Foundation — safe area, breakpoints, shared shell
**Files:** Modify `client/tailwind.config.ts` (add `screens.ipad = '1194px'`; keep existing screens), `client/src/styles.css` (safe-area utilities), every screen that currently uses `lg:` for the iPad-landscape layout (`Home.tsx`, `DailyMission.tsx`, `SoundPractice.tsx`, `LevelStairs.tsx`, and any other the brief §13 table names) → `ipad:`, and screens using `sm:` to mean tablet (`SoundPractice`, `SoundWordList`, `LevelStairs`, `Home`) → `md:`; add a shared page-shell helper (a class constant or small component in `components/ui/`) that applies the design's frame padding with `env(safe-area-inset-*)`.
- Per brief §1: padding is safe-area inset plus breathing room (design's 56/44 already includes the 47/34 insets) — implement as `calc(env(safe-area-inset-top) + 9px)` style rules, not fixed pixels. Horizontal padding per frame family (16 / 20 / 14 / 18) belongs to the screens, not the shell.
- This task must be a NO-OP visually at 1194×834 and at 1024 (verify: the iPad layout now activates at 1194 instead of 1024, so a 1024-wide window must show the tablet-portrait layout, not a squeezed map — confirm that is what happens and report it).
- Tests: existing suite stays green; add a test asserting the shell applies safe-area padding classes.
- Commit `feat(mobile): safe-area shell and real breakpoints`.

### Task 2: Home — M1b
**Files:** Modify `client/src/screens/Home.tsx` (+test).
- Per brief §3: phone layout = header (greeting + Foxy + streak/stars), then the mission card near the top, then a 2-column grid of the eight topic cards (128 px), then the stairs and parent links. The map (`SLOTS`, `TRAIL`, the absolutely-positioned islands) renders only from `ipad:` up; the tablet breakpoint keeps the existing 2-col grid but wider.
- Spec decision 1: on phone, copy naming "bản đồ" becomes "trang chủ 🏠" — audit this screen's own strings only; other screens' back-labels are Task 3/7.
- Tests: at the phone default the islands are a grid with no absolute positioning and the mission CTA precedes them in DOM order; the map elements still render for the iPad breakpoint (class assertions); locked tiles unchanged.
- Geometry: 390×844 must show the CTA without scrolling; report the box.
- Commit `feat(mobile): home fits a phone`.

### Task 3: Daily Mission + Mission Complete
**Files:** Modify `client/src/screens/DailyMission.tsx` (+test), `client/src/screens/MissionComplete.tsx` (+test), `client/src/components/MissionCard.tsx` (+test) if the card's phone form differs.
- Per brief §4: the five group cards become 76 px horizontal rows on phone (`flex-col` → `flex-row` at the base, columns from `md:`), CTA pinned; per brief §12 (M8b) the completion screen's phone stack.
- Spec decision 1: "Về bản đồ 🏝️" → "Về trang chủ 🏠" on phone (both screens), unchanged from `md:` up.
- Tests: row layout at base, column classes from `md:`; wording per breakpoint (class-based assertion or a rendered-text test at both).
- Geometry: 390×844 and 375×667 — CTA visible, page height reported.
- Commit `feat(mobile): mission steps as rows`.

### Task 4: The speak frame + sound drill
**Files:** Modify `client/src/screens/SoundPractice.tsx` (+test), `client/src/screens/SoundWordList.tsx` (+test), and whichever shared result components the brief §5 names (`ScoreBars`, `ScoredWords`, `Stars`, `HintCard`) — **only** behind phone-prefixed rules.
- Per brief §5 (M3/M3b): the shared before/after speaking stack for phone, including the compressed result state; per brief §6 (M4): the sound drill's two-row grid collapses to the design's stacked tiers, mouth tile 168×200 → 64 px row.
- The five practice screens share this frame; this task owns SoundPractice as the reference implementation and any shared component changes. Task 5–6 follow it.
- Geometry: `/sound/dh/<longest tip word>` idle AND result state at 390×844 and 375×667; report both, plus 1194×834 unchanged.
- Commit `feat(mobile): the speaking frame fits a phone`.

### Task 5: Flashcard + meaning guess
**Files:** Modify `client/src/screens/WordCard.tsx` (+test).
- Per brief §7 (M5): card becomes `min(320px, 82%)` with the design's 16/17 aspect ratio instead of the hard `320×360`; per brief §8 (M5b): the guess step's phone layout.
- Spec decision 3: a correct guess shows the praise and an explicit "Tiếp theo →" button (≥64 px) that reveals the card + mic — at every breakpoint. Update the existing praise-auto-clear behaviour accordingly and keep its test honest.
- Tests: card sizing classes; guess-correct now requires the button before the mic appears (update the existing tests that assumed auto-reveal — do not delete coverage).
- Geometry: both outcome states (unlocked, retry-with-hint) at 390×844 and 375×667.
- Commit `feat(mobile): flashcard and guess step on a phone`.

### Task 6: Story player, quiz, Speak Lab stairs
**Files:** Modify `client/src/screens/StoryPlayer.tsx`, `StoryQuiz.tsx`, `LevelStairs.tsx` (+tests), plus the story sub-components the brief §9 names.
- Per brief §9 (M6): phone player layout, 14 px side padding, karaoke line sizing; §10 (M6b): quiz's phone stack; §11 (M7): the stairs become a bottom-up vertical zigzag with a dotted SVG trail and a pinned CTA on phone, keeping the diagonal staircase from `ipad:` up.
- Tests: per-screen structural assertions at base vs `ipad:`; the stairs' five steps and Foxy placement logic unchanged.
- Geometry: all three screens at 390×844 and 375×667; the story player must keep its illustration frame's aspect ratio.
- Commit `feat(mobile): stories and the staircase on a phone`.

### Task 7: Topic hub, parent dashboard, docs
**Files:** Modify `client/src/screens/TopicHub.tsx` (+test), `client/src/screens/ParentDashboard.tsx` (+test), `README.md`, spec status line, brief §2.5 note in `docs/2026-08-22-giai-phap-va-design-brief.md`.
- Per brief §12: M8 topic hub gains the 236 px teal island header on phone; M8c parent dashboard's dense phone layout (18 px padding).
- Spec decision 2: the dashboard KEEPS "Bản ghi gần đây" — on phone it may collapse into a disclosure with a ≥64 px summary row, closed by default. Do not delete the card or its tests.
- Any remaining "Về bản đồ" copy on phone → "Về trang chủ 🏠" (audit the whole `client/src/screens` tree and fix what's left).
- README Phase 10 section + iPad/iPhone checklist rows (add a phone column or a separate phone checklist); spec status line; brief note.
- Commit `feat(mobile): topic hub and parent area` then `docs: phase 10 phone layout`.

## Self-Review
Spec decision 1 → T2 (Home) + T3 (wording) + T7 (sweep); decision 2 → T7; decision 3 → T5. Brief §1 → T1; §3 → T2; §4/§12-M8b → T3; §5/§6 → T4; §7/§8 → T5; §9/§10/§11 → T6; §12-M8/M8c → T7; §13 → T1; §15 → every task's verification. T1 must land before all others (it moves the iPad breakpoint); T4 must land before T5 and T6 if it changes shared result components — otherwise T5/T6 may run in parallel with each other.
