# Phase 7 — Topic map & Daily lesson engine

Returns Home to the Claude Design intent (islands = topics with locks) and turns "Nhiệm vụ hôm nay" from three counters into a concrete, generated lesson that adapts to the child. Approved by the user 2026-08-24 (topic islands now, auto difficulty with parent override, ~12-minute lessons with a parent-adjustable length).

## 1. Topics

Canonical topic list, in unlock order:

| id | emoji | name (vi) | words | sentences | story |
|---|---|---|---|---|---|
| animals | 🐘 | Động vật | NEW `words/animals.json` | NEW s13–s16 | `at-the-zoo`, `little-fox` |
| food | 🍎 | Đồ ăn | existing | s1–s4 | `my-breakfast` |
| school | 🏫 | Trường học | existing | s5–s8 | — (Sắp có) |
| family | 👨‍👩‍👧 | Gia đình | existing | s9–s12 | — (Sắp có) |
| weather | ☀️ | Thời tiết | NEW `words/weather.json` | NEW s17–s20 | — (Sắp có) |

`client/src/content/topics.ts` exports `TOPICS: Topic[]` (`{ id, emoji, name, vi }` in the order above) and `findTopic(id)`. `Story` gains `topic: TopicId`; tag the three stories per the table. `WordTopic` union grows to `'animals' | 'food' | 'school' | 'family' | 'weather'`.

New words (mirror the exact JSON shape of `words/food.json`, audio `/audio/<word>.mp3`):
- animals: elephant 🐘 /ˈelɪfənt/ con voi; giraffe 🦒 /dʒəˈrɑːf/ hươu cao cổ; fish 🐟 /fɪʃ/ con cá; bird 🐦 /bɜːrd/ con chim; monkey 🐵 /ˈmʌŋki/ con khỉ; tiger 🐯 /ˈtaɪɡər/ con hổ; bear 🐻 /beər/ con gấu; duck 🦆 /dʌk/ con vịt.
- weather: sun ☀️ /sʌn/ mặt trời; rain 🌧️ /reɪn/ mưa; wind 💨 /wɪnd/ gió; cloud ☁️ /klaʊd/ mây; snow ❄️ /snoʊ/ tuyết; hot 🥵 /hɑːt/ nóng; cold 🥶 /koʊld/ lạnh; rainbow 🌈 /ˈreɪnboʊ/ cầu vồng.

New sentences appended to `sentences.json` (same shape; audio `/audio/sentences/<id>.mp3`; child voice "Con"):
- s13 animals: The elephant is big. — Con voi to lớn.
- s14 animals: I see a little bird. — Con thấy một chú chim nhỏ.
- s15 animals: The monkey can jump. — Chú khỉ biết nhảy.
- s16 animals: I like the funny duck. — Con thích chú vịt ngộ nghĩnh.
- s17 weather: The sun is yellow. — Mặt trời màu vàng.
- s18 weather: It is raining today. — Hôm nay trời mưa.
- s19 weather: I see a rainbow. — Con thấy cầu vồng.
- s20 weather: It is cold in winter. — Mùa đông trời lạnh.

Audio: controller runs the existing generators (`gen-audio.mjs` for the 16 words, `gen-sentences.mjs` for s13–s20) and commits the mp3s.

## 2. Home — topic map

The five islands become the five topics (same island visual language, trail, star rows, percentage layout as today). Order on the map follows the design: Animals, Food, School, Family, Weather.

- Island link → `/topic/:id`; locked islands render the existing locked-tile look (🔒, "Sắp có" chip replaced by "Chưa mở khóa") and are not links.
- **Unlock rule**: `animals` is always unlocked; a later topic unlocks when the previous topic has ≥ 6 of its 8 words unlocked (Leitner). **Migration exception**: a topic with any existing progress (any of its words unlocked, or any of its sentences with stars > 0) is unlocked regardless — the update must never take content away.
- **Island stars** (`0–3`): from that topic's word deck — 0 none unlocked, ≥1 → 1★, ≥6 → 2★, all 8 → 3★.
- The mission card, the "🗣️ Các bậc luyện nói" button and the "👨‍👩‍👧 Phụ huynh" link keep their Phase-6 placement. "Nghe kể chuyện" is no longer an island; `/stories` remains routable (reached from topic hubs and lesson items).

## 3. Topic hub — `/topic/:id`

Header: island emoji + name + StarRow (island stars). Three section cards (tap targets ≥ 64 px):
- 🧩 **Từ mới** → `/words/<id>` — shows `x/8 từ` from Leitner.
- 🧱 **Ghép câu** → `/sentences?topic=<id>` — `SentenceList` accepts an optional `?topic=` filter (no topic param = all, unchanged). Shows how many of the topic's sentences have stars.
- 🎧 **Truyện** → `/story/<storyId>` when the topic has stories (list them, with story stars); otherwise a muted "Sắp có 📖" card, not a link.
Unknown/locked topic id → "Chưa mở khóa" screen with a back link (children can deep-link via PWA history).

## 4. Daily lesson engine — `client/src/progress/lesson.ts`

Pure module, localStorage-backed, no server.

