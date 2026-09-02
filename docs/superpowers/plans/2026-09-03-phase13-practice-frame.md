# Phase 13 — Khung luyện nói (vòng 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The nine speaking screens (B1 PracticeCard, B2 SoundWordList, B3 SoundPractice, B4 PairPractice, B5 StarPractice, B6 VoicePractice, C4 StoryRetell, C7 WordCard, C9 SentenceBuilder) render the round-2 design's "teach" content at phone 390×844, iPad portrait 834×1194 and iPad landscape 1194×834, on top of the Phase 12 frame, with the six frame behaviours round 2 added (collapsible teach strip, dimmed header while recording, chip pairs, one-row countdown, Foxy prompt with the seconds, act row layout on iPad portrait) — and the four result states of the carrier B6 fit 834 px on iPad landscape, measured.

**Architecture:** Shared changes land first (Tailwind `short:` variant, `ChipPair`, `PageHeader.dimmed`, `PageBody.split.collapsed` + act row layout, `MicButton.countdownLayout`, `SpeakPrompt`, `ResultCard.fox/compact/forceHint`, `SoundTier`, `MouthPanel`) plus a DEV-only result fixture so headless screenshots can reach scored states. Then each screen is rewritten teach-first in its own task, keeping its Phase 12 hooks and logic. A final task screenshots everything and documents.

**Tech Stack:** React 19, react-router-dom, Tailwind 3 (plugin variants `ipad`, new `short`), Vitest + Testing Library (jsdom, `globals: true`), oxlint, tsc. Screenshots: `docs/design/current/shoot.mjs` + `sheet.mjs` (`SHOTS_DIR`, dev server `pnpm --filter client exec vite --mode nossl --port 5174 --strictPort`).

**Spec:** `docs/superpowers/specs/2026-09-03-phase13-practice-frame-design.md` (18 decisions).
**Numbers & copy:** `docs/design/2026-09-03-round2-practice-brief.md` (§1 frame per state, §2 nine variants, §4 R1–R24). The brief wins on measurements, the spec on decisions.

## Global Constraints
- Branch `phase13-practice` from `main` (d662cf1). One commit per task; pre-commit secret hook; never `--no-verify`; never print `.env`.
- Breakpoints: unprefixed = phone; `md:` = iPad portrait (and tablets); `ipad:` = iPad landscape; new `short:` = `(max-width:767px) and (max-height:700px)`; `lg:` is not used.
- Phase 12 tokens, `Button` sizes, `MicButton` sizes (124/150, 150/190), `ResultCard` row order ①–⑥ are unchanged. Do not touch `useSpeakingAttempt` except Task 3's fixture hook, `createScorer`, `missionNav`.
- Teach column content and sizes per brief §2 verbatim; act column = `SpeakPrompt` → (`SpeakError`) → `MicButton` before a result, `ResultCard` after.
- Keep every existing `data-testid`. Tests green, 0 act() warnings, lint (only the known LessonChip warning) + typecheck + build clean.
- Screenshots per task: `SHOTS=<names> SHOTS_DIR=../current-phase13/shots node shoot.mjs <phone|ipad|ipadp>` from `docs/design/current/`, dev server in the background; report `overflow` lines. Commands from repo root; `pnpm.cmd` on the user's shell.

---

### Task 1: `short:` variant, `ChipPair`, `PageHeader.dimmed`

**Files:**
- Modify: `client/tailwind.config.ts` (plugins), `client/src/components/ui/page/PageHeader.tsx`, `client/src/components/ui/index.ts`
- Create: `client/src/components/ui/ChipPair.tsx`
- Test: `client/src/components/ui/ui.test.tsx`, `client/src/components/ui/page/page.test.tsx`

**Interfaces:**
- Produces: Tailwind variant `short:`; `<ChipPair left right size?='md'|'lg'>`; `PageHeader` prop `dimmed?: boolean`.

- [ ] **Step 1: Failing tests**

