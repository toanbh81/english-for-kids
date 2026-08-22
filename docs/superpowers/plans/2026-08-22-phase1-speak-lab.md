# Phase 1 — Speak Lab (Sound Zoo + Word Pop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PWA that runs on iPad Safari, records the child's voice, scores pronunciation of single sounds and single words (Speak Lab levels 1–2) via Azure Pronunciation Assessment with a Web Speech fallback, and shows kid-friendly star feedback.

**Architecture:** Vite + React + TypeScript SPA (PWA via `vite-plugin-pwa`). A tiny Express server (`server/`) exposes `/api/speech-token` which exchanges the Azure key for a 10-minute token so the key never reaches the browser; the browser uses `microsoft-cognitiveservices-speech-sdk` directly with that token. All scoring engines implement one `PronunciationScorer` interface; a `createScorer()` factory picks Azure when online + token available, else Web Speech. Lesson content is static JSON under `src/content/`. Progress is stored in `localStorage` (IndexedDB deferred to Phase 3).

**Tech Stack:** Vite 5, React 18, TypeScript 5, Tailwind CSS 3, vite-plugin-pwa, microsoft-cognitiveservices-speech-sdk, Express 4, Vitest + @testing-library/react, pnpm.

**Spec:** `docs/2026-08-22-giai-phap-va-design-brief.md`

## Global Constraints

- Target device: iPad Safari ≥ 16. Recording must use `getUserMedia` and work after a user tap (Safari requires a gesture).
- Language/voice: `en-US` only.
- Azure tier F0 (free). Region and key come from `server/.env` (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`), never from the client bundle.
- Feedback rule: score 0–59 → 1 star, 60–79 → 2 stars, 80–100 → 3 stars. Show **at most one** correction hint per attempt.
- Tap targets ≥ 64×64 px; mic button ≥ 120 px. Font: Nunito (Google Fonts). Palette: cream bg `#FFF8EE`, coral `#FF7A59`, teal `#2BB3A3`, star yellow `#FFC43D`, good `#3CB371`, ok `#F5B700`, fix `#E8506A`.
- UI copy for instructions in Vietnamese; learning content in English.
- Commit after every task. Repo is initialized in Task 1.

---

## File Structure

```
english-speaking/
├─ package.json                 pnpm workspace root scripts (dev runs client+server)
├─ pnpm-workspace.yaml
├─ client/                      Vite React PWA
│  ├─ index.html
│  ├─ vite.config.ts            PWA plugin + /api proxy → server
│  ├─ tailwind.config.ts
│  ├─ src/
│  │  ├─ main.tsx, App.tsx      routing (react-router) between screens
│  │  ├─ styles.css
│  │  ├─ content/
│  │  │  ├─ types.ts            LessonCard, Level types
│  │  │  ├─ sound-zoo.json      level 1 cards
│  │  │  └─ word-pop.json       level 2 cards
│  │  ├─ audio/
│  │  │  ├─ recorder.ts         useRecorder hook (MediaRecorder → Blob)
│  │  │  └─ player.ts           playSample(url) / playBlob(blob)
│  │  ├─ scoring/
│  │  │  ├─ types.ts            PronunciationScorer, PronunciationResult
│  │  │  ├─ feedback.ts         result → stars, word colors, single hint
│  │  │  ├─ azureScorer.ts      Azure SDK implementation
│  │  │  ├─ webSpeechScorer.ts  Web Speech fallback
│  │  │  └─ createScorer.ts     factory with online/token detection
│  │  ├─ progress/
│  │  │  └─ store.ts            localStorage stars per card
│  │  ├─ components/
│  │  │  ├─ MicButton.tsx       idle/recording/processing/disabled
│  │  │  ├─ Stars.tsx
│  │  │  ├─ ScoredWords.tsx     word coloring
│  │  │  └─ HintCard.tsx
│  │  └─ screens/
│  │     ├─ Home.tsx            two level buttons + stars total
│  │     ├─ LevelSelect.tsx     cards list for a level
│  │     └─ PracticeCard.tsx    the 3-state practice screen
│  └─ src/**/*.test.ts(x)
└─ server/
   ├─ package.json
   ├─ src/index.ts              Express: GET /api/speech-token
   ├─ src/token.ts              fetchAzureToken(key, region)
   └─ .env.example
```

---

### Task 1: Repo + workspace scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `client/` (Vite template), `server/package.json`

**Interfaces:**
- Produces: `pnpm dev` runs client (5173) and server (8787) together.

- [ ] **Step 1: Init git and pnpm workspace**

```bash
cd D:/ToanBH/SourceCode/english-speaking
git init -b main
pnpm init
```

Write `pnpm-workspace.yaml`:
```yaml
packages:
  - client
  - server
```

Write `.gitignore`:
```
node_modules
dist
.env
*.local
```

- [ ] **Step 2: Scaffold client**

```bash
pnpm create vite client --template react-ts
cd client && pnpm add react-router-dom microsoft-cognitiveservices-speech-sdk
pnpm add -D vite-plugin-pwa tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

Replace `client/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Speak Up!',
        short_name: 'SpeakUp',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FFF8EE',
        theme_color: '#FF7A59',
        icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
      },
    }),
  ],
  server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true },
})
```

`client/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

`client/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8EE', coral: '#FF7A59', teal: '#2BB3A3', star: '#FFC43D',
        good: '#3CB371', ok: '#F5B700', fix: '#E8506A',
      },
      fontFamily: { sans: ['Nunito', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config
```

`client/src/styles.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&display=swap');
@tailwind base; @tailwind components; @tailwind utilities;
html, body, #root { height: 100%; }
body { @apply bg-cream font-sans text-slate-800; -webkit-user-select: none; }
```

Add a placeholder `client/public/icon-512.png` (any 512×512 PNG; generate with ImageMagick `magick -size 512x512 xc:#FF7A59 client/public/icon-512.png` or copy any image).

- [ ] **Step 3: Scaffold server**

