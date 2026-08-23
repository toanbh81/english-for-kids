# Phase 6 — Sentence Stars & Story Voice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two new Speak Lab levels — Sentence Stars (stress/linking/fluency) and Story Voice (prosody by mood) — with content, audio, screens, star rules, stairs unlock and docs.

**Spec:** `docs/superpowers/specs/2026-08-23-phase6-sentence-stars-story-voice-design.md` (authority).

## Global Constraints
- Branch `phase6-stars-voice`. Commit per task; secret hooks; no `--no-verify`.
- Star rules exactly as spec (`starsForSentence`, `starsForVoice`); keys `sstar:<id>`, `voice:<id>`; activity kind `speak`.
- Reuse `useSpeakingAttempt`, `toFeedback`, `ScoreBars`, `ScoredWords`, `HintCard`, `MicButton`, `Foxy`, UI kit; outer/inner component pattern; tap ≥ 64 px; Vietnamese copy; tests/lint/typecheck/build green; no act() warnings.

---

### Task 1: Content + generators + pure scoring helpers
**Files:** Create `client/src/content/sentence-stars.json`, `client/src/content/story-voice.json`, extend `client/src/content/index.ts` (`SENTENCE_STARS`, `findSentenceStar`, `STORY_VOICE`, `findVoice`) and `types.ts` (`SentenceStar`, `VoicePassage`), `client/src/scoring/levelStars.ts` (+test) with `starsForSentence(r)` and `starsForVoice(r, engine)`, `scripts/gen-phrases.mjs` (Emma HD, plain text, rate -10%, writes `/audio/stars/<id>.mp3` and `/audio/voice/<id>.mp3` for the two JSON files; usage exit 1 without env), content tests (10 sentences 4–8 words with valid `stress` indexes; 8 passages with valid moods and 2–3 sentences; unique ids; audio paths), README generator line. Do not run the generator (controller does).
- Commit `feat(content): sentence stars, story voice passages, star rules and phrase generator`.

### Task 2: Sentence Stars screens
**Files:** Create `client/src/screens/StarLevel.tsx`, `StarPractice.tsx`, `client/src/components/StressedSentence.tsx` (+tests); Modify `App.tsx` (`/level/sentence-stars` before `/level/:levelId`, `/star/:id`).
- Per spec §1. `StressedSentence({ words, stress, link })` renders words with stressed ones `text-coral-text text-[48px]` and a ‿ connector (`aria-hidden`) between linked pairs; rhythm card = row of dots (big for stressed) with `animate-pulse-soft` while the sample plays (toggle a `playing` state around `playUrl`).
- Tests: level lists 10; practice renders stressed words with the coral class; result 85/85/100 → 3★ stored `sstar:<id>`; 65/40/100 → 2★; fallback copy "Nhịp: 🐢 chậm" when fluency < 60.
- Commit `feat(stars): sentence stars level and practice`.

### Task 3: Story Voice screens
**Files:** Create `client/src/screens/VoiceLevel.tsx`, `VoicePractice.tsx`, `client/src/components/ProsodyChip.tsx` (+tests); Modify `App.tsx` (`/level/story-voice`, `/voice/:id`).
- Per spec §2 (mood badge, tips card with 3 tips per mood from a `MOOD_TIPS` map, passage with ❗❓ highlighted, auto-stop 10 s via `autoStopMs: 10000`, ProsodyChip from `result.prosody ?? accuracy`, webspeech → "Chưa chấm được ngữ điệu" + cap 2).
- Tests: level lists 8; practice shows mood copy + tips; result prosody 84/accuracy 75 → 3★ `voice:<id>`; prosody 65 → 2★; webspeech → chip unscored, stars ≤ 2.
- Commit `feat(voice): story voice level and practice`.

### Task 4: Stairs unlock, docs, status
**Files:** Modify `client/src/screens/LevelStairs.tsx` (+test), `README.md`, spec status, brief §2.5.
- Steps 4–5 link to the new levels with stars from `sstar:*` / `voice:*`; tests for 5 links; README Phase 6 section + iPad rows; status lines. Commit `feat(stairs): unlock sentence stars and story voice; docs`.

## Self-Review
Spec §1 → T1,T2; §2 → T1,T3; §3 → T4. Keys/rules consistent; generator mirrors gen-sentences.mjs.
