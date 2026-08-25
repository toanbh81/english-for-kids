# Speak Up! 🎤

A kids' English pronunciation practice PWA — kids listen to a word, record themselves saying it, and get 1–3 stars feedback with word-level hints. Built for iPad use at home (installable via "Add to Home Screen").
*(Ứng dụng luyện phát âm tiếng Anh cho trẻ em: nghe từ mẫu, ghi âm, nhận sao đánh giá và gợi ý.)*

## Prerequisites

- Node.js ≥ 20
- pnpm 9 (`corepack enable` or `npm i -g pnpm`)
- An Azure Speech resource, free tier **F0** (for pronunciation scoring and generating sample audio) — create one in the Azure Portal under "Speech services"

## Setup

```bash
pnpm install
```

Copy the server environment example and fill in your Azure Speech key/region:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_REGION=southeastasia   # e.g. southeastasia — use the region of your Azure Speech resource
```

The client normally reaches the token API through the Vite dev/preview proxy, so no client config is
needed. If you serve the built client from somewhere the proxy does not cover, copy
`client/.env.example` to `client/.env` and set `VITE_API_BASE` to the server's origin (e.g.
`http://192.168.10.4:8787`); leaving it empty keeps the same-origin `/api/speech-token` path.

## Generating sample audio (Nghe mình / Nghe cô)