```tsx
// ui.test.tsx
describe('ChipPair', () => {
  it('joins a teal left half and a coral right half', () => {
    render(<ChipPair left="Âm 2/9" right="Từ 1/3" />)
    const pair = screen.getByTestId('chip-pair')
    expect(pair.children[0]).toHaveClass('bg-teal-50', 'text-teal-600', 'rounded-l-r12', 'rounded-r-none')
    expect(pair.children[1]).toHaveClass('bg-coral-50', 'text-coral-text', 'rounded-r-r12', 'rounded-l-none')
    expect(pair).toHaveTextContent('Âm 2/9Từ 1/3')
  })
})
// page.test.tsx
it('dimmed header fades and disables back and right cells', () => {
  wrap(<PageShell><PageHeader dimmed back={<BackButton to="/" label="Về nhà" />}>x</PageHeader><PageBody>y</PageBody></PageShell>)
  expect(screen.getByRole('link', { name: 'Về nhà' }).parentElement).toHaveClass('opacity-40', 'pointer-events-none')
  expect(screen.getByTestId('header-right')).toHaveClass('opacity-40', 'pointer-events-none')
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/components/ui` → FAIL.

- [ ] **Step 3: Implement**

`tailwind.config.ts` plugin block — add next to `ipad`:
```ts
      addVariant('short', '@media (max-width: 767px) and (max-height: 700px)')
```
Then replace every `[@media(max-width:767px)_and_(max-height:700px)]:` prefix in `client/src` with `short:` (`grep -rln "max-height:700px" client/src`).

```tsx
// ChipPair.tsx — brief Q8: two halves stuck together, teal left / coral right.
const SIZE = { md: 'text-[15px] py-[7px]', lg: 'text-[17px] py-[9px]' } as const
export function ChipPair({ left, right, size = 'md', className = '' }: { left: React.ReactNode; right: React.ReactNode; size?: 'md' | 'lg'; className?: string }) {
  const s = SIZE[size]
  return (
    <span data-testid="chip-pair" className={`inline-flex font-display font-extrabold ${className}`}>
      <span className={`rounded-l-r12 rounded-r-none bg-teal-50 px-3 text-teal-600 md:rounded-l-r14 ${s}`}>{left}</span>
      <span className={`rounded-r-r12 rounded-l-none bg-coral-50 px-3 text-coral-text md:rounded-r-r14 ${s}`}>{right}</span>
    </span>
  )
}
```
(Tailwind must know `rounded-l-r12`/`rounded-r-r12`/`-r14`: they derive from the `r12`/`r14` radius tokens automatically.)

`PageHeader.tsx`: add `dimmed?: boolean`; wrap back in `<div className={`justify-self-start ${dimmed ? 'opacity-40 pointer-events-none' : ''}`}>` and add the same two classes to the right cell when `dimmed`.

- [ ] **Step 4: Run** the two test files, then full suite + lint + typecheck → PASS.
- [ ] **Step 5: Commit** — `feat(ui): short variant, ChipPair, dimmed header`

---

### Task 2: `PageBody.collapsed` + act row on iPad portrait; `MicButton.countdownLayout`; `SpeakPrompt`; `ResultCard.fox/compact/forceHint`

**Files:**
- Modify: `client/src/components/ui/page/PageBody.tsx`, `client/src/components/speak/MicButton.tsx`, `client/src/components/speak/ResultCard.tsx`, `client/src/components/speak/index.ts`
- Create: `client/src/components/speak/SpeakPrompt.tsx`
- Test: `page.test.tsx`, `speak.test.tsx`

**Interfaces:**
- Produces: `split.collapsed?: { emoji: string; label: string; onExpand(): void }`; act container `md:flex-row md:gap-10 ipad:flex-col`; `MicButton` `countdownLayout?: 'row' | 'column'` (default `row`); `<SpeakPrompt mood say seconds?>`; `ResultCard` `fox?: { mood: FoxyMood; say: string }`, `compact?: boolean`, `forceHint?: boolean`.

- [ ] **Step 1: Failing tests**

