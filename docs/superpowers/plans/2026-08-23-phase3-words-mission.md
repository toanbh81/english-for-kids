# Phase 3 — Words, Sentence Builder, Mission/Foxy, Parent Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily-habit layer (mission, streak, Foxy), vocabulary with say-to-unlock + Leitner review, tap-to-build sentences with spoken check, and a parent dashboard with time, weak sounds and recordings.

**Architecture:** New `progress/` stores (activity log, Leitner, IndexedDB recordings) feed Home/Parent; `useSpeakingAttempt` gets an `onResult` callback so every scored attempt is logged in one place; content JSON + generated Azure audio as in Phases 1–2; new screens wired into the existing router; a `Foxy` component shared across screens.

**Tech Stack:** unchanged (Vite 8, React 19, TS strict, Tailwind 3, vitest/jsdom, react-router 7). No new runtime deps except none — IndexedDB via the raw API; use `fake-indexeddb` (devDependency) for tests.

**Spec:** `docs/superpowers/specs/2026-08-23-phase3-words-mission-design.md` (authority).

## Global Constraints
- Branch `phase3-words-mission`. Commit per task; secret-leak hooks must pass; never `--no-verify`.
- Tap targets ≥ 64×64 px; Vietnamese UI copy; en-US content; palette tokens cream/coral/teal/star/good/ok/fix.
- Unlock threshold **60**; Leitner intervals **1/3/7/14 days** for boxes 1→4; mission = `story ≥1`, `speak ≥5`, `word ≥3` events today; streak = consecutive completed days ending today or yesterday.
- Activity log key `speakup.activity` (cap 2000), Leitner key `speakup.leitner`, limit key `speakup.limit.minutes` (default 20), IndexedDB db `speakup-recordings` store `recordings` (cap 20 FIFO).
- All of `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` green before each commit; no act() warnings.

---

## File Structure
```
client/src/progress/activity.ts (+test)        log + mission/streak/minutes/weak-phoneme queries
client/src/progress/leitner.ts (+test)         spaced repetition boxes
client/src/progress/recordings.ts (+test)      IndexedDB blobs (fake-indexeddb in tests)
client/src/speaking/useSpeakingAttempt.ts      add onResult(result, blob) option (+test)
client/src/components/Foxy.tsx (+test)         mascot with 5 moods
client/src/components/MissionCard.tsx, StreakWeek.tsx (+test)
client/src/content/words/{food,school,family}.json, index.ts, types.ts (+test)
client/src/content/sentences.json (+ in index.ts) (+test)
client/src/screens/Home.tsx                    mission, streak, Foxy, limit banner, new cards
client/src/screens/WordTopics.tsx, WordList.tsx, WordCard.tsx (+tests)
client/src/screens/SentenceList.tsx, SentenceBuilder.tsx (+tests)
client/src/screens/ParentGate.tsx, ParentDashboard.tsx (+tests)
client/src/App.tsx                             routes
scripts/gen-sentences.mjs                      Emma HD audio for sentences (+ words via gen-audio.mjs)
README.md                                      Phase 3 section + iPad rows
```

---

### Task 1: Activity log + Leitner + recordings stores

**Files:** Create `client/src/progress/activity.ts`, `activity.test.ts`, `leitner.ts`, `leitner.test.ts`, `recordings.ts`, `recordings.test.ts`; add devDependency `fake-indexeddb`.

