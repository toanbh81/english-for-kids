# Phase 10 — Phone layout

**Implemented 2026-08-26 on branch `phase10-mobile-layout` (tasks 1–7).** Accepted deviations from
this spec and the design, recorded in the SDD ledger
(`.superpowers/sdd/2026-08-26-phase10-mobile-layout/progress.md`) and in the README's Phase 10
section: the mic stays 150/190 px on a phone, not the design's 124 (`MicButton` is off-limits, brief
§15 risk 4); `Button size="lg"` keeps its 34 px landscape radius on a phone (no phone size exists on
the shared primitive yet); the topic hub's bottom-pinned "Học tiếp ▸" CTA (design §12 M8) was not
built; the parent dashboard also keeps "Điểm trung bình", the custom-minutes input, the chart's
dashed target line and "Áp dụng từ bài học ngày mai" — none of the design's other "bỏ trên phone"
items were asked for by name, so only "Bản ghi gần đây" (decision 2) was deliberately kept and the
rest simply weren't removed; the story quiz answers are emoji, not the design's `art/` photographs
(export is a separate task, brief Q14); and several open questions the brief left for "Design" or
"Product" (Q3 streak tap-detail panel, Q9's flip-card chip label debate, Q11's karaoke tap-target
question, Q17's 7-vs-14-day parent chart) were resolved pragmatically by whichever task touched that
screen, per that task's own report.

**Tap targets (binding rule 5), settled in the final fix wave.** The first pass had shipped three
back arrows under the floor — 56×56 on `LevelStairs` and `TopicHub`, 48×48 on `StoryPlayer` — taken
from the design's own numbers. They are 64×64 on a phone now, at every one of those three sites, and
nothing measured broke: `/levels` and `/story/:id` still fit 844 and 667 exactly, `/topic/:id` still
fits 844 and its 375×667 scroll grew from 34 px to 42 px with nothing covered at `scrollTop` 0. So
**the child's screens hold the 64 px floor everywhere.** The one accepted exception is the parent
dashboard, whose controls run 44–48 px tall (measured, and quantified in README.md's phone
checklist) because the design calls that screen an adult interface outright — decision 2's
disclosure summary row is still held to 64.

**The mission chip's corner (final fix wave, C1).** Below the tablet breakpoint the floating
"🌞 Nhiệm vụ" chip becomes a 64×64 badge in the top-right gutter every practice header reserves,
because at its old bottom-right anchor it covered 51–94% of the phone CTA this phase had just
pulled above the fold. It covers no control at any phone width, but it does sit on three
read-outs: the story player's "Cảnh n/m", the quiz's "Câu n/m", and — whenever the simple engine
is running — the "chế độ đơn giản" engine badge whose gutter it occupies (53–86% covered). All
three are plain text, and all three are readable again from the tablet breakpoint up.

The app was built for iPad landscape and is unusable on a phone in practice: nothing overflows sideways, but every screen is 1.2–2.6 viewports tall and the primary action falls below the fold (Home's "Bắt đầu" sits at y≈1221 on a 844 px screen). Claude Design delivered `Speak Up Mobile.dc.html` (14 artboards at 390×844) on 2026-08-25.

**The numbers are in the handoff brief, not here:** `docs/design/2026-08-25-mobile-handoff-brief.md` is the authority for every measurement, per-frame structure and per-file delta (§1 frame rules, §2–§12 per screen, §13 breakpoints, §15 iPad risks, §16 new components). This spec records only the decisions the design deliberately left open, and the rules that bind the whole phase.

## Decisions (made by the user 2026-08-25)

1. **Home on phone = M1b** — the island *map* is dropped below the tablet breakpoint. The mission card moves near the top of the screen and the eight topics become a 2-column card grid. The curved map, its trail and its slot positions stay exactly as they are from the iPad breakpoint up. Any copy that says "Về bản đồ" on a phone must read "Về trang chủ 🏠" instead (MissionComplete, DailyMission, and any back-label that names the map); on tablet/iPad the wording is unchanged.
2. **Parent dashboard keeps "Bản ghi gần đây"** — the design drops it on phone; we do not. Removing it would remove a working feature (the last 20 recordings), not just reflow a layout. On phone it may collapse into a disclosure (`<details>`-style, closed by default, ≥64 px summary row), but it must stay reachable.
3. **Meaning-guess step gains an explicit "Tiếp theo →"** — per the design: a correct guess praises ("Đoán đúng rồi! 🎉") and then waits for the child to tap on to the speaking step, instead of revealing the card and mic automatically. This applies at every breakpoint, so the flow is the same on iPad.

## Binding rules

- **The iPad layout must not regress.** Every phone rule is a default-breakpoint (unprefixed) style; the existing iPad behaviour keeps its prefix. Brief §15 lists the ten things that break 1194×834 if touched naively — `MicButton`'s 150/190, `Button`'s size map, `ScoreBars`' row, `Home`'s `SLOTS`/`TRAIL`, and the rest. Treat that list as binding.
- **Breakpoints** per brief §13: `<640` phone (unprefixed) · `768` tablet portrait (`md:`) · `1194` iPad landscape. Add a `ipad: '1194px'` screen to `tailwind.config.ts` and move the iPad-landscape layouts from `lg:` (1024) to it, so a 1024–1193 tablet gets the portrait layout rather than a squeezed map. Where a screen currently uses `sm:` to mean "tablet", it becomes `md:`.
- **Safe area is new work**: `viewport-fit=cover` is already in `index.html`, but nothing in `client/src/` reads `env(safe-area-inset-*)`. Screens gain top/bottom safe-area padding on phone; the design's frame padding (56 top / 44 bottom) already includes it — implement as `env()` plus the design's breathing room, not as fixed 56/44.
- **Every screen's primary action is reachable without scrolling at 390×844**, and at 375×667 either fits or is pinned to the bottom. This is the phase's acceptance test, measured with DOM geometry, not asserted.
- Tap targets ≥ 64 px; mic ≥ 120 px (the phone mic is 124 per the design — still above the floor); no horizontal scroll at any width from 320 px up.
- Vietnamese child copy; existing tokens only — the design confirms colours, chunky shadows, radii, Foxy, chips and stars do **not** change across breakpoints.
- Tests/lint/typecheck/build green, 0 act() warnings; secret hooks unconditional.

## Scope

Screens covered, with their design frames: Home (M1b), Daily Mission (M2), the shared speak frame (M3/M3b — governs all five lesson types), sound drill (M4), flashcard (M5) and meaning-guess (M5b), story player (M6) and quiz (M6b), Speak Lab stairs (M7), topic hub (M8), mission complete (M8b), parent dashboard (M8c).

Out of scope: phone landscape; any content change; the story artwork now sitting in the design project's `art/` folder (separate task — the images must be exported and wired with `scripts/link-story-images.mjs`).
