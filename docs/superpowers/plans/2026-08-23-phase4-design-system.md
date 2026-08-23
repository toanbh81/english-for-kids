# Phase 4 — Apply the Claude Design handoff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the app to the Claude Design handoff (tokens, Foxy SVG, chunky UI kit, island-map Home, Daily Mission + Mission Complete screens, redesigned player/quiz/speak-card/words/sentences/parent screens) with behaviour and test contracts unchanged.

**Architecture:** Tailwind theme extension + a small `components/ui/` kit; each screen is restyled in place using the kit; two new routes. No store/hook/content changes except Home's celebration handoff to `/mission/done`.

**Tech Stack:** unchanged. Design reference: `docs/design/speak-up-screens.dc.html`, `docs/design/foxy-svg-reference.js`, `docs/design/README.md` (tokens).

**Spec:** `docs/superpowers/specs/2026-08-23-phase4-design-system-design.md` (authority).

## Global Constraints
- Branch `phase4-design` (from `phase3-words-mission`). Commit per task; secret hooks; never `--no-verify`.
- Behaviour frozen: same routes (+ `/mission`, `/mission/done`), same stores, hooks, scoring, copy for tested strings (e.g. "Bấm để nói", "Dừng", "Không tìm thấy…", "Hoàn thành! 🎉", "Thử lại", "Tiếp theo →" may become "Tiếp theo ▸" ONLY if every test is updated in the same commit).
- Tests: existing suites must stay green; when a visual class assertion breaks (e.g. `text-coral`, `text-slate-400`), update the assertion to the new token in the same task. data-testids and aria-labels unchanged.
- Tap targets ≥ 64 px; mic ≥ 120 px; fonts Baloo 2 + Nunito; tokens exactly as the spec.
- All of `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` green before each commit; no act() warnings.

---

### Task 1: Tokens, fonts, keyframes, UI kit
**Files:** Modify `client/tailwind.config.ts`, `client/src/styles.css`; Create `client/src/components/ui/{Button,Card,BackButton,Toggle,Chip,ProgressBar,Toast,SpeechBubble,StarRow,SceneDots}.tsx`, `client/src/components/ui/index.ts`, `client/src/components/ui/ui.test.tsx`; Modify `client/src/components/Foxy.tsx` (+ its tests in `habit-components.test.tsx`).
- Theme: colors per spec (incl. aliases `cream/coral/teal/star/good/ok/fix` → new hexes), `fontFamily.display`, `boxShadow` (`card`, `card-sm`, `chunky-coral`, `chunky-teal`, `chunky-sun`, `chunky-line`), `borderRadius` (`xl2: 20px` … or use arbitrary), `keyframes`/`animation` (`pulse`, `ring`, `fall`, `star-drop`, `bob`, `wiggle`), `safelist` for dynamic tone classes (`bg-good-50 text-good-700 border-good-300` etc.).
- `styles.css`: import Baloo 2 + Nunito; body `bg-cream-50 text-ink-900 font-sans`.
- Kit APIs: `Button({ variant:'primary'|'secondary'|'outline'|'ghost', size:'md'|'lg', pulse?, children, ...button props })` → min-h 64, Baloo, chunky shadow, `active:translate-y-[2px]`; `Card({ className, children })` white rounded-[28px] shadow-card; `BackButton({ to, label='Quay lại' })` Link 66 px round; `Toggle({ on, onChange, emoji, label })` (button role switch, aria-checked); `Chip({ tone:'teal'|'coral'|'sun'|'neutral', children })`; `ProgressBar({ value 0–100, tone })`; `Toast({ message }|null)` + `useToast()` hook (`show(msg)`, auto-hide 1400 ms, one at a time); `SpeechBubble({ title, subtitle })`; `StarRow({ value 0–3, size })`; `SceneDots({ count, active })`.
- Foxy: replace emoji with the SVG from `docs/design/foxy-svg-reference.js` converted to JSX (moods: idle, listening→listen eyes closed + small mouth, happy, cheer (+sparkles), surprised→wow). Keep `data-testid="foxy"`, `data-mood`, `size`, `say` (bubble uses SpeechBubble). Update Foxy tests to assert an `<svg>` is rendered and `data-mood` is set.
- Tests: each kit component renders and forwards handlers; Toggle aria-checked; Toast disappears after 1.4 s (fake timers); Button variants apply the expected background class.
- Commit `feat(ui): design tokens, Foxy SVG mascot and chunky UI kit`.