`server/package.json`:
```json
{
  "name": "server", "private": true, "type": "module",
  "scripts": { "dev": "tsx watch src/index.ts", "test": "vitest run" },
  "dependencies": { "express": "^4.19.2", "dotenv": "^16.4.5" },
  "devDependencies": { "tsx": "^4.16.2", "typescript": "^5.5.4", "@types/express": "^4.17.21", "vitest": "^2.0.5" }
}
```
Run `cd server && pnpm install`.

`server/.env.example`:
```
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_REGION=southeastasia
```

Root `package.json` scripts:
```json
"scripts": {
  "dev": "pnpm -r --parallel dev",
  "test": "pnpm -r test",
  "build": "pnpm --filter client build"
}
```

- [ ] **Step 4: Verify both start**

Run: `pnpm dev`
Expected: Vite on http://localhost:5173 shows the default page; server prints nothing yet (index.ts added in Task 2). Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold pnpm workspace with Vite PWA client and Express server"
```

---

### Task 2: Token server `/api/speech-token`

**Files:**
- Create: `server/src/token.ts`, `server/src/index.ts`, `server/src/token.test.ts`

**Interfaces:**
- Produces: `GET /api/speech-token` → `{ token: string, region: string }` (HTTP 500 `{error}` if Azure fails). Client Task 5 consumes this.

- [ ] **Step 1: Write failing test**

`server/src/token.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { fetchAzureToken } from './token'

describe('fetchAzureToken', () => {
  it('posts key to the region token endpoint and returns the text token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'abc.token' })
    const token = await fetchAzureToken('KEY', 'southeastasia', fetchMock as unknown as typeof fetch)
    expect(token).toBe('abc.token')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://southeastasia.api.cognitive.microsoft.com/sts/v1.0/issueToken',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'Ocp-Apim-Subscription-Key': 'KEY' }) }),
    )
  })
  it('throws when Azure responds non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'bad' })
    await expect(fetchAzureToken('K', 'r', fetchMock as unknown as typeof fetch)).rejects.toThrow('401')
  })
})
```

- [ ] **Step 2: Run, expect fail**

Run: `cd server && pnpm test`
Expected: FAIL — cannot find module './token'.

- [ ] **Step 3: Implement**

`server/src/token.ts`:
```ts
export async function fetchAzureToken(key: string, region: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
  })
  if (!res.ok) throw new Error(`Azure token request failed: ${res.status}`)
  return res.text()
}
```

`server/src/index.ts`:
```ts
import 'dotenv/config'
import express from 'express'
import { fetchAzureToken } from './token.js'

const app = express()
const key = process.env.AZURE_SPEECH_KEY
const region = process.env.AZURE_SPEECH_REGION