Sample word audio (Jenny's voice) is generated locally and saved to `client/public/audio/`. The
generated mp3s **are committed** (deploys need sound, and regenerating them costs an Azure call per
word) — the one exception is `client/public/audio/audition/`, the voice-audition scratch folder,
which is the only audio path in `.gitignore`. Run this once after setup, or whenever you add new
words, and commit what it writes:

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-audio.mjs three thank this very fish zoo ship chair red lion cat dog elephant monkey rabbit tiger bird horse sheep frog snake giraffe
```

Story narration (full scenes with per-word timings) is generated the same way:

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-story.mjs little-fox at-the-zoo my-breakfast
```

This writes mp3s to `client/public/audio/stories/<id>/` and fills word timings (start/end ms) into
each story's JSON; commit both the updated JSON files and the mp3s.
Run the commands from the repo root — the script resolves every path against the repo root, so it
writes to the same places whatever your current directory is. If Azure's word boundaries do not
line up with a scene's `words` array, the script exits with a message instead of writing shifted
timings; fix the scene's `text`/`words` split and re-run.

Vocabulary word audio (Phase 3) goes in its own folder via `--out`, since it is generated one clear
word at a time rather than as full narration:

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-audio.mjs --out client/public/audio/words apple banana bread milk egg rice water cake book pen teacher desk bag friend ruler clock mother father sister brother baby grandma grandpa home
```

`gen-audio.mjs` accepts `--out <dir>` (default `client/public/audio`) and `--voice <name>` (default
`en-US-JennyNeural`, a clear neutral voice good for single words).

Sentence Builder audio (Phase 3) is generated with the Emma HD voice, same as story narration:

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-sentences.mjs
```

This writes `client/public/audio/sentences/<id>.mp3` for every sentence in
`client/src/content/sentences.json` (or, given ids as extra args, only those sentences). Run it
whenever you add or change a sentence, and commit the mp3s like the other generated audio.

Sentence Stars and Story Voice (Phase 6) share one generator, since both are plain Emma HD phrases
read straight from their JSON `text` field (Story Voice's mood rides on punctuation alone, no SSML
styling):

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-phrases.mjs
```

This writes `client/public/audio/stars/<id>.mp3` for every sentence in
`client/src/content/sentence-stars.json` and `client/public/audio/voice/<id>.mp3` for every passage
in `client/src/content/story-voice.json` (or, given ids as extra args, only those items). Run it
whenever you add or change a sentence/passage, and commit the mp3s like the other generated audio.

Tập âm's 27 sound-zoo words (Phase 5) added 17 new words beyond the original 10 (`rabbit` and
`sheep` were already generated for Word Pop, so they are not repeated below):

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-audio.mjs think that mother van seven fox five zip zebra shoe cheese chicken run leg lamp
```

Minimal Pairs (Phase 5) words go in their own folder, same as vocabulary words:

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-audio.mjs --out client/public/audio/pairs ship sheep bat bad three tree fan van sit seat thin tin rice lice cap cup
```

Isolated sound samples for Tập âm's "🔊 Nghe âm lẻ" button (the 9 target sounds on their own, not
inside a word) are generated with `scripts/gen-sounds.mjs`, which speaks each phoneme via SSML
`<phoneme alphabet="ipa">`:

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-sounds.mjs
```

This writes `client/public/audio/sounds/<ph>.mp3` for each of `th dh v f z sh ch r l`. Most single
consonants sound clipped or wrong when Azure is asked to say the bare IPA symbol on its own, so the
script appends a light schwa (`ə`) to the phoneme value it sends (e.g. `θ` becomes `θə`) — Jenny
then articulates a clean, isolated consonant sound rather than a garbled fragment, while the output
still reads to a child as "just the /θ/ sound".

## Phase 2 — Listening (Nghe kể chuyện)

A listening module that engages kids in illustrated stories with synchronized karaoke-style text. Kids listen to a 60–120 s story (6–7 scenes), see words light up in sync with narration, can slow playback, tap words to replay, toggle Vietnamese subtitles, then answer 3 picture questions and retell one target sentence.

**No-audio fallback:** If you have not yet run `gen-story.mjs` or audio files are missing, the player still works — it drives the karaoke from an estimated word timing based on a silent clock (Chưa có giọng đọc — chữ chạy theo nhịp ước lượng). Everything is testable without Azure Speech.

Features:
- **Karaoke player** with scene art (large emoji on gradient), current word enlarged in coral, past words greyed out
- **Speed control:** a single 🐢/🐇 button toggles between 0.75× and 1× (both the audio and the karaoke)
- **Tap-word replay:** tap any word to hear it in isolation — from the narration once it exists, otherwise spoken by the browser's own voice (`speechSynthesis`)
- **Subtitles toggle:** 🇻🇳 Vietnamese subtitles
- **Quiz:** 3 picture-choice questions, Foxy says right/wrong, retry allowed; stars stored in `story:<id>`
- **Retell:** speak one target sentence; lenient scoring (≥60 → 3★, ≥35 → 2★, else 1★) with encouragement, no phoneme hint; stars stored in `retell:<id>`

For narration timings, see **"Generating sample audio"** above (`scripts/gen-story.mjs`). Built-in stories: *The Little Fox*, *At the Zoo*, *My Breakfast*.

### Verified on iPad

| # | Step | Expected result | Result |
|---|------|------------------|--------|
| 1 | Share → Add to Home Screen | Opens full-screen, cream background, Nunito font | ⏳ pending |
| 2 | Sound Zoo → "three": tap 🔊 → hears Jenny; tap mic → permission prompt → accept; say "three"; tap stop | Stars appear within 3 s; word colored; hint shows if score < 80 | ⏳ pending |
| 3 | "Nghe mình" (listen to self) | Plays back the recording | ⏳ pending |
| 4 | Turn Wi-Fi off → reload | Header shows "chế độ đơn giản"; scoring still returns stars (Web Speech fallback) | ⏳ pending |
| 5 | Close and reopen the app | Stars persist | ⏳ pending |
| 7 | Stories → The Little Fox → play scene 1; tap the 🐢 speed button | Karaoke slows to 0.75×; the button becomes 🐇 | ⏳ pending |
| 8 | Stories → The Little Fox → scene 1, tap the word "Foxy" | Until narration is generated, the word is spoken by the browser voice (speechSynthesis) and the karaoke pauses on it | ⏳ pending |
| 9 | Stories → The Little Fox → finish quiz (3 questions), then Retell → speak "He wants an apple." | Lenient score (1–3 stars) appears; encouragement message shown | ⏳ pending |
| 10 | After running `gen-story.mjs`: play scene 1 and tap 🐢 | 🐢 actually slows the audio (not just the karaoke) | ⏳ pending |
| 11 | Retell → record once, go back to the player, tap a word | speechSynthesis word replay works after a mic recording | ⏳ pending |

### Narration voice (giọng kể)

Default voice is **`en-US-Emma:DragonHDLatestNeural`** (Azure HD): it acts the text out from context on its own, and
measured against a reference children's-story video it matched the narrator's register (~205 Hz) and pitch range.
HD voices ignore `express-as`/`emphasis`; the generator only adds a slower rate (`-15%`) and explicit sentence
breaks (400 ms), per-scene overridable via `voice.rate` / `voice.pauseMs` in the story JSON.
Override the voice with `STORY_VOICE=en-US-AriaNeural` — non-HD voices use the styled SSML path
(`voice.style`, `degree`, `pitch`, `emphasis` hints).

Tools for comparing voices / tuning against a reference clip (put videos in the git-ignored `samples/`):

```bash
node scripts/audition-voices.mjs little-fox 3
```

```bash
node scripts/transcribe-sample.mjs samples/clip.wav > samples/clip.words.json
```

```bash
py -3.11 scripts/analyze-prosody.py samples/clip.wav client/public/audio/stories/little-fox/scene-4.mp3
```

(`analyze-prosody.py` needs `pip install praat-parselmouth numpy`; audition files land in `client/public/audio/audition/`, git-ignored.)

## Running

```bash
pnpm dev
```

This starts both apps:
- Client (Vite, HTTPS dev server): **https://localhost:5173** — accept the self-signed certificate warning in your browser on first load.
- API server (Express): **http://localhost:8787** (`GET /api/speech-token`)

The client dev server uses HTTPS because Safari on iOS/iPadOS only allows microphone access (`getUserMedia`) over a secure origin (HTTPS or `localhost`).

## Testing

```bash
pnpm test        # client (Vitest, 703 tests) + server (Vitest, 2 tests)
pnpm lint        # oxlint on the client
pnpm typecheck   # tsc -b (client) + tsc --noEmit (server)
```

`pnpm test` runs `pnpm -r test`, which executes the client suite (`vitest run`, 703 tests in 63
files) and the server suite (`vitest run`, 2 tests). `pnpm lint` and `pnpm typecheck` fan out the
same way.

## Security note

The token endpoint (`GET /api/speech-token`) is **unauthenticated**: anyone who can reach the server
gets a short-lived Azure Speech token. That is acceptable only because this setup is meant to run on
a home LAN for a single family, behind the router's NAT. **Never port-forward this server and never
deploy it as-is to the public internet** — a leaked token endpoint means someone else spending your
Azure quota. Before any cloud deploy, add a shared secret (or real auth) on the endpoint plus a rate
limit per client.

## Secret-leak guard (bắt buộc trước khi commit/push)

`scripts/check-secrets.sh` scans for `.env` files and secret-looking strings (Azure keys, tokens, private keys). It runs automatically:

- as git hooks in `.githooks/` — enable once per clone:

```bash
git config core.hooksPath .githooks
```

- as a Claude Code hook (`.claude/settings.json`) before any `git commit` / `git push` Claude runs.

Manual audit of all tracked files:

```bash
bash scripts/check-secrets.sh tree
```

Never bypass with `--no-verify`; fix the pattern instead if it false-positives.

## Phase 3 — Words, Sentence Builder, Daily Mission, Parent Dashboard

A daily habit loop: kids complete a 3-step mission (listen to a story, try 5 words/sentences, unlock or review vocabulary), earn a weekly streak, and see Foxy the mascot celebrate progress. Parents can view pronunciation practice time, weak sounds, and recordings (behind a math gate).

**Routes:**

| Route | Screen |
|---|---|
| `/levels` | Speak Lab stairs — reached from the "🗣️ Xem các bậc" chip on `/level/:levelId` (the map links levels directly) |
| `/words` | topic list + the "Ôn tập hôm nay" review deck |
| `/words/:topic` | word list — `topic` is `food`, `school`, `family` or `review` |
| `/words/:topic/:wordId` | flashcard + say-to-unlock |
| `/sentences` | sentence list |
| `/sentence/:id` | Sentence Builder |
| `/parent` | Parent Dashboard (behind the math gate) |

**Features:**

- **Words (Từ vựng)** — 3 topics (Food 🍎, School 🏫, Family 👨‍👩‍👧) × 8 words each. Flashcard with emoji/IPA front, Vietnamese + example sentence back. "Nói để mở khoá" (say ≥60 to unlock). Spaced repetition: Leitner boxes 1/3/7/14 days; "Ôn tập hôm nay" deck shows due words. Sample audio is already generated — see **"Generating sample audio"** above to regenerate it.

- **Sentence Builder (Ghép câu)** — 12 sentences (4 per topic). Tap tiles in order to build the sentence. Wrong order → shake + Foxy hint. Correct → reads the sentence (pre-generated Emma HD mp3). Then child reads it back (scores like other modules). Sentence audio is already generated — see **"Generating sample audio"** above.

- **Daily Mission + Streak** — Home shows "Nhiệm vụ hôm nay": 🎧 1 story (quiz done) → 🗣️ 5 attempts (scored) → 🧩 3 words said well enough to count (score ≥ 60). Streak counts consecutive days with mission complete; Home shows 7 dots (★ done / ○ not) + "🔥 N ngày". Activity log (`speakup.activity`, capped 2000 entries) tracks all attempts.

- **Foxy Moods** — 5 moods (idle, listening, happy, cheer, surprised). Home: greeting + mood from mission state. Practice screens: listens while recording, happy/cheer on stars. Mission complete → confetti (once a day) + cheer.

- **Parent Dashboard** (`/parent`) — Gated by random single-digit math question (e.g., "7 × 8?"); the unlock lasts 10 minutes and ends as soon as you leave the screen. Shows: 14-day bar chart of minutes/day, pronunciation averages per module (Nói / Từ vựng / Ghép câu), top 5 weak phonemes, recent attempts (date, text, score) with playback of last 20 recordings (IndexedDB `speakup-recordings`, FIFO), daily time limit setting (`speakup.limit.minutes`, default 20). Gentle banner on Home if limit exceeded (not a hard block).

  The mission's "3 từ" step counts only word attempts scoring **≥ 60** (the same bar that unlocks a card); attempts with no score at all — the Web Speech fallback — still count.

**Storage keys:**
- `speakup.activity` — activity log (timestamp, kind, id, score, weak phonemes); practice minutes are inferred from the timestamps, not stored
- `speakup.leitner` — word boxes and due dates
- `speakup.limit.minutes` — daily time limit, 5–60, default 20
- `speakup.celebrated` — the day the mission-complete confetti last fired
- `speakup.parent` — `sessionStorage` flag: when the parent gate was passed (valid 10 minutes)
- `speakup-recordings` — IndexedDB for audio blobs (cap 20)

## Phase 4 — Giao diện mới (Claude Design)

A full visual re-skin to the Claude Design handoff — routes, stores, scoring, and every existing test contract (texts, aria-labels, `data-testid`s) stay the same, except for two screens the design explicitly adds.

**What changed:**

- **Design tokens** (Tailwind theme) — warm cream canvas, the `ink`/`coral`/`teal`/`sun`/`good`/`ok`/`fix` color scale, Baloo 2 (display) + Nunito (body) via Google Fonts, chunky hard-offset shadows (`shadow-card`, `shadow-chunky-*`), and a shared press feedback (`active:translate-y-[2px]`). The old single-word aliases (`cream`, `coral`, `teal`, `star`, `good`, `ok`, `fix`) still work.
- **Foxy** — the fox mascot is now an SVG component (`client/src/components/Foxy.tsx` — it is a screen-level mascot, not part of the `ui/` barrel) with 5 moods (idle, listening, happy, cheer, surprised), replacing the old emoji stand-in. The drawing itself is `aria-hidden`: his mood repeats what the surrounding copy already says.
- **UI kit** (`client/src/components/ui/`) — `Button`, `Card`, `BackButton`, `Toggle`, `Chip`, `ProgressBar`, `Toast`, `SpeechBubble`, `StarRow`, `SceneDots`, shared across screens.
- **Home** (`/`) is now an island map: a dotted SVG path threads through five circular, color-shadowed islands — 🎧 Nghe kể chuyện, 🧩 Từ vựng and 🧱 Ghép câu are whole modules, only 🦁 Sound Zoo and 🎈 Word Pop are Speak Lab levels — with a greeting bubble, week/star pills, and a mission card. Landscape uses the path layout; portrait stacks the islands in a grid.
- **Daily Mission** (`/mission`) and **Mission Complete** (`/mission/done`) are new screens the design adds — Home's mission card now hands off to `/mission` (today's 3 steps, one at a time) instead of celebrating inline; finishing the mission routes to `/mission/done` for the confetti + Foxy cheer.
- **Speak Lab** levels moved to `/levels` (a stairs layout, `LevelStairs.tsx`) with restyled level-select cards at `/level/:levelId`. The map links the two playable levels directly, so `/levels` is reached from the "🗣️ Xem các bậc" chip in the level-select header; that screen's back button goes to the map.
- **Speak card** (`/practice/:cardId`) — restyled state chips (idle/listening/scored) and a countdown **number** under the word while recording, mirroring the 6 s auto-stop. "Tiếp theo →" stays inside the current level; the level's last card ends with "Hoàn thành 🎉" back at the level list.
- **Story player/quiz** — restyled to the same card/token system; the player's speed and subtitle switches use the new `Toggle` component. The quiz link under the controls is "Tiếp tục ▸" (coral, pulsing) once the story has ended and a quiet dashed "Bỏ qua ▸" before that, so the quiz is always one tap away.
- **Words** (`/words/:topic/:wordId`) — "Từ mới hôm nay 🧩 n/3" header over a flip card (front: emoji/IPA, back: Vietnamese + example sentence), replacing the old two-pane layout. Each face carries its own "Lật thẻ" button; the face turned away is `inert` + `aria-hidden`, so only the face the child is looking at is focusable.
- **Sentence Builder** (`/sentence/:id`) — tiles are colored by grammatical role (who/does/what), with the legend between the tray and the tile pool.
- **Parent Gate + Dashboard** (`/parent`) — the gate is a centered card with a 44px question and a 64px input; the dashboard header adds a weekly summary line ("Tuần này: N phút luyện · điểm phát âm trung bình N/100"), a "Khoá lại" control that re-locks without leaving the screen, a 14-day chart with a dashed target line at the daily limit, pronunciation averages as three cards, weak-phoneme tips in a highlighted note, and daily-limit quick-pick chips (15/20/30) alongside the existing number input.

  The parent area is still drawn in the kid palette (cream canvas, Baloo 2, chunky shadows). A quieter adult palette for `/parent` is deferred — it was not part of the handoff.

