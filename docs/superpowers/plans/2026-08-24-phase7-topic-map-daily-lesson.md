# Phase 7 — Topic map & Daily lesson engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home becomes the design's topic map (5 islands with locks), and the daily mission becomes a generated, band-adaptive lesson of concrete items.

**Architecture:** New pure modules `content/topics.ts`, `progress/band.ts`, `progress/topicProgress.ts`, `progress/lesson.ts` feed a rewritten Home, a new TopicHub screen, and a rewritten DailyMission. Existing scoring, stores, Leitner and Speak Lab are consumed, not changed.

**Spec:** `docs/superpowers/specs/2026-08-24-phase7-topic-map-daily-lesson-design.md` (authority).

## Global Constraints
- Branch `phase7-topic-lessons`. Commit per task; secret hooks; no `--no-verify`.
- Deterministic generation: mulberry32 over `dayKey` (existing `content/shuffle.ts`); no `Math.random()`.
- Storage keys exactly: `speakup.lesson.<dayKey>`, `speakup.lesson.length`, `speakup.band` — same try/catch hygiene as `progress/store.ts`.
- Reuse `useSpeakingAttempt`, UI kit, Foxy, tokens; outer/inner hook pattern; tap ≥ 64 px; Vietnamese child copy ("Con"); tests/lint/typecheck/build green; no act() warnings.
- Never remove unlocked content: the migration exception in spec §2 is binding.

---

### Task 1: Topics + new content
**Files:** Create `client/src/content/topics.ts`, `client/src/content/words/animals.json`, `client/src/content/words/weather.json`; Modify `client/src/content/types.ts` (Story gains `topic: TopicId`; `WordTopic` union += `'animals' | 'weather'`), `client/src/content/sentences.json` (append s13–s20 per spec §1, exact texts/vi), `client/src/content/stories/*.json` (tag `at-the-zoo`→animals, `little-fox`→animals, `my-breakfast`→food), `client/src/content/words/index.ts` (or wherever `words/*` are registered — mirror how food/school/family are exported), `client/src/content/index.ts`, `client/src/content/content.test.ts`.
**Interfaces (produces):** `type TopicId = 'animals'|'food'|'school'|'family'|'weather'`; `TOPICS: { id: TopicId; emoji: string; name: string }[]` in unlock order animals→food→school→family→weather (names: Động vật, Đồ ăn, Trường học, Gia đình, Thời tiết; emoji 🐘🍎🏫👨‍👩‍👧☀️); `findTopic(id: string): Topic | undefined`.
- New word JSONs mirror `words/food.json` shape exactly (ids `<topic>-<word>`if that is the existing convention — read food.json first and copy its convention); word/ipa/vi/emoji values verbatim from spec §1; audio `/audio/<word>.mp3`.
- Tests: 5 topics in order; 8 words per new topic with unique ids and audio paths; sentences count 20, s13–s16 topic animals, s17–s20 weather, every `vi` in child voice (extend the existing child-voice test); every story has a topic from TOPICS. Do not run audio generators (controller does).
- Commit `feat(content): topics, animal and weather decks, topic sentences and story tags`.

### Task 2: Band, topic progress and the lesson engine
**Files:** Create `client/src/progress/band.ts` (+test), `client/src/progress/topicProgress.ts` (+test), `client/src/progress/lesson.ts` (+test); Modify `client/src/progress/activity.ts` (+test).
**Interfaces (produces):**
- `band.ts`: `type Band = 1|2|3|4|5`; `getBand(): { value: Band; mode: 'auto'|'manual' }` (initialises per spec §5 from store keys on first read and persists); `setBandValue(v: Band): void` (sets mode manual); `setBandAuto(): void`; `autoAdjustBand(now: number, events: ActivityEvent[]): void` (spec §5 rules; no-op in manual mode; at most one step per call; derives history from lesson records + events).
- `topicProgress.ts`: `topicUnlocked(id: TopicId): boolean` (spec §2 rule + migration exception); `unlockedTopics(): TopicId[]`; `topicStars(id: TopicId): 0|1|2|3` (word-deck rule §2); `currentTopic(): TopicId` (first unlocked topic with an incomplete deck; all complete → last unlocked).
- `lesson.ts`: `LessonItem`/`Lesson` types verbatim from spec §4; `getLessonLength()`/`setLessonLength(l)`; `getLesson(now?): Lesson` (generates once per day, seeded, persists, prunes to 30, calls `autoAdjustBand` first); `lessonForDay(day: string): Lesson | null`; `lessonStatus(now?, events?): { items: (LessonItem & { done: boolean })[]; doneCount: number; total: number; done: boolean }`.
- `activity.ts`: `missionStatus` and `completedDays` gain the lesson OR (spec §4 Mission compatibility) — a day counts as done when the legacy counters hold **or** `lessonForDay(day)` exists and every item matches a completing event that day. Import direction: `activity.ts` must not import `lesson.ts` if that creates a cycle (lesson imports activity types) — pass lesson lookup in as an injected function or move the OR into a small `progress/dayDone.ts` consumed by both screens; the implementer picks the cycle-free wiring and documents it in the report.
- Item selection, done-matching, recipe table, review/word sourcing: spec §4 verbatim. Weak-phoneme priority uses the existing weak-phoneme query in `activity.ts` (read the file for its exact name).
- Tests (mock localStorage + fixed `now`): recipe counts for each length; same day twice → identical lesson; band gates the speak pool (band 1 lesson contains no `/star/` or `/voice/` routes; band 5 contains at least one item from the newest level); weak phoneme steers card choice; word items come from `currentTopic()`; review prefers due Leitner words; `lessonStatus` marks done on a matching event (score 60) and not on score 50; legacy streak day still counts; lesson-complete day counts without legacy counters; band init from existing stars; auto up after 3 good days, down after 2 bad, manual freezes; prune keeps 30.
- Commit `feat(lesson): difficulty band, topic progress and the daily lesson engine`.

