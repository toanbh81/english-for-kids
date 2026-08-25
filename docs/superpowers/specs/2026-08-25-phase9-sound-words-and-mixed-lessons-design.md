# Phase 9 — Per-word sound practice, cross-topic lessons, eight islands

Approved by the user 2026-08-25. Three asks, in their words: a pronunciation card in the daily mission should be **one representative word**, not the sound's whole 3-word run, while Speak Lab lets the child drill each word of a sound separately; the daily mission and the topic islands must be **separate axes** — the mission mixes content from every unlocked topic so the child is not stuck on one theme; and the map gets **three more topics**, with several islands open from the start, so there is enough content to mix.

## 1. Sound practice by word

- `/sound/:ph` becomes a **word list** (a sub-level): the sound's header (IPA 72 px, `PHONEME_TIPS[ph]`, 🔊 Nghe âm lẻ) then one card per word of that sound (emoji, word, IPA, its own StarRow), each linking to `/sound/:ph/:cardId`. Back → `/levels`.
- `/sound/:ph/:cardId` is the practice screen: exactly today's SoundPractice UI (two-row grid, mouth card, mic, SoundChip result) but for **one** word. Its result stores that word's stars and offers "Tiếp theo →" to the next word of the sound in free play (last word → the word list).
- **Stars**: per word under `sword:<cardId>`; the sound's own key `sound:<ph>` becomes the **minimum** across its words (0 while any word is unpractised), so the tile and the stairs keep meaning "all three words are green". A legacy `sound:<ph>` value earned by the old 3-word run stays as a floor (`max(derived, legacy)`) — progress is never taken away.
- Star rule per word (unchanged in spirit): target-phoneme score ≥ 80 → 3★, ≥ 60 → 2★, else 1★; a word the engine never scored the phoneme in caps at 2★.
- The old whole-run route (`/sound/:ph` as a 3-word sequence) is gone; nothing else links to it.

## 2. The daily mission mixes topics

The mission and the islands are **separate axes**: an island is one topic's library, the mission is today's lesson drawn across every unlocked topic.

| Item | Source |
|---|---|
| 🎧 Nghe | The story with the fewest stars, across all stories (unchanged) |
| 🗣️ Phát âm | Speak Lab pool by band, weak-phoneme first (unchanged) — a sound item is now **one word**: `/sound/<ph>/<cardId>`, preferring the sound's lowest-starred word |
| 🧩 Từ mới | Unlearned words from **any unlocked topic** |
| 🧱 Ghép câu (**new group**) | Sentences with no stars from **any unlocked topic** |
| 🔁 Ôn tập | Due Leitner words + lowest-starred attempted items (unchanged) |

