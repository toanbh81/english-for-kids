# Phase 5 — Legible learning path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tập âm (by sound), Đọc từ (fluency streak), Học từ mới (meaning first + recall review) and the new Minimal Pairs level visibly different skills, with the existing scoring hook and stores.

**Architecture:** Content grows (27 sound cards, 8 pairs, isolated-sound samples); new screens `SoundLevel`, `SoundPractice`, `PairLevel`, `PairPractice`; `PracticeCard` gains the Word Pop streak; `WordCard` gains the meaning-guess step and recall mode. Everything reuses `useSpeakingAttempt`, `toFeedback`, `setStars`, `logActivity`, the Phase-4 UI kit.

**Spec:** `docs/superpowers/specs/2026-08-23-phase5-learning-path-design.md` (authority).

## Global Constraints
- Branch `phase5-learning-path`. Commit per task; secret hooks; no `--no-verify`.
- Thresholds: sound chip good ≥ 80 / ok ≥ 60 / fix; Tập âm 3★ when all 3 words' target phoneme ≥ 80; Word Pop 3★ = 2 consecutive ≥ 80, single attempt stars capped at 2; Words unlock ≥ 60 unchanged; Pairs mic stars via `toFeedback`.
- Store keys: `sound:<ph>`, `pair:<id>`, Word Pop cards keep `<cardId>`. Activity kind `speak` for Tập âm/Đọc từ/Pairs attempts (score = overall, phonemes = weak ones).
- Tap targets ≥ 64 px; mic ≥ 120 px; Vietnamese copy; UI kit + tokens; tests/lint/typecheck/build green; no act() warnings.

---

### Task 1: Content — sound cards, pairs, generators
**Files:** Modify `client/src/content/types.ts` (`Level.id` union adds `'minimal-pairs'`; add `SoundGroup`, `PairItem`), `client/src/content/sound-zoo.json` (27 cards per spec with authored IPA, `targetPhoneme`), Create `client/src/content/minimal-pairs.json` (8 pairs), `client/src/content/sounds.ts` (`SOUNDS: { ph, ipa, example, cards }[]` derived from sound-zoo cards, order th dh v f z sh ch r l; `findSound(ph)`), extend `client/src/content/index.ts` (`PAIRS`, `findPair`, `LEVELS` unchanged ids), `client/src/content/content.test.ts` (27 cards / 9 sounds × 3, unique ids, audio paths, 8 pairs with distinct words + audio); Modify `scripts/gen-audio.mjs` to accept `--phoneme <ipa>` mode? Simpler: Create `scripts/gen-sounds.mjs` that synthesizes each isolated sound via SSML `<phoneme alphabet="ipa" ph="…">` to `client/public/audio/sounds/<ph>.mp3` (Jenny, rate -20%); README lines. Do NOT run generators (controller runs them).
- IPA map for new words: think /θɪŋk/, that /ðæt/, mother /ˈmʌðər/, van /væn/, seven /ˈsevən/, fox /fɒks/, five /faɪv/, zip /zɪp/, zebra /ˈziːbrə/, shoe /ʃuː/, sheep /ʃiːp/, cheese /tʃiːz/, chicken /ˈtʃɪkɪn/, rabbit /ˈræbɪt/, run /rʌn/, leg /leɡ/, lamp /læmp/; emojis sensible. Pairs: ship🚢/sheep🐑 (ɪ/iː), bat🦇/bad 👎 (t/d), three3️⃣/tree🌳 (θ/t), fan🪭/van🚐 (f/v), sit🪑/seat💺 (ɪ/iː), thin📏/tin🥫 (θ/t), rice🍚/lice🐛 (r/l), cap🧢/cup☕ (æ/ʌ); audio `/audio/pairs/<word>.mp3`.
- Commit `feat(content): sound groups (27 cards), minimal pairs and isolated-sound generator`.