### Task 2: Home island map + Daily Mission + Mission Complete
**Files:** Modify `client/src/screens/Home.tsx` (+test), `client/src/components/MissionCard.tsx`, `StreakWeek.tsx` (+tests); Create `client/src/screens/DailyMission.tsx`, `MissionComplete.tsx` (+tests); Modify `client/src/App.tsx`.
- Home per spec §1: landscape map with absolutely positioned islands inside a `relative` container that scales with `aspect-[1194/834]` max-width, portrait (`md:` breakpoint below 900 px width → stacked grid). Islands: Link + 118–132 px circle (`bg-teal-500 shadow-[0_8px_0_#1FA396,0_0_0_8px_#D3F1EC]` etc. per island color), name Baloo 22, StarRow from `getStars` aggregated per module (stories: sum of `story:*` capped to 3 for display → use max; levels: max of their cards; words: `unlockedCount()`-based 0–3; sentences: max). Mission card bottom-left: uses `missionStatus`, ProgressBar, CTA Link to `/mission` ("Bắt đầu ▸") or "Hoàn thành rồi! 🎉 Chơi lại?" when done. Week pill = restyled `StreakWeek` (keep its `dots`/`streak` props and test expectations: 7 dots, today marked, "🔥 N ngày"). Keep the limit banner and the parent link. Remove the in-Home confetti: when `status.done && !celebratedToday` → `navigate('/mission/done')` once (set `speakup.celebrated`).
- DailyMission per spec §2 (cards with ≈ minutes, current step ring `border-4 border-teal-500`, done ✓, Foxy cheer, CTA to first incomplete: `/stories`, `/level/sound-zoo`, `/words`).
- MissionComplete per spec §3 (`Confetti`, Foxy cheer, "+N ⭐" = stars gained today computed as `getActivity()` events today with score → count of 3★-equivalents? Simpler and honest: show `streak()` and today's mission "3/3"; label "+{todayEvents.length} hoạt động" is ugly — use `+N ⭐` where N = number of today's `speak|word|sentence` events with score ≥ 60; document in a comment).
- Tests: Home renders 5 islands (links), mission CTA text by status, navigates to `/mission/done` when done & not celebrated (MemoryRouter + Routes with a stub element), no navigation second time; DailyMission highlights the first incomplete step and CTA href; MissionComplete shows confetti + streak text.
- Commit `feat(ui): island-map home, daily mission and mission complete screens`.

### Task 3: Listening Player + Quiz restyle
**Files:** Modify `client/src/screens/StoryPlayer.tsx`, `StoryQuiz.tsx`, `client/src/components/Karaoke.tsx`, `PlayerControls.tsx`, `SceneArt.tsx` (+ existing tests).
- Per spec §4–5. Karaoke: Baloo, `text-[32px]`, active `text-[44px] text-coral-text`, read `text-[#CDBFA9]`, future ink-900; keep `min-h-[64px] min-w-[64px]` and the aria/test contract (update class assertions). PlayerControls: speed pill chips, 104 px teal play, Toggle components (aria-labels unchanged), SceneDots; continue button prop `onContinue` + `ended` (the StoryPlayer passes it). Quiz: Foxy + bubble, option cards 250×270, badges, banner copy per spec; keep aria-labels (option label) and test ids.
- Commit `feat(ui): listening player and quiz restyle`.

### Task 4: Speak Lab card (3 states) + level select
**Files:** Modify `client/src/screens/PracticeCard.tsx`, `LevelSelect.tsx`, `client/src/components/MicButton.tsx`, `Stars.tsx`, `ScoredWords.tsx`, `HintCard.tsx` (+ tests); Create `client/src/components/ScoreBars.tsx`.
- Per spec §6–7. MicButton: 150 px coral with halo ring (`shadow-[0_10px_0_#E05A3A,0_0_0_12px_#FFE3D7]`), recording → ring animation layers + pulse; keep aria-labels ("Bấm để nói"/"Dừng"/"Đang chấm…") and disabled logic. Countdown: PracticeCard shows remaining seconds during recording (derive from `autoStopMs` via a 1 s interval started on recording; cleared on stop). Stars: `star-drop` animation with stagger, keep `data-testid` star-filled/empty. ScoredWords: chips with ✓/～/✗ and good/ok/fix tone classes (update test class assertions to `text-good-700` etc. — keep aria-labels "tốt/tạm được/cần sửa"). HintCard: 👅 card. ScoreBars: 4 bars from `PronunciationResult` (accuracy, fluency, completeness, prosody ?? accuracy). Level select: stair layout with 5 entries, last 3 locked (no Link), Foxy on the first non-3★ level.
- Commit `feat(ui): speak lab card states and level stairs`.

### Task 5: Words, Sentence Builder, Retell, lists
**Files:** Modify `client/src/screens/WordTopics.tsx`, `WordList.tsx`, `WordCard.tsx`, `SentenceList.tsx`, `SentenceBuilder.tsx`, `StoryList.tsx`, `StoryRetell.tsx` (+ tests).
- Per spec §8–9, §11. WordCard flip card 3D (`[transform-style:preserve-3d]`, `rotate-y-180`) with MẶT TRƯỚC/MẶT SAU labels, "🎤 Nói để mở khoá" label under the mic, 🔓 badge; Sentence tiles tone by thirds (sky/peach/sun) with role legend; lists as card grids with StarRow.
- Commit `feat(ui): words, sentence builder, retell and list screens restyle`.

### Task 6: Parent dashboard restyle + docs
**Files:** Modify `client/src/screens/ParentGate.tsx`, `ParentDashboard.tsx` (+tests), `README.md`, spec status.
- Per spec §10: header + summary line (this week's minutes from `minutesPerDay(7)`, average of `averageScoreByKind` non-null), "Khoá lại" button (clears `speakup.parent`, shows gate), chart target line at `getLimitMinutes()`, limit chips 15/20/30 + the number input, restyled sections. Keep all existing test contracts (minute-bar testids, labels).
- README: "Phase 4 — UI" section (what changed, tokens, new routes, design reference), iPad rows (landscape/portrait Home map, mission → done flow, speak card countdown). Spec status line.
- Commit `feat(ui): parent dashboard restyle; docs`.

## Self-Review
Spec coverage: tokens/kit/Foxy T1; Home/Mission/Done T2; player/quiz T3; speak card/levels T4; words/sentences/retell/lists T5; parent + docs T6. Test contracts preserved by rule; new routes added in T2. No behaviour changes besides the celebration handoff (spec §3).
