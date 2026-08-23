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

Sample word audio (Jenny's voice) is generated locally and saved to `client/public/audio/`. It is **not** committed — run this once after setup, or whenever you add new words:

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-audio.mjs three thank this very fish zoo ship chair red lion cat dog elephant monkey rabbit tiger bird horse sheep frog snake giraffe
```

Story narration (full scenes with per-word timings) is generated the same way:

```bash
AZURE_SPEECH_KEY=your-key AZURE_SPEECH_REGION=southeastasia node scripts/gen-story.mjs little-fox at-the-zoo my-breakfast
```

This writes mp3s to `client/public/audio/stories/<id>/` and fills word timings (start/end ms) into
each story's JSON; commit the updated JSON files afterwards (the mp3s themselves are gitignored).
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
whenever you add or change a sentence; the mp3s are gitignored like the other generated audio.

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
pnpm test        # client (Vitest, 309 tests) + server (Vitest, 2 tests)
pnpm lint        # oxlint on the client
pnpm typecheck   # tsc -b (client) + tsc --noEmit (server)
```

`pnpm test` runs `pnpm -r test`, which executes the client suite (`vitest run`, 309 tests in 41
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
