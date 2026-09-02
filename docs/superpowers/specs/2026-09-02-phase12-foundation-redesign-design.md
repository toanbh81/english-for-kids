# Phase 12 — Nền tảng redesign (khung trang, component sheet, trạng thái)

**Implemented 2026-09-03 on branch `phase12-foundation` (tasks 1–16).** Accepted deviations from the
plan text, all recorded as `Ruling:` lines in `progress.md`: `ResultCardProps.canReplay` stays
optional rather than required; dialogs take async `onConfirm`/`onSubmit` callbacks instead of the
plan's sketched `setBusy` API; `Notice` gained an `adult?` prop for the ≥44 px adult tap floor instead
of always using the child hit band; a story's `NotFound` keeps routing to `/mission` when reached
mid-lesson rather than a flat `/stories`; `WeekDots.minutes` is a day-keyed map built from the real
`minutesPerDay()` instead of an index-keyed one; the Parent Dashboard's "🔐 Khoá lại" control is
icon-only below `md` instead of carrying a visible label at every width; on a phone, Home's header
shows a single greeting line instead of the full Foxy + speech-bubble chrome, which moves to the first
body row (the header cell has no room for it at 390 px) — accepted until Phase 13 redraws Home;
LevelSelect's "Xem các bậc" stairs pill moved into the body's first row (`self-end`) at every width
instead of the header, so the header keeps its default `LessonChip` slot; loading skeletons *are*
the row/card while they're up, not a skeleton nested inside an already-styled frame; `createScorer`'s
`fallbackReason` implements two of this spec's four planned values (`'offline' | 'token'` — `timeout`
folds into `token`, `unsupported` became its own `SpeakError` kind instead of a fallback reason); and
the "+N thông báo" `NoticeStack` overflow line, listed below under "Không làm (Phase 13–15)", shipped
in this phase instead. The before/after screenshots and the checklist rows this phase adds are in
`README.md`'s "Phase 12 — Nền tảng redesign" section.

Phase đầu tiên của đợt redesign toàn bộ giao diện (2026-09). Nó **không vẽ lại màn nào**; nó dựng bộ khung và component mà vòng 2–4 (Phase 13–15) sẽ lắp vào từng màn, và **chuyển mọi màn hiện có sang khung đó** để LessonChip, Back, footer, toast và các trạng thái lỗi/rỗng/tải cư xử giống nhau ở 33 màn.

**Số đo nằm trong brief, không ở đây:** `docs/design/2026-09-02-round1-foundation-brief.md` là nguồn cho mọi kích thước, màu, copy (§1 khung trang, §2 component sheet, §3 Q3/Q4/Q6, §5 rủi ro iPad, §6 việc mới). Bối cảnh và trạng thái từng màn: `docs/design/2026-09-02-screen-inventory-for-redesign.md`. Ảnh app trước khi làm: `docs/design/current/`. Spec này chỉ ghi các quyết định đã chốt và luật ràng buộc.

## Quyết định (người dùng duyệt 2026-09-02: "làm theo đề xuất" cho R1–R20 của brief §4)