### Task 2: Tập âm screens
**Files:** Create `client/src/screens/SoundLevel.tsx` (replaces the `/level/sound-zoo` card grid: 9 sound tiles with IPA 56 px, example word, StarRow from `getStars('sound:'+ph)`, Link `/sound/:ph`), `client/src/screens/SoundPractice.tsx` (+tests); Modify `App.tsx` (`/sound/:ph`), `LevelSelect.tsx` (redirect sound-zoo to SoundLevel), `LevelStairs.tsx` (names: Tập âm / Đọc từ / Nghe & chọn), `Home.tsx` island names.
- SoundPractice: header IPA 72 px + `PHONEME_TIPS[ph]`; "🔊 Nghe âm lẻ" (playUrl `/audio/sounds/<ph>.mp3`, missing-notice); carousel "Từ n/3" with the word (font-display 56), emoji, "🔊 Nghe mẫu"; mouth card; `useSpeakingAttempt({ targetText: word, resetKey: ph+idx, onResult })`; result = **SoundChip** (`/θ/` + score + ✓/～/✗ tone) from the worst occurrence of the target phoneme in `result.words[*].phonemes` (match by `phoneme === ph`; if absent use word accuracy), tip, small word line, "Tiếp theo →" to the next word; after all 3 → stars = 3 if every word's target score ≥ 80, 2 if ≥ 60, else 1 → `setStars('sound:'+ph)`, "Hoàn thành 🎉" → `/level/sound-zoo`. Log `speak` activity per attempt.
- Tests: level renders 9 tiles; practice shows IPA + first word, result chip tone for phoneme 92/55, 3★ after three ≥ 80 results (mock hook like PracticeCard.test), navigation.
- Commit `feat(sound): sound-first Tập âm level and practice`.

### Task 3: Word Pop streak + hidden IPA
**Files:** Modify `client/src/screens/PracticeCard.tsx` (+test).
- When `level.id === 'word-pop'`: IPA hidden behind a "Xem phiên âm" ghost button; slots "○○" → "●○" → "●●"; attempt ≥ 80 fills, < 80 resets; on second consecutive → `setStars(id, 3)` + "Nói đúng 2 lần liên tiếp! 🎉"; otherwise `Math.min(2, feedback.stars)`. Sound Zoo cards keep the old behaviour (they are now reached via SoundPractice, but `/practice/sz-*` still works).
- Tests: two ≥80 results → 3★ stored; 80 then 50 → slots reset and stars ≤ 2; IPA toggle.
- Commit `feat(wordpop): two-in-a-row fluency challenge and hidden IPA`.

### Task 4: Học từ mới — meaning guess + recall review
**Files:** Modify `client/src/screens/WordCard.tsx` (+test), `WordList.tsx` (review flag passed via route state or `?mode=review` query).
- New card (not unlocked, not review): step **Đoán nghĩa**: emoji + word, three Vietnamese options (the word's `vi` + 2 distractors from the same topic, seeded shuffle by word id), wrong → shake + "Thử lại nhé", right → "Đúng rồi! 🎉" then the flip card + mic appear. Review mode (`topic === 'review'`): front face shows emoji + `vi` with the English word hidden ("?"), "Gợi ý" button reveals it; mic unchanged.
- Tests: guess wrong then right reveals the card; review front hides the word until "Gợi ý".
- Commit `feat(words): meaning-first flashcards and recall review`.

### Task 5: Minimal Pairs level
**Files:** Create `client/src/screens/PairLevel.tsx` (8 pair cards, stars `pair:<id>`), `PairPractice.tsx` (+tests); Modify `App.tsx` (`/level/minimal-pairs` → PairLevel, `/pair/:id`), `LevelStairs.tsx` (unlock the 3rd step → `/level/minimal-pairs`), `Home.tsx`? (no new island; reachable from stairs and Daily Mission step 2 stays).
- PairPractice: two big cards (emoji + word + IPA) left/right; "🔊 Nghe" plays one of the two (seeded by attempt count) ; tap a card → ✅/🙈 + Foxy; after 2 correct (count in state) the mic section appears: target text `"${a.word}, ${b.word}"`, `toFeedback` stars + ScoredWords; `setStars('pair:'+id)`; `logActivity('speak')`; "Tiếp theo →" next pair.
- Tests: listen → correct/incorrect feedback; mic appears after 2 correct; stars stored.
- Commit `feat(pairs): minimal pairs listen-and-choose level`.

### Task 6: Docs, audio, status
- Controller runs: `gen-audio.mjs` for new words (think that mother van seven fox five zip zebra shoe cheese chicken run leg lamp) to `client/public/audio`, pairs words to `client/public/audio/pairs`, `gen-sounds.mjs` for the 9 sounds; commit the mp3s (audio is tracked).
- README Phase 5 section + iPad rows; spec status line; brief §2.5 note. Commit `docs: phase 5 learning path`.

## Self-Review
Spec 1 → T1,T2; 2 → T3; 3 → T4; 4 → T1,T5; 5 → T2 (names). Stars keys consistent; hook reuse everywhere; no scoring changes.
