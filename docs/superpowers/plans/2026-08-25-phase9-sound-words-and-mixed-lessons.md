# Phase 9 — Per-word sound practice, cross-topic lessons, eight islands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pronunciation step is one word (with Speak Lab drilling each word of a sound), the daily lesson mixes content across every unlocked topic and gains a sentence group, and the map grows to eight topics with the first four open.

**Spec:** `docs/superpowers/specs/2026-08-25-phase9-sound-words-and-mixed-lessons-design.md` (authority).

## Global Constraints
- Branch `phase9-mixed-lessons`. Commit per task; secret hooks; no `--no-verify`.
- Deterministic: everything seeded off `dayKey` via `content/shuffle.ts`; no `Math.random`.
- Store keys exactly: `sword:<cardId>` (per word), `sound:<ph>` (derived min, legacy floor), `sentence:<id>` unchanged.
- Free play unchanged where `location.state?.mission !== true`; mission wiring goes through `progress/missionNav.ts` (`useMissionNext`, `MISSION_STATE`, `groupItems`).
- Tap ≥ 64 px; Vietnamese child copy; UI kit; outer/inner pattern; tests/lint/typecheck/build green; 0 act() warnings.

---

### Task 1: Three topics + sentences + content wiring
**Files:** Create `client/src/content/words/colors.json`, `body.json`, `toys.json`; Modify `client/src/content/topics.ts` (append colors 🎨 Màu sắc, body 🧍 Cơ thể, toys 🧸 Đồ chơi in that order), `client/src/content/words/types.ts` (`WordTopic` union += the three), wherever decks are registered (mirror how weather/animals were added), `client/src/content/sentences.json` (append s21–s32 verbatim from spec §3), tests (`topics.test.ts`, `words.test.ts`, `sentences.test.ts`, `content.test.ts`).
- Values verbatim from spec §3 (word/ipa/emoji/vi, sentence text/vi/topic). Deck JSON shape and id convention copied from `words/food.json`; every word needs an `example` sentence in the same style as the existing decks (author them, short and A1).
- Tests: 8 topics in order; 8 words per new deck, unique ids, audio paths; 32 sentences with 4 per new topic; child-voice check still passes. Do NOT run audio generators (controller does).
- Commit `feat(content): colors, body and toys topics`.

### Task 2: Sound practice by word
**Files:** Create `client/src/screens/SoundWordList.tsx` (+test); Modify `client/src/screens/SoundPractice.tsx` (+test) to practise ONE card, `client/src/App.tsx` (`/sound/:ph` → SoundWordList, `/sound/:ph/:cardId` → SoundPractice), `client/src/progress/store.ts` if a helper is warranted, `client/src/screens/SoundLevel.tsx` (+test) and `client/src/screens/LevelStairs.tsx` (+test) for the derived sound stars.
**Interfaces (produces):** `sword:<cardId>` per-word stars; a helper (e.g. `soundStars(ph)` in `content/sounds.ts` or `progress/store.ts` — implementer picks, document it) returning `max(min(word stars), legacy sound:<ph>)`, consumed by SoundLevel, SoundWordList and LevelStairs.
- SoundWordList per spec §1 (header + one card per word with its own stars, links to `/sound/:ph/:cardId`, back → `/levels`).
- SoundPractice: single card; keep the two-row grid, mission chip/back/next via `useMissionNext`, mouth card, SoundChip, `Từ n/N` chip now meaning "word n of this sound" for free-play context; result stores `sword:<cardId>` and logs `speak` with `card.id` (unchanged); free-play "Tiếp theo →" walks the sound's words, last → `/sound/:ph`.
- Tests: list renders every word with stars and hrefs; practice scores one word and stores `sword:`; derived sound stars = min, legacy floor honoured; stairs/level tiles read the derived value; mission mode still shows its chip and follows `nextRoute`.
- Commit `feat(sound): drill one word at a time`.

### Task 3: Cross-topic lesson generation + sentence group
**Files:** Modify `client/src/progress/lesson.ts` (+test), `client/src/progress/lessonStore.ts` (+test) for the new kind, `client/src/progress/missionNav.ts` (+test) if the group table needs the new kind, `client/src/screens/DailyMission.tsx` (+test) for the 🧱 group card.
- `LessonItemKind` += `'sentence'`; recipe table from spec §2; speak sound items become `/sound/<ph>/<cardId>` picking the sound's lowest-starred word (ties seeded); word + sentence pools drawn across ALL unlocked topics with mixing rules 1–3; `currentTopic()` dropped from generation.
- DailyMission group card: title "N câu ghép", emoji 🧱, tone neutral, chip "≈ N phút"; group order follows lesson order (listen, speak, word, sentence, review). No topic subtitle anywhere.
- Backward compatibility: a persisted lesson from an earlier day (old kinds, `/sound/<ph>` routes) must still render and match — keep `matchIds` handling for a bare `<ph>` id.
- Tests: recipe counts per length; a lesson with 4 unlocked topics touches ≥2 topics in its content items; the day-rotation changes the leading topic across two days; two consecutive days touch every unlocked topic; sentence items route/activity/done-matching; sound speak item is a word route; old stored lesson still works.
- Commit `feat(lesson): mix every unlocked topic and add sentence steps`.

### Task 4: Eight-island map, unlock rule, island role
**Files:** Modify `client/src/screens/Home.tsx` (+test), `client/src/progress/topicProgress.ts` (+test), `client/src/screens/TopicHub.tsx` (+test).
- `topicUnlocked`: the first FOUR topics are always open; later topics need the previous deck ≥ 6/8; migration exception unchanged.
- Home: eight island slots in a two-row serpentine inside the existing band, islands 96 px (`lg` 112 px), trail redrawn through the eight centres; subtitle "Luyện thêm" under each island name; locked tile unchanged. Verify with DOM geometry at 1194×834 (`pnpm --filter client exec vite --mode nossl --port 5174`, stop after): no overlap between islands or with the mission card/stairs/parent controls, all eight inside the frame, no page scroll; report the measured boxes.
- TopicHub: each section that contains an item of today's lesson (compare against `lessonStatus().items` routes — words `/words/<topic>/<id>`, sentences `/sentence/<id>`, stories `/story/<id>`) shows a `Chip tone="teal" size="sm"` "Có trong nhiệm vụ hôm nay".
- Tests: 8 islands with hrefs in order; first four unlocked on a fresh profile; fifth locked until the fourth deck hits 6/8; migration case; hub chips appear only for sections in today's lesson.
- Commit `feat(map): eight islands and the free-practice role`.

### Task 5: Audio, docs, status
- Controller (not the implementer) runs `gen-audio.mjs` for the 24 new words → `client/public/audio/words/`, `gen-sentences.mjs` for s21–s32, and commits the mp3s.
- Implementer: README Phase 9 section (per-word sound drill, mixing rules + new recipe table, eight islands + unlock, island role chips) + iPad checklist rows; spec status line; brief §2.5 note.
- Commit `docs: phase 9 per-word sounds and mixed lessons`.

## Self-Review
Spec §1 → T2; §2 → T3 (consumes T2's word routes); §3 content → T1, map/unlock → T4; §4 → T4. T3 depends on T2's `/sound/:ph/:cardId` route existing and on T1's topics; T4 depends on T1's topic list and T3's lesson items (hub chips). Order T1 → T2 → T3 → T4 → T5; T1 and T2 touch disjoint files and may run in parallel.