app.get('/api/speech-token', async (_req, res) => {
  if (!key || !region) return res.status(500).json({ error: 'Azure not configured' })
  try {
    const token = await fetchAzureToken(key, region)
    res.json({ token, region })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

app.listen(8787, () => console.log('server on :8787'))
```

- [ ] **Step 4: Run tests, expect pass**

Run: `cd server && pnpm test` → 2 passed.
Manual: copy `.env.example` to `.env` with real key, `pnpm dev`, then `curl http://localhost:8787/api/speech-token` → JSON with a long token.

- [ ] **Step 5: Commit**

```bash
git add server && git commit -m "feat(server): Azure speech token endpoint"
```

---

### Task 3: Scoring types + feedback mapping

**Files:**
- Create: `client/src/scoring/types.ts`, `client/src/scoring/feedback.ts`, `client/src/scoring/feedback.test.ts`

**Interfaces:**
- Produces:
```ts
export type WordScore = { word: string; score: number; errorType: 'None' | 'Mispronunciation' | 'Omission' | 'Insertion'; phonemes: { phoneme: string; score: number }[] }
export type PronunciationResult = { overall: number; accuracy: number; fluency: number; completeness: number; prosody?: number; words: WordScore[]; engine: 'azure' | 'webspeech' }
export interface PronunciationScorer { score(audio: Blob, targetText: string): Promise<PronunciationResult> }
export type WordTone = 'good' | 'ok' | 'fix'
export type Feedback = { stars: 1 | 2 | 3; message: string; words: { word: string; tone: WordTone }[]; hint?: { word: string; phoneme?: string; tip: string } }
export function toFeedback(r: PronunciationResult): Feedback
```

- [ ] **Step 1: Write failing tests**

`client/src/scoring/feedback.test.ts`:
```ts
import { toFeedback } from './feedback'
import type { PronunciationResult } from './types'

const base = (over: Partial<PronunciationResult>): PronunciationResult => ({
  overall: 0, accuracy: 0, fluency: 0, completeness: 0, words: [], engine: 'azure', ...over,
})

describe('toFeedback', () => {
  it('maps score bands to stars and messages', () => {
    expect(toFeedback(base({ overall: 30 })).stars).toBe(1)
    expect(toFeedback(base({ overall: 60 })).stars).toBe(2)
    expect(toFeedback(base({ overall: 80 })).stars).toBe(3)
    expect(toFeedback(base({ overall: 30 })).message).toBe('Thử lại nào!')
    expect(toFeedback(base({ overall: 90 })).message).toBe('Tuyệt vời!')
  })
  it('colors words: >=80 good, 60-79 ok, <60 fix', () => {
    const fb = toFeedback(base({ overall: 70, words: [
      { word: 'I', score: 95, errorType: 'None', phonemes: [] },
      { word: 'like', score: 65, errorType: 'None', phonemes: [] },
      { word: 'three', score: 40, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'th', score: 20 }, { phoneme: 'r', score: 80 }] },
    ] }))
    expect(fb.words.map(w => w.tone)).toEqual(['good', 'ok', 'fix'])
  })
  it('gives exactly one hint for the lowest word and its worst phoneme', () => {
    const fb = toFeedback(base({ overall: 70, words: [
      { word: 'three', score: 40, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'th', score: 20 }, { phoneme: 'r', score: 80 }] },
      { word: 'very', score: 50, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'v', score: 30 }] },
    ] }))
    expect(fb.hint).toEqual({ word: 'three', phoneme: 'th', tip: 'Đặt đầu lưỡi giữa hai hàm răng rồi thổi nhẹ.' })
  })
  it('gives no hint when every word is good', () => {
    expect(toFeedback(base({ overall: 90, words: [{ word: 'cat', score: 92, errorType: 'None', phonemes: [] }] })).hint).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, expect fail** — `cd client && pnpm vitest run src/scoring` → module not found.

- [ ] **Step 3: Implement**

`client/src/scoring/types.ts`: paste the types from the Interfaces block above.

`client/src/scoring/feedback.ts`:
```ts
import type { Feedback, PronunciationResult, WordTone } from './types'

export const PHONEME_TIPS: Record<string, string> = {
  th: 'Đặt đầu lưỡi giữa hai hàm răng rồi thổi nhẹ.',
  dh: 'Đặt đầu lưỡi giữa hai hàm răng và rung cổ họng.',
  v: 'Răng trên chạm môi dưới, rung cổ họng.',
  f: 'Răng trên chạm môi dưới, thổi hơi ra.',
  z: 'Như âm "s" nhưng rung cổ họng.',
  sh: 'Chu môi ra, thổi hơi như "suỵt".',
  ch: 'Đầu lưỡi chạm vòm miệng rồi bật ra.',
  r: 'Cuộn lưỡi lên, không chạm vòm miệng.',
  l: 'Đầu lưỡi chạm sau răng trên.',
}
const DEFAULT_TIP = 'Nghe mẫu rồi nói chậm lại từng âm nhé.'

export function toneFor(score: number): WordTone {
  return score >= 80 ? 'good' : score >= 60 ? 'ok' : 'fix'
}

export function toFeedback(r: PronunciationResult): Feedback {
  const stars = r.overall >= 80 ? 3 : r.overall >= 60 ? 2 : 1
  const message = stars === 3 ? 'Tuyệt vời!' : stars === 2 ? 'Tốt lắm! Sửa một chút nhé' : 'Thử lại nào!'
  const words = r.words.map(w => ({ word: w.word, tone: toneFor(w.score) }))
  const worst = [...r.words].filter(w => w.score < 80).sort((a, b) => a.score - b.score)[0]
  let hint: Feedback['hint']
  if (worst) {
    const ph = [...worst.phonemes].sort((a, b) => a.score - b.score)[0]
    hint = { word: worst.word, phoneme: ph?.phoneme, tip: (ph && PHONEME_TIPS[ph.phoneme]) ?? DEFAULT_TIP }
  }
  return { stars, message, words, hint }
}
```

- [ ] **Step 4: Run, expect pass** — 4 passed.

- [ ] **Step 5: Commit** — `git add client/src/scoring && git commit -m "feat(scoring): result types and kid-friendly feedback mapping"`

---

### Task 4: Web Speech fallback scorer

**Files:**
- Create: `client/src/scoring/webSpeechScorer.ts`, `client/src/scoring/webSpeechScorer.test.ts`

**Interfaces:**
- Produces: `class WebSpeechScorer implements PronunciationScorer` plus exported pure helper `scoreTranscript(transcript: string, target: string): PronunciationResult` (tested). Live mode listens via `webkitSpeechRecognition` *during* recording, so the class also exposes `start(): void` and `stop(): Promise<string>`; `score(_blob, target)` uses the last transcript.

- [ ] **Step 1: Failing test**

```ts
import { scoreTranscript } from './webSpeechScorer'

describe('scoreTranscript', () => {
  it('scores 100 when all target words recognized', () => {
    const r = scoreTranscript('i like cats', 'I like cats.')
    expect(r.overall).toBe(100)
    expect(r.words.every(w => w.score === 100)).toBe(true)
    expect(r.engine).toBe('webspeech')
  })
  it('marks missing words as Omission with score 0', () => {
    const r = scoreTranscript('i like', 'I like cats')
    expect(r.words[2]).toMatchObject({ word: 'cats', score: 0, errorType: 'Omission' })
    expect(r.overall).toBe(67)
  })
  it('returns 0 for empty transcript', () => {
    expect(scoreTranscript('', 'cat').overall).toBe(0)
  })
})
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement**

```ts
import type { PronunciationResult, PronunciationScorer } from './types'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean)

export function scoreTranscript(transcript: string, target: string): PronunciationResult {
  const heard = new Set(norm(transcript))
  const words = norm(target).map(w => ({
    word: w, score: heard.has(w) ? 100 : 0,
    errorType: heard.has(w) ? 'None' as const : 'Omission' as const, phonemes: [],
  }))
  const overall = words.length ? Math.round(words.reduce((s, w) => s + w.score, 0) / words.length) : 0
  return { overall, accuracy: overall, fluency: overall, completeness: overall, words, engine: 'webspeech' }
}

type Rec = { start(): void; stop(): void; lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null }

export class WebSpeechScorer implements PronunciationScorer {
  private rec: Rec | null = null
  private transcript = ''
  private done: Promise<string> = Promise.resolve('')

  static isSupported() { return typeof window !== 'undefined' && 'webkitSpeechRecognition' in window }

  start() {
    const Ctor = (window as unknown as { webkitSpeechRecognition: new () => Rec }).webkitSpeechRecognition
    this.rec = new Ctor()
    this.rec.lang = 'en-US'; this.rec.interimResults = false; this.rec.continuous = true
    this.transcript = ''
    this.done = new Promise(resolve => {
      this.rec!.onresult = e => { this.transcript = Array.from(e.results).map(r => r[0].transcript).join(' ') }
      this.rec!.onend = () => resolve(this.transcript)
    })
    this.rec.start()
  }
  stop() { this.rec?.stop(); return this.done }
  async score(_audio: Blob, target: string) { return scoreTranscript(await this.done, target) }
}
```

- [ ] **Step 4: Run, expect pass. Step 5: Commit** — `git commit -am "feat(scoring): Web Speech fallback scorer"`

---

### Task 5: Azure scorer

**Files:**
- Create: `client/src/scoring/azureScorer.ts`, `client/src/scoring/azureScorer.test.ts`, `client/src/scoring/createScorer.ts`

**Interfaces:**
- Consumes: `GET /api/speech-token` (Task 2).
- Produces: `class AzureScorer implements PronunciationScorer`; pure `parseAzureResult(json: unknown): PronunciationResult` (tested); `createScorer(): Promise<{ scorer: PronunciationScorer; engine: 'azure' | 'webspeech' }>`.

Azure JSON shape (from `PronunciationAssessmentResult` detail, `NBest[0]`):
```json
{ "NBest": [{ "PronunciationAssessment": { "AccuracyScore": 85, "FluencyScore": 90, "CompletenessScore": 100, "PronScore": 88, "ProsodyScore": 70 },
  "Words": [{ "Word": "three", "PronunciationAssessment": { "AccuracyScore": 40, "ErrorType": "Mispronunciation" },
             "Phonemes": [{ "Phoneme": "th", "PronunciationAssessment": { "AccuracyScore": 20 } }] }] }] }
```

- [ ] **Step 1: Failing test**

```ts
import { parseAzureResult } from './azureScorer'

it('parses NBest[0] into PronunciationResult', () => {
  const r = parseAzureResult({ NBest: [{
    PronunciationAssessment: { AccuracyScore: 85, FluencyScore: 90, CompletenessScore: 100, PronScore: 88, ProsodyScore: 70 },
    Words: [{ Word: 'three', PronunciationAssessment: { AccuracyScore: 40, ErrorType: 'Mispronunciation' },
      Phonemes: [{ Phoneme: 'th', PronunciationAssessment: { AccuracyScore: 20 } }] }],
  }] })
  expect(r).toEqual({ overall: 88, accuracy: 85, fluency: 90, completeness: 100, prosody: 70, engine: 'azure',
    words: [{ word: 'three', score: 40, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'th', score: 20 }] }] })
})
it('throws on missing NBest', () => { expect(() => parseAzureResult({})).toThrow() })
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement**

`client/src/scoring/azureScorer.ts`:
```ts
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import type { PronunciationResult, PronunciationScorer, WordScore } from './types'

export function parseAzureResult(json: unknown): PronunciationResult {
  const n = (json as { NBest?: any[] }).NBest?.[0]
  if (!n) throw new Error('Azure result has no NBest')
  const pa = n.PronunciationAssessment
  const words: WordScore[] = (n.Words ?? []).map((w: any) => ({
    word: w.Word, score: w.PronunciationAssessment?.AccuracyScore ?? 0,
    errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
    phonemes: (w.Phonemes ?? []).map((p: any) => ({ phoneme: p.Phoneme, score: p.PronunciationAssessment?.AccuracyScore ?? 0 })),
  }))
  return { overall: pa.PronScore, accuracy: pa.AccuracyScore, fluency: pa.FluencyScore,
    completeness: pa.CompletenessScore, prosody: pa.ProsodyScore, words, engine: 'azure' }
}

export async function fetchToken(): Promise<{ token: string; region: string }> {
  const res = await fetch('/api/speech-token')
  if (!res.ok) throw new Error('token unavailable')
  return res.json()
}

/** Decode any browser-recorded blob (mp4/webm) to 16 kHz mono PCM WAV for the SDK. */
export async function blobToWav(blob: Blob): Promise<ArrayBuffer> {
  const ctx = new AudioContext({ sampleRate: 16000 })
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  const ch = decoded.getChannelData(0)
  const buf = new ArrayBuffer(44 + ch.length * 2); const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + ch.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, ch.length * 2, true)
  ch.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))
  await ctx.close()
  return buf
}

