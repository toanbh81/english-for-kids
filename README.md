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

## Phase 2 — Listening (Nghe kể chuyện)

A listening module that engages kids in illustrated stories with synchronized karaoke-style text. Kids listen to a 60–120 s story (6–7 scenes), see words light up in sync with narration, can slow playback, tap words to replay, toggle Vietnamese subtitles, then answer 3 picture questions and retell one target sentence.

**No-audio fallback:** If you have not yet run `gen-story.mjs` or audio files are missing, the player still works — it drives the karaoke from an estimated word timing based on a silent clock (Chưa có giọng đọc — chữ chạy theo nhịp ước lượng). Everything is testable without Azure Speech.

Features:
- **Karaoke player** with scene art (large emoji on gradient), current word enlarged in coral, past words greyed out
- **Speed control:** a single 🐢/🐇 button toggles between 0.75× and 1× (both the audio and the karaoke)
- **Tap-word replay:** tap any word to hear it in isolation — from the narration once it exists, otherwise spoken by the browser's own voice (`speechSynthesis`)
- **Subtitles toggle:** 🇻🇳 Vietnamese subtitles
- **Background music:** procedural ambient pad (Web Audio, toggle remembered in `localStorage`)
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
| 6 | Stories → The Little Fox → play scene 1; tap 🎵 twice | Music stops, then starts again while the story keeps playing; selection persists across reload | ⏳ pending |
| 7 | Stories → The Little Fox → play scene 1; tap the 🐢 speed button | Karaoke slows to 0.75×; the button becomes 🐇 | ⏳ pending |
| 8 | Stories → The Little Fox → scene 1, tap the word "Foxy" | Until narration is generated, the word is spoken by the browser voice (speechSynthesis) and the karaoke pauses on it | ⏳ pending |
| 9 | Stories → The Little Fox → finish quiz (3 questions), then Retell → speak "He wants an apple." | Lenient score (1–3 stars) appears; encouragement message shown | ⏳ pending |
| 10 | After running `gen-story.mjs`: play scene 1 and tap 🐢 | 🐢 actually slows the audio (not just the karaoke) | ⏳ pending |
| 11 | Retell → record once, go back to the player, tap a word | speechSynthesis word replay works after a mic recording | ⏳ pending |
| 12 | Play with 🎵 on → lock the iPad → unlock and tap ▶ / 🎵 | Music resumes after lock/unlock instead of staying silent | ⏳ pending |

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
pnpm test        # client (Vitest, 132 tests) + server (Vitest, 2 tests)
pnpm lint        # oxlint on the client
pnpm typecheck   # tsc -b (client) + tsc --noEmit (server)
```

`pnpm test` runs `pnpm -r test`, which executes the client suite (`vitest run`, 132 tests in 21
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