**Interfaces — Produces:**
```ts
// activity.ts
export type ActivityKind = 'story' | 'speak' | 'word' | 'sentence'
export type ActivityEvent = { ts: number; kind: ActivityKind; id: string; score?: number; phonemes?: { phoneme: string; score: number }[] }
export function logActivity(e: ActivityEvent): void                    // appends, caps at 2000 (drop oldest)
export function getActivity(sinceTs = 0): ActivityEvent[]
export function dayKey(ts: number): string                               // local 'YYYY-MM-DD'
export function missionStatus(now = Date.now()): { story: number; speak: number; word: number; done: boolean }   // counts today; done when story≥1 && speak≥5 && word≥3
export function completedDays(): Set<string>                              // day keys where mission done
export function streak(now = Date.now()): number                          // consecutive completed days ending today or yesterday
export function weekDots(now = Date.now()): { day: string; done: boolean; isToday: boolean }[]   // Mon..Sun of the current week
export function minutesPerDay(days: number, now = Date.now()): { day: string; minutes: number }[] // session = events ≤10 min apart; minutes = Σ(session span, min 1 min per session)
export function minutesToday(now = Date.now()): number
export function weakPhonemes(n = 5): { phoneme: string; avg: number; count: number }[]   // from events' phonemes, lowest avg first, count ≥ 2
export function averageScoreByKind(): Record<ActivityKind, number | null>
// leitner.ts
export type LeitnerEntry = { box: 1 | 2 | 3 | 4; due: number }
export const INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 14 } as const
export function getBox(wordId: string): 0 | 1 | 2 | 3 | 4                // 0 = not unlocked
export function promote(wordId: string, now = Date.now()): LeitnerEntry     // 0→1, 1→2 … 4 stays 4; due = now + interval(newBox)
export function demote(wordId: string, now = Date.now()): LeitnerEntry      // → box 1, due = now + 1 day
export function dueWords(now = Date.now()): string[]                        // unlocked words with due ≤ now
export function unlockedCount(): number
// recordings.ts
export type Recording = { id: string; ts: number; text: string; blob: Blob }
export async function saveRecording(r: Recording): Promise<void>            // keep newest 20
export async function listRecordings(): Promise<Recording[]>                // newest first
```
- [ ] **Step 1: Failing tests** (vitest, jsdom; `import 'fake-indexeddb/auto'` at top of recordings.test.ts; `localStorage.clear()` in beforeEach; use fixed timestamps via `new Date('2026-08-23T10:00:00')`):
  - activity: logging 2001 events keeps 2000 newest; `missionStatus` counts only today and `done` flips at 1/5/3; `streak` = 3 for three consecutive completed days ending today, = 0 if yesterday missing; `weekDots` returns 7 entries Mon–Sun with `isToday` once; `minutesPerDay(14)` returns 14 entries and two events 4 min apart → 4 min, events 30 min apart → 2 sessions of 1 min each; `weakPhonemes` averages across events and ignores phonemes with count < 2; `minutesToday`.
  - leitner: `getBox` 0 initially; promote chain 0→1→2→3→4→4 with due = now + 1/3/7/14 days; demote → 1 with due now+1d; `dueWords` lists only due ones.
  - recordings: save 21 → list returns 20 newest first with blobs intact.
- [ ] **Step 2: Run → fail. Step 3: Implement** with try/catch around storage reads (same pattern as store.ts). Dates: compute `dayKey` with local time (`getFullYear/getMonth/getDate`).
- [ ] **Step 4: Green, lint, typecheck. Commit** `feat(progress): activity log, Leitner boxes and IndexedDB recordings`.

---

### Task 2: `useSpeakingAttempt.onResult` + Foxy + Mission/Streak components

**Files:** Modify `client/src/speaking/useSpeakingAttempt.ts` (+test); Create `client/src/components/Foxy.tsx`, `MissionCard.tsx`, `StreakWeek.tsx`, `habit-components.test.tsx`.

**Interfaces — Produces:**
```ts
useSpeakingAttempt(opts: { targetText; autoStopMs?; resetKey?; onResult?: (result: PronunciationResult, blob: Blob | null) => void })
// called once per scored result (after setResult), with the recorded blob (null for Web Speech)
<Foxy mood="idle"|"listening"|"happy"|"cheer"|"surprised" size?: 'sm'|'md'|'lg' say?: string />
// emoji face per mood: idle 🦊, listening 🦊👂, happy 🦊😊, cheer 🦊🎉, surprised 🦊😮 — rendered as a rounded badge with optional speech bubble `say`; data-testid="foxy" data-mood
<MissionCard status={{story,speak,word,done}} />   // 3 rows with ✓/counts (🎧 1 truyện 0/1, 🗣️ 5 thẻ 2/5, 🧩 3 từ 0/3), each a Link (/stories, /level/sound-zoo, /words), done → "Hoàn thành! 🎉"
<StreakWeek dots={weekDots()} streak={n} />        // 7 circles T2..CN (★ done / ○), "🔥 N ngày"
```
- [ ] Tests: `onResult` invoked once with the mocked result and blob (reuse the PracticeCard test mocks); Foxy renders `data-mood` and bubble text; MissionCard shows counts and "Hoàn thành! 🎉" when done; StreakWeek shows 7 dots with today marked and the streak text.
- [ ] Implement; existing 133 tests stay green. Commit `feat(habit): onResult hook callback, Foxy mascot, mission and streak components`.

---

### Task 3: Words content + audio script + Leitner screens

**Files:** Create `client/src/content/words/types.ts`, `food.json`, `school.json`, `family.json`, `index.ts`, `words.test.ts`; screens `WordTopics.tsx`, `WordList.tsx`, `WordCard.tsx` (+tests); Modify `App.tsx` (routes `/words`, `/words/:topic`, `/words/:topic/:wordId`), `README.md` (generator line).