export class AzureScorer implements PronunciationScorer {
  constructor(private token: string, private region: string) {}

  async score(audio: Blob, targetText: string): Promise<PronunciationResult> {
    const wav = await blobToWav(audio)
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(this.token, this.region)
    speechConfig.speechRecognitionLanguage = 'en-US'
    const pushStream = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1))
    pushStream.write(wav.slice(44)); pushStream.close()
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream)
    const paConfig = new sdk.PronunciationAssessmentConfig(targetText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark, sdk.PronunciationAssessmentGranularity.Phoneme, true)
    paConfig.enableProsodyAssessment = true
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
    paConfig.applyTo(recognizer)
    return new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(result => {
        recognizer.close()
        if (result.reason !== sdk.ResultReason.RecognizedSpeech) return reject(new Error(`Azure: ${sdk.ResultReason[result.reason]}`))
        const json = JSON.parse(result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult))
        resolve(parseAzureResult(json))
      }, err => { recognizer.close(); reject(new Error(err)) })
    })
  }
}
```

`client/src/scoring/createScorer.ts`:
```ts
import { AzureScorer, fetchToken } from './azureScorer'
import { WebSpeechScorer } from './webSpeechScorer'
import type { PronunciationScorer } from './types'

export async function createScorer(): Promise<{ scorer: PronunciationScorer; engine: 'azure' | 'webspeech' }> {
  if (navigator.onLine) {
    try { const { token, region } = await fetchToken(); return { scorer: new AzureScorer(token, region), engine: 'azure' } }
    catch { /* fall through */ }
  }
  return { scorer: new WebSpeechScorer(), engine: 'webspeech' }
}
```

- [ ] **Step 4: Run tests, expect pass. Step 5: Commit** — `git add client/src/scoring && git commit -m "feat(scoring): Azure pronunciation scorer and engine factory"`

---

### Task 6: Recorder hook + audio player

**Files:**
- Create: `client/src/audio/recorder.ts`, `client/src/audio/player.ts`, `client/src/audio/recorder.test.ts`

**Interfaces:**
- Produces:
```ts
export type RecorderState = 'idle' | 'recording' | 'processing'
export function useRecorder(opts?: { maxMs?: number }): { state: RecorderState; start(): Promise<void>; stop(): Promise<Blob>; level: number }
export function pickMimeType(): string   // 'audio/mp4' on Safari, else 'audio/webm'
export function playUrl(url: string): Promise<void>
export function playBlob(blob: Blob): Promise<void>
```

- [ ] **Step 1: Failing test (pure part)**

```ts
import { pickMimeType } from './recorder'
it('prefers audio/mp4 when supported, else webm', () => {
  const orig = globalThis.MediaRecorder
  ;(globalThis as any).MediaRecorder = { isTypeSupported: (t: string) => t === 'audio/mp4' }
  expect(pickMimeType()).toBe('audio/mp4')
  ;(globalThis as any).MediaRecorder = { isTypeSupported: (t: string) => t === 'audio/webm' }
  expect(pickMimeType()).toBe('audio/webm')
  ;(globalThis as any).MediaRecorder = orig
})
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement**