```tsx
// page.test.tsx
it('collapsed split body shows the strip instead of the teach column and expands on tap', () => {
  const onExpand = vi.fn()
  wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p>, collapsed: { emoji: '😊', label: 'I love my dog!', onExpand } }} /></PageShell>)
  expect(screen.queryByText('dạy')).toBeNull()
  const strip = screen.getByRole('button', { name: /mở/ })
  expect(strip).toHaveClass('h-8', 'text-[15px]', 'text-[#D9C9AE]', 'md:h-16', 'md:bg-white', 'ipad:hidden')
  fireEvent.click(strip); expect(onExpand).toHaveBeenCalled()
})
it('act column is a row on iPad portrait and a column on landscape', () => {
  wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
  expect(screen.getByText('làm').parentElement).toHaveClass('md:flex-row', 'md:gap-10', 'ipad:flex-col')
})
// speak.test.tsx
it('MicButton lays the level bars and countdown in one row by default, column when asked', () => {
  const { rerender } = render(<MicButton state="recording" level={0.5} onPress={() => {}} secondsLeft={13} />)
  expect(screen.getByTestId('countdown-row')).toHaveClass('flex-row', 'gap-3.5')
  expect(screen.getByTestId('countdown')).toHaveClass('min-w-[56px]', 'md:min-w-[70px]')
  rerender(<MicButton state="recording" level={0.5} onPress={() => {}} secondsLeft={13} countdownLayout="column" />)
  expect(screen.getByTestId('countdown-row')).toHaveClass('flex-col')
})
it('SpeakPrompt shows Foxy and the seconds in coral', () => {
  render(<SpeakPrompt mood="idle" say="Đọc cả đoạn thật có hồn nhé!" seconds={13} />)
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'idle')
  expect(screen.getByText('13 giây')).toHaveClass('text-coral-text')
})
it('ResultCard fox row sits after the listen row; compact keeps only head, hint and cta; forceHint shows the hint at 2 stars', () => {
  render(<MemoryRouter><ResultCard stars={2} praise="x" hint={{ word: 'w', tip: 't' }} forceHint fox={{ mood: 'cheer', say: 'Giọng vui thật đấy!' }} onSample={() => {}} onRetry={() => {}} /></MemoryRouter>)
  const rows = Array.from(screen.getByTestId('result-card').children).map(c => c.getAttribute('data-row'))
  expect(rows).toEqual(['head', 'hint', 'listen', 'fox', 'cta'])
  render(<MemoryRouter><ResultCard compact stars={1} praise="y" words={[{ word: 'a', tone: 'fix' }]} bars={{ accuracy: 1, fluency: 1, completeness: 1 } as never} hint={{ word: 'w', tip: 't' }} onRetry={() => {}} /></MemoryRouter>)
  const rows2 = Array.from(screen.getAllByTestId('result-card')[1].children).map(c => c.getAttribute('data-row'))
  expect(rows2).toEqual(['head', 'hint', 'cta'])
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`PageBody.tsx` split branch:
```tsx
type Split = { teach: ReactNode; act: ReactNode; collapsed?: { emoji: string; label: string; onExpand: () => void } }
// …
<div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:mt-4 ipad:flex-row ipad:gap-6 ipad:overflow-visible ${className}`}>
  {split.collapsed ? (
    <>
      {/* brief §0.4 / §1: phone strip 32, iPad-portrait strip 64; landscape never collapses */}
      <button type="button" onClick={split.collapsed.onExpand} aria-label="mở lại phần dạy"
        className="flex h-8 w-full shrink-0 items-center gap-2 px-1 text-left md:h-16 md:rounded-r18 md:bg-white md:px-4 md:shadow-card-xs ipad:hidden">
        <span aria-hidden="true" className="text-[15px] md:text-[28px]">{split.collapsed.emoji}</span>
        <span className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold text-[#D9C9AE] md:text-[18px] md:text-sand-text">{split.collapsed.label}</span>
        <span className="shrink-0 text-[12px] font-extrabold text-ink-300 md:text-[13px]">▾ mở</span>
      </button>
      <div className="hidden ipad:flex ipad:min-h-0 ipad:flex-1 ipad:flex-col ipad:items-center ipad:justify-center ipad:overflow-y-auto">{split.teach}</div>
    </>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center ipad:min-h-0 ipad:overflow-y-auto">{split.teach}</div>
  )}
  <div className="flex flex-col items-center justify-center md:h-[300px] md:shrink-0 md:flex-row md:gap-10 ipad:h-auto ipad:max-h-full ipad:w-[440px] ipad:shrink-0 ipad:min-h-0 ipad:flex-col ipad:gap-4 ipad:overflow-y-auto">{split.act}</div>
</div>
```
(When collapsed with a result, the act column on portrait must grow: the screen passes `className="md:[&>*:last-child]:h-auto"` — simpler: add prop `actGrow?: boolean` that swaps `md:h-[300px]` for `md:flex-1 md:min-h-0`; use it in the result state.)