Mixing rules (all seeded by `dayKey`, so a day's lesson stays frozen):
1. **Spread within the day** — when ≥2 topics are unlocked, the day's content items (words + sentences) must touch at least 2 different topics while content allows; consecutive word slots prefer different topics.
2. **Rotate by day** — the topic priority order is shuffled per day, so the topic that leads today trails tomorrow.
3. **No island left behind** — across any two consecutive days every unlocked topic must be touched at least once when slots allow; within a day, ties break toward the topic with the fewest learned words, so the unlock frontier keeps advancing.
4. `currentTopic()` no longer feeds lesson generation; it remains only for topic-unlock bookkeeping.

Recipe (rebalanced because a speak item is now one word, not three):

| length | 🎧 | 🗣️ | 🧩 | 🧱 | 🔁 | total | ≈ |
|---|---|---|---|---|---|---|---|
| short | 1 | 2 | 2 | 1 | 1 | 7 | 8 ph |
| medium | 1 | 4 | 3 | 1 | 2 | 11 | 12 ph |
| long | 1 | 6 | 4 | 2 | 3 | 16 | 18 ph |

`LessonItemKind` gains `'sentence'`; the Daily Mission renders its group as "🧱 N câu ghép" (tone teal-ish `neutral`), placed after 🧩 in lesson order. Sentence items route to `/sentence/<id>`, activity kind `sentence`, done at score ≥ 60 or unscored — matching what `SentenceBuilder` logs. **No subtitle naming the topics** appears on the mission screen (explicitly not wanted).

## 3. Three new topics — eight islands

New topics appended to `TOPICS` in unlock order: **colors 🎨 Màu sắc**, **body 🧍 Cơ thể**, **toys 🧸 Đồ chơi**. Final order: animals, food, school, family, weather, colors, body, toys.

Decks (`words/<topic>.json`, same shape/convention as `words/food.json`, audio `/audio/words/<word>.mp3`):
- colors: red 🔴 /red/ màu đỏ; blue 🔵 /bluː/ màu xanh dương; yellow 🟡 /ˈjeloʊ/ màu vàng; green 🟢 /ɡriːn/ màu xanh lá; black ⚫ /blæk/ màu đen; white ⚪ /waɪt/ màu trắng; pink 🌸 /pɪŋk/ màu hồng; orange 🟠 /ˈɔːrɪndʒ/ màu cam.
- body: hand ✋ /hænd/ bàn tay; eye 👁️ /aɪ/ mắt; ear 👂 /ɪr/ tai; nose 👃 /noʊz/ mũi; mouth 👄 /maʊθ/ miệng; foot 🦶 /fʊt/ bàn chân; hair 💇 /her/ tóc; arm 💪 /ɑːrm/ cánh tay.
- toys: ball ⚽ /bɔːl/ quả bóng; doll 🪆 /dɑːl/ búp bê; kite 🪁 /kaɪt/ con diều; car 🚗 /kɑːr/ ô tô; robot 🤖 /ˈroʊbɑːt/ rô bốt; drum 🥁 /drʌm/ cái trống; puzzle 🧩 /ˈpʌzl/ trò ghép hình; balloon 🎈 /bəˈluːn/ bóng bay.

New sentences appended to `sentences.json` (child voice, audio `/audio/sentences/<id>.mp3`):
- s21 colors: The sky is blue. — Bầu trời màu xanh.
- s22 colors: I like the red car. — Con thích chiếc ô tô đỏ.
- s23 colors: My bag is yellow. — Cặp của con màu vàng.
- s24 colors: The grass is green. — Cỏ màu xanh lá.
- s25 body: I have two hands. — Con có hai bàn tay.
- s26 body: My eyes are big. — Mắt của con to.
- s27 body: I wash my hands. — Con rửa tay.
- s28 body: I hear with my ears. — Con nghe bằng tai.
- s29 toys: I play with my ball. — Con chơi với quả bóng.
- s30 toys: My doll is small. — Búp bê của con nhỏ.
- s31 toys: The kite is in the sky. — Con diều ở trên trời.
- s32 toys: I like my toy car. — Con thích ô tô đồ chơi của con.

**Unlock**: the first **four** topics (animals, food, school, family) are open from the start; each later topic unlocks when the previous deck has ≥ 6/8 words unlocked. The migration exception stands: any topic with existing progress is open regardless.

**Map**: eight islands in a two-row serpentine inside the existing 1194×834 frame band, islands 96 px (`lg` 112 px) so all eight fit without overlap; the dotted trail is redrawn through the eight centres. Below `lg` the islands stay a 2-column grid. Locked islands keep the 🔒 "Chưa mở khóa" tile. Mission card, stairs button and parent link keep their places. The layout must be verified with DOM geometry at 1194×834: no overlap, every island fully inside the frame, tap targets ≥ 64 px, no page scroll.

## 4. Island role, made visible

- Island label gains the subtitle **"Luyện thêm"** under the topic name (the map is the free-choice library).
- The topic hub's three sections show real progress: `x/8 từ`, `x/4 câu`, and per-story stars (already there).
- Any hub section that contains an item of today's lesson shows a chip **"Có trong nhiệm vụ hôm nay"** (teal, `size="sm"`), so the relationship between the two axes is visible without merging them.

## 5. Rules

Tap ≥ 64 px; mic ≥ 120 px; Vietnamese child copy ("Con"); UI kit/tokens; outer/inner hook pattern; deterministic generation seeded by `dayKey` (no `Math.random`); free-play behavior unchanged where `state.mission` is absent; storage try/catch hygiene; audio committed; tests/lint/typecheck/build green, no act() warnings; secret hooks unconditional.