`recorder.ts`:
```ts
import { useCallback, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'processing'

export function pickMimeType(): string {
  return ['audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function useRecorder(opts: { maxMs?: number } = {}) {
  const maxMs = opts.maxMs ?? 8000
  const [state, setState] = useState<RecorderState>('idle')
  const [level, setLevel] = useState(0)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const raf = useRef(0)
  const stopResolve = useRef<((b: Blob) => void) | null>(null)
  const timer = useRef(0)

  const stop = useCallback((): Promise<Blob> => new Promise(resolve => {
    if (!rec.current || rec.current.state === 'inactive') return resolve(new Blob())
    stopResolve.current = resolve
    setState('processing')
    rec.current.stop()
  }), [])

  const start = useCallback(async () => {
    stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = pickMimeType()
    rec.current = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
    chunks.current = []
    rec.current.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
    rec.current.onstop = () => {
      cancelAnimationFrame(raf.current); clearTimeout(timer.current)
      stream.current?.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunks.current, { type: rec.current?.mimeType })
      setState('idle'); setLevel(0)
      stopResolve.current?.(blob)
    }
    // level meter
    const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream.current)
    const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an)
    const data = new Uint8Array(an.frequencyBinCount)
    const tick = () => { an.getByteTimeDomainData(data)
      setLevel(Math.min(1, data.reduce((m, v) => Math.max(m, Math.abs(v - 128)), 0) / 64)); raf.current = requestAnimationFrame(tick) }
    tick()
    rec.current.start()
    setState('recording')
    timer.current = window.setTimeout(() => void stop(), maxMs)
  }, [maxMs, stop])

  return { state, start, stop, level }
}
```

`player.ts`:
```ts
export function playUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio(url); a.onended = () => resolve(); a.onerror = () => reject(new Error('audio failed')); void a.play()
  })
}
export async function playBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob)
  try { await playUrl(url) } finally { URL.revokeObjectURL(url) }
}
```

- [ ] **Step 4: Run tests, expect pass. Step 5: Commit** — `git add client/src/audio && git commit -m "feat(audio): MediaRecorder hook with level meter and playback helpers"`

---

### Task 7: Lesson content (Sound Zoo + Word Pop) + progress store

**Files:**
- Create: `client/src/content/types.ts`, `client/src/content/sound-zoo.json`, `client/src/content/word-pop.json`, `client/src/content/index.ts`, `client/src/progress/store.ts`, `client/src/progress/store.test.ts`
- Create: `client/public/audio/` (sample mp3 per card, generated with Azure TTS `en-US-JennyNeural`; a script `scripts/gen-audio.mjs` is in Step 3)

**Interfaces:**
- Produces:
```ts
export type LessonCard = { id: string; text: string; ipa: string; emoji: string; audio: string; targetPhoneme?: string; tip?: string }
export type Level = { id: 'sound-zoo' | 'word-pop'; title: string; cards: LessonCard[] }
export const LEVELS: Level[]
export function getStars(cardId: string): 0 | 1 | 2 | 3
export function setStars(cardId: string, stars: 1 | 2 | 3): void   // keeps max
export function totalStars(): number
```

- [ ] **Step 1: Failing test**