`MicButton.tsx`: add `countdownLayout = 'row'`; replace the two trailing lines with
```tsx
{rec && (
  <div data-testid="countdown-row" className={`flex items-center ${countdownLayout === 'row' ? 'flex-row gap-3.5 md:gap-4' : 'flex-col gap-3'}`}>
    {countdownLayout === 'column' && secondsLeft !== undefined && <Countdown seconds={secondsLeft} />}
    <LevelBars level={level} />
    {countdownLayout === 'row' && secondsLeft !== undefined && <Countdown seconds={secondsLeft} />}
  </div>
)}
{!rec && CAPTION[state] && <p className="text-[15px] font-bold text-ink-500 md:text-[18px]">{CAPTION[state]}</p>}
```
and in `Countdown.tsx` change the disc to `flex h-auto min-w-[56px] items-center justify-center … md:min-w-[70px] md:text-[56px]` (no fixed 96 disc: brief §1 shows a bare number `min-width 56/70`; keep `bg-peach-50 rounded-full px-3 py-1` so it still reads as a badge).

```tsx
// SpeakPrompt.tsx — brief §1: Foxy 60×58 (phone) / 72×70 (iPad) + bubble, seconds in coral.
import { Foxy } from '../Foxy'
import type { FoxyMood } from '../Foxy'
export function SpeakPrompt({ mood, say, seconds }: { mood: FoxyMood; say: string; seconds?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-[58px] w-[60px] shrink-0 md:h-[70px] md:w-[72px]"><Foxy mood={mood} size="sm" /></div>
      <div className="rounded-r16 rounded-bl-[6px] bg-white px-3.5 py-[9px] font-display text-[15px] font-extrabold text-ink-900 shadow-card-xs md:px-4 md:py-2.5 md:text-[17px]">
        {say}{seconds !== undefined && <> <span className="text-coral-text">{seconds} giây</span></>}
      </div>
    </div>
  )
}
```

`ResultCard.tsx`: props `fox?`, `compact?`, `forceHint?`. Row logic:
```tsx
const showHint = p.hint && (p.forceHint || p.stars < 2)
// order: head, extra, (!compact) words, (!compact) bars, hint, (!compact) listen, fox, cta
{p.fox && <div data-row="fox" className="flex items-center justify-center gap-2 ipad:mt-auto md:gap-2.5"><div className="h-[42px] w-[44px] ipad:h-[50px] ipad:w-[52px] md:h-[93px] md:w-[96px] ipad:h-[50px]"><Foxy mood={p.fox.mood} size="sm" /></div><p className="text-[13px] font-bold text-ink-500 md:rounded-r16 md:rounded-bl-[6px] md:bg-white md:px-4 md:py-2.5 md:font-display md:text-[17px] md:font-extrabold md:text-ink-900 md:shadow-card-xs ipad:bg-transparent ipad:p-0 ipad:font-sans ipad:text-[14px] ipad:font-bold ipad:text-ink-500 ipad:shadow-none">{p.fox.say}</p></div>}
```
(`compact` also drops the listen row.)

- [ ] **Step 4: Run** all tests + lint + typecheck → PASS (update Task 6/8 assertions that relied on the old countdown/caption layout).
- [ ] **Step 5: Commit** — `feat(speak): collapsible teach strip, prompt bubble, countdown row, ResultCard fox/compact`

