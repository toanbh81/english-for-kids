# Phase 3 — Words, Sentence Builder, Daily Mission + Foxy, Parent Dashboard

Refines §2.2C, §2.2D, §2.3.5, §2.4 of `docs/2026-08-22-giai-phap-va-design-brief.md`. Phases 1–2 are merged on `main`.

## Goal
Turn the app into a daily habit: a fixed 3-step mission on Home with a weekly streak and the Foxy mascot reacting to progress; two new learning modules (vocabulary with say-to-unlock + spaced repetition, and spoken grammar via sentence building); and a parent view of practice time, stars and weak sounds.

## Scope
1. **Words (Từ vựng)** — 3 topics × 8 words (Food 🍎, School 🏫, Family 👨‍👩‍👧): flashcard (front: emoji + word + IPA, back: Vietnamese + example sentence), 🔊 sample, mic "Nói để mở khoá": overall ≥ 60 unlocks the word (🔒→🔓 animation) and schedules it for review. Spaced repetition = Leitner boxes 1→2→3→4 with intervals 1/3/7/14 days; a "Ôn tập hôm nay" deck lists due words (≥60 → next box, <60 → box 1). Sample audio generated with `scripts/gen-audio.mjs` (reused) for the 24 words; the existing 22 Speak Lab samples stay.
2. **Sentence Builder (Ghép câu)** — 12 sentences (4 per topic) shown as shuffled word tiles; the child **taps tiles in order** to fill the sentence tray (tap a placed tile to return it). Wrong order → tray shakes, Foxy hint "Thử lại nhé"; correct → 🔊 reads the sentence (pre-generated Emma HD mp3 via `scripts/gen-sentences.mjs`), then the mic step scores the child reading it (stars via `toFeedback`, hint allowed). Tap-to-place replaces drag-and-drop deliberately: more reliable on iPad for a 9-year-old; drag can be layered later.
3. **Daily mission + streak + Foxy** — Home shows "Nhiệm vụ hôm nay": 🎧 1 truyện (quiz finished) → 🗣️ 5 thẻ phát âm (scored attempts) → 🧩 3 từ mới (unlocked or reviewed). Progress from an **activity log** (`speakup.activity`, array of `{ ts, kind: 'story'|'speak'|'word'|'sentence', id, score? , ms? }`, capped at 2000 entries). Streak = consecutive days with the mission completed; Home shows the current week as 7 dots (★ done / ○ not) and "🔥 N ngày". Foxy (`<Foxy mood />`, emoji-based face with 5 moods: idle, listening, happy, cheer, surprised) appears on Home (greeting + mood from mission state), in PracticeCard/Retell/Words (listening while recording, happy/cheer on stars), in Sentence Builder hints. Completing the mission → confetti + Foxy cheer.
4. **Parent Dashboard** — route `/parent`, gated by a random single-digit multiplication question (e.g. "7 × 8 = ?"); shows: minutes practised per day for 14 days (bar chart, computed from activity log timestamps — sessions of events within 10 min), average pronunciation score per level/module, top 5 weak phonemes (from attempt results: lowest phoneme scores; requires storing phoneme scores in the log), recent attempts list (date, text, score) with playback of the last 20 recordings (Blobs in IndexedDB `speakup-recordings`, FIFO), and a daily time limit setting (`speakup.limit.minutes`, default 20) that shows a gentle "Hôm nay bé học đủ rồi 🦊" banner on Home when exceeded (not a hard block).

Out of scope: accounts/sync, AI illustrations, true drag-and-drop, push notifications.

## Data & storage
- `client/src/progress/activity.ts`: `logActivity(e)`, `getActivity(sinceTs?)`, `missionStatus(date)`, `streak(date)`, `minutesPerDay(days)`, `weakPhonemes(n)`.
- `client/src/progress/recordings.ts`: IndexedDB (`idb`-free, raw API) `saveRecording({ id, ts, text, blob })`, `listRecordings()`, cap 20.
- `client/src/progress/leitner.ts`: `getBox(wordId)`, `promote(wordId)`, `demote(wordId)`, `dueWords(today)`; storage `speakup.leitner` `{ [wordId]: { box, due } }`.
- Content: `client/src/content/words/{food,school,family}.json` (`WordCard = { id, word, ipa, emoji, vi, example, audio, topic }`), `client/src/content/sentences.json` (`SentenceItem = { id, topic, words: string[], vi, audio }`).
- `useSpeakingAttempt` gains an optional `onResult?(result, blob)` callback used to log activity + save recordings without duplicating logic in each screen.

## Rules
- Unlock threshold 60 (spec §2.2C). Mission counts: story = a quiz completion (`story` event), speak = 5 `speak` events, word = 3 `word` events (unlock or review). Streak day boundary: local midnight.
- Stars: Words — none (unlock is the reward); Sentence Builder — `toFeedback` stars stored `sentence:<id>`; Home total includes them.
- Tap targets ≥ 64 px; Vietnamese UI; en-US content; Azure key only server-side; secret hooks in force; tests/lint/typecheck/build green.

## Routes
`/words` (topics + review deck), `/words/:topic`, `/words/:topic/:wordId` (card), `/sentences`, `/sentence/:id`, `/parent`.