```ts
import { getStars, setStars, totalStars } from './store'
beforeEach(() => localStorage.clear())
it('stores best stars per card and sums total', () => {
  expect(getStars('a')).toBe(0)
  setStars('a', 2); setStars('a', 1)
  expect(getStars('a')).toBe(2)
  setStars('b', 3)
  expect(totalStars()).toBe(5)
})
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement**

`store.ts`:
```ts
const KEY = 'speakup.stars'
type Map = Record<string, 1 | 2 | 3>
const read = (): Map => JSON.parse(localStorage.getItem(KEY) ?? '{}')
export function getStars(id: string): 0 | 1 | 2 | 3 { return read()[id] ?? 0 }
export function setStars(id: string, stars: 1 | 2 | 3) {
  const m = read(); if ((m[id] ?? 0) < stars) { m[id] = stars; localStorage.setItem(KEY, JSON.stringify(m)) }
}
export function totalStars() { return Object.values(read()).reduce((s, v) => s + v, 0) }
```

`content/types.ts`: types above. `content/index.ts`:
```ts
import soundZoo from './sound-zoo.json'
import wordPop from './word-pop.json'
import type { Level } from './types'
export const LEVELS: Level[] = [soundZoo as Level, wordPop as Level]
export const findCard = (id: string) => LEVELS.flatMap(l => l.cards).find(c => c.id === id)
```

`sound-zoo.json` (10 cards, each a short word isolating one sound):
```json
{ "id": "sound-zoo", "title": "Sound Zoo", "cards": [
  { "id": "sz-th-three", "text": "three", "ipa": "/θriː/", "emoji": "3️⃣", "audio": "/audio/three.mp3", "targetPhoneme": "th" },
  { "id": "sz-th-thank", "text": "thank", "ipa": "/θæŋk/", "emoji": "🙏", "audio": "/audio/thank.mp3", "targetPhoneme": "th" },
  { "id": "sz-dh-this", "text": "this", "ipa": "/ðɪs/", "emoji": "👉", "audio": "/audio/this.mp3", "targetPhoneme": "dh" },
  { "id": "sz-v-very", "text": "very", "ipa": "/ˈveri/", "emoji": "💯", "audio": "/audio/very.mp3", "targetPhoneme": "v" },
  { "id": "sz-f-fish", "text": "fish", "ipa": "/fɪʃ/", "emoji": "🐟", "audio": "/audio/fish.mp3", "targetPhoneme": "f" },
  { "id": "sz-z-zoo", "text": "zoo", "ipa": "/zuː/", "emoji": "🦁", "audio": "/audio/zoo.mp3", "targetPhoneme": "z" },
  { "id": "sz-sh-ship", "text": "ship", "ipa": "/ʃɪp/", "emoji": "🚢", "audio": "/audio/ship.mp3", "targetPhoneme": "sh" },
  { "id": "sz-ch-chair", "text": "chair", "ipa": "/tʃer/", "emoji": "🪑", "audio": "/audio/chair.mp3", "targetPhoneme": "ch" },
  { "id": "sz-r-red", "text": "red", "ipa": "/red/", "emoji": "🔴", "audio": "/audio/red.mp3", "targetPhoneme": "r" },
  { "id": "sz-l-lion", "text": "lion", "ipa": "/ˈlaɪən/", "emoji": "🦁", "audio": "/audio/lion.mp3", "targetPhoneme": "l" }
] }
```

`word-pop.json` (12 animal words): cat /kæt/ 🐱, dog /dɔːɡ/ 🐶, elephant /ˈelɪfənt/ 🐘, monkey /ˈmʌŋki/ 🐵, rabbit /ˈræbɪt/ 🐰, tiger /ˈtaɪɡər/ 🐯, bird /bɜːrd/ 🐦, horse /hɔːrs/ 🐴, sheep /ʃiːp/ 🐑, frog /frɔːɡ/ 🐸, snake /sneɪk/ 🐍, giraffe /dʒəˈræf/ 🦒 — ids `wp-<word>`, audio `/audio/<word>.mp3`.

`scripts/gen-audio.mjs` (run once with `AZURE_SPEECH_KEY`/`REGION` env, Node 20):
```js
import { writeFileSync, mkdirSync } from 'node:fs'
const words = process.argv.slice(2)
const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION
const tokRes = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key } })
const token = await tokRes.text()
mkdirSync('client/public/audio', { recursive: true })
for (const w of words) {
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="en-US-JennyNeural"><prosody rate="-15%">${w}</prosody></voice></speak>`
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' }, body: ssml })
  writeFileSync(`client/public/audio/${w}.mp3`, Buffer.from(await res.arrayBuffer()))
  console.log('ok', w)
}
```
Run: `node scripts/gen-audio.mjs three thank this very fish zoo ship chair red lion cat dog elephant monkey rabbit tiger bird horse sheep frog snake giraffe`

- [ ] **Step 4: Run tests, expect pass; verify 22 mp3 files exist. Step 5: Commit** — `git add -A && git commit -m "feat(content): Sound Zoo and Word Pop cards, sample audio, star store"`

---

### Task 8: UI components (MicButton, Stars, ScoredWords, HintCard)

**Files:**
- Create: `client/src/components/MicButton.tsx`, `Stars.tsx`, `ScoredWords.tsx`, `HintCard.tsx`, `client/src/components/components.test.tsx`

**Interfaces:**
- Produces:
```tsx
<MicButton state="idle"|"recording"|"processing"|"disabled" level={0..1} onPress={() => void} />
<Stars value={0|1|2|3} animate? />
<ScoredWords words={{word, tone}[]} onWordTap?(word) />
<HintCard hint={{word, phoneme?, tip}} />
```

- [ ] **Step 1: Failing tests**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MicButton } from './MicButton'; import { Stars } from './Stars'
import { ScoredWords } from './ScoredWords'; import { HintCard } from './HintCard'