- **Motion** — a `prefers-reduced-motion: reduce` block in `client/src/styles.css` collapses every animation and transition to .01 ms (one iteration), so the bobbing, wiggling and confetti stand still for a child who asked the system for less motion.
- **Offline fonts** — Baloo 2 and Nunito are cached at runtime by the service worker (`fonts.googleapis.com` stale-while-revalidate, `fonts.gstatic.com` cache-first for a year), since the precache glob only covers files in `dist/`.

Design reference: `docs/design/` — `speak-up-screens.dc.html` is the static screen/component reference (search it for a screen's Vietnamese heading, e.g. "Góc phụ huynh"), and `docs/design/README.md` documents the tokens.

Dev tip: to preview the app over plain HTTP (e.g. for automated DOM checks or a browser tool without a trusted certificate), run:
```bash
pnpm --filter client exec vite --mode nossl --port 5174
```

## Phase 5 — Learning path (Tập âm · Đọc từ · Học từ mới · Nghe & chọn)

Sound Zoo, Word Pop and Từ vựng used to all present "a word + a mic", so a child (and a parent
watching) could not tell the four speaking games apart. Phase 5 gives each bậc a visibly different
skill, on top of the same scoring engine (`useSpeakingAttempt` + `toFeedback`) and the same
`speak` activity logging — three of the four log `speak` and so count toward the daily mission's
"5 thẻ" step (Tập âm, Đọc từ, Nghe & chọn); Học từ mới logs `word` events instead.

- **🦁 Tập âm (Sound Zoo)** — organised **by sound, not by word**: 9 target sounds (th /θ/, dh /ð/,
  v, f, z, sh /ʃ/, ch /tʃ/, r, l), each with 3 words (27 cards total). The level screen
  (`/level/sound-zoo`) shows 9 sound tiles — big IPA symbol, one example word, stars = the best
  score across that sound's 3 words. Tapping a tile opens `/sound/:ph`: a 72 px IPA header + tip
  text, a "🔊 Nghe âm lẻ" button that plays the sound in isolation (generated via SSML
  `<phoneme>`, see `gen-sounds.mjs` below), and the 3 words as a "Từ 1/3" mini-carousel. Scoring
  shows only the target sound — a chip like "/θ/ ✓ 92" — with the word itself shown small
  underneath; 3 stars once all 3 words score ≥ 80 on the target phoneme. When nothing measured the
  sound — Web Speech's "chế độ đơn giản" reports no phonemes, and an Azure result can drop one —
  the chip goes neutral ("Chưa chấm được âm — cần kết nối Azure", no number) instead of borrowing
  the word's accuracy, and a run containing such a word is capped at 2 stars.
- **🎈 Đọc từ (Word Pop)** — whole-word fluency on the same 12 animal words (`/practice/:cardId`).
  IPA is hidden by default (tap "Xem phiên âm" to reveal). A streak challenge replaces a single
  attempt: two slots ○○ ("Lần 1/2 · Lần 2/2 ✓"); an attempt ≥ 80 fills the next slot, one < 80
  clears both; 2 consecutive ≥ 80 attempts award 3 stars, otherwise stars come from the single
  attempt as before (capped at 2).
- **🧩 Học từ mới (Từ vựng)** — meaning first, at `/words/...`. New cards start with **Đoán nghĩa**:
  emoji + English word shown, child picks 1 of 3 Vietnamese meanings (distractors from the same
  topic); a wrong pick shakes the card. Then the card flips and "🎤 Nói để mở khoá" works as before.
  In the **Ôn tập** (review) deck the front face hides the English word — only emoji + Vietnamese
  meaning show, so the child has to recall and say the word — with a "Gợi ý" button to reveal it.
  The front-face 🔊 is withheld until that hint is tapped: it speaks the word, so leaving it there
  would be a one-tap bypass of the whole recall step.
  Leitner unlock/spacing rules are unchanged.
- **👯 Nghe & chọn (Minimal Pairs)** — a new level, `/level/minimal-pairs` (`PairLevel`) →
  `/pair/:id` (`PairPractice`): 8 contrastive pairs (ship/sheep, bat/bad, three/tree, fan/van,
  sit/seat, thin/tin, rice/lice, cap/cup). 🔊 plays one of the two words, picked **seeded
  pseudo-random per pair** (a PRNG stream seeded by the pair id, so the order has no beat the child
  can count but is identical every time that pair is opened); the child taps
  the matching picture/word card (✅/🙈 + Foxy). The scoreboard is one tick per **word** ("ship ✓ ·
  sheep ○"), and the mic step opens only once **each** word has been picked correctly at least
  once — two right answers on the same word prove nothing about the contrast. The draw never plays
  the same word more than twice running, so both sides come up within any four listens. The mic
  step then asks the child to read both words in one go ("ship, sheep"), scored the normal way.

**Routes:**

| Route | Screen |
|---|---|
| `/level/sound-zoo` | Tập âm sound tiles (`SoundLevel`, rendered by `LevelSelect` for that one level id) |
| `/sound/:ph` | Tập âm practice — one sound, 3-word carousel (`SoundPractice`) |
| `/practice/:cardId` | Đọc từ (Word Pop) practice card — unchanged path, new streak UI |
| `/words`, `/words/:topic`, `/words/:topic/:wordId` | Học từ mới — topic list, word list, flashcard (Đoán nghĩa → flip → say-to-unlock; review hides the word) |
| `/level/minimal-pairs` | Nghe & chọn level (`PairLevel`) |
| `/pair/:id` | Nghe & chọn practice — listen, choose, then read both words (`PairPractice`) |

**Storage keys:**
- `sound:<ph>` — Tập âm stars, one per sound (not per word/card); the Tập âm island on Home and
  the "Tập âm" step on `/levels` both show `best` over the 9 `sound:<ph>` keys.
- `pair:<id>` — Nghe & chọn stars, one per pair (not per word).
- Word Pop keeps its stars per card (`c.id`, e.g. `wp-cat`); Học từ mới keeps using the Leitner
  deck (`speakup.leitner`), not a star key, for its island/step.

**Audio generation:** new Sound Zoo words, Minimal Pairs words and the 9 isolated-sound samples
are produced by the same `gen-audio.mjs` / `gen-sounds.mjs` scripts documented above under
"Generating sample audio" — see that section for the exact commands and output folders
(`client/public/audio`, `client/public/audio/pairs`, `client/public/audio/sounds`). Like the Phase
2–4 audio, these mp3s are committed: every folder under `client/public/audio/` is tracked in git
except `audio/audition/`, the voice-audition scratch folder, which is the only one `.gitignore`
excludes.


### Story illustrations via Claude Design (kho ảnh trung tâm)

The Claude Design project holds a **"Story Art"** page with one `image-slot` per story scene (slot id = `story-<storyId>-scene-<n>`, 4:3) plus a style prompt per scene. Fill the slots there (drag an image in), then export the project zip and copy each image to `client/public/images/stories/<storyId>/scene-<n>.png` (jpg/webp also fine). Run:

```bash
node scripts/link-story-images.mjs
```

It sets `scenes[n].image` in the story JSON for every file found (and clears it for missing ones); scenes without an image keep the emoji art. Commit the JSON and the images. `docs/design/out/Story Art.dc.html` is the local copy of that page; regenerate it when stories are added (see the snippet in git history of this commit) so new scenes get slots.

## Phase 6 — Sentence Stars ⭐ & Story Voice 🎭

The last two bậc of the Speak Lab staircase move past single words: **Sentence Stars** teaches a
whole sentence read smoothly — stress on the right words, sounds linked together — while **Story
Voice** teaches a short passage read *with feeling*. Both reuse `useSpeakingAttempt` + Azure
Pronunciation Assessment; what changes bậc to bậc is which scores count and how the result is
shown.

- **⭐ Sentence Stars (`/level/sentence-stars` → `/star/:id`)** — 10 sentences
  (`client/src/content/sentence-stars.json`), each with `stress` (which words carry the beat) and
  an optional `link` (adjacent word pairs that run together, e.g. "red apple"). The sentence renders
  in `StressedSentence`: stressed words go coral and larger, linked pairs get a small ‿ connector
  underneath. A rhythm card shows one dot per word (big dot = stressed); tapping it replays the
  sample and each dot pops once when its word is spoken, so the beat travels along the sentence
  with the voice. The card loads the clip itself and takes the tempo from its duration (duration ÷
  word count, ~420 ms a word if the browser reports no duration); each pop is a one-shot animation
  lasting 60% of a beat, re-armed on every play, because a repeating one would put every dot back
  in phase after the first pass and they would pulse in unison. Stars weigh accuracy, fluency **and** completeness together
  (`starsForSentence`): all three ≥ 80 → 3★, accuracy and completeness ≥ 60 → 2★, else 1★. The
  result also shows a rhythm line off the fluency score in three bands — ≥ 80 "Nhịp: 🎵 tốt",
  60–79 "Nhịp: 🙂 khá — nói liền hơi hơn nhé", below 60 "Nhịp: 🐢 chậm". Stars live at
  `sstar:<id>`.
- **🎭 Story Voice (`/level/story-voice` → `/voice/:id`)** — 8 short passages
  (`client/src/content/story-voice.json`), each tagged with a `mood` (happy, surprised, question,
  sad, excited, calm) and read with a mood tips card ("🎭 Gợi ý giọng") before the mic opens — the
  mood's three shared tips, or the passage's own `tips` when it has them. The whole screen is sized
  to a landscape iPad: at 1194×834 the mic ends 68 px above the fold on all 8 passages with no
  scrolling (56 px mood emoji, compact 14 px tips list, and 30 px passage type on `lg` once a
  passage runs past 12 words). The mic stays open 13 s
  here (every other bậc uses 6 s), long enough for three sentences read slowly and with feeling.
  Scoring is prosody-first: a big "Ngữ điệu NN" chip toned by `result.prosody` leads the result,
  ahead of the usual score bars. **What the child is shown** never fakes prosody from accuracy:
  with no prosody score the chip says so and the fourth score bar stays empty, labelled "Ngữ điệu
  —". The star rule is the exception, deliberately — with prosody missing `starsForVoice` reads
  accuracy to choose between 1★ and 2★ (a run is still worth more than the floor), and caps the
  result at 2★ so unmeasured feeling can never earn 3★. Stars
  (`starsForVoice`) need prosody ≥ 80 **and** accuracy ≥ 70 for 3★, prosody ≥ 60 for 2★, else 1★ —
  and when the engine is Web Speech (no prosody at all) the chip reads "Chưa chấm được ngữ điệu"
  and the run is capped at 2★, the same "can't measure it, don't credit it" rule Tập âm uses for
  missing phoneme scores. Stars live at `voice:<id>`.
- **Stairs:** `/levels` now shows all 5 bậc as playable links — Sentence Stars and Story Voice take
  the best star across their `sstar:*` / `voice:*` keys, the same "best across the level's keys"
  pattern as Tập âm's sounds and Nghe & chọn's pairs. Both log `speak` activity, so they count
  toward the daily mission's "5 thẻ" step like the other three speaking bậc.

Audio for both levels is generated with `scripts/gen-phrases.mjs` (Emma HD) — see "Generating
sample audio" above for the exact command and output folders (`client/public/audio/stars`,
`client/public/audio/voice`).

## Phase 7 — Topic map & Daily lesson engine

Home returns to the original Claude Design intent (islands = topics with locks), and "Nhiệm vụ hôm
nay" stops being three flat counters and becomes a concrete lesson generated for that day, adapted
to the child's level.

- **Topic map (`/`)** — the five islands are now the five topics, in unlock order: 🐘 Động vật
  (`animals`), 🍎 Đồ ăn (`food`), 🏫 Trường học (`school`), 👨‍👩‍👧 Gia đình (`family`), ☀️ Thời tiết
  (`weather`) — `client/src/content/topics.ts`. An island links to `/topic/:id`; a locked island
  keeps its place on the trail but renders 🔒 + a "Chưa mở khóa" chip and is not a link.
  "🗣️ Các bậc luyện nói" and "👨‍👩‍👧 Phụ huynh" keep their Phase 6 placement; "Nghe kể chuyện" is no
  longer an island (`/stories` is still routable, reached from a topic hub or a lesson item).
  - **Unlock rule** (`client/src/progress/topicProgress.ts`) — `animals` is always unlocked; a
    later topic unlocks once the *previous* topic has ≥ 6 of its 8 words unlocked in Leitner.
    **Migration exception**: a topic with any existing progress — any word already unlocked, or
    any of its sentences with stars > 0 — unlocks regardless of the chain, so a phase 1–6 player's
    map never loses content the update would otherwise hide.
  - **Island stars** (`topicStars`, 0–3): 0 words unlocked → 0★, ≥ 1 → 1★, ≥ 6 → 2★, all 8 → 3★.
- **Topic hub (`/topic/:id`)** — header (emoji + name + island StarRow) over three ≥ 64 px section
  cards (`client/src/screens/TopicHub.tsx`): 🧩 **Từ mới** → `/words/<id>` (`x/8 từ` unlocked);
  🧱 **Ghép câu** → `/sentences?topic=<id>` (`SentenceList` filters to the topic when the query
  param is present, unfiltered otherwise) showing how many of the topic's sentences have stars;
  🎧 **Truyện** lists the topic's stories with a StarRow each, or a muted "Sắp có 📖" card (never a
  link) when the topic has none yet. An unknown or still-locked id renders a "Chưa mở khóa" screen
  with a back link, so a deep link from PWA history never dead-ends.
