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
pnpm test        # client (Vitest, 22+ tests) + server (Vitest, 2 tests)
pnpm lint        # oxlint on the client
pnpm typecheck   # tsc -b (client) + tsc --noEmit (server)
```

`pnpm test` runs `pnpm -r test`, which executes the client suite (`vitest run`, 22+ tests) and the
server suite (`vitest run`, 2 tests). `pnpm lint` and `pnpm typecheck` fan out the same way.

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