Content (id = `<topic>-<word>`, audio `/audio/words/<word>.mp3`):
- food 🍎: apple /ˈæpəl/ 🍎 "quả táo" "I eat an apple."; banana /bəˈnænə/ 🍌; bread /bred/ 🍞; milk /mɪlk/ 🥛; egg /eɡ/ 🥚; rice /raɪs/ 🍚; water /ˈwɔːtər/ 💧; cake /keɪk/ 🎂 — each with `vi` and a 3–5 word example.
- school 🏫: book /bʊk/ 📖; pen /pen/ 🖊️; teacher /ˈtiːtʃər/ 👩‍🏫; desk /desk/ 🪑; bag /bæɡ/ 🎒; friend /frend/ 🧑‍🤝‍🧑; ruler /ˈruːlər/ 📏; clock /klɒk/ ⏰.
- family 👨‍👩‍👧: mother /ˈmʌðər/ 👩; father /ˈfɑːðər/ 👨; sister /ˈsɪstər/ 👧; brother /ˈbrʌðər/ 👦; baby /ˈbeɪbi/ 👶; grandma /ˈɡrænmɑː/ 👵; grandpa /ˈɡrænpɑː/ 👴; home /hoʊm/ 🏠.

Screens:
- `WordTopics` `/words`: 3 topic cards (emoji, title, "x/8 đã mở khoá") + "📚 Ôn tập hôm nay (N)" card → `/words/review` (a virtual topic listing `dueWords()`); back "← Về nhà".
- `WordList` `/words/:topic`: grid of cards (emoji, word, 🔓/🔒 by `getBox`); `review` topic lists due words across topics.
- `WordCard` `/words/:topic/:wordId`: flip card (tap to flip: front emoji+word+IPA, back vi+example), 🔊 sample (`playUrl` with the audio-missing notice), Foxy listening while recording, MicButton via `useSpeakingAttempt({ targetText: word, onResult })`; on result: overall ≥ 60 → `promote(id)` + "🔓 Mở khoá!" + Foxy cheer, else `demote(id)` if already unlocked (review) and "Thử lại nhé" with `toFeedback` hint; always `logActivity({ kind: 'word', id, score, phonemes })` and `saveRecording` when blob; "Tiếp theo →" to the next word in the list (or back to topic when last).
- [ ] Tests: content shape (24 words, unique ids, audio paths); WordCard with mocked `useSpeakingAttempt` result 70 → Leitner box 1 + activity event + unlock text; result 40 on a box-2 word → box 1; flip toggles faces.
- [ ] `README.md`: `node scripts/gen-audio.mjs apple banana bread milk egg rice water cake book pen teacher desk bag friend ruler clock mother father sister brother baby grandma grandpa home` writes to `client/public/audio/words/` — modify `scripts/gen-audio.mjs` to accept `--out client/public/audio/words` (default stays `client/public/audio`) and voice `--voice` (default JennyNeural for single words — clear, neutral).
- [ ] Commit `feat(words): vocabulary topics, flashcards with say-to-unlock and Leitner review`.

---

### Task 4: Sentence Builder

**Files:** Create `client/src/content/sentences.json`, add to `client/src/content/index.ts` (`SENTENCES`, `findSentence`), `client/src/content/sentences.test.ts`; screens `SentenceList.tsx`, `SentenceBuilder.tsx` (+tests); `scripts/gen-sentences.mjs`; Modify `App.tsx` (routes `/sentences`, `/sentence/:id`), `README.md`.

Content: 12 sentences (`id s1..s12`, topic food/school/family, `words` split, `vi`, audio `/audio/sentences/<id>.mp3`): "I eat an apple.", "Milk is white.", "I like bread and eggs.", "Water is good for me.", "This is my book.", "My teacher is kind.", "I have a red pen.", "My bag is big.", "This is my mother.", "My father is tall.", "I love my family.", "My sister has a baby doll." (keep words tiles = `words` array incl. punctuation on the last tile).

Behaviour: tiles shuffled (seeded by id so tests are deterministic: Fisher–Yates with a mulberry32 seed from the id; ensure shuffled ≠ original or rotate by 1); tap a tile → appends to tray; tap a tray tile → returns it; when tray full: compare; wrong → tray `animate-shake` class for 500 ms + Foxy "Thử lại nhé" and tiles return; correct → Foxy "Đúng rồi!" + auto 🔊 (`playUrl(audio)`; missing → notice) + mic step: `useSpeakingAttempt({ targetText: sentence, onResult })` → `toFeedback` stars + message + hint, `setStars('sentence:<id>')`, `logActivity({ kind: 'sentence' })`, `saveRecording`; "Tiếp theo →" to next sentence.
- [ ] Tests: deterministic shuffle; tap order builds the tray; wrong order shows "Thử lại nhé" and resets; correct order reveals the mic; result 85 → 3 stars + `sentence:s1` = 3 + activity event.
- [ ] `scripts/gen-sentences.mjs`: like gen-story (Emma HD, rate -10%, plain text, no timings needed) writing `client/public/audio/sentences/<id>.mp3`; usage error without env.
- [ ] Commit `feat(sentences): tap-to-build sentence builder with spoken check`.