- **Daily lesson engine (`client/src/progress/lesson.ts`, `lessonStore.ts`)** — pure,
  localStorage-backed, no server call. `getLesson(now)` returns the day's lesson, generating and
  persisting it (`speakup.lesson.<dayKey>`, pruned to the most recent 30 days) on the first call of
  the day; generation is seeded off the day key (`shuffleTiles`'s mulberry32 stream), so a reload
  never changes what a day already handed out. Recipe by length
  (`speakup.lesson.length`, default `medium`, set from the Parent Dashboard):

    | length | 🎧 listen | 🗣️ speak | 🧩 word | 🔁 review | ≈ time |
    |---|---|---|---|---|---|
    | short | 1 | 2 | 2 | 1 | ~8 phút |
    | medium | 1 | 4 | 3 | 2 | ~12 phút |
    | long | 1 | 6 | 4 | 3 | ~18 phút |

  - **listen** — the story with the fewest stars; among the stories tied at that count the day
    index picks one (`tied[daysSinceEpoch % tied.length]`), so once the child has played them all
    — when every day is a tie — the three take turns rather than the seed favouring one. Done once
    a `story` activity event for it lands after the lesson was created.
  - **speak** — drawn from the union of speaking levels up to the child's band (1 sound tiles → 2
    word-pop cards → 3 minimal pairs → 4 sentence stars → 5 story voice); half the slots (rounded
    up) come from the band's newest level, the rest from the levels below, all seeded per day.
    Sound/word cards touching a phoneme averaging < 80 (`weakPhonemes`) are picked first.
  - **word** — new (unlocked-word-count = 0) words dealt round-robin across **every** unlocked
    topic in `dayTopicOrder(day)` (see the mixing rules below), then locked decks once every open
    deck is finished, all seeded.
  - **review** — due Leitner words first, then the previously-attempted item (any kind, stars > 0,
    at or below the child's band) with the fewest stars; a brand-new player with nothing to review
    yet gets extra new words as filler instead.
  - An item counts done (`itemDone`) when a matching activity event lands after the lesson was
    created with `score === undefined || score >= 60` (a sound tile matches any of its group's word
    cards, since `SoundPractice` logs the card, not the group).
  - **Mission compatibility** — `missionStatus`/`completedDays`/`streak`/`weekDots`
    (`client/src/progress/activity.ts`) mark a day done when **either** the legacy counters hold
    (1 story, 5 speaks, 3 words scored ≥ 60) **or** that day's persisted lesson is complete
    (`lessonDone`). History earned on phases 1–6, before lessons existed, keeps counting under the
    old rule. Home's `MissionCard` now shows the lesson's `doneCount/total`, and the celebration
    handoff to `/mission/done` fires on lesson completion exactly as it did on counter completion.
- **Difficulty band (`client/src/progress/band.ts`)** — `speakup.band` stores
  `{ value: 1–5, mode: 'auto' | 'manual' }`.
  - **Init** (nothing stored yet): 5 if any `voice:*` stars > 0, else 4 if any `sstar:*`, else 3 if
    any `pair:*`, else 2 if any Word Pop card has stars, else 1 — so a returning phase 1–6 player is
    never dropped back to sound tiles.
  - **Auto adjust** — runs once a day, at lesson generation, only in `auto` mode, and moves at most
    one level a day: **+1** after 3 consecutive prior days that were completed with that day's mean
    scored-event ≥ 80; **−1** after 2 consecutive prior days that were started (any event) but not
    completed, or completed with a mean < 60 — a day with no events at all is a rest day, not a bad
    one.
  - **Manual** — the parent picks a value (`setBandValue`), which stops auto adjustment until they
    re-enable it (`setBandAuto`, which resumes auto from wherever the value currently sits).
- **Daily Mission screen (`/mission`, rewritten)** — lists today's lesson items in order, each as
  emoji + label (e.g. "🗣️ Nói: The cat is under the table.") with "✓ Xong" once done; the first
  undone item gets a teal ring and "bắt đầu ở đây!"; the single CTA reads "Bắt đầu <emoji>" and
  routes straight to that item, so the child never has to choose. The header shows the band as a
  chip ("Bậc ⭐ 3") next to the `doneCount/total` chip. All items done → the same celebration
  handoff as before.
- **Parent Dashboard additions (`/parent`)** — a new "Bài học" card: **Độ khó** shows the current
  band as five buttons (1–5, each labelled "Bậc N" for assistive tech, the visible face staying the
  bare numeral) plus a "Tự động" toggle for the mode — picking a band switches to manual, and
  toggling auto back on resumes from the value it is already at; **Thời lượng** offers three chips
  (Ngắn ~8 phút / Vừa ~12 phút / Dài ~18 phút) that set `speakup.lesson.length`. Styled consistent
  with the rest of the (kid-palette) dashboard.

**New storage keys:** `speakup.band` — difficulty band + mode; `speakup.lesson.<dayKey>` — that
day's generated lesson (pruned to the most recent 30); `speakup.lesson.length` — lesson length
(`short`/`medium`/`long`, default `medium`).

**New route:** `/topic/:id` (topic hub). `/sentences` gained an optional `?topic=<id>` filter.

## Phase 8 — Mission flow & practice polish

Ten fixes from the first live session on Phase 7, plus the scoring bugs behind three of them: the
Daily Mission became a flat list of individual items instead of the prototype's grouped step
cards, practice screens gave the child no way back into the lesson or on to its next step, Tập âm's
layout wandered, WordCard hid its own score, and a single cold Azure token request could pin a
whole card to the phoneme-blind fallback with a scary "lỗi kết nối Azure" message.

- **Daily Mission (`/mission`) shows groups, not items** (`client/src/progress/missionNav.ts`
  `groupItems`, `client/src/screens/DailyMission.tsx`) — today's lesson items are bucketed by kind
  in the order the generator laid them out (never a hard-coded listen → speak → word → review), one
  card per group: emoji, title ("Nghe 1 truyện" / "N thẻ phát âm" / "M từ mới" / "K bài ôn tập"),
  `doneCount/total`, a "Bước i" caption, and either a "≈ N phút" chip or "✓ Xong". The first group
  with an undone item gets a teal ring + "· bắt đầu ở đây!"; every card links to the group's first
  undone item (a finished group links to its first item, for a replay), carrying router state
  `{ mission: true }` (`MISSION_STATE`) so the screen it opens knows it is a lesson step. Cards sit
  in a grid, up to 4 columns from `lg`, stacked below. The single sticky CTA goes to the ringed
  group and reads "Bắt đầu ▸" while `doneCount === 0`, "Tiếp tục ▸" after — the same rule
  `MissionCard` already used on Home (`client/src/components/MissionCard.tsx`). `/mission` also
  gained Home's once-per-day celebration redirect: on mount, a lesson that is `done` and not yet
  celebrated today marks itself celebrated and navigates to `/mission/done`.
- **Mission session: numbering, back, next** (`client/src/progress/missionNav.ts`) — a new
  `missionPosition`/`missionNext`/`useMissionNext` walk today's lesson to place whatever route the
  child is standing on. `SoundPractice`, `PracticeCard`, `PairPractice`, `StarPractice`,
  `VoicePractice`, `WordCard` and `SentenceBuilder` become mission-aware whenever they were reached
  with `state: { mission: true }` (`StoryPlayer` is excluded — stories keep their own flow, per
  spec §3):
  - The header grows a position chip built from `mission.pos.index`/`mission.pos.total`: "Âm i/N"
    (SoundPractice), "Thẻ i/N" (PracticeCard/PairPractice/StarPractice/VoicePractice), "Từ mới i/N"
    (WordCard), "Câu i/N" (SentenceBuilder). The number counts inside `mission.pos.group`, so the
    noun has to agree with it: `missionNoun(pos, own)` replaces every one of those with "Ôn tập i/N"
    when the lesson filed the step under 🔁 — a word reached from review is not "Từ mới" anything.
  - `BackButton` targets `/mission` labelled "Nhiệm vụ" instead of the screen's usual deck/level.
  - The finish/next CTA calls `mission.go()`, which either advances to `nextRoute` (still carrying
    `{ mission: true }`) or, when nothing follows, returns to `/mission` with no state (which then
    celebrates if the lesson is now done). The label is decided by `missionNext`: "Tiếp theo →"
    whenever an undone step still follows this one in lesson order — the rest of this group, then
    the next group's first undone item; only once nothing follows does it distinguish "Hoàn thành
    🎉" (this really was the last thing outstanding anywhere in the lesson) from "Về nhiệm vụ →" (an
    earlier group is still open) — a child replaying an already-finished later group while an
    earlier one waits must not be told the lesson is done. Free play (no `mission` state) is
    unaffected: every screen behaves exactly as before, and `LessonChip`
    (`client/src/components/LessonChip.tsx`, mounted globally)
    stays as the thread back to a lesson reached without the flag — except it hides itself whenever
    the screen *is* mission-aware, since the header/CTA already cover that; it only keeps showing
    on `/story/*` routes in mission mode, because stories don't carry the flag through their own
    flow. "Mission-aware" is asked, never assumed: the chip calls `isItemRoute()` — the same exact
    route match `missionNav` walks with — so the flag alone is not enough to suppress it. A child
    upgrading from Phase 8 has a whole-group `/sound/<ph>` step in storage and lands on
    `/sound/<ph>/<cardId>`, where the screen finds no mission of its own; the chip is then the only
    control on screen that leads back.
