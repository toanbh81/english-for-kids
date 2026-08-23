# Phase 5 — Make the learning path legible: Tập âm · Đọc từ · Học từ mới · Minimal Pairs

Refines §2.2B–C of `docs/2026-08-22-giai-phap-va-design-brief.md`. Phases 1–4 are on `main`.

## Problem
Sound Zoo, Word Pop and Từ vựng all present "a word + a mic", so a 9-year-old (and the parent) cannot tell them apart. Each bậc must teach a visibly different skill.

## Scope
1. **Tập âm (Sound Zoo)** — organised **by sound, not by word**. 9 sounds (th /θ/, dh /ð/, v, f, z, sh /ʃ/, ch /tʃ/, r, l), each with **3 words** (27 cards). Level screen shows sound tiles (`/θ/` big, example "three", stars = best over its words). Practice screen (`/sound/:phoneme`): header is the IPA symbol 72 px + tip text, a "🔊 Nghe âm lẻ" button (generated sample of the sound in isolation via SSML `<phoneme>`), the 3 words as a mini-carousel (1 at a time, "Từ 1/3"), mouth card; scoring shows **only the target sound**: a big chip "/θ/ ✓ 92" (good ≥80 / ok / fix) + the tip, the word itself shown small underneath; 3 stars when all 3 words have the target phoneme ≥ 80. Progress key `sound:<phoneme>`.
2. **Đọc từ (Word Pop)** — whole-word fluency. Same 12 animal words. Changes: IPA hidden by default (tap "Xem phiên âm" to reveal); a **streak challenge**: "Nói đúng 2 lần liên tiếp" — the card shows 2 slots ○○; an attempt with overall ≥ 80 fills a slot, < 80 clears both; 3 stars = 2 consecutive ≥ 80 (stored as today: `setStars(cardId, 3)`), otherwise stars from the single attempt as now capped at 2. Copy: "Lần 1/2 · Lần 2/2 ✓".
3. **Học từ mới (Từ vựng)** — meaning first. New flow per card: **Đoán nghĩa** (emoji + word shown, choose 1 of 3 Vietnamese meanings; distractors from the same topic) → flip card → 🎤 Nói để mở khoá (unchanged). **Ôn tập**: the front face hides the English word (shows emoji + Vietnamese) so the child must recall it and say it; tapping "Gợi ý" reveals the word. Leitner/unlock rules unchanged.
4. **Minimal Pairs (👯)** — new level `/level/minimal-pairs` + `/pair/:id`: 8 pairs (ship/sheep, bat/bad, three/tree, fan/van, sit/seat, thin/tin, rice/lice, cap/cup). Flow: 🔊 plays ONE of the two words (random, seeded per attempt) → child taps the matching picture/word card → ✅/🙈 + Foxy; after 2 correct listens, mic step: read both words in one go ("ship, sheep") scored by `toFeedback` (stars `pair:<id>`). Level tile unlocked in the stairs.
5. **Naming on the map/stairs**: 🦁 "Tập âm", 🎈 "Đọc từ", 🧩 "Học từ mới", 👯 "Nghe & chọn" (Minimal Pairs); Daily mission step 2 stays "5 thẻ phát âm" (counts speak events from Tập âm, Đọc từ, Minimal Pairs).

## Content
- Sound Zoo words (id `sz-<ph>-<word>`, audio `/audio/<word>.mp3`): th: three, thank, think; dh: this, that, mother; v: very, van, seven; f: fish, fox, five; z: zoo, zip, zebra; sh: ship, shoe, sheep; ch: chair, cheese, chicken; r: red, rabbit, run; l: lion, leg, lamp. IPA per word authored; isolated sound samples `/audio/sounds/<ph>.mp3` generated with `<phoneme alphabet="ipa" ph="θ">` (gen script extension).
- Minimal pairs JSON: `{ id, a: { word, ipa, emoji, audio }, b: {...}, contrast: 'ɪ/iː' }`.
- New word mp3s generated with `scripts/gen-audio.mjs` (existing 22 stay).

## Rules
- Scoring engine/hook unchanged; all new screens use `useSpeakingAttempt` + `toFeedback`; activity `speak` events logged for Tập âm / Đọc từ / Minimal Pairs (mission counts).
- Tap targets ≥ 64 px, Vietnamese copy, tests/lint/typecheck/build green, Phase-4 UI kit + tokens.
- Old routes `/level/sound-zoo` and `/practice/:cardId` keep working (`/level/sound-zoo` becomes the sound-tile screen; `/practice/:cardId` stays for Word Pop cards).
