# Phase 8 — Mission flow & practice polish

Ten user-reported adjustments from the first live session with Phase 7 (2026-08-24), plus the root-caused scoring bugs behind three of them. Reference visual: the Daily Mission frame of the Claude Design prototype (grouped step cards "Nghe 1 truyện / 5 thẻ phát âm / 3 từ mới", ≈minute chips, teal ring on the current step, Foxy + single CTA).

Status: implemented 2026-08-24 → 2026-08-25 on branch `phase8-mission-flow` (tasks 1–6), including two approved deviations from this spec: the "Từ n/3" word-position chip relocates into the header while recording/scoring instead of staying in the word-tile cell, since that cell stops existing at that point (§4); and the finish-label predicate was refined so "Hoàn thành 🎉" only fires when this step is the very last thing outstanding in the whole lesson, with "Về nhiệm vụ →" covering a finished group while another is still open (§3, milestone M1).

## 1. Daily Mission shows groups, not a flat item list

`/mission` renders one card per **group**, derived from today's lesson items by kind, in lesson order:

| kind | title | emoji | chip |
|---|---|---|---|
| listen | "Nghe 1 truyện" | 🎧 | ≈ 4 phút |
| speak | "N thẻ phát âm" | 🗣️ | ≈ N phút |
| word | "M từ mới" | 🧩 | ≈ M phút |
| review | "K bài ôn tập" | 🔁 | ≈ K phút |

- Each card: emoji, title, progress "x/N" (done items in the group), "Bước i" caption; the first group with an undone item gets the teal ring + "Bước i · bắt đầu ở đây!". A fully done group shows "✓ Xong" instead of the chip.
- Each card is a Link to the group's **first undone item** (done group → its first item, for replay). The single CTA "Bắt đầu ▸" / "Tiếp tục ▸" (see §2 wording rule) links to the ringed group's first undone item. All mission-originated navigation carries `state: { mission: true }` (§3).
- Layout mirrors the prototype: cards side by side from `lg` (up to 4 columns), stacked below; sticky CTA + Foxy row as today. Band chip and doneCount/total stay in the header.
- Completion: `/mission` gains the same once-per-day celebration navigate as Home — on mount, if `lessonStatus().done` and not yet celebrated today, mark celebrated and navigate `/mission/done`.

## 2. Home CTA wording

`MissionCard`: `doneCount === 0` → "Bắt đầu ▸"; `0 < doneCount < total` → "Tiếp tục ▸"; done → existing replay wording. Same rule for the Daily Mission CTA label.

## 3. Mission session: numbering, back, next

New module `client/src/progress/missionNav.ts`:

```ts
type MissionPos = { group: LessonItemKind; index: number; total: number; nextRoute: string | null }
function missionPosition(pathname: string, now?: number): MissionPos | null
```

`missionPosition` looks up today's lesson; returns null if the pathname is not an item route. `index`/`total` are 1-based within the item's group; `nextRoute` = the group's next undone item, else the next group's first undone item, else null (lesson done or nothing left).

Practice screens (`SoundPractice`, `PracticeCard`, `PairPractice`, `StarPractice`, `VoicePractice`, `WordCard`, `SentenceBuilder`, `StoryPlayer` excluded — stories keep their own flow) become **mission-aware** when `location.state?.mission === true`:
- Header shows a position chip: "Âm i/N" (SoundPractice), "Thẻ i/N" (PracticeCard/PairPractice/StarPractice/VoicePractice), "Từ mới i/N" (WordCard), "Câu i/N" (SentenceBuilder) — from `missionPosition`.
- BackButton targets `/mission` (label "Nhiệm vụ") instead of the level/word list.
- The screen's next/finish CTA targets `nextRoute` (carrying `state: { mission: true }` forward); when `nextRoute` is null → `/mission` (which then celebrates if done).
Without the state flag, every screen behaves exactly as today (free play from Speak Lab/topic hubs unchanged). The LessonChip stays for free-play entries onto lesson routes.

## 4. SoundPractice layout: two aligned rows

The practice area becomes a two-row grid with shared columns, so the cells line up vertically:
- Row 1 — the sound: cell A = mouth-shape/IPA tile (`/θ/` 72 px + 🔊 Nghe âm lẻ), cell B = the sound's description (`PHONEME_TIPS[ph]`).
- Row 2 — the word: cell A = the word tile (emoji + 🔊 Nghe mẫu), cell B = the word's text (word 56 px + IPA + "Từ n/3" chip).
Grid `grid-cols-[minmax(180px,auto)_1fr]` from `sm`; stacked single column below. Tap targets ≥ 64 px; mic/result area below the grid unchanged.

## 5. Scoring resilience (root cause of "lỗi kết nối Azure")

- `createScorer()`: retry the token fetch once after a 700 ms backoff before falling back to Web Speech (Vercel cold starts fail the first request).
- **Non-sticky fallback**: in `useSpeakingAttempt.startRecording`, if the current scorer is webspeech and `navigator.onLine`, call `createScorer()` again first and use the fresh scorer if it comes back azure. A single failed token fetch must never pin a whole card to Web Speech.
- `SoundPractice` unscored copy no longer blames the connection: webspeech engine → "Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!"; azure result without the target phoneme → "Chưa nghe rõ âm này — thử lại nhé!". The word "Azure" never appears in child-facing copy.

## 6. WordCard flip: hint instead of buttons

- Remove the "MẶT TRƯỚC"/"MẶT SAU" chips and both 🔄 flip buttons.
- The card itself becomes the accessible control: `role="button"`, `tabIndex=0`, `aria-label="Lật thẻ"` (Enter/Space already flip via onCardKey — keep).
- Peek hint: while un-flipped and idle, the card runs a `peek` keyframe (rotateY 0 → −18° → 0 over 0.9 s) every 4 s, starting 2.5 s after mount, stopping permanently after the first flip. Pure CSS animation (Tailwind keyframe), timer-free where possible (`animation-delay` + `animation-iteration-count` driven by a `hasFlipped` class).

## 7. WordCard shows its score

After an attempt, render under the card: `Stars` (from `toFeedback(result).stars`), a score chip "Điểm: NN" (rounded overall; hidden when the engine returned no number), and the existing HintCard on retry. The 🔓 Mở khoá! banner stays.

## 8. Guess praise must not read as scoring

The meaning-guess praise becomes "Đoán đúng rồi! 🎉" and auto-clears after 1.5 s (timer), instead of persisting until the first flip.

## 9. Celebration on finishing the lesson — covered by §1 (mission-mount celebrate) + §3 (final next → `/mission`).

## 10. Back from mission items — covered by §3.

## Rules
Tap ≥ 64 px; mic ≥ 120 px; Vietnamese child copy; UI kit/tokens; outer/inner hook pattern; free-play behavior unchanged wherever `state.mission` is absent; tests/lint/typecheck/build green, no act() warnings; secret hooks unconditional.