- **SoundPractice two-row layout** (`client/src/screens/SoundPractice.tsx`) — the practice area is
  a two-row grid (`grid-cols-[minmax(180px,auto)_1fr]` from `sm`, stacked below) sharing columns so
  cells line up: row 1 is the sound (mouth/IPA tile + "🔊 Nghe âm lẻ" | the phoneme's
  `PHONEME_TIPS`), row 2 is the word (emoji tile + "🔊 Nghe mẫu" | word text, IPA, and a "Từ n/3"
  chip), row 2 only rendered while idle. **Approved deviation from spec §4:** once recording starts
  or a result lands, the word cell stops existing, so the "Từ n/3" chip relocates into the header
  next to the mission's "Âm i/N" chip instead of simply disappearing — the run's position inside
  the sound is never off-screen, just relocated.
- **Scoring resilience** (root cause of "lỗi kết nối Azure") — `createScorer()`
  (`client/src/scoring/createScorer.ts`) retries the token fetch once after a 700 ms backoff before
  falling back to Web Speech, since a Vercel cold start can fail only the first request; offline
  skips the retry outright. The fallback is no longer sticky: `useSpeakingAttempt.startRecording`
  (`client/src/speaking/useSpeakingAttempt.ts`) checks, on every mic tap while the current scorer is
  `webspeech` and `navigator.onLine`, whether a fresh `createScorer()` now comes back `azure`, and
  adopts it before opening the mic — one failed token fetch can no longer pin a whole card to the
  phoneme-blind engine. That re-check is awaited, so the mic reads as busy (`micState:
  'processing'`) rather than idle for the moment it takes; a `startingRef` guard rejects a second
  tap that lands inside that window. `SoundPractice`'s unscored copy no longer blames a connection
  the child has never heard of: the simple engine → "Chế độ đơn giản chưa chấm được âm lẻ — bé thử
  lại nhé!"; an Azure result that simply missed the phoneme → "Chưa nghe rõ âm này — thử lại nhé!".
