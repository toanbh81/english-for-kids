# Phase 6 — Sentence Stars ⭐ & Story Voice 🎭 (Speak Lab bậc 4–5)

Refines §2.2B rows 4–5 of `docs/2026-08-22-giai-phap-va-design-brief.md`. Phases 1–5 are on `main`.

Status: implemented 2026-08-23 on branch phase6-stars-voice (tasks 1–4).

## Goal
Finish the Speak Lab staircase: after sounds (Tập âm), words (Đọc từ) and ears (Nghe & chọn), the child speaks **whole sentences** with stress/linking, then **short passages with feeling**. Both levels reuse `useSpeakingAttempt` + Azure Pronunciation Assessment; the new thing is *which* scores matter and how they are shown.

## 1. Sentence Stars ⭐ (`/level/sentence-stars`, `/star/:id`)
- Content `client/src/content/sentence-stars.json`: 10 sentences, 4–8 words, A1, each with `stress: number[]` (word indexes carrying sentence stress) and `link?: [number, number][]` (pairs of adjacent words that link, e.g. "an apple"), `vi`, `audio: /audio/stars/<id>.mp3` (Emma HD, rate -10%).
  Sentences: "I have a red apple.", "My mom is in the kitchen.", "The cat is under the table.", "We go to school by bus.", "Can I have some water?", "My brother likes ice cream.", "It is sunny today.", "Where is my blue bag?", "I can run very fast!", "The fox jumps over the log."
- Practice screen: Chip "Câu n/10"; the sentence in `font-display` 40 px where stressed words are **coral + larger (48 px)** and linked pairs show a small ‿ connector underneath; subtitle `vi`; legend "Chữ cam = nhấn mạnh · ‿ = nối âm"; 🔊 Nghe mẫu; mouth card replaced by a **rhythm card**: dots per word (big dot = stressed) that the child can tap to hear the sentence again with the dots pulsing in rhythm (pure CSS animation synced to `audio.duration/words` — approximate); MicButton + countdown + Foxy as elsewhere.
- Result: `ScoredWords` chips (per-word tone), `ScoreBars` (Chính xác / Trôi chảy / Đầy đủ / Ngữ điệu), HintCard when hint; **stars rule**: accuracy ≥ 80 AND fluency ≥ 80 AND completeness ≥ 80 → 3; accuracy ≥ 60 AND completeness ≥ 60 → 2; else 1 (`starsForSentence(result)`), key `sstar:<id>`; a line "Nhịp: 🐢 chậm / 🎵 tốt" derived from fluency (<60 chậm). `logActivity('speak')` + `saveRecording`. "↻ Thử lại", "Tiếp theo →", last → level.
- Level screen: list of 10 sentence cards with StarRow; title "Sentence Stars ⭐", subtitle "Nói cả câu — nhấn đúng chỗ, nối âm mượt!".

## 2. Story Voice 🎭 (`/level/story-voice`, `/voice/:id`)
- Content `client/src/content/story-voice.json`: 8 passages of 2–3 sentences with `mood: 'happy' | 'surprised' | 'question' | 'sad' | 'excited'`, `moodVi`, `emoji`, `vi`, `audio: /audio/voice/<id>.mp3` (Emma HD plain; punctuation carries the intonation).
  Passages (examples): happy — "I love my dog! He is my best friend. We play every day."; surprised — "Wow, look at that! The elephant is so big. I can't believe it!"; question — "Where is my hat? Is it under the bed? Oh, here it is!"; sad — "My ice cream fell down. I am so sad. Can I have another one?"; excited — "Today is my birthday! I have a big cake. Let's eat it together!"; plus 3 more (a calm bedtime line, a proud line, a scared-then-relieved line).
- Practice screen: mood badge (emoji 72 px + "Đọc với giọng: vui vẻ/ngạc nhiên/hỏi/buồn/háo hức"), the passage `font-display` 34 px with sentence-final punctuation highlighted (❗❓ coral), subtitle `vi`, 🔊 Nghe mẫu, a **"🎭 Gợi ý giọng"** card (3 tips per mood, e.g. question: "Lên giọng ở cuối câu hỏi"), MicButton (auto-stop 10 s), countdown, Foxy.
- Result: **Prosody-first**: a big chip "Ngữ điệu 84" toned by `result.prosody ?? accuracy` (good ≥80/ok ≥60/fix), then ScoreBars, ScoredWords, HintCard; **stars rule**: prosody ≥ 80 AND accuracy ≥ 70 → 3; prosody ≥ 60 → 2; else 1 (`starsForVoice(result)`), key `voice:<id>`; when the engine is Web Speech (no prosody) show the chip as "Chưa chấm được ngữ điệu" and cap at 2. Logging as above.
- Level screen: 8 cards with mood emoji + first sentence + StarRow; title "Story Voice 🎭", subtitle "Đọc có hồn — vui, buồn, ngạc nhiên!".

## 3. Stairs & map
`LevelStairs` steps 4–5 become links with stars = max over `sstar:*` / `voice:*`; Foxy placement logic unchanged. Home map unchanged (stairs are reached via Tập âm/Đọc từ islands → "Xem các bậc"); Daily mission step 2 counts these `speak` events too.

## Rules
Tap targets ≥ 64 px; mic ≥ 120 px; Vietnamese UI; en-US; UI kit/tokens; hooks unconditional (outer/inner); tests/lint/typecheck/build green; audio generated with the existing Emma HD generator pattern and committed.