---

### Task 5: Home with mission, streak, Foxy, limit banner; wire logging into Phase 1–2 screens

**Files:** Modify `client/src/screens/Home.tsx` (+`Home.test.tsx`), `PracticeCard.tsx`, `StoryQuiz.tsx`, `StoryRetell.tsx`.

- Home: Foxy greeting (mood: `done` → cheer, any progress → happy, else idle; `say` = "Chào bé! Hôm nay mình học gì nào?" / "Giỏi lắm, tiếp tục nhé!" / "Hoàn thành nhiệm vụ rồi! 🎉"), `MissionCard`, `StreakWeek`, total stars, module cards: 🎧 Nghe kể chuyện, 🗣️ Sound Zoo / Word Pop, 🧩 Từ vựng (`/words`), 🧱 Ghép câu (`/sentences`), small "👨‍👩‍👧 Phụ huynh" link (`/parent`, bottom-right, 64 px); when `minutesToday() ≥ limit` show banner "Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!" (non-blocking).
- Logging: PracticeCard passes `onResult` → `logActivity({ kind: 'speak', id: card.id, score, phonemes: result.words.flatMap(w => w.phonemes) })` + `saveRecording`; StoryQuiz on finish → `logActivity({ kind: 'story', id })`; StoryRetell `onResult` → `logActivity({ kind: 'sentence', id: 'retell:'+id, score })`.
- Foxy in PracticeCard/Retell: mood listening while recording, happy/cheer on 2/3 stars.
- [ ] Tests: Home shows mission counts from seeded activity, streak text, banner when over limit; PracticeCard test asserts an activity event after scoring (extend existing test file).
- [ ] Commit `feat(home): daily mission, streak, Foxy and time-limit banner; log activity from all modules`.

---

### Task 6: Parent gate + dashboard

**Files:** Create `client/src/screens/ParentGate.tsx`, `ParentDashboard.tsx`, `ParentDashboard.test.tsx`; Modify `App.tsx` (`/parent`).

- Gate: question `a × b = ?` with a,b ∈ 3..9 (seeded from `Date.now()` at mount; tests stub `Math.random`), numeric input (inputMode numeric, 64 px), wrong → "Chưa đúng" and new question; right → `sessionStorage['speakup.parent'] = '1'` and render dashboard (skip gate if already set).
- Dashboard (adult style, text-base, slate): "Phút luyện / ngày (14 ngày)" bar chart in pure divs (height ∝ minutes, label per day, max scaled), "Điểm trung bình" per kind (speak/word/sentence) from `averageScoreByKind`, "Âm hay sai" list from `weakPhonemes(5)` with the `PHONEME_TIPS` text, "Bản ghi gần đây" list (date, text, score if any) with ▶ buttons playing `listRecordings()` blobs via `playBlob`, "Giới hạn mỗi ngày" number input (5–60, step 5) saved to `speakup.limit.minutes`, "Đặt lại tiến trình" button with confirm dialog (clears stars/activity/leitner/recordings). Back link "← Về nhà".
- [ ] Tests: gate accepts the right product and rejects wrong; dashboard with seeded activity renders 14 bars, the weakest phoneme first, and a recording row (fake-indexeddb) whose ▶ calls `playBlob`; limit input persists.
- [ ] Commit `feat(parent): math-gated parent dashboard with time chart, weak sounds, recordings and daily limit`.

---

### Task 7: Audio generation + docs + status

- [ ] Run (with the Azure env from `server/.env`): `node scripts/gen-audio.mjs --out client/public/audio/words <24 words>` and `node scripts/gen-sentences.mjs` — audio is git-ignored; verify files exist; note in the report (no JSON changes needed since no timings).
- [ ] README: Phase 3 section (what/where), generator commands, iPad checklist rows (say-to-unlock flow, review deck after a day, sentence builder tap/undo, mission completes + confetti, streak after two days, parent gate + recordings playback, limit banner). Spec status line; brief §2.5 note "Phase 3 implemented <date>".
- [ ] Full gates; commit `docs: phase 3 README, audio generation and status`.

## Self-Review
Spec coverage: Words (content/flashcard/unlock/Leitner/review) T1,T3; Sentence Builder T4; mission/streak/Foxy T1,T2,T5; activity logging all modules T5; Parent dashboard (chart, averages, weak phonemes, recordings, limit, reset) T1,T6; limit banner T5; audio + docs T7. Interfaces consistent: activity/leitner/recordings (T1) used by T3–T6; `onResult` (T2) used by T3–T5; Foxy (T2) used by T3–T5; `PHONEME_TIPS` from Phase 1 used by T6.