- **WordCard flip: hint instead of buttons** (`client/src/screens/WordCard.tsx`) — the
  "MẶT TRƯỚC"/"MẶT SAU" chips and the two 🔄 flip buttons are gone; the card itself is the control
  (`role="button"`, `tabIndex=0`, `aria-label="Lật thẻ"`, Enter/Space still flip it). While
  un-flipped and idle it runs a CSS `peek` keyframe (rotateY 0 → −18° → 0 over 0.9 s) every 4 s,
  starting 2.5 s after mount, driven purely by `animation-delay`/`animation-iteration-count` and a
  `hasFlipped` class that turns it off for good after the first flip.
- **WordCard shows its score** — after an attempt, `Stars` (from `toFeedback(result).stars`) and a
  "Điểm: NN" chip (rounded overall, hidden when the engine returned no usable number) render under
  the card, alongside the existing `HintCard` on retry and the 🔓 "Mở khoá!" banner.
- **Guess praise reads as a guess, not a score** — the meaning-guess praise is now
  "Đoán đúng rồi! 🎉" and clears itself after 1.5 s on a timer, instead of persisting until the
  first flip (where it used to sit right where the pronunciation score lands).

## Phase 9 — Per-word sound practice, cross-topic lessons, eight islands

Three asks drove this phase: a Tập âm card should drill **one word** of a sound at a time instead
of its whole 3-word run; the daily mission and the topic islands are **separate axes**, so the
mission mixes content from every unlocked topic instead of sitting on whichever one the map
happens to point at; and the map needed more content to mix, so it grew from five islands to eight.

- **Tập âm becomes a word list, then a per-word drill** (`client/src/screens/SoundWordList.tsx`,
  `SoundPractice.tsx`) — `/sound/:ph` is now a sub-level: the sound's 72 px IPA header,
  `PHONEME_TIPS[ph]`, a "🔊 Nghe âm lẻ" button, then one card per word of that sound (emoji, word,
  IPA, its own `StarRow`), each linking to `/sound/:ph/:cardId`. That route is exactly the old
  `SoundPractice` UI (two-row grid, mouth card, mic, `SoundChip` result) but scored and starred for
  **one** word; "Tiếp theo →" walks to the next word of the sound in free play, and the last word
  returns to the word list. The old whole-run behaviour (three words back to back under one score)
  is gone — nothing links to it any more.
  - **Stars** live per word at `sword:<cardId>`. The sound's own "stars" are no longer stored at
    all: `soundStars(ph)` (`client/src/progress/store.ts`) derives them as the **minimum**
    `sword:*` across the sound's words (so the tile only turns green once every word does), floored
    by whatever the old `sound:<ph>` key already holds — `max(derived, legacy)` — so a return
    visit from before this phase never looks like lost progress. The star rule per word is
    unchanged: target-phoneme score ≥ 80 → 3★, ≥ 60 → 2★, else 1★, capped at 2★ when the engine
    never scored the phoneme in that word.
- **The daily mission mixes every unlocked topic** (`client/src/progress/lesson.ts`) —
  no single "current topic" steers a lesson any more (the old `currentTopic()` helper had no caller
  left and is gone). A day's word and sentence slots are dealt across **every unlocked topic**
  instead of whichever one the map would point at next:
  - **`dayTopicOrder(day)`** ranks the unlocked topics by three keys, strongest first: **freshness**
    — an island the last lesson (and, at half weight, the one before it) never touched outranks one
    it did, which is what rotates the leading topic day to day and is what makes any two lessons in
    a row cover the whole open map while slots allow; then **the frontier** — among islands of equal
    freshness, the deck with the fewest learned words goes first, so the unlock chain keeps
    advancing; then **the day's seed** — what freshness and the frontier leave tied is settled by a
    `shuffleTiles` draw off `dayKey`, so a fresh profile (nothing learned, no lesson history) still
    gets a different order every day rather than the same one.
  - **`deal(order, pool)`** hands the topics' pools out one item at a time in a round-robin over
    `order`, skipping any topic whose pool has run dry — consecutive slots come from different
    topics while more than one still has content, and a topic that empties out drops from the cycle
    rather than ending it. New words (`newWordPool`) are dealt this way across the open map, then
    (a second pass) across the locked decks, so reaching ahead once every open deck is finished can
    never take a slot from an island still on the map.
  - **The 🧱 sentence slot spreads too** (`sentencePool`) — the islands the word slots did *not*
    reach lead the cycle, so an unbuilt sentence from an untouched island is offered before an
    unbuilt one from a touched island; only once no untouched island has an unbuilt sentence does a
    touched island's join the pool, and only once nothing anywhere is unbuilt does it fall back to
    replaying an already-starred sentence. This is still `deal`'s round-robin, not a strict
    two-phase split, so a lesson with more sentence slots than untouched islands keeps spreading
    once the untouched side runs dry instead of stacking every remaining slot on one island.
  - **Rebalanced recipe** (`RECIPES`, `client/src/progress/lesson.ts`) — a speak slot is now one
    word rather than three, and the new 🧱 group joined:

    | length | 🎧 listen | 🗣️ speak | 🧩 word | 🧱 sentence | 🔁 review | total | ≈ time |
    |---|---|---|---|---|---|---|---|
    | short | 1 | 2 | 2 | 1 | 1 | 7 | ~8 phút |
    | medium | 1 | 4 | 3 | 1 | 2 | 11 | ~12 phút |
    | long | 1 | 6 | 4 | 2 | 3 | 16 | ~18 phút |

  - `LessonItemKind` gains `'sentence'`; the Daily Mission group renders as "🧱 N câu ghép" after
    🧩 in lesson order, and a sentence item routes to `/sentence/<id>`, done at score ≥ 60 or
    unscored — the same bar `SentenceBuilder` already logs against. No island name or topic list
    appears anywhere on the mission screen; mixing is invisible on purpose.
- **Three new topics — eight islands** (`client/src/content/topics.ts`,
  `client/src/content/words/{colors,body,toys}.json`) — **colors 🎨 Màu sắc**, **body 🧍 Cơ thể**,
  **toys 🧸 Đồ chơi** append to `TOPICS`, 8 words each, same shape/convention as the existing decks.
  Final unlock order: animals, food, school, family, weather, colors, body, toys. Twelve sentences
  (s21–s32, 4 per new topic) append to `sentences.json`.
  - **Unlock** (`client/src/progress/topicProgress.ts`, `OPEN_FROM_START = 4`) — the **first four**
    topics (animals, food, school, family) are open from the start, so the mixing rules above have
    something to spread across on day one; each later topic still unlocks once the previous deck
    reaches ≥ 6/8 words unlocked, and the migration exception (any existing progress in a topic
    opens it regardless of the chain) is unchanged.
  - **Map** (`client/src/screens/Home.tsx`) — eight islands in a two-row serpentine (row one left →
    right, row two right → left) inside the existing 1194×834 frame, 96 px discs (`lg` 112 px), the
    dotted trail redrawn through the eight centres. Below `lg` the islands fall back to a 2-column
    grid, unchanged from Phase 7. The eight slots are hand-placed against that hand-fitted trail,
    so `Home.tsx` throws at module load if `TOPICS` ever outgrows `SLOTS` — a ninth topic would
    otherwise render an unpositioned, colourless disc on top of the first island.
- **Island role, made visible** (`client/src/screens/Home.tsx`, `TopicHub.tsx`) — each unlocked
  island's label grows a "Luyện thêm" subtitle under the topic name, so the map reads as the
  free-choice library it is, next to (never instead of) the daily mission. **Approved deviation
  from the spec:** the subtitle renders only on unlocked islands — a locked tile already carries a
  "Chưa mở khóa" chip in that spot, so there is nothing left to caption twice. The topic hub's 🧩 Từ
  mới and 🧱 Ghép câu sections show a teal "Có trong nhiệm vụ hôm nay" chip whenever that section
  holds an item of today's lesson (matched by route against `lessonStatus().items`), so the
  relationship between the two axes — practising here counts there — is visible without merging
  them; 🎧 Truyện already showed this per story via its `StarRow` row.

**New routes:** `/sound/:ph/:cardId` (per-word Tập âm practice). `/sound/:ph` is repointed from a
3-word carousel to the word list described above.

**New storage keys:** `sword:<cardId>` — per-word Tập âm stars; `sound:<ph>` stops being written but
is still read as a floor by `soundStars`.