---

### Task 3: DEV-only result fixture for headless screenshots

**Files:**
- Create: `client/src/speaking/fixture.ts`
- Modify: `client/src/speaking/useSpeakingAttempt.ts` (one hook at the end of the reset effect), `docs/design/current/shoot.mjs` (result routes)
- Test: `client/src/speaking/fixture.test.ts`

**Interfaces:**
- Produces: `readResultFixture(search: string): PronunciationResult | null` — `?fixture=result3` → an Azure-like result (overall 86, accuracy 88, fluency 81, completeness 100, prosody 84, words all good except 2 ok/1 fix), `?fixture=result1` → Web-Speech-like (50s, prosody undefined, words alternating good/fix); returns `null` unless `import.meta.env.DEV` and the param is present. `useSpeakingAttempt` applies it once per `resetKey` as if `onResult` had fired (sets `result`, calls `onResult(result, null)`, engine `'azure'` for result3 / `'webspeech'` for result1).

- [ ] **Step 1: Failing test**
```ts
it('returns null in production and a scored result in dev', () => {
  vi.stubEnv('DEV', false); expect(readResultFixture('?fixture=result3')).toBeNull()
  vi.stubEnv('DEV', true)
  const r = readResultFixture('?fixture=result3&x=1')!
  expect(r.overall).toBe(86); expect(r.words.length).toBeGreaterThan(0); expect(r.prosody).toBe(84)
  expect(readResultFixture('?fixture=result1')!.prosody).toBeUndefined()
  expect(readResultFixture('?nope')).toBeNull(); vi.unstubAllEnvs()
})
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `fixture.ts` building the `PronunciationResult` from the target text (`words: text.split(' ')` with scores), and in the hook's reset effect after computing `locked`: `const fx = readResultFixture(window.location.search); if (fx) { adoptScorer({ scorer: { score: async () => fx }, engine: fx.prosody === undefined ? 'webspeech' : 'azure' }); setResult(fx); onResultRef.current?.(fx, null); return }` (skip `createScorer`). `shoot.mjs`: add shots `voice-result3` (`/voice/sv1?fixture=result3`), `voice-result1`, `star-result3`, `sound-result3` (`/sound/th/sz-th-three?fixture=result3`), `pair-result3` (`/pair/pair-ship-sheep?fixture=result3` — the listening phase must be skipped by the fixture: PairPractice treats a present result as "speaking phase done"), `retell-result3`, `word-result3` (`/words/animals/animals-elephant?fixture=result3` — WordCard skips the guess step when a fixture result is present), `sentence-result3` (`/sentence/s12?fixture=result3` — SentenceBuilder marks the tray correct), `practice-result3`.
- [ ] **Step 4: Run** tests + lint + typecheck + `pnpm --filter client build` and confirm `grep -c fixture client/dist/assets/*.js` is 0 or the branch is dead (tree-shaken by `import.meta.env.DEV`).
- [ ] **Step 5: Commit** — `chore(speak): dev-only result fixture for screenshots`

---

### Task 4: B6 VoicePractice — the carrier, 4 states × 3 frames

**Files:** Modify `client/src/screens/VoicePractice.tsx` (+ test)

- [ ] **Step 1: Failing tests** — with the mocked hook: (a) idle: teach has mood row (`text-[34px] md:text-[48px]` emoji, `text-[16px] md:text-[22px]` label), passage `text-[24px] md:text-[34px] md:max-w-[560px]`, gloss `text-[13px] md:text-[17px]`, sample `Button` (56/64 — `size="md"`), tips card `text-[12px] md:text-[14px] short:hidden`; act has `SpeakPrompt` with "13 giây" and `MicButton`; (b) recording: header `dimmed`, centre chip text "● Đang ghi" with `bg-coral-50 text-coral-text`, passage `text-[26px]`, tips hidden, `countdown-row` present; (c) result: `page-body` shows the collapsed strip with the passage text and no tips; `result-card` has a `fox` row; clicking the strip shows the teach column again.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — per brief §1: state `teachOpen` (reset to `false` when a result lands, `true` on `a.reset()`); `PageHeader dimmed={recording}`; chip = `recording ? <Chip tone="coral">● Đang ghi</Chip> : <Chip tone="teal">Đoạn n/8</Chip>` (teal, not coral, per the brief); `PageBody split={{ teach, act, collapsed: result && !teachOpen ? { emoji: passage.emoji, label: passage.text, onExpand: () => setTeachOpen(true) } : undefined }} actGrow={!!result}`; teach classes as in Step 1; act idle = `<SpeakPrompt mood="idle" say="Đọc cả đoạn thật có hồn nhé!" seconds={13} />` + error + `<MicButton … countdownLayout="row" />` wrapped so that on `md:` (portrait) the prompt and mic sit side by side (act container already `md:flex-row`); result = `<ResultCard … fox={{ mood: stars === 3 ? 'cheer' : stars === 2 ? 'happy' : 'idle', say: stars === 3 ? 'Foxy: "Giọng vui thật đấy!"' : 'Foxy: "Thử lại lần nữa nhé!"' }} />`. Remove the `lg:` size step in `Passage`.
- [ ] **Step 4: Run** tests/lint/typecheck; screenshots `voice-idle,voice-result3,voice-result1` at all three frames + a recording shot (`voice-recording`: add to `shoot.mjs` by clicking the mic with `navigator.mediaDevices` stubbed to a fake stream) — report overflow lines; **`ipad/voice-result3` must fit 834 with no `-full`**.
- [ ] **Step 5: Commit** — `feat(voice): round-2 teach column and four states on the carrier`

---

### Task 5: B5 StarPractice

**Files:** Modify `client/src/screens/StarPractice.tsx` (+ test)
- [ ] Tests: stressed sentence sizes `text-[32px]/[26px] md:text-[48px]/[40px] md:max-w-[560px]`; gloss 14/20; legend `text-[12px] md:text-[14px] short:hidden`; rhythm card `md:w-[480px]` dots 24/12; no `min-h-[112px]` reserve; result `sub` equals `rhythmLine(...)` and the card is not passed a separate rhythm line; recording hides the legend and keeps the sentence colours.
- [ ] Implement per brief §2 B5 + carrier behaviours (dimmed header, "● Đang ghi", collapsed strip with the sentence, `SpeakPrompt say="Nói cả câu một hơi nhé!"` (no seconds), `fox` in ResultCard).
- [ ] Screens `star-idle,star-result3` × 3 frames. Commit `feat(star): round-2 teach column`.

---

### Task 6: `SoundTier` + B3 SoundPractice + B2 SoundWordList

**Files:** Create `client/src/components/speak/SoundTier.tsx`; modify `SoundPractice.tsx`, `SoundWordList.tsx` (+ tests)
- **`SoundTier({ ph, ipa, tip, onPlay, audioMissing, wiggle? })`**: phone card `bg-peach-50 rounded-r20 px-3.5 py-3 shadow-[0_6px_0_#F2DFC9]` with mouth tile 56 (`rounded-r16 bg-white text-[30px]`), IPA `text-[40px] text-[#C08457]`, speaker 56 round teal, tip `text-[13px] text-sun-700 line-clamp-2`; `md:` row `md:max-w-[560px] md:rounded-r24 md:px-5 md:py-4` mouth 64, IPA `md:text-[72px]`, tip 17, speaker 64. B2 uses `md:max-w-[640px]`.
- [ ] Tests: SoundTier classes; SoundPractice header uses `ChipPair` "Âm n/9" / "Từ n/3" at all times and no progress dots; word tier `text-[40px] md:text-[56px]`, IPA `short:hidden`; result `extra` has the SoundChip + `Từ {word} · N điểm` line; `forceHint` when tone ≠ good; SoundWordList grid `grid-cols-3` with tiles `min-h-[120px]` (emoji 40 · word 17 · IPA 12 · stars 12px) and a Foxy prompt row below; iPad `md:w-[200px] md:min-h-[180px]` centred, no `md:grid-cols-3` stretch.
- [ ] Implement per brief §2 B3/B2 + carrier behaviours. B2 has no mic: `PageBody` plain (not split) on iPad too (`ipad:` one column).
- [ ] Screens `sound-list,sound-practice-idle,sound-result3` × 3 frames. Commit `feat(sound): SoundTier, chip pair, round-2 sound screens`.

---

### Task 7: B1 PracticeCard + `MouthPanel`

**Files:** Create `client/src/components/speak/MouthPanel.tsx`; modify `PracticeCard.tsx` (+ test)
- `MouthPanel({ card, open, onToggle })`: toggle button "👄 Khẩu hình" (`bg-peach-50 text-[#C08457] shadow-[0_5px_0_#F2DFC9]`, 56/64) and, when open, the mouth tile `h-[140px] w-[140px] md:h-[220px] md:w-[220px]` below the button row.
- [ ] Tests: header chip "Thẻ n/12 · ● ○" (streak dots inside the centre chip for Word Pop); emoji card `h-[140px] w-[140px] rounded-r26 md:h-[220px] md:w-[220px]` emoji `text-[76px] md:text-[120px]`; word `text-[44px] md:text-[64px]`; IPA-reveal button `h-9 bg-sand text-sand-text md:h-11`; button row `🔊 Nghe mẫu` + `👄 Khẩu hình`; streak line `short:hidden`; mouth panel toggles; recording shrinks the card (`h-[110px]`) and hides the two buttons; result keeps the CTA gate and the 2★ streak praise "Nói đúng lần nữa để 3★!".
- [ ] Implement per brief §2 B1 + carrier (prompt "Nói to, rõ trong 5 giây nhé!" with `seconds={5}`).
- [ ] Screens `practice-idle,practice-ipa-hidden,practice-result3` × 3 frames. Commit `feat(practice): round-2 card with mouth panel`.

---

### Task 8: B4 PairPractice

**Files:** Modify `PairPractice.tsx` (+ test)
- [ ] Tests: header `ChipPair` "Cặp n/8" / contrast; phase 1: speaker button 56 teal with `outline-4 outline-teal-line` while unplayed, options `h-24 w-24 md:h-[200px] md:w-[200px]` (`opacity-45` disabled), wrong feedback is one line "🙈 Nghe lại rồi chọn nhé", tick line; phase 2: green one-line chip "✓ Nghe & chọn xong: ship ✓ · sheep ✓" replaces the summary Card, "Giờ nói cả hai từ nhé", two word cards `w-[150px] md:w-[220px]`, sample button; mic only in phase 2; result `words` 2 chips + bars, `fox` row.
- [ ] Implement per brief §2 B4 + carrier (prompt "Nói cả hai từ: ship, sheep").
- [ ] Screens `pair-listen,pair-listen-armed,pair-result3` × 3 frames. Commit `feat(pair): round-2 listen and speak phases`.

---

### Task 9: C4 StoryRetell

**Files:** Modify `StoryRetell.tsx` (+ test)
- [ ] Tests: no H1; header chip "Kể lại · cảnh n/m"; card `rounded-r22 px-[18px] py-[22px] md:max-w-[560px] md:px-7 md:py-8`, scene line 12/14, sentence `text-[32px] md:text-[40px]`, gloss 15/20, speaker 56/64; result has no `bars`, has `words`, `fox`; CTA = Thử lại + one primary.
- [ ] Implement per brief §2 C4 + carrier (prompt "Bé kể lại câu này nhé — 8 giây" → `seconds={8}`; countdown 8→1 already).
- [ ] Screens `retell-idle,retell-result3` × 3 frames. Commit `feat(retell): round-2 card`.

---

### Task 10: C7 WordCard

**Files:** Modify `WordCard.tsx` (+ test)
- [ ] Tests: guess step options keep the emoji at `md:` (no `md:hidden`), correct option ring classes, "🔊 Nghe lại" 44 button, CTA in footer only after a correct guess; flip card `w-[min(320px,82%)] aspect-[16/17] rounded-[30px] md:w-[320px] md:h-[360px]` with `animate-peek` until first flip and a `🔄` corner icon `opacity-30` that disappears after the first flip; hint line under the card "Mặt sau: nghĩa + câu ví dụ + 🔊"; result: `ResultCard compact` with `sub` "🔓 Đã mở khoá" / "thử lại để mở khoá", no words/bars, card keeps its size (no `md:h-[300px]` swap), mic hidden on phone (`max-md:hidden`) and beside the CTA on iPad.
- [ ] Implement per brief §2 C7, Q7, Q9, Q10 + carrier (prompt "Đọc to từ trên thẻ nhé!"). Fixture: a present result skips the guess step.
- [ ] Screens `word-guess,word-guess-correct,word-card-front,word-card-back,word-result3` × 3 frames. Commit `feat(word): round-2 flip card and compact result`.

---

### Task 11: C9 SentenceBuilder

**Files:** Modify `SentenceBuilder.tsx` (+ test)
- [ ] Tests: tiles `h-11 min-w-[44px] rounded-r12 text-[17px] md:h-14 md:text-[22px] md:rounded-r14` with the three role colour sets from the brief; tray `min-h-[76px] rounded-r18 md:min-h-[96px] md:max-w-[640px] md:rounded-r22`; wrong = tray `animate-shake border-fix-300` + "🦊 Chưa đúng — thử lại nhé" then empties; correct = green banner "Đúng rồi! 🎉 Giờ đọc câu lên nhé" + "🔊 Đọc câu cho bé nghe"; iPad: `MicButton state="disabled"` present before the sentence is correct with caption "Xếp đúng câu trước nhé" (`hidden md:flex`); result: the tray region renders `ScoredWords` in place (same order) and `ResultCard` receives no `words`; `goNext` stays inside the topic when `?topic=` was given and lands on `/sentences?topic=…` after the last one.
- [ ] Implement per brief §2 C9 + R18–R20 + carrier (prompt "Đúng rồi! Giờ đọc câu lên nhé").
- [ ] Screens `sentence-empty,sentence-partial,sentence-correct,sentence-result3` × 3 frames. Commit `feat(sentence): round-2 tray, in-place scored words, in-topic next`.

---

### Task 12: Verification — screenshots, README, checklist

**Files:** Modify `README.md`, the spec (status line), `docs/design/round-2026-09/README.md`; `docs/design/current/shoot.mjs` (any missing routes)
- [ ] Full three-viewport run into `docs/design/current-phase13/shots/` + `sheet.mjs`; list every `overflow` line; iPad landscape must show none for `voice-result3`, `star-result3`, `sound-result3`, `sentence-result3`.
- [ ] README "Phase 13 — Khung luyện nói": what changed (frame behaviours, 9 screens), the result-state measurements per screen at 1194×834 (from the run), deviations recorded as `Ruling:` in the ledger, three checklist rows (chip đôi Âm/Từ; dải gập chạm mở lại; khẩu hình bật/tắt) + one for the recording header dimming.
- [ ] Spec status line; round README "Bước tiếp" → Phase 14 (round 3).
- [ ] `pnpm --filter client test && lint && typecheck && build`. Commit `docs: phase 13 practice frame — screenshots and checklist`.

## Self-review
- Spec coverage: decisions 1–7 → Tasks 1–2; 8 → 7; 9 → 6; 10 → 8; 11 → 5; 12 → 9; 13 → 10; 14 → 11; 15 → 6; 16 → 1; 17 → each screen task's tests ("processing keeps teach"); 18 → Tasks 4/7. Fixture → Task 3. Verification → Task 12.
- Placeholders: screen tasks give class lists and behaviours rather than full JSX; the brief §2 carries the per-element numbers and the Phase 12 files carry the surrounding code — the implementer transcribes from both. Accepted for this plan because every value is stated in one of the two documents.
- Type consistency: `collapsed` shape, `actGrow`, `countdownLayout`, `SpeakPrompt` props, `fox/compact/forceHint` are named identically in Task 2 and in Tasks 4–11.