1. **Bóng nút = `0 5px 0`** (brief R1). Token `chunky-coral/teal/sun/line` đổi từ 6px xuống 5px. Card giữ `shadow-card 0 8px 0` và `shadow-card-sm 0 5px 0`.
2. **Bo góc nút đổi theo design** (R2): phone 18 · md 20 · lg 24 · adult 12. Đây là thay đổi cố ý trên cả iPad, không còn là "không được đụng" như Phase 10. Card/panel giữ radius token (28/34).
3. **Chip từ (`WordChip`) 40px và không tương tác** (R3). `ScoredWords` mất `onWordTap`; PracticeCard bỏ tính năng chạm chip để phát mẫu (đã có nút "Nghe mẫu").
4. **Sao dùng `#FFB020`** (R4): thêm token `star`; `sun-400 #FFC533` giữ cho pill/chip/chấm tuần.
5. **Scale bo góc mới** (R5): thêm `rounded-r10 … r28` vào tailwind; `xl2/xl3/xl4` giữ cho tới khi màn cuối được chuyển (Phase 15) rồi xoá.
6. **Breakpoint 3 frame** (R6): unprefixed = phone (<768) · `md:` (≥768) = **iPad dọc** (token cỡ iPad, xếp dọc) · `ipad:` (≥1024 ngang ≥692 cao, variant hiện có) = iPad ngang 2 cột. Tablet 768–833 nhận layout iPad dọc. Không thêm breakpoint mới.
7. **Footer là sibling** trong `PageShell` (R7): xoá 3 cách ghim đáy hiện có (WordCard sticky ×2, DailyMission sticky + `-mx`, SentenceBuilder `mt-auto`).
8. **LessonChip sống trong `PageHeader`** (R8): rời `App.tsx`; slot phải của header; logic hiện/ẩn giữ nguyên (`missionNav`); gutter `min-w-[66px]` ở 9 màn bị xoá. Trong lúc chuyển dần, chip global vẫn render cho màn **chưa** dùng `PageHeader` (nhận diện qua context), để không màn nào mất chip giữa chừng.
9. **Hết giờ khoá mic trên màn luyện** (R9): `useSpeakingAttempt` đọc `minutesToday ≥ getLimitMinutes()` → `micState='locked'`, lỗi 🌙, CTA đổi thành "Về trang chủ". Home vẫn giữ banner.
10. **Lộ việc rớt xuống chế độ đơn giản** (R10): `createScorer` trả thêm `fallbackReason` (`offline | token | timeout | unsupported`); hook phát lỗi 📡 **một lần mỗi phiên** (sessionStorage), nút "Tiếp tục" đóng dải.
11. **"Mở cài đặt" / "Mở Chrome"** (R11) mở một `Notice` info dạng hướng dẫn 3 bước bằng chữ; sheet có ảnh là việc của vòng 2.
12. **Scorer chờ quá 3s** (R12) → lỗi 👂 với dòng phụ "máy chấm chưa sẵn".
13. **Tên hồ sơ ≤ 40 ký tự, hiển thị rút gọn 2 từ cuối** (R13): clamp ở `addProfile/renameProfile`; `shortName()` dùng ở ProfilePicker, Home, Dashboard hàng hồ sơ; tên đầy đủ trong dialog và `title`.
14. **`longestStreak(events)`** (R14) trong `activity.ts`, cho panel streak.
15. **Toast 2400ms, tối đa 2 dòng, max-width 360, dưới safe-top** (R15).
16. **`SyncPill` in cả `syncing`, `lastError`, `lastSyncedAt`** (R16); "Thử lại" gọi flush.
17. **HintCard chỉ khi `stars < 2`** (R17), thống nhất 6 màn.
18. **ScoreBars luôn lưới 2×2** (R18); bỏ nhánh md hàng ngang.
19. **Outline = viền teal `#C4E8E1`** (R19); "↻ Thử lại" là outline.
20. **Not-found dùng cùng component ở mọi frame** (R20), size phone/md theo Button.

## Luật ràng buộc

- **Số đo lấy nguyên văn từ brief §1–§2.** Chỗ brief ghi "design không nói" thì đã có quyết định ở trên; ngoài đó không tự bịa số.
- **Ba frame kiểm chứng**: 390×844 (và 375×667 cho CTA), 834×1194, 1194×834. Chụp lại bằng `docs/design/current/shoot.mjs` trước và sau mỗi task; ảnh sau lưu `docs/design/current-phase12/`.
- **Chấp nhận thay đổi trên iPad** khi và chỉ khi brief §2 nói khác code hiện tại (bóng, bo góc nút, chip 40, mic prefix). Thứ brief không nhắc thì iPad giữ nguyên byte.
- **Vùng chạm**: trẻ ≥64 (nhìn có thể 56 với lề trong suốt); người lớn 44; link chữ 44. Không cuộn ngang từ 320px.
- **Không phần tử `fixed`/`absolute` trong Body** trừ Confetti và scrim của Dialog/Sheet.
- **Copy tiếng Việt cho bé** như brief; copy người lớn trong Dialog/Notice như brief §2.7–2.8.
- **Test giữ `data-testid` hiện có** (`streak-dot`, `data-today`, `group-*`, `sync-status`, `remote-*`, `profile-*`, `reset-notice`). Component gộp phải giữ testid của cả hai bản cũ.
- Tests/lint/typecheck/build xanh, 0 act() warning; hook secret không bỏ qua.

## Phạm vi