## iPad setup & testing (Thiết lập trên iPad)

1. Make sure your iPad and PC are on the same Wi-Fi network.
2. On the PC, find your LAN IP address:
   ```bash
   ipconfig
   ```
   Look for the "IPv4 Address" under your active adapter (Wi-Fi or Ethernet), e.g. `192.168.10.4`.
3. Start the dev server on the PC: `pnpm dev`.
4. On the iPad, open Safari and go to `https://<PC-LAN-IP>:5173` (e.g. `https://192.168.10.4:5173`).
5. Safari will warn about the self-signed certificate — tap **Show Details → visit this website** to accept it.
6. Tap the **Share** button → **Add to Home Screen** to install the app (Thêm vào Màn hình chính).
7. Open the app from the Home Screen icon and test — the microphone will only work over HTTPS, which is why step 2 (LAN HTTPS) is required.

> **Service worker / offline on iOS:** iOS Safari refuses to register a service worker on a
> self-signed certificate, so the PWA install above gives you the icon and full-screen chrome but
> **not** offline caching. To verify the PWA/offline behaviour on the iPad you need a certificate the
> device actually trusts: generate one with [`mkcert`](https://github.com/FiloSottile/mkcert), install
> the mkcert CA profile on the iPad, and enable it under **Settings → General → VPN & Device
> Management → Certificate Trust Settings**. Until that is done, the checklist below only validates
> the manifest/meta tags (icon, full-screen launch, theme colour), not service-worker caching.

### Verified on iPad

> Manual checklist — could not be executed in this environment (no physical iPad available). Run these steps on an actual iPad and fill in the results.

| # | Step | Expected result | Result |
|---|------|------------------|--------|
| 1 | Share → Add to Home Screen | Opens full-screen, cream background, Nunito font | ⏳ pending |
| 2 | Sound Zoo → "three": tap 🔊 → hears Jenny; tap mic → permission prompt → accept; say "three"; tap stop | Stars appear within 3 s; word colored; hint shows if score < 80 | ⏳ pending |
| 3 | "Nghe mình" (listen to self) | Plays back the recording | ⏳ pending |
| 4 | Turn Wi-Fi off → reload | Header shows "chế độ đơn giản"; scoring still returns stars (Web Speech fallback) | ⏳ pending |
| 5 | Close and reopen the app | Stars persist | ⏳ pending |
| 6 | Words → Food → "apple": tap 🔊 → say "apple" | Say-to-unlock flow: mic → record → stars; ≥60 unlocks word (🔒→🔓); ≤3 attempts show first unlock attempt | ⏳ pending |
| 7 | Unlock same word again next day (or change date) → Words → Food → "apple" | Appears in review deck ("Ôn tập hôm nay") if due; re-attempt gives higher box | ⏳ pending |
| 8 | Sentences → pick a sentence; tap tiles in wrong order, then right order | Wrong order: tray shakes + Foxy hint. Correct: sentence reads, then mic to record response | ⏳ pending |
| 9 | Home → complete all 3 mission steps (quiz + 5 attempts + 3 words ≥ 60) | Mission rows fill; the next visit to Home redirects once that day to `/mission/done` for the confetti + Foxy cheer — there is no confetti overlay on Home itself (the mission stays complete, it does not reset) | ⏳ pending |
| 10 | Complete mission on 2 consecutive days | Streak shows "🔥 2 ngày"; week dot changes ★ to ○ per day | ⏳ pending |
| 11 | Home → tap the "👨‍👩‍👧 Phụ huynh" link → answer the math question | Parent Dashboard unlocks: 14-day chart, weak phonemes, last 20 recordings (play button works) | ⏳ pending |
| 12 | Parent Dashboard → set limit to 5 minutes → go back to Home → spend 6 minutes → Home | Gentle banner: "Hôm nay bé học đủ rồi 🦊" — a notice only, with no dismiss control and no block on practising | ⏳ pending |
| 13 | Home in landscape, then rotate to portrait | Landscape: island map on the dotted path. Portrait: islands stack into a scrollable 2-column grid, mission card and parent link stay reachable | ⏳ pending |
| 14 | Home → mission card → "Bắt đầu ▸" | Opens `/mission` on the first not-yet-done step | ⏳ pending |
| 15 | Complete the 3rd mission step | Routes to `/mission/done` with confetti + Foxy cheer | ⏳ pending |
| 16 | Speak card (`/practice/:cardId`) → tap mic | A countdown number under the word ticks 6→1 while recording, mirroring the auto-stop timer | ⏳ pending |
| 17 | Words → Food → any word card → tap the card (whole card is the control, `aria-label="Lật thẻ"`, no separate 🔄 button) | Card flips (emoji/IPA face ↔ Vietnamese/example face) | ⏳ pending |
| 18 | Sentence Builder → any sentence | Tiles are colored by role (who/does/what), with the legend between the tray and the tile pool | ⏳ pending |
| 19 | Parent Dashboard → tap "Khoá lại" | Immediately re-locks and shows a fresh math question, without leaving `/parent` | ⏳ pending |
| 20 | Story player → tap the subtitle switch | Toggle switch flips state and announces it (e.g. "Phụ đề bật") | ⏳ pending |
| 21 | Tập âm → `/level/sound-zoo` → open a sound tile → tap "🔊 Nghe âm lẻ" | Plays the isolated-sound sample (just the phoneme, not a full word) | ⏳ pending |
| 22 | Tập âm practice → score a word, then tap "🔊 Nghe mẫu" under the result | Replays that word's own sample (the same audio as before the attempt). The /θ/ chip next to it is a read-out, not a button — nothing happens when it is tapped | ⏳ pending |
| 23 | Đọc từ (Word Pop) → say a word twice in a row scoring ≥ 80 | Streak fills ●●, then awards 3 stars ("Lần 1/2 · Lần 2/2 ✓") | ⏳ pending |
| 24 | Học từ mới → new card → tap a wrong meaning in "Đoán nghĩa" | Card shakes and lets the child try again | ⏳ pending |
| 25 | Học từ mới → "Ôn tập hôm nay" → open a due word | English word is hidden (emoji + Vietnamese only) until "Gợi ý" is tapped | ⏳ pending |
| 26 | Nghe & chọn (`/level/minimal-pairs`) → open a pair → listen, choose, then read both words | 🔊 plays one word, tapping the matching card gives ✅/🙈 + Foxy. The line under the cards ticks off one word at a time ("ship ✓ · sheep ○") and the mic step appears only after BOTH words have been picked correctly — deliberately getting the same word right twice must not open it | ⏳ pending |
| 27 | `/levels` stairs | "Nghe & chọn" step shows unlocked (not the 🔒 "Sắp có" placeholder) | ⏳ pending |
| 28 | Turn Wi-Fi off (header shows "chế độ đơn giản") → Tập âm → say all 3 words of a sound | Chip reads "Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!" with no number and no mention of "Azure"; the word's own score still shows, and the run awards at most 2 stars | ⏳ pending |
| 29 | Học từ mới → "Ôn tập hôm nay" → open a due word | No 🔊 on the hidden front face; it appears only after "Gợi ý" is tapped | ⏳ pending |
| 30 | Sentence Stars → open a sentence with a linked pair (e.g. ss1 "red apple") | Stressed words render coral and larger; the linked pair shows a small ‿ connector underneath | ⏳ pending |
| 31 | Sentence Stars practice → tap the rhythm card | Each dot pops once when its word is spoken — the beat travels left to right with the voice, the dots never pulse in unison, and the dot for each stressed word is visibly bigger. Tapping again replays it | ⏳ pending |
| 32 | Sentence Stars → score a sentence | Result shows a "Nhịp: 🐢 chậm" / "Nhịp: 🙂 khá — nói liền hơi hơn nhé" / "Nhịp: 🎵 tốt" line under the stars, driven by the fluency score | ⏳ pending |
| 33 | Story Voice → open any passage | Mood badge (emoji + "Đọc với giọng: …") and the "🎭 Gợi ý giọng" tips card show before the mic opens | ⏳ pending |
| 34 | Story Voice → score a passage over Wi-Fi (Azure) | A big "Ngữ điệu NN" chip leads the result, toned by the prosody score, ahead of the score bars | ⏳ pending |
| 35 | Turn Wi-Fi off (header shows "chế độ đơn giản") → Story Voice → score a passage | Chip reads "Chưa chấm được ngữ điệu" instead of a number, the fourth score bar is empty and labelled "Ngữ điệu —", and the run is capped at 2 stars | ⏳ pending |
| 36 | `/levels` stairs | All 5 steps show as playable links — Sentence Stars and Story Voice have no 🔒 "Sắp có" placeholder left | ⏳ pending |
| 37 | Story Voice → tap the mic and read a whole passage slowly, with feeling | The countdown ticks 13→1 and the mic stays open to the end of the third sentence — it must not cut off mid-passage | ⏳ pending |
| 38 | Story Voice → open each of the 8 passages in landscape | The whole screen fits with no scrolling and the mic is fully visible above the fold on every one, including the longest (sv4) | ⏳ pending |
| 39 | Home → tap the Weather island (locked, at the far right) | Renders 🔒 with a "Chưa mở khóa" chip and does not navigate; unlock it by learning ≥ 6/8 Family words, then tap again | ⏳ pending |
| 40 | Home → tap the Animals island | Opens `/topic/animals`: emoji + name + island star row, then three cards — 🧩 Từ mới, 🧱 Ghép câu, 🎧 Truyện (with story links + stars, or "Sắp có 📖" for a topic with none yet) | ⏳ pending |
| 41 | Topic hub → tap 🧩 Từ mới, then 🧱 Ghép câu | Từ mới opens `/words/<topic>` for that topic only; Ghép câu opens `/sentences?topic=<topic>` showing only that topic's sentences | ⏳ pending |
| 42 | Home → mission card → "Bắt đầu ▸" | Opens `/mission` showing today's lesson as grouped step cards (e.g. "🎧 Nghe 1 truyện", "🗣️ 4 thẻ phát âm", "🧩 3 từ mới"), not a flat item list; each card shows its own `x/N` progress and a "Bước i" caption; the first group with an undone item has a teal ring and "· bắt đầu ở đây!" | ⏳ pending |
| 43 | `/mission` → tap the ringed group's card (or the sticky CTA), finish its first undone item, return to `/mission` | That group's `x/N` progress advances; once every item in it is done the card shows "✓ Xong" instead of the "≈ N phút" chip, and the teal ring/CTA move to the next group with an undone item | ⏳ pending |
| 44 | `/mission` header | Shows a "Bậc ⭐ N" chip matching the band set in Parent Dashboard, next to the `doneCount/total` chip | ⏳ pending |
| 45 | Parent Dashboard → "Bài học" card → tap a band number (e.g. 4) | That button highlights (coral) and "Tự động" un-highlights; reopening `/mission` draws speaking practice from the new band | ⏳ pending |
| 46 | Parent Dashboard → "Bài học" card → tap "Tự động" after picking a band manually | "Tự động" highlights (teal) again, resuming automatic band adjustment from the current value | ⏳ pending |
| 47 | Parent Dashboard → "Bài học" card → tap a length chip (Ngắn / Vừa / Dài) | That chip highlights; the next day's (or a freshly cleared day's) lesson has the matching item count | ⏳ pending |
| 48 | `/mission` → tap a group card that is NOT yet ringed teal (e.g. tap "🧩 3 từ mới" while "🎧 Nghe 1 truyện" is still the ringed one) | Opens that group's first item anyway — the child can jump ahead, not just follow the ring | ⏳ pending |
| 49 | `/mission` → open any of today's speak/word/sentence items from a group card | Screen header shows a position chip ("Âm i/N" / "Thẻ i/N" / "Từ mới i/N" / "Câu i/N") and the back arrow reads "Nhiệm vụ" instead of the usual deck/level name; tapping it returns to `/mission`, not the deck | ⏳ pending |
| 50 | `/mission` → open a speak/word/sentence item that is not the last item of its group, finish it | The finish button reads "Tiếp theo →" and opens the next item of the same group, still tagged as a mission step | ⏳ pending |
| 51 | `/mission` → open the last item of a group while another group still has undone items, finish it | The finish button reads "Về nhiệm vụ →" (not "Hoàn thành 🎉"); tapping it returns to `/mission`, which still shows the other group open | ⏳ pending |
| 52 | `/mission` → finish the very last undone item of the whole lesson | The finish button reads "Hoàn thành 🎉"; tapping it routes to `/mission`, which immediately redirects to `/mission/done` for the confetti + Foxy cheer | ⏳ pending |
| 53 | Open a practice/word/sentence screen directly from Speak Lab, Words or Sentence Builder (not from `/mission`) | No position chip in the header, back arrow goes to the usual deck/level as before Phase 8, and finishing reads "Tiếp theo →" / "Hoàn thành 🎉" against that screen's own deck — free play is unchanged | ⏳ pending |
| 54 | `/mission` → open a story item, listen to it, then open a non-story mission item from the same lesson | While inside the story, a small floating "🌞 Nhiệm vụ x/N" chip (bottom-right) is visible and links back to `/mission`; once on the non-story item, that floating chip is gone (the header/back-button already cover it) | ⏳ pending |
| 55 | Tập âm → open any sound tile (free play or from `/mission`) | Two aligned rows: sound tile (mouth/IPA + "🔊 Nghe âm lẻ") over its description on the left column, word tile (emoji + "🔊 Nghe mẫu") over word text/IPA/"Từ 1/3" chip on the right column, both rows sharing the same left edge | ⏳ pending |
| 56 | Tập âm, opened from `/mission` → tap the mic to record a word | The "Từ n/3" chip moves up into the header next to the "Âm i/N" chip the instant recording starts (the word tile/description row disappears) — the count is never simply gone from the screen | ⏳ pending |
| 57 | Turn Wi-Fi off then quickly back on → Tập âm → tap mic right away | Mic briefly shows a busy/processing state (not an error) while it re-checks for Azure, then opens for real; if Azure answers, the header does not show "chế độ đơn giản" | ⏳ pending |
| 58 | Turn Wi-Fi off (header shows "chế độ đơn giản") → Học từ mới → say a word | Chip/feedback area never mentions "Azure"; wording is plain and encouraging | ⏳ pending |
| 59 | Học từ mới → any card, before the first tap | Card gently rocks (peeks open a little) every few seconds on its own, without being told to | ⏳ pending |
| 60 | Học từ mới → tap the card once to flip it, flip back, wait several seconds | The peek animation does not resume — it only ever happens before the first flip | ⏳ pending |
| 61 | Học từ mới → record a word and score it | Stars and a "Điểm: NN" score chip appear under the card, in addition to the existing hint (on a low score) and the 🔓 "Mở khoá!" banner (on unlock) | ⏳ pending |
| 62 | Học từ mới → a still-locked word → guess its meaning correctly | Shows "Đoán đúng rồi! 🎉" praise, which clears itself after about 1.5 s, well before the mic/flip step | ⏳ pending |
| 63 | Tập âm → `/level/sound-zoo` → tap a sound tile | Opens a word list: IPA header + tip text + "🔊 Nghe âm lẻ", then one card per word of that sound (emoji, word, IPA, its own star row) — not the old 3-word run | ⏳ pending |
| 64 | Sound word list → tap one word card → say it, then tap "Tiếp theo →" | Opens the practice screen for that one word only; scoring it stars only that word (`sword:<cardId>`); "Tiếp theo →" walks to the next word of the sound, and the last word returns to the word list | ⏳ pending |
| 65 | Complete today's mission, then advance the date (or wait) a day and complete the next mission | The two days' 🧩/🧱 items are drawn from different topics where the map allows — the child is not stuck reviewing the same island two days running | ⏳ pending |
| 66 | `/mission` | A "🧱 N câu ghép" group card appears after "🧩 N từ mới" (once the lesson length includes a sentence slot); tapping it opens Sentence Builder for that item | ⏳ pending |
| 67 | Home | Eight islands total (Động vật, Đồ ăn, Trường học, Gia đình, Thời tiết, Màu sắc, Cơ thể, Đồ chơi) in a two-row layout; the first four are open from a fresh profile, the rest show 🔒 "Chưa mở khóa" until unlocked | ⏳ pending |
| 68 | Home → tap an unlocked island → topic hub for a topic with a word or sentence in today's lesson | The 🧩 Từ mới and/or 🧱 Ghép câu section shows a teal "Có trong nhiệm vụ hôm nay" chip; a section with nothing in today's lesson shows no chip | ⏳ pending |

## Architecture

```
client/src/
  audio/        # recording (useRecorder) and playback (playUrl/playBlob) helpers
  scoring/       # pronunciation scoring: Azure scorer, Web Speech fallback, feedback/star logic
  content/       # lesson content data (Sound Zoo, Word Pop word lists) and types
  progress/      # stars/progress persistence (localStorage-backed store)
  components/    # shared UI: MicButton, Stars, HintCard, ScoredWords
  screens/       # routed pages: Home, LevelSelect, PracticeCard

server/src/      # Express API: issues short-lived Azure Speech tokens (GET /api/speech-token)
```

## Deploy
See [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md) — Vercel hosting with a serverless token function; audio files are committed so deploys have sound.
