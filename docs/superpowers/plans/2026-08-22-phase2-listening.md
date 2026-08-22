# Phase 2 — Listening ("Nghe kể chuyện") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three illustrated stories with synced karaoke text, background music, speed control, tap-to-replay words, Vietnamese subtitles, a 3-question picture quiz and a retell-into-the-mic step — playable on iPad with or without generated narration audio.

**Architecture:** New `client/src/story/` module (pure timing utils, Web Audio music, `useStoryPlayer` hook driving either an `HTMLAudioElement` or a silent fallback clock), story JSON under `client/src/content/stories/`, three new screens wired into the existing router, and a shared `useSpeakingAttempt` hook extracted from `PracticeCard` so Retell reuses the reviewed recording/scoring flow. A Node script generates narration mp3s + word timings with the Azure Speech SDK (WordBoundary events).

**Tech Stack:** as Phase 1 (Vite 8, React 19, TS strict, Tailwind 3, vitest/jsdom, react-router 7, microsoft-cognitiveservices-speech-sdk).

**Spec:** `docs/superpowers/specs/2026-08-22-phase2-listening-design.md` (authority) + `docs/2026-08-22-giai-phap-va-design-brief.md` §2.2A.

## Global Constraints
- Branch `phase2-listening` off `main` (e9a91bf+). Commit per task; secret-leak hooks in `.githooks/` and `.claude/settings.json` must pass; never `--no-verify`.
- Tap targets ≥ 64×64 px; karaoke text ≥ 32 px (`text-4xl`); Vietnamese UI copy, English learning content, `en-US` voice `en-US-JennyNeural`.
- Palette tokens: cream/coral/teal/star/good/ok/fix (existing Tailwind config). Active karaoke word = `text-coral` + `scale-110`; past words `text-slate-400`; future words `text-slate-800`.
- Quiz stars: 3 correct-on-first-try → 3, 2 → 2, else 1. Retell stars: overall ≥60 → 3, ≥35 → 2, else 1. Store keys `story:<id>` and `retell:<id>` via `setStars`.
- Fallback clock: `estimateTimings(text, 110 wpm)`; rate options exactly `0.75` and `1`.
- Music: procedural pad, gain 0.06, started only from a user tap; preference key `speakup.music` ('on' | 'off', default 'on').
- All of `pnpm test`, `pnpm lint` (0 errors), `pnpm typecheck`, `pnpm build` green before each commit.

---

## File Structure
```
client/src/speaking/useSpeakingAttempt.ts        recorder+scorer flow (extracted from PracticeCard)
client/src/speaking/useSpeakingAttempt.test.tsx
client/src/screens/PracticeCard.tsx              refactored to use the hook (UI unchanged)
client/src/content/stories/types.ts              Story/Scene/StoryWord/QuizQ
client/src/content/stories/{little-fox,at-the-zoo,my-breakfast}.json
client/src/content/stories/index.ts              STORIES, findStory
client/src/story/timing.ts (+test)               estimateTimings, activeWordIndex, splitWords
client/src/story/music.ts (+test)                BackgroundMusic (Web Audio), musicPref
client/src/story/useStoryPlayer.ts (+test)       player hook (audio or fallback clock)
client/src/components/SceneArt.tsx, Karaoke.tsx, PlayerControls.tsx (+test)
client/src/screens/StoryList.tsx, StoryPlayer.tsx, StoryQuiz.tsx, StoryRetell.tsx (+tests)
client/src/App.tsx, client/src/screens/Home.tsx  routes + home card
scripts/gen-story.mjs                            Azure SDK narration + word timings
README.md                                        Phase 2 section
```

---

### Task 1: Extract `useSpeakingAttempt` from PracticeCard

**Files:** Create `client/src/speaking/useSpeakingAttempt.ts`, `client/src/speaking/useSpeakingAttempt.test.tsx`; Modify `client/src/screens/PracticeCard.tsx`.

