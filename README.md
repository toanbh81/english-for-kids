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
pnpm test        # client (Vitest, 426 tests) + server (Vitest, 2 tests)
pnpm lint        # oxlint on the client
pnpm typecheck   # tsc -b (client) + tsc --noEmit (server)
```

`pnpm test` runs `pnpm -r test`, which executes the client suite (`vitest run`, 426 tests in 52
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
  sample and the dots beat once per word while the sample plays — the card loads the clip itself
  and takes the tempo from its duration (duration ÷ word count, ~420 ms a word if the browser
  reports no duration). Stars weigh accuracy, fluency **and** completeness together
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
  ahead of the usual score bars. Prosody is never faked from accuracy: when a run has no prosody
  score the chip says so and the fourth score bar stays empty, labelled "Ngữ điệu —". Stars
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
| 17 | Words → Food → any word card → tap the card (or the "Lật thẻ" button on the face) | Card flips (emoji/IPA face ↔ Vietnamese/example face) | ⏳ pending |
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
| 28 | Turn Wi-Fi off (header shows "chế độ đơn giản") → Tập âm → say all 3 words of a sound | Chip reads "Chưa chấm được âm — cần kết nối Azure" with no number, the word's own score still shows, and the run awards at most 2 stars | ⏳ pending |
| 29 | Học từ mới → "Ôn tập hôm nay" → open a due word | No 🔊 on the hidden front face; it appears only after "Gợi ý" is tapped | ⏳ pending |
| 30 | Sentence Stars → open a sentence with a linked pair (e.g. ss1 "red apple") | Stressed words render coral and larger; the linked pair shows a small ‿ connector underneath | ⏳ pending |
| 31 | Sentence Stars practice → tap the rhythm card | The dots beat once per word while the sample plays, in step with the voice; the dot for each stressed word is visibly bigger | ⏳ pending |
| 32 | Sentence Stars → score a sentence | Result shows a "Nhịp: 🐢 chậm" / "Nhịp: 🙂 khá — nói liền hơi hơn nhé" / "Nhịp: 🎵 tốt" line under the stars, driven by the fluency score | ⏳ pending |
| 33 | Story Voice → open any passage | Mood badge (emoji + "Đọc với giọng: …") and the "🎭 Gợi ý giọng" tips card show before the mic opens | ⏳ pending |
| 34 | Story Voice → score a passage over Wi-Fi (Azure) | A big "Ngữ điệu NN" chip leads the result, toned by the prosody score, ahead of the score bars | ⏳ pending |
| 35 | Turn Wi-Fi off (header shows "chế độ đơn giản") → Story Voice → score a passage | Chip reads "Chưa chấm được ngữ điệu" instead of a number, the fourth score bar is empty and labelled "Ngữ điệu —", and the run is capped at 2 stars | ⏳ pending |
| 36 | `/levels` stairs | All 5 steps show as playable links — Sentence Stars and Story Voice have no 🔒 "Sắp có" placeholder left | ⏳ pending |
| 37 | Story Voice → tap the mic and read a whole passage slowly, with feeling | The countdown ticks 13→1 and the mic stays open to the end of the third sentence — it must not cut off mid-passage | ⏳ pending |
| 38 | Story Voice → open each of the 8 passages in landscape | The whole screen fits with no scrolling and the mic is fully visible above the fold on every one, including the longest (sv4) | ⏳ pending |

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