**Types**
```ts
type LessonItemKind = 'listen' | 'speak' | 'word' | 'review'
type LessonItem = { kind: LessonItemKind; activity: ActivityKind; id: string; route: string; label: string; emoji: string }
type Lesson = { day: string; created: number; band: number; items: LessonItem[] }
```

**`getLesson(now = Date.now()): Lesson`** — returns today's lesson, generating and persisting it (`speakup.lesson.<dayKey>`) on first call of the day. Generation is seeded with mulberry32 over `dayKey` (existing `shuffle.ts`), so a reload never changes the day's lesson. Old lesson records are pruned to the most recent 30 keys.

**Recipe** by length (`speakup.lesson.length`: `'short' | 'medium' | 'long'`, default `'medium'`):

| length | listen | speak | word | review | ≈ time |
|---|---|---|---|---|---|
| short | 1 | 2 | 2 | 1 | 8 ph |
| medium | 1 | 4 | 3 | 2 | 12 ph |
| long | 1 | 6 | 4 | 3 | 18 ph |

- **listen**: the story with the lowest `story:<id>` stars (ties → seeded pick). Route `/story/<id>`; done when a `story` activity event for that id lands after `created`.
- **speak** by band (see §5): the pool is the union of levels up to the band — band 1: sound cards (`/sound/<ph>`); band 2: + word-pop cards (`/practice/<id>`); band 3: + minimal pairs (`/pair/<id>`); band 4: + sentence stars (`/star/<id>`); band 5: + story voice (`/voice/<id>`). Half the speak slots (rounded up) draw from the band's newest level, the rest from lower levels, seeded. If the activity log's `weakPhonemes` (existing helper) names sounds scoring < 80, sound/word cards containing those phonemes are chosen first. Done = matching `speak` event with `score === undefined || score >= 60`.
- **word**: unlearned words from the **current topic** = the first unlocked topic (unlock order) whose deck has < 8 unlocked words; if every unlocked deck is complete, seeded picks from any locked-topic deck are allowed (random new words, per the user's request). Route `/words/<topic>/<wordId>`; done = `word` event, score rule as above.
- **review**: due Leitner words first (existing `dueWords`), then the previously attempted item (any kind) with the lowest stars > 0 store key, mapped back to its route. Fewer due items than slots → fill from lowest-star items; nothing attempted yet → fill with extra new words. Done rule follows the item's activity kind.

**`lessonStatus(now, events): { items: (LessonItem & { done: boolean })[]; doneCount: number; total: number; done: boolean }`** — done-matching as above, evaluated against the activity log (single read, passed in like `missionStatus`).

**Mission compatibility**: `missionStatus`/`completedDays`/`streak`/`weekDots` treat a day as done when **either** the legacy counter rule holds (story ≥ 1, speak ≥ 5, word ≥ 3) **or** that day's persisted lesson is complete. History earned before Phase 7 keeps its streak.

Home's MissionCard shows `doneCount/total` of the lesson; the celebration flow (`/mission/done`) fires on lesson completion exactly as it did on counter completion.

## 5. Difficulty band — `client/src/progress/band.ts`

`speakup.band` stores `{ value: 1|2|3|4|5, mode: 'auto' | 'manual' }`.

- **Init** (first read, nothing stored): 5 if any `voice:*` stars > 0; else 4 if any `sstar:*`; else 3 if any `pair:*`; else 2 if any word-pop card stars; else 1.
- **Auto adjust** (evaluated once per day at lesson generation, only in `auto` mode): +1 after 3 consecutive completed days with day-average score ≥ 80 (mean of scored events that day); −1 after 2 consecutive days that were started (any event) but not completed, or completed with average < 60. Clamp 1–5. The adjustment history needs no extra store — it derives from lesson records + the activity log.
- **Manual**: parent sets `value`, `mode: 'manual'`; auto adjustments stop until the parent re-enables auto.

## 6. Daily Mission screen — rewrite

`/mission` lists today's lesson items in order: emoji + label (e.g. "🗣️ Nói: The cat is under the table.") + ✓ when done; the first undone item gets the teal ring and the CTA links **directly to that item's route**. Header shows band as a friendly chip ("Bậc ⭐ 3") and `doneCount/total`. All items done → existing celebration handoff.

## 7. Parent Dashboard additions

New "Bài học" card:
- **Độ khó**: current band 1–5 as five buttons, "Tự động" toggle (mode). Manual selection sets manual mode; toggling auto back on resumes auto from the current value.
- **Thời lượng**: three chips Ngắn ~8ph / Vừa ~12ph / Dài ~18ph → `speakup.lesson.length`.
Adult-neutral styling consistent with the existing dashboard.

## 8. Speak Lab

Unchanged — it remains the skill-level library (5 bậc). Topic browsing is the map's job; no topic filter is added to the stairs.

## Rules

Tap targets ≥ 64 px; mic ≥ 120 px; Vietnamese child copy ("Con"); en-US; UI kit/tokens; outer/inner hook pattern; tests/lint/typecheck/build green, no act() warnings; audio committed; secret hooks unconditional. Deterministic day generation: no `Math.random()`; everything seeded off `dayKey`.