**Interfaces — Produces:**
```ts
export type SpeakingAttempt = {
  micState: 'idle' | 'recording' | 'processing' | 'disabled'
  level: number
  engine: 'azure' | 'webspeech' | null
  result: PronunciationResult | null
  error: string | null
  lastBlob: Blob | null
  onMic(): void          // toggles start / stop+score
  reset(): void          // clears result + error (keeps scorer)
}
export function useSpeakingAttempt(opts: { targetText: string; autoStopMs?: number; resetKey?: string }): SpeakingAttempt
```
Behaviour is exactly PracticeCard's current flow (auto-stop timer, `stoppedRef` once-guard, scoring lock, token refresh retry once, Web Speech branch without MediaRecorder, `isSupported` message, mic-permission message, "Không nghe rõ, bé thử lại nhé!" on failure). `resetKey` change = what `[cardId]` effect did (clear state, re-create scorer). The hook returns the raw `PronunciationResult`; callers map it (`toFeedback` in PracticeCard, lenient stars in Retell). `setStars` stays in the callers.

- [ ] **Step 1: Failing test** `useSpeakingAttempt.test.tsx` — mock `../audio/recorder` with the same stateful `useRecorder` mock PracticeCard.test uses (copy it), mock `../scoring/createScorer` to resolve `{ engine: 'azure', scorer: { score: async () => ({ overall: 85, accuracy: 85, fluency: 90, completeness: 100, engine: 'azure', words: [] }) } }`. With `renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))`: wait until `micState === 'idle'`; `act(() => result.current.onMic())` → `micState === 'recording'`; `act(() => result.current.onMic())` → `await waitFor(() => expect(result.current.result?.overall).toBe(85))`; `reset()` clears `result`. Second test: `start` rejecting → `error` matches /cho phép dùng mic/.
- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/speaking` → fails (module missing).
- [ ] **Step 3: Implement** — move the state/refs/functions (`scoreWithTokenRefresh`, `stopAndScore`, `armAutoStop`, `startRecording`, `onMic`) verbatim from PracticeCard into the hook; replace `card!.text` with `opts.targetText`, `[cardId]` with `[opts.resetKey]`, `AUTO_STOP_MS` with `opts.autoStopMs ?? 6000`; drop `feedback/attempts/audioMissing/setStars` (caller concerns). Expose `result` instead of `feedback`.
- [ ] **Step 4: Refactor PracticeCard** to `const attempt = useSpeakingAttempt({ targetText: card?.text ?? '', resetKey: cardId })`; derive `feedback = attempt.result ? toFeedback(attempt.result) : null` via `useMemo`; keep `attempts` counter (increment in a `useEffect` on `attempt.result` change) and `setStars` there; `retry = attempt.reset`; `MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic}`; label uses `attempt.engine === 'webspeech'`. All existing `PracticeCard.test.tsx` tests must pass unchanged (they mock the same modules).
- [ ] **Step 5: Run full client suite, lint, typecheck, build → green. Commit** `refactor(speaking): extract useSpeakingAttempt hook from PracticeCard`.

---

### Task 2: Story types, timing utils, 3 stories

**Files:** Create `client/src/content/stories/types.ts`, `index.ts`, three JSONs, `client/src/story/timing.ts`, `client/src/story/timing.test.ts`.

**Interfaces — Produces:**
```ts
// types.ts
export type StoryWord = { w: string; start?: number; end?: number }
export type Scene = { text: string; textVi: string; emoji: string; bg: string; audio: string; image?: string; words: StoryWord[] }
export type QuizQ = { q: string; qVi: string; options: { emoji: string; label: string }[]; answer: 0 | 1 | 2 }
export type Story = { id: string; title: string; titleVi: string; emoji: string; scenes: Scene[]; quiz: QuizQ[]; retell: { text: string; textVi: string } }
// index.ts
export const STORIES: Story[]; export const findStory: (id: string) => Story | undefined
// timing.ts
export function splitWords(text: string): string[]                       // keeps punctuation attached: "Hello," "fox!"
export function estimateTimings(words: string[], wpm?: number): { start: number; end: number }[]   // ms; duration ∝ letters, min 180 ms, gap 60 ms, scaled so mean word = 60000/wpm
export function activeWordIndex(timings: { start: number; end: number }[], tMs: number): number   // -1 before first; last index after end; index of word whose start ≤ t (binary or linear)
export function totalDuration(timings: { start: number; end: number }[]): number
```

- [ ] **Step 1: Failing tests**
```ts
import { splitWords, estimateTimings, activeWordIndex, totalDuration } from './timing'
it('splits on whitespace keeping punctuation', () => expect(splitWords('Hi, little fox!')).toEqual(['Hi,', 'little', 'fox!']))
it('estimates monotonic timings scaled to wpm', () => {
  const t = estimateTimings(['a', 'elephant', 'is', 'big'], 120)
  expect(t).toHaveLength(4); for (let i = 1; i < t.length; i++) expect(t[i].start).toBeGreaterThanOrEqual(t[i-1].end)
  expect(t[1].end - t[1].start).toBeGreaterThan(t[0].end - t[0].start)
  const mean = t.reduce((s, x) => s + (x.end - x.start), 0) / 4; expect(Math.round(mean)).toBe(500)
})
it('finds the active word', () => {
  const t = [{ start: 0, end: 200 }, { start: 260, end: 500 }, { start: 560, end: 900 }]
  expect(activeWordIndex(t, -5)).toBe(-1); expect(activeWordIndex(t, 100)).toBe(0); expect(activeWordIndex(t, 230)).toBe(0)
  expect(activeWordIndex(t, 600)).toBe(2); expect(activeWordIndex(t, 5000)).toBe(2); expect(totalDuration(t)).toBe(900)
})
```
- [ ] **Step 2: Run → fail. Step 3: Implement** `timing.ts`:
```ts
export function splitWords(text: string) { return text.trim().split(/\s+/).filter(Boolean) }
export function estimateTimings(words: string[], wpm = 110) {
  const letters = words.map(w => Math.max(1, w.replace(/[^A-Za-z']/g, '').length))
  const meanLetters = letters.reduce((a, b) => a + b, 0) / Math.max(1, letters.length)
  const target = 60000 / wpm                        // desired mean word duration
  const GAP = 60
  let t = 0
  return letters.map(n => { const dur = Math.max(180, (n / meanLetters) * target); const s = t; t = s + dur + GAP; return { start: s, end: s + dur } })
}
export function activeWordIndex(t: { start: number; end: number }[], ms: number) {
  if (!t.length || ms < t[0].start) return -1
  let i = 0; while (i + 1 < t.length && t[i + 1].start <= ms) i++; return i
}
export function totalDuration(t: { start: number; end: number }[]) { return t.length ? t[t.length - 1].end : 0 }
```
(The mean test: durations ∝ letters with mean(letters/meanLetters)=1 so mean = target = 500 at 120 wpm, as long as no word hits the 180 ms floor — 'a' at 120 wpm: 1/3.5*500 ≈ 143 < 180 → floor applies. Use words `['cat','elephant','is','big']` in the test instead so the mean is exact; adjust test accordingly.)
- [ ] **Step 4: Stories.** Write the three JSONs. Each scene's `words` = `splitWords(text)` mapped to `{ w }` (no timings yet), `audio` = `/audio/stories/<id>/scene-<n>.mp3` (n from 1), `bg` a CSS gradient string like `linear-gradient(135deg,#FFE5B4,#FFB88C)`.
  - `little-fox` 🦊 "The Little Fox" / "Chú cáo nhỏ" — 7 scenes: "This is Foxy. Foxy is a little fox." / "Foxy lives in the forest." / "Foxy is hungry. He wants an apple." / "He sees a big red apple on a tree." / "Foxy jumps, but the apple is too high." / "A bird helps Foxy. The apple falls down." / "Foxy says thank you. He is happy!" Quiz: Who is Foxy? (🐱 cat, 🦊 fox, 🐶 dog → 1); What does Foxy want? (🍎 apple, 🍌 banana, 🍕 pizza → 0); Who helps Foxy? (🐦 bird, 🐟 fish, 🐘 elephant → 0). Retell: "Foxy wants a big red apple."
  - `at-the-zoo` 🦁 "At the Zoo" / "Ở sở thú" — 6 scenes: "Today I go to the zoo with my mom." / "I see a big lion. The lion is sleeping." / "The monkeys are funny. They jump and play." / "The elephant is grey. It has a long nose." / "I eat ice cream. It is cold and sweet." / "I love the zoo!" Quiz: Who goes to the zoo with me? (👩 mom, 👨 dad, 👵 grandma → 0); What is the lion doing? (😴 sleeping, 🏃 running, 🍽️ eating → 0); What do I eat? (🍦 ice cream, 🍎 apple, 🍞 bread → 0). Retell: "The elephant has a long nose."
  - `my-breakfast` 🥞 "My Breakfast" / "Bữa sáng của em" — 6 scenes: "It is morning. I am hungry." / "I eat eggs and bread." / "I drink milk. Milk is white." / "My sister eats a banana." / "My dad drinks coffee. It is hot." / "Breakfast is yummy!" Quiz: What do I drink? (🥛 milk, 🧃 juice, ☕ coffee → 0); What does my sister eat? (🍌 banana, 🍎 apple, 🥚 egg → 0); Is the coffee hot or cold? (🔥 hot, 🧊 cold, 🌧️ wet → 0). Retell: "I eat eggs and bread."
  Shuffle answer positions so not every answer is index 0 (put correct option at indexes 1/0/2, 2/0/1, 0/2/1 across the three stories and set `answer` accordingly).
- [ ] **Step 5: `index.ts`** imports the three JSONs as `Story` and exports `STORIES` (in the order above) and `findStory`. Add a test in `timing.test.ts` (or `stories.test.ts`) that every story has ≥6 scenes, every scene `words.length === splitWords(text).length`, every quiz has exactly 3 questions with 3 options and `answer` in range.
- [ ] **Step 6: Tests/lint/typecheck/build green. Commit** `feat(story): story content, types and timing utils`.

---

### Task 3: Narration generator script

**Files:** Create `scripts/gen-story.mjs`; Modify `README.md` (usage).

- [ ] **Step 1: Write the script** (Node 20+, uses the SDK already in `client/node_modules` — resolve via `createRequire(import.meta.url)` with `client/package.json` as base):
```js
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const require = createRequire(new URL('../client/package.json', import.meta.url))
const sdk = require('microsoft-cognitiveservices-speech-sdk')
const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION
if (!key || !region) { console.error('Usage: AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… node scripts/gen-story.mjs <storyId> [...]'); process.exit(1) }
const ids = process.argv.slice(2); if (!ids.length) { console.error('no story ids'); process.exit(1) }
for (const id of ids) {
  const path = `client/src/content/stories/${id}.json`
  const story = JSON.parse(readFileSync(path, 'utf8'))
  mkdirSync(`client/public/audio/stories/${id}`, { recursive: true })
  for (let i = 0; i < story.scenes.length; i++) {
    const scene = story.scenes[i]
    const cfg = sdk.SpeechConfig.fromSubscription(key, region)
    cfg.speechSynthesisVoiceName = 'en-US-JennyNeural'
    cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
    const synth = new sdk.SpeechSynthesizer(cfg, null)
    const bounds = []
    synth.wordBoundary = (_s, e) => { if (e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word) bounds.push({ text: e.text, start: e.audioOffset / 10000, end: (e.audioOffset + e.duration) / 10000 }) }
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-JennyNeural"><prosody rate="-10%">${scene.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</prosody></voice></speak>`
    const result = await new Promise((res, rej) => synth.speakSsmlAsync(ssml, r => { synth.close(); r.reason === sdk.ResultReason.SynthesizingAudioCompleted ? res(r) : rej(new Error(r.errorDetails || 'synthesis failed')) }, e => { synth.close(); rej(new Error(e)) }))
    writeFileSync(`client/public/audio/stories/${id}/scene-${i + 1}.mp3`, Buffer.from(result.audioData))
    // Align boundaries to scene.words (same order; boundaries exclude punctuation).
    let b = 0
    scene.words = scene.words.map(w => { const m = bounds[b++]; return m ? { w: w.w, start: Math.round(m.start), end: Math.round(m.end) } : { w: w.w } })
    if (b !== bounds.length) console.warn(`${id} scene ${i + 1}: ${bounds.length} boundaries vs ${scene.words.length} words`)
    console.log('ok', id, `scene-${i + 1}`, `${bounds.length} words`)
  }
  writeFileSync(path, JSON.stringify(story, null, 2) + '\n')
}
```
- [ ] **Step 2: Verify without a key** — `node scripts/gen-story.mjs little-fox` prints the usage line and exits 1. (Do not run with a key in this environment.)
- [ ] **Step 3: README** — add under "Generating sample audio": `node scripts/gen-story.mjs little-fox at-the-zoo my-breakfast` (with the two env vars) writes mp3s to `client/public/audio/stories/<id>/` and fills word timings into the story JSON; commit the JSON afterwards.
- [ ] **Step 4: Commit** `feat(story): Azure narration generator with word timings`.

---

### Task 4: Background music + `useStoryPlayer` hook

**Files:** Create `client/src/story/music.ts`, `music.test.ts`, `client/src/story/useStoryPlayer.ts`, `useStoryPlayer.test.tsx`.

**Interfaces — Produces:**
```ts
// music.ts
export function getMusicPref(): boolean; export function setMusicPref(on: boolean): void   // localStorage 'speakup.music'
export class BackgroundMusic { start(): void; stop(): void; get playing(): boolean }        // Web Audio pad; start() is a no-op if already playing or AudioContext unavailable
// useStoryPlayer.ts
export type PlayerState = { sceneIndex: number; playing: boolean; rate: 0.75 | 1; tMs: number; wordIndex: number; hasAudio: boolean; musicOn: boolean; subtitles: boolean }
export function useStoryPlayer(story: Story): PlayerState & {
  play(): void; pause(): void; toggle(): void; setRate(r: 0.75 | 1): void
  nextScene(): void; prevScene(): void; goScene(i: number): void
  replayWord(i: number): void; toggleMusic(): void; toggleSubtitles(): void
  timings: { start: number; end: number }[]                     // current scene
  ended: boolean                                                 // last scene finished
}
```
Behaviour: on scene change build `timings` = scene words' `start/end` if all present else `estimateTimings(words)`. If scene has timings AND an `Audio(scene.audio)` element loads (`canplaythrough` or `loadedmetadata`), drive `tMs` from `audio.currentTime*1000` via `requestAnimationFrame` while playing; else a fallback clock (`performance.now()` delta × rate). `wordIndex = activeWordIndex(timings, tMs)`. When `tMs ≥ totalDuration + 400` → auto-advance to next scene and keep playing; on the last scene set `ended` and `playing=false`. `replayWord(i)`: pause, set `tMs = timings[i].start`, play, and auto-pause when `tMs ≥ timings[i].end` (one-shot). `setRate` updates `audio.playbackRate` and the fallback clock. `play()` starts music if `musicOn` (gesture context). Cleanup on unmount stops audio, rAF, music.

- [ ] **Step 1: Failing tests** (fallback clock path; jsdom has no real audio — stub `globalThis.Audio` with a fake that never fires `canplaythrough` so fallback is used; use `vi.useFakeTimers()` + stub `performance.now` to advance; stub `requestAnimationFrame` to `setTimeout(cb,16)`):
  1. initial state: `sceneIndex 0, playing false, wordIndex -1, hasAudio false, timings.length === words.length`.
  2. `play()` then advance 1200 ms → `wordIndex ≥ 1`; `pause()` freezes `tMs`.
  3. advancing past `totalDuration+400` → `sceneIndex` becomes 1 and `playing` stays true.
  4. `setRate(0.75)` → after 1000 ms real, `tMs ≈ 750` (±50).
  5. `replayWord(2)` → `tMs` starts at `timings[2].start` and `playing` becomes false after `timings[2].end`.
  6. `toggleMusic()` flips `musicOn` and persists `localStorage['speakup.music']`.
  `music.test.ts`: `getMusicPref()` defaults true; `setMusicPref(false)` persists; `BackgroundMusic.start()` with `AudioContext` undefined does not throw and `playing` stays false; with a fake `AudioContext` (createOscillator/createGain/createBiquadFilter returning objects with `connect/start/stop`, `gain: { value }`, `frequency: { value }`), `start()` sets `playing` true and `stop()` false.
- [ ] **Step 2: Run → fail. Step 3: Implement** `music.ts`:
```ts
const KEY = 'speakup.music'
export function getMusicPref() { try { return localStorage.getItem(KEY) !== 'off' } catch { return true } }
export function setMusicPref(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* ignore */ } }
export class BackgroundMusic {
  private ctx: AudioContext | null = null; private nodes: { stop(): void }[] = []
  get playing() { return this.ctx !== null }
  start() {
    if (this.ctx || typeof AudioContext === 'undefined') return
    const ctx = new AudioContext(); this.ctx = ctx
    const master = ctx.createGain(); master.gain.value = 0.06
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900
    filter.connect(master); master.connect(ctx.destination)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 300; lfo.connect(lfoGain); lfoGain.connect(filter.frequency)
    for (const f of [130.81, 196.0, 261.63, 329.63]) {          // C major pad: C3 G3 C4 E4
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = detune
        o.connect(filter); o.start(); this.nodes.push(o)
      }
    }
    lfo.start(); this.nodes.push(lfo)
    void ctx.resume?.()
  }
  stop() { this.nodes.forEach(n => { try { n.stop() } catch { /* already stopped */ } }); this.nodes = []; void this.ctx?.close(); this.ctx = null }
}
```
`useStoryPlayer.ts`: implement per the behaviour above with refs for `audio`, `rafId`, `clockStart`, `clockBase`, `music: BackgroundMusic`, `replayUntil`. Keep the file under ~180 lines; put the audio-vs-clock selection in a small `createClock(scene, timings, rate)` helper inside the file.
- [ ] **Step 4: Tests/lint/typecheck/build green. Commit** `feat(story): background music and story player hook`.

---

### Task 5: Components — SceneArt, Karaoke, PlayerControls

**Files:** Create `client/src/components/SceneArt.tsx`, `Karaoke.tsx`, `PlayerControls.tsx`, `story-components.test.tsx`.

**Interfaces — Produces:**
```tsx
<SceneArt emoji bg image? />                       // div with style background, emoji at text-[160px], or <img> if image
<Karaoke words={StoryWord[]} activeIndex onWordTap(i) subtitle?: string />   // buttons per word (min-h-[64px] px-2 text-4xl font-extrabold); active: text-coral scale-110; past: text-slate-400; subtitle line text-2xl text-slate-500 if given
<PlayerControls playing rate musicOn subtitles sceneIndex sceneCount onToggle onRate onPrev onNext onMusic onSubtitles />
// buttons: ⏮ (aria "Cảnh trước"), ▶/⏸ (aria "Phát"/"Tạm dừng", 96px), ⏭ ("Cảnh sau"), 🐢/🐇 toggle (aria "Tốc độ 0.75"/"Tốc độ 1"), 🎵 ("Nhạc nền bật"/"tắt"), 🇻🇳 ("Phụ đề bật"/"tắt"); progress dots row with data-testid="scene-dot" and data-active on current
```
- [ ] **Step 1: Failing tests**: Karaoke renders 3 buttons, index 1 has class `text-coral`, index 0 `text-slate-400`, tapping index 2 calls `onWordTap(2)`, subtitle text shown when provided; PlayerControls: play button aria "Phát" when paused, "Tạm dừng" when playing; rate button shows 🐢 when rate 1 (meaning "slow down") and 🐇 when 0.75; dots count = sceneCount with exactly one `data-active="true"`; all six buttons call their handlers; SceneArt renders `<img>` when `image` provided else the emoji.
- [ ] **Step 2: Run → fail. Step 3: Implement** (Tailwind, `TAP = 'min-h-[64px] min-w-[64px] flex items-center justify-center rounded-2xl bg-white shadow text-3xl active:scale-95'`; play button `w-24 h-24 rounded-full bg-coral text-white text-5xl`).
- [ ] **Step 4: Green → Commit** `feat(ui): scene art, karaoke and player controls`.

---

### Task 6: Screens — StoryList + StoryPlayer; routes + Home card

**Files:** Create `client/src/screens/StoryList.tsx`, `StoryPlayer.tsx`, `StoryPlayer.test.tsx`; Modify `App.tsx`, `Home.tsx`.

- [ ] **Step 1: Failing test** `StoryPlayer.test.tsx` — mock `../story/useStoryPlayer` to return a controllable state (`sceneIndex 0, playing false, wordIndex 1, timings, hasAudio false, musicOn true, subtitles false, ended false`, spies for actions). Render at `/story/little-fox`: shows story title, scene emoji, the words of scene 0 with index 1 active, clicking "Phát" calls `toggle`, clicking a word calls `replayWord(i)`; with `subtitles: true` the `textVi` is visible; with `ended: true` a "Trả lời câu hỏi →" link to `/story/little-fox/quiz` appears. `StoryList`: renders 3 story cards linking to `/story/<id>` with `Stars value={getStars('story:<id>')}`.
- [ ] **Step 2: Run → fail. Step 3: Implement**
  - `StoryList`: header "🎧 Nghe kể chuyện", back link "← Về nhà" (64 px), grid of cards (emoji, title, titleVi, Stars).
  - `StoryPlayer`: `const story = findStory(id)`; `const p = useStoryPlayer(story)`; layout: top bar (back link to `/stories`, title), `SceneArt` (flex-1, max-h 60vh), `Karaoke` (words of current scene, `activeIndex = p.wordIndex`, `subtitle = p.subtitles ? scene.textVi : undefined`, `onWordTap = p.replayWord`), `PlayerControls`. When `!p.hasAudio` show small grey text "Chưa có giọng đọc — chữ chạy theo nhịp ước lượng". When `p.ended` show a coral button/link "Trả lời câu hỏi →" to `/story/${id}/quiz`.
  - `App.tsx` routes: `/stories` → StoryList, `/story/:id` → StoryPlayer, `/story/:id/quiz` → StoryQuiz (Task 7), `/story/:id/retell` → StoryRetell (Task 8) — add the two later routes in their tasks.
  - `Home.tsx`: add a first card `Link to="/stories"` "🎧 Nghe kể chuyện" styled like the level cards but `bg-coral`.
- [ ] **Step 4: Green → Commit** `feat(ui): story list and story player screens`.

---

### Task 7: Quiz screen

**Files:** Create `client/src/screens/StoryQuiz.tsx`, `StoryQuiz.test.tsx`; Modify `App.tsx` (route).

Behaviour: shows question `q` (text-3xl) + `qVi` (text-xl slate-500), three option buttons (emoji text-[72px] + label, min 120×120, `bg-white shadow rounded-3xl`). On tap: correct → button turns `bg-good/20 ring-4 ring-good`, Foxy line "🦊 Đúng rồi!" and after 900 ms advance; wrong → `bg-fix/20 ring-4 ring-fix`, "🦊 Chưa đúng, thử lại nhé" and that question is marked not-first-try. After 3 questions: stars = firstTryCorrect 3→3, 2→2, else 1; `setStars('story:<id>', stars)`; show `<Stars animate={stars===3}>`, "Bé trả lời đúng X/3", buttons "Kể lại câu chuyện →" (`/story/<id>/retell`, coral) and "Nghe lại" (`/story/<id>`).
- [ ] **Step 1: Failing test**: render `/story/little-fox/quiz`; answer all three correctly (use fake timers for the 900 ms advance) → 3 filled stars and `localStorage` contains `"story:little-fox":3`; second test: first question wrong then right, others right → 2 stars.
- [ ] **Step 2–4:** implement, green, commit `feat(ui): story picture quiz`.

---

### Task 8: Retell screen

**Files:** Create `client/src/screens/StoryRetell.tsx`, `StoryRetell.test.tsx`, `client/src/story/retellStars.ts` (+ test); Modify `App.tsx` (route).

```ts
// retellStars.ts
export function retellStars(overall: number): 1 | 2 | 3   // ≥60→3, ≥35→2, else 1
export const RETELL_MESSAGE: Record<1|2|3, string> = { 3: 'Tuyệt vời! 🦊', 2: 'Hay lắm!', 1: 'Bé kể tốt lắm, thử lại nhé!' }
```
Screen: title "Bé kể lại nhé", the target sentence text-5xl font-extrabold, `textVi` below, 🔊 button that plays `scene audio` of the scene containing the sentence if any word timings exist (find scene whose `text` includes `retell.text`; else use `speechSynthesis` if available; else no-op), `MicButton` driven by `useSpeakingAttempt({ targetText: story.retell.text, resetKey: id })`; after `result`: `Stars` + message, `setStars('retell:<id>', stars)`, buttons "Thử lại" (`attempt.reset`) and "Về danh sách truyện" (`/stories`, coral). Errors from the hook shown in `text-fix`.
- [ ] **Step 1: Failing tests**: `retellStars(70)=3, (40)=2, (10)=1`; screen test with `useSpeakingAttempt` mocked to return `result.overall 40` → 2 filled stars and `localStorage` has `"retell:little-fox":2`.
- [ ] **Step 2–4:** implement, green, commit `feat(ui): story retell with lenient stars`.

---

### Task 9: Docs, PWA check, final wiring

**Files:** Modify `README.md`, `docs/2026-08-22-giai-phap-va-design-brief.md` (status line), `client/vite.config.ts` only if precache misses anything.

- [ ] **Step 1:** README: "Phase 2 — Listening" section (what it does, fallback mode note, generator command, iPad checklist rows: karaoke sync with generated audio; tap-word replay; music toggle survives reload; speed 0.75; quiz → retell flow). Mark spec doc "Phase 2 implemented <date> on branch phase2-listening".
- [ ] **Step 2:** `pnpm build` → confirm precache includes the new JSON-bundled code (mp3 glob already present). Run the full suite, lint, typecheck.
- [ ] **Step 3: Commit** `docs: phase 2 listening README and status`.

## Self-Review
- Spec coverage: stories/scenes/art ✔ T2,T5,T6; karaoke + tap word + speed + subtitles + music ✔ T4,T5,T6; no-audio fallback ✔ T2,T4; narration + timings generator ✔ T3; quiz ✔ T7; retell lenient ✔ T1,T8; progress + home card ✔ T6,T7,T8; docs ✔ T9.
- Placeholders: none. Types consistent: `StoryWord/Scene/Story` (T2) used by T4–T8; `useSpeakingAttempt` (T1) used by T8; `retellStars` (T8); `useStoryPlayer` API (T4) mocked in T6 with the same field names.