it('MicButton calls onPress and is disabled when disabled', () => {
  const fn = vi.fn()
  const { rerender } = render(<MicButton state="idle" level={0} onPress={fn} />)
  fireEvent.click(screen.getByRole('button', { name: /nói/i })); expect(fn).toHaveBeenCalled()
  rerender(<MicButton state="disabled" level={0} onPress={fn} />)
  expect(screen.getByRole('button')).toBeDisabled()
})
it('Stars renders 3 stars with filled count', () => {
  render(<Stars value={2} />)
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getAllByTestId('star-empty')).toHaveLength(1)
})
it('ScoredWords applies tone classes and icons', () => {
  render(<ScoredWords words={[{ word: 'three', tone: 'fix' }, { word: 'cats', tone: 'good' }]} />)
  expect(screen.getByText('three')).toHaveClass('text-fix')
  expect(screen.getByLabelText('cần sửa')).toBeInTheDocument()
})
it('HintCard shows word and tip', () => {
  render(<HintCard hint={{ word: 'three', phoneme: 'th', tip: 'Đặt lưỡi giữa răng.' }} />)
  expect(screen.getByText(/three/)).toBeInTheDocument(); expect(screen.getByText('Đặt lưỡi giữa răng.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement**

`MicButton.tsx`:
```tsx
type Props = { state: 'idle' | 'recording' | 'processing' | 'disabled'; level: number; onPress: () => void }
export function MicButton({ state, level, onPress }: Props) {
  const ring = state === 'recording' ? 1 + level * 0.35 : 1
  const label = state === 'recording' ? 'Dừng' : state === 'processing' ? 'Đang chấm…' : 'Bấm để nói'
  return (
    <button aria-label={label} disabled={state === 'disabled' || state === 'processing'} onClick={onPress}
      className="relative w-32 h-32 rounded-full bg-coral text-white text-5xl shadow-lg disabled:opacity-50 active:scale-95 transition">
      {state === 'recording' && <span className="absolute inset-0 rounded-full bg-coral/40" style={{ transform: `scale(${ring})` }} />}
      <span className="relative">{state === 'processing' ? '⏳' : state === 'recording' ? '⏹' : '🎤'}</span>
    </button>
  )
}
```

`Stars.tsx`:
```tsx
export function Stars({ value }: { value: 0 | 1 | 2 | 3 }) {
  return <div className="flex gap-2 text-5xl">{[1, 2, 3].map(i =>
    <span key={i} data-testid={i <= value ? 'star-filled' : 'star-empty'} className={i <= value ? 'text-star' : 'text-slate-300'}>★</span>)}</div>
}
```

`ScoredWords.tsx`:
```tsx
import type { WordTone } from '../scoring/types'
const ICON: Record<WordTone, { glyph: string; label: string }> = {
  good: { glyph: '✓', label: 'tốt' }, ok: { glyph: '~', label: 'tạm được' }, fix: { glyph: '!', label: 'cần sửa' } }
export function ScoredWords({ words, onWordTap }: { words: { word: string; tone: WordTone }[]; onWordTap?: (w: string) => void }) {
  return <div className="flex flex-wrap justify-center gap-4 text-4xl font-extrabold">{words.map((w, i) =>
    <button key={i} onClick={() => onWordTap?.(w.word)} className={`text-${w.tone} flex items-baseline gap-1`}>
      <span className={`text-${w.tone}`}>{w.word}</span><span aria-label={ICON[w.tone].label} className="text-xl">{ICON[w.tone].glyph}</span>
    </button>)}</div>
}
```
(Add `safelist: ['text-good','text-ok','text-fix']` to `tailwind.config.ts`.)

`HintCard.tsx`:
```tsx
export function HintCard({ hint }: { hint: { word: string; phoneme?: string; tip: string } }) {
  return <div className="rounded-3xl bg-white shadow p-5 flex gap-4 items-center max-w-xl">
    <span className="text-4xl">👄</span>
    <div><div className="font-extrabold text-xl">Sửa từ này: <span className="text-fix">{hint.word}</span>{hint.phoneme && <span className="text-slate-500"> (âm "{hint.phoneme}")</span>}</div>
      <div className="text-lg">{hint.tip}</div></div></div>
}
```

- [ ] **Step 4: Run tests, expect pass. Step 5: Commit** — `git add client/src/components client/tailwind.config.ts && git commit -m "feat(ui): mic button, stars, scored words, hint card"`

---

### Task 9: Screens + routing (Home, LevelSelect, PracticeCard)

**Files:**
- Create: `client/src/screens/Home.tsx`, `LevelSelect.tsx`, `PracticeCard.tsx`, `client/src/App.tsx` (replace), `client/src/main.tsx` (replace), `client/src/screens/PracticeCard.test.tsx`

**Interfaces:**
- Consumes: `useRecorder`, `playUrl/playBlob`, `createScorer`, `toFeedback`, `LEVELS/findCard`, `getStars/setStars`, components from Task 8.
- Routes: `/` Home, `/level/:levelId`, `/practice/:cardId`.

- [ ] **Step 1: Failing test (PracticeCard flow with mocked scorer/recorder)**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
vi.mock('../audio/recorder', () => ({ useRecorder: () => ({ state: 'idle', level: 0, start: vi.fn(), stop: vi.fn().mockResolvedValue(new Blob()) }) }))
vi.mock('../audio/player', () => ({ playUrl: vi.fn().mockResolvedValue(undefined), playBlob: vi.fn() }))
vi.mock('../scoring/createScorer', () => ({ createScorer: async () => ({ engine: 'azure', scorer: { score: async () => ({
  overall: 85, accuracy: 85, fluency: 90, completeness: 100, engine: 'azure',
  words: [{ word: 'three', score: 85, errorType: 'None', phonemes: [] }] }) } }) }))
import { PracticeCard } from './PracticeCard'

it('shows the word, records, and renders 3 stars', async () => {
  render(<MemoryRouter initialEntries={['/practice/sz-th-three']}><Routes><Route path="/practice/:cardId" element={<PracticeCard />} /></Routes></MemoryRouter>)
  expect(screen.getByText('three')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))  // start
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói|dừng/i })) // stop (mock state stays idle)
  await waitFor(() => expect(screen.getAllByTestId('star-filled')).toHaveLength(3))
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement**

`main.tsx`:
```tsx
import React from 'react'; import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'; import App from './App'; import './styles.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>)
```

`App.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom'
import { Home } from './screens/Home'; import { LevelSelect } from './screens/LevelSelect'; import { PracticeCard } from './screens/PracticeCard'
export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/level/:levelId" element={<LevelSelect />} /><Route path="/practice/:cardId" element={<PracticeCard />} /></Routes>
}
```

`Home.tsx`:
```tsx
import { Link } from 'react-router-dom'; import { LEVELS } from '../content'; import { totalStars } from '../progress/store'
export function Home() {
  return <main className="h-full flex flex-col items-center justify-center gap-8 p-8">
    <h1 className="text-6xl font-extrabold text-coral">Speak Up! 🦊</h1>
    <div className="text-2xl">⭐ {totalStars()} sao</div>
    <div className="flex gap-6">{LEVELS.map(l =>
      <Link key={l.id} to={`/level/${l.id}`} className="w-64 h-40 rounded-3xl bg-teal text-white text-3xl font-extrabold flex items-center justify-center shadow-lg active:scale-95">{l.title}</Link>)}</div>
  </main>
}
```

`LevelSelect.tsx`:
```tsx
import { Link, useParams } from 'react-router-dom'; import { LEVELS } from '../content'; import { getStars } from '../progress/store'; import { Stars } from '../components/Stars'
export function LevelSelect() {
  const level = LEVELS.find(l => l.id === useParams().levelId)
  if (!level) return <p>Không tìm thấy</p>
  return <main className="p-8"><Link to="/" className="text-2xl">← Về nhà</Link>
    <h1 className="text-5xl font-extrabold my-6">{level.title}</h1>
    <div className="grid grid-cols-3 gap-5">{level.cards.map(c =>
      <Link key={c.id} to={`/practice/${c.id}`} className="rounded-3xl bg-white shadow p-5 flex flex-col items-center gap-2 active:scale-95">
        <span className="text-6xl">{c.emoji}</span><span className="text-3xl font-extrabold">{c.text}</span><Stars value={getStars(c.id)} /></Link>)}</div></main>
}
```

`PracticeCard.tsx`:
```tsx
import { useEffect, useState } from 'react'; import { Link, useNavigate, useParams } from 'react-router-dom'
import { findCard, LEVELS } from '../content'; import { useRecorder } from '../audio/recorder'; import { playBlob, playUrl } from '../audio/player'
import { createScorer } from '../scoring/createScorer'; import { toFeedback } from '../scoring/feedback'
import type { Feedback, PronunciationScorer } from '../scoring/types'; import { WebSpeechScorer } from '../scoring/webSpeechScorer'
import { setStars } from '../progress/store'
import { MicButton } from '../components/MicButton'; import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'; import { HintCard } from '../components/HintCard'

export function PracticeCard() {
  const { cardId = '' } = useParams(); const nav = useNavigate()
  const card = findCard(cardId)
  const rec = useRecorder({ maxMs: 6000 })
  const [scorer, setScorer] = useState<{ scorer: PronunciationScorer; engine: string } | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setFeedback(null); setAttempts(0); createScorer().then(setScorer) }, [cardId])
  if (!card) return <p>Không tìm thấy thẻ</p>
  const allCards = LEVELS.flatMap(l => l.cards); const next = allCards[allCards.findIndex(c => c.id === cardId) + 1]

  async function onMic() {
    if (!scorer) return
    if (rec.state === 'idle') {
      setFeedback(null); setError(null)
      if (scorer.scorer instanceof WebSpeechScorer) scorer.scorer.start()
      await rec.start(); return
    }
    if (rec.state === 'recording') {
      const blob = await rec.stop(); setLastBlob(blob)
      if (scorer.scorer instanceof WebSpeechScorer) await scorer.scorer.stop()
      try {
        const fb = toFeedback(await scorer.scorer.score(blob, card!.text))
        setFeedback(fb); setAttempts(a => a + 1); setStars(card!.id, fb.stars)
      } catch (e) { setError('Không nghe rõ, bé thử lại nhé!'); console.error(e) }
    }
  }

  const micState = !scorer ? 'disabled' : rec.state
  return <main className="h-full flex flex-col items-center justify-between p-6">
    <div className="w-full flex justify-between text-xl"><Link to={`/level/${LEVELS.find(l => l.cards.includes(card))!.id}`}>← Quay lại</Link>
      <span className="text-slate-400">{scorer?.engine === 'webspeech' ? 'chế độ offline' : ''}</span></div>
    <div className="flex items-center gap-10">
      <span className="text-[120px]">{card.emoji}</span>
      <div className="text-center"><div className="text-7xl font-extrabold">{card.text}</div><div className="text-2xl text-slate-500">{card.ipa}</div>
        <button onClick={() => playUrl(card.audio)} className="mt-4 w-20 h-20 rounded-full bg-teal text-white text-4xl">🔊</button></div>
    </div>
    {error && <p className="text-2xl text-fix">{error}</p>}
    {feedback && <section className="flex flex-col items-center gap-4">
      <Stars value={feedback.stars} /><p className="text-3xl font-extrabold">{feedback.message}</p>
      <ScoredWords words={feedback.words} onWordTap={() => playUrl(card.audio)} />
      {feedback.hint && <HintCard hint={feedback.hint} />}
      <div className="flex gap-4 text-xl">
        {lastBlob && <button onClick={() => playBlob(lastBlob)} className="px-6 py-3 rounded-2xl bg-white shadow">🎧 Nghe mình</button>}
        <button onClick={() => playUrl(card.audio)} className="px-6 py-3 rounded-2xl bg-white shadow">🔊 Nghe mẫu</button>
        {next && (feedback.stars === 3 || attempts >= 3) && <button onClick={() => nav(`/practice/${next.id}`)} className="px-6 py-3 rounded-2xl bg-coral text-white font-extrabold">Tiếp theo →</button>}
      </div></section>}
    <MicButton state={micState} level={rec.level} onPress={onMic} />
  </main>
}
```

- [ ] **Step 4: Run all client tests, expect pass** — `cd client && pnpm vitest run`.

- [ ] **Step 5: Commit** — `git add client/src && git commit -m "feat(ui): home, level select and practice card screens"`

---

### Task 10: iPad verification + PWA install

**Files:**
- Modify: `client/index.html` (meta tags), `README.md` (create)

- [ ] **Step 1: Add iOS meta tags to `client/index.html` `<head>`**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/icon-512.png" />
<title>Speak Up!</title>
```

- [ ] **Step 2: Serve on LAN over HTTPS** (Safari requires HTTPS for `getUserMedia` on non-localhost)

```bash
cd client && pnpm add -D @vitejs/plugin-basic-ssl
```
In `vite.config.ts` add `import basicSsl from '@vitejs/plugin-basic-ssl'` and `basicSsl()` to `plugins`. Run `pnpm dev`; on the iPad open `https://<PC-LAN-IP>:5173`, accept the certificate warning.

- [ ] **Step 3: Manual checklist on iPad** (record results in README under "Verified on iPad")

1. Share → Add to Home Screen; opens full-screen, cream background, Nunito font.
2. Sound Zoo → "three": tap 🔊 → hears Jenny; tap mic → permission prompt → accept; say "three"; tap stop → stars appear within 3 s; word colored; hint shows if < 80.
3. "Nghe mình" plays back the recording.
4. Turn Wi-Fi off → reload → header shows "chế độ offline" and scoring still returns stars (Web Speech).
5. Stars persist after closing and reopening the app.

- [ ] **Step 4: Write `README.md`** with: setup (`pnpm i`, `server/.env`), `pnpm dev`, `node scripts/gen-audio.mjs …`, iPad steps above, and the verification table.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "chore: iOS PWA meta, HTTPS dev server, README with iPad verification"`

---

## Self-Review

- **Spec coverage (Phase 1 scope):** PWA shell ✔ (T1, T10); iPad recording ✔ (T6, T10); Azure F0 en-US scoring behind interface ✔ (T3, T5); Web Speech fallback ✔ (T4); Speak Lab levels 1–2 content & screens ✔ (T7, T9); kid feedback rule 1–3 stars + single hint + word colors ✔ (T3, T8); listen-self/listen-sample compare ✔ (T9); stars persisted ✔ (T7). Deferred to later phases by spec: mouth-shape animation (placeholder 👄 icon only), Listening module, Words, Sentence Builder, Foxy mascot, Parent Dashboard, IndexedDB.
- **Placeholder scan:** none; the only "placeholder" is the icon PNG, with a concrete command to generate it.
- **Type consistency:** `PronunciationResult`, `Feedback`, `WordTone`, `useRecorder` return shape, `createScorer` return shape and `LessonCard` fields used identically across T3–T9. `WebSpeechScorer.start/stop` used in T9 match T4.