**Làm trong Phase 12:**
- Token: `star`, radius scale, `chunky-*` 5px, 5 màu mới (`#F1E7D4 #FF9A8A #FFE9A8 #C4E8E1 #FFF1E6`).
- Primitive: `Button` (4 size × 4 variant, disabled, pulse) · `LinkText` · `BackButton` (phone/ipad/adult/onArt) · `Stars` (gộp `Stars` + `StarRow`) · `Toast`.
- Khung: `PageShell` / `PageHeader` / `PageBody` / `PageFooter` cho 3 frame; `LessonChip` + `EngineBadge` trong header; **chuyển 33 màn sang khung** (không đổi nội dung body của màn).
- Luyện nói: `MicButton` 4 trạng thái + `LevelBars` · `Countdown` · `ResultCard` (①–⑥) + `WordChip` (4 tone) · `SpeakError` 5 loại · logic R9/R10/R12 trong `useSpeakingAttempt`/`createScorer`. Dùng ở 9 màn: PracticeCard, SoundPractice, PairPractice, StarPractice, VoicePractice, StoryRetell, WordCard, SentenceBuilder (+ SoundChip `unknown` ở SoundPractice).
- Trạng thái: `NotFound` (8 màn) · `EmptyState` (5 chỗ) · `Notice` 6 loại + `NoticeStack` (Home 3 banner, Dashboard 5 notice, CloudStart dải info/lỗi) · `Dialog` + `useDialog` thay 4 `window.confirm/prompt` · `Skeleton` (thẻ Tài khoản, hàng Tiến độ từ xa, scorer) · `SyncPill` 7 · `StreakPanel` + `WeekDots` (Home, MissionComplete).

**Không làm (Phase 13–15):** bố cục riêng từng màn theo vòng 2–4 (2 cột "dạy/làm" cho từng biến thể, khung danh sách, Home iPad dọc, Dashboard lưới, CloudStart); "+1 thông báo"; sheet hướng dẫn có ảnh; ảnh `art/`; nội dung bài học.

## Kiến trúc

- `components/ui/page/` — `PageShell` (cột flex cao viewport, `PAGE_SHELL` safe-area giữ nguyên, gutter theo frame) · `PageHeader` (`back`, `center`, `right?`; `right` mặc định = `LessonChip`, rộng bằng Back) · `PageBody` (`flex:1`, vùng cuộn duy nhất; `split` prop cho iPad ngang 2 cột dạy/làm 440 và iPad dọc 2 tầng làm 300) · `PageFooter` (1–2 nút; fade 40; iPad ngang: render trong cột "làm").
- `components/speak/` — `MicButton`, `LevelBars`, `Countdown`, `ResultCard`, `WordChip`, `SpeakError`. `ResultCard` nhận `{stars, praise, score, sub, prosody, words, bars, hint, canReplay, onReplay, onSample, onRetry, primary}`; màn chỉ lắp dữ liệu.
- `components/ui/` — `Notice`, `NoticeStack`, `Dialog` + `useDialog()` (Promise-based `confirm/destructive/prompt`), `EmptyState`, `NotFound`, `Skeleton`, `SyncPill`, `StreakPanel`, `WeekDots`, `Stars`, `LinkText`.
- `LessonChip` đọc `PageHeaderContext`: có header → render trong slot; không → fallback global (tạm, xoá ở Phase 15).
- Dữ liệu: `activity.longestStreak`, `profileState.shortName` + clamp 40, `createScorer` trả `fallbackReason`, `useSpeakingAttempt` thêm `locked` + timer 3s + lỗi có `kind` (6 loại) thay chuỗi.

## Kiểm chứng

- Mỗi task: `pnpm test`, `pnpm lint`, `pnpm typecheck`; với task đụng giao diện: chụp 3 frame bằng `shoot.mjs` (bộ lọc `SHOTS=`), so với `docs/design/current/`.
- Cuối phase: `sheet.mjs` tạo bộ sheet mới; README phase ghi bảng "trước → sau" cho 6 màn từng tràn (B5 959, B6 1140, P2 1268/1733, A6 iPad 1189, C6, C8) và khẳng định không màn nào mất LessonChip.
- Kiểm chứng thủ công trên iPad thật: bổ sung hàng vào checklist README (mic 124→150 trên iPhone, sheet streak, dialog xoá tiến trình).