### Task 3: Topic map Home + TopicHub
**Files:** Create `client/src/screens/TopicHub.tsx` (+test); Modify `client/src/screens/Home.tsx` (+test), `client/src/screens/SentenceList.tsx` (+test) for `?topic=`, `client/src/App.tsx` (`/topic/:id`).
- Home: islands = TOPICS per spec §2 (same layout system, trail, star rows; locked tile per spec); island stars from `topicStars`; mission card shows `doneCount/total` from `lessonStatus` (label "Nhiệm vụ hôm nay", progress bar fraction = doneCount/total); stairs button, parent link, streak header, limit banner, celebration flow unchanged (celebration now keys off `lessonStatus().done`).
- TopicHub per spec §3, including the locked/unknown-id screen.
- SentenceList: `useSearchParams`; `?topic=<id>` filters `SENTENCES` by topic, header shows the topic name, no param = today's behaviour.
- Tests: 5 islands in order with `/topic/<id>` hrefs; a locked topic renders no link; migration case (a `family` word unlocked → family island is a link even though school deck < 6); island star bands; TopicHub sections and hrefs, "Sắp có 📖" when no story, locked screen; SentenceList filtered vs unfiltered; mission card fraction.
- Commit `feat(map): topic islands, topic hub and filtered sentences`.

### Task 4: Daily Mission rewrite
**Files:** Modify `client/src/screens/DailyMission.tsx` (+test), `client/src/components/MissionCard.tsx` (+test) if its props change.
- Per spec §6: list `lessonStatus().items` (emoji, label, ✓ / teal ring on first undone), CTA → that item's exact route; band chip "Bậc ⭐ n"; all done → existing completion CTA. Keep the one-read-per-mount pattern.
- Tests: renders every item of a seeded lesson in order; done ticks from seeded events; CTA href = first undone item's route; completed lesson shows the finish state; band chip text.
- Commit `feat(mission): the daily lesson as concrete steps`.

### Task 5: Parent dashboard — Bài học card
**Files:** Modify `client/src/screens/ParentDashboard.tsx` (+test).
- New card per spec §7: five band buttons (current highlighted; press → `setBandValue`, mode manual), "Tự động" toggle (`setBandAuto` / stays manual), three length chips wired to `get/setLessonLength`. Adult styling consistent with the dashboard's existing cards; controls ≥ 44 px (dashboard is the adult area — follow its existing control sizing).
- Tests: band button press persists value+manual; auto toggle restores auto; length chip persists; current settings render highlighted.
- Commit `feat(parent): band and lesson-length controls`.

### Task 6: Audio, docs, status
- Controller (not the implementer) runs: `node scripts/gen-audio.mjs` for the 16 new words → `client/public/audio/`, `node scripts/gen-sentences.mjs` for s13–s20 → `client/public/audio/sentences/`; commits mp3s.
- Implementer: README Phase 7 section (map, lesson recipe table, band rules, parent controls) + iPad checklist rows; spec status line; brief §2.5 note in `docs/2026-08-22-giai-phap-va-design-brief.md`.
- Commit `docs: phase 7 topic map and daily lessons`.

## Self-Review
Spec §1 → T1; §2/§3 → T3 (rules from T2); §4/§5 → T2 (+T4 UI); §6 → T4; §7 → T5; §8 → no-op. Interfaces named consistently (`topicStars`, `lessonStatus`, `getBand`) across T2 consumers T3–T5. Determinism constraint carried in Global Constraints; migration exception carried in T2 (rule) and T3 (test).
