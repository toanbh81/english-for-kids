# Phase 14 — Danh sách và điều hướng (vòng 3): khung danh sách + 17 màn trên khung Phase 12/13

Phase 12 dựng khung trang (`PageShell/PageHeader/PageBody/PageFooter`, `Button`, `Stars`, `Notice/NoticeStack`, `EmptyState`, `NotFound`, `Skeleton`, `LessonChip`, `BackButton`) và Phase 13 dựng khung luyện nói (`ChipPair`, `SpeakPrompt`, `PageBody.split`, `PageHeader.dimmed`, variant `short:`, luật `ipad:` thắng `md:`). Phase 14 **không đụng 9 màn luyện nói**: nó dựng **khung danh sách** (một lưới, hai cỡ ô, hai cỡ hàng, H2 dính) thay 7 lưới tự viết, đổi header danh sách sang **một hàng căn trái có dòng phụ**, và sửa **điều hướng** (banner Home, copy "Về bản đồ", CTA ghim đáy, header StoryPlayer lên trên tranh).

**Số đo nằm trong brief, không ở đây:** `docs/design/2026-09-03-round3-lists-nav-brief.md` (§0 bốn quyết định gốc, §1 khung danh sách theo 3 frame, §2 mười ba màn + dữ liệu xấu nhất, §3 Q11–Q14/Q19, §4 R1–R32, §5 rủi ro, §6 việc mới). Spec này chỉ ghi quyết định đã chốt và luật ràng buộc.

## Quyết định (người dùng duyệt 2026-09-03: "làm theo đề xuất" cho R1–R32)

**Khung danh sách (component mới)**

1. **`ListGrid`** `size='sm'|'lg'` (R1, R4): `sm` = `grid-cols-3 md:grid-cols-5 ipad:grid-cols-6` gap 8/12; `lg` = `grid-cols-2 md:grid-cols-3 ipad:grid-cols-4` gap 8/12. **Không `lg:` ở bất kỳ đâu** — 1024 bắt cả iPad dọc xoay lẫn desktop; hàng lẻ căn trái, không kéo rộng.
2. **`Tile`** (R1, R5, R10): `sm` 110/136 cao (emoji 40/56, chữ 15/19, IPA 36 `#C08457`), `lg` 128/160 (chữ 17/20, 2 dòng ellipsis); nhận `chip?`, `stars?`, `variant='locked'` (nền `sand`, 🔒, chip "Chưa mở khoá" — dựng sẵn, dữ liệu chưa tới được) và `variant='accent'` (nền `sun-50` cho ô "Ôn tập" của C5). Xoá `CARD_LINK` khi cả 7 call-site đã chuyển.
3. **`ListRow`** `h=64|96` (R1, R8, R9): 64 = radius 16, câu 16px `truncate`, sao 13px (C8); 96 = radius 20, đĩa 64 + tên 19px + phụ 13px + sao + chevron (C1).
4. **`StickyGroup`** (R6): H2 dính `sticky top-0 z-10 bg-cream-50`, 15/17px + đuôi đếm 12/13px; C8 không có đuôi.
5. **`PageHeader` nhận `title`/`sub`/`align`/`onBand`** (R2, R3, R19): `align='start'` cho cột giữa `flex-1 min-w-0` căn trái, H1 22 `md:28` + phụ 13/15; **mặc định giữ nguyên hành vi căn giữa hôm nay** để 9 màn Phase 13 (chip, `ChipPair`, "● Đang ghi") không đổi một pixel. `onBand` = header trong suốt trên dải màu, Back trắng .92 glyph teal — **ngoại lệ có tên** với luật Phase 12 "header luôn trên cream", chỉ TopicHub dùng; `dimmed`/`engine`/`right` giữ nguyên đường đi.
6. **`PageBody` nhận `fade?` và `gap?`** (R11, R30): `fade` = pseudo-element 50px cùng công thức fade 40 của `PageFooter`, bật cho màn danh sách **không có footer**; `gap` nhận 8|10|12, **mặc định 0** để 33 màn cũ không đổi — màn danh sách nhận gap qua `ListGrid`/`StickyGroup` thay vì `mt-*` rải rác.
7. **Bốn mốc nhỏ** (R15, R16, R10, R31): `Button size='sm'` = 48 radius 16 (CTA của MissionCard, không đẻ `CTA_PHONE` thứ tư) · `EmptyState size='hero'` (Foxy 120, tiêu đề 22, phụ 14) · `Chip tone='coralSolid'` (`#FF7A59` nền đặc, chữ trắng) · `Stars` thêm mốc **13** và **14** vào `SIZE`, không chấp nhận lệch 1px — 5 màn cùng đọc bảng này.
8. **Ô phải header là quy ước, không phải prop mới** (R28): `LessonChip` mặc định (tự ẩn khi không phải bước nhiệm vụ, ô 56/48 vẫn giữ chỗ); màn cần thứ khác thì truyền `right`. **Không truyền `right={null}`** ở C1/C8/A10–A14.

**Mười màn danh sách**

9. **C6 WordList** `/words/:topic` · `/words/review` là **màn tham chiếu 3 frame**: ô nhỏ, chip 🔓/🔒 (không sao), phụ đề "64 từ · chạm để ôn". **Review nhóm theo chủ đề** (R6): `dueWords()` gom qua `findTopic` theo thứ tự `TOPICS` trước khi vẽ → 8 nhóm H2 dính thay danh sách phẳng. Empty (`EmptyState`) **chỉ có ở review**.
10. **C1 StoryList** `/stories`: **hàng 96** ×3 phone + Foxy 96×93 `bob` + một dòng chữ lấp chỗ trống (không bong bóng) — "không kéo ô cho to"; iPad = ô nhỏ 3 cột **căn giữa**. Ô phải trống (mặc định).
11. **C8 SentenceList** `/sentences` (+`?topic=`): **hàng 64** `truncate`, H2 dính không đuôi; iPad **2 cột hàng** (`md:grid-cols-2`), H2 vẫn dính. Lọc hợp lệ = 4 hàng không H2, phụ đề "4 câu · {tên chủ đề}"; `?topic=` lạ = không lọc.
12. **C5 WordTopics** `/words`: ô "Ôn tập" `variant='accent'` + chip `coralSolid` "12 từ hôm nay" (0 từ → chip "Chưa có từ ôn" tone neutral, ô vẫn bấm được); ô chủ đề chip "3/8 mở" 11px thay dòng chữ thường; phụ đề "{n} chủ đề đã mở · chạm để học". Chủ đề khoá = **vắng mặt**, không vẽ ô khoá.
13. **A10–A14 giữ 5 route và 5 file mỏng** (R7), thân chung `ListGrid` + `Tile`: A10 nhỏ/emoji+sao · A11 nhỏ/IPA 36 + từ ví dụ · A12 lớn/cặp + chip `ɪ / iː` · A13 lớn/câu EN 2 dòng + nghĩa · A14 lớn/emoji mood + chip mood + câu đầu. Back cả 5 trỏ `/levels` "Các bậc"; dòng phụ giữa thân (R3) lên `sub`; **bỏ pill "🗣️ Xem các bậc"** của A10 (Back đã thay). Không gộp thành một màn cấu hình bằng bảng.
14. **B2 SoundWordList** chỉ hạ cỡ về chuẩn ô nhỏ (110, chữ 15/19); **header giữa giữ `Chip` "Âm n/9" của Phase 13**, không đổi sang H1+phụ — đây là màn có tầng âm, không phải danh sách thuần.
15. **Suy iPad cho màn không có artboard** (R32): iPad dọc = phone với số cột 5/3 và cỡ ×1.25; iPad ngang = iPad dọc với 6/4 cột trong `max-width:1080`. `Skeleton` giữ nguyên Phase 12 ở mọi màn danh sách.

**Home và banner**

16. **Home iPad dọc** (R13): lưới đảo `md:grid-cols-3 md:auto-rows-fr` ô 150; **ô thứ 9 trong lưới = "🗣️ Các bậc luyện nói"** (8 đảo + Speak Lab = 3 hàng khít), vẫn `ipad:absolute` ở bản đồ; cụm streak + ⭐ + nút phụ huynh chuyển vào `PageHeader right` từ `md:` lên. Đảo **phone hạ `h-32` → 110** để lưới thấy 2 hàng dù có 2 banner, hàng chân Speak Lab + phụ huynh giữ nguyên. **iPad ngang = bản đồ cũ, không đổi vòng này.**
17. **Banner Home** (R12): thứ tự ưu tiên và `max=2` của `NoticeStack` **giữ nguyên** (đã khớp design); dòng gộp thành `<button min-h-[44px]>` nêu **tên banner bị ẩn đầu tiên** — "+1 thông báo (Thêm vào Màn hình chính) ▸" — mở `Dialog` (Phase 12) liệt kê phần còn lại. Banner hết giờ không tắt được; 2 info giữ ✕ 40 (hit 44).

**Nhiệm vụ, đảo, bậc**

18. **MissionCard** (R15): **300×128 cố định**, CTA `size='sm'` 48 `nowrap`; thêm trạng thái `empty` (total 0) vào `MissionProgress`; bỏ dòng "Hoàn thành! 🎉" riêng, nhãn xong = "Chơi lại 🎉" teal, rỗng = "Luyện tự do →" outline + đếm "—".
19. **DailyMission** (R16, R17): rỗng = `EmptyState size='hero'` (bỏ `cta`) + `PageFooter` 2 nút 56 "Luyện tự do →" primary và "Về trang chủ 🏠" outline. iPad = 2 chip lên `right` của header, thẻ nhóm `ipad:h-[240px]`, phụ đổi sang "{done}/{total} · …", chip "≈ 5'", CTA `Button lg` + `ipad:w-[480px]` cạnh Foxy 80.
20. **MissionComplete 0 sao** (R18): nhánh `starsToday === 0` → Foxy **happy**, **không confetti**, thẻ trắng "Mai làm lại để lấy ⭐ nhé" thay pill "+0 ⭐", H1 2 dòng "Xong nhiệm vụ rồi! 🦊 / Con đã rất cố gắng."; nhánh `streak === 0` → "🔥 Bắt đầu chuỗi mới từ hôm nay!".
21. **TopicHub** (R19, R20): dải teal 236 thành **nền của header + khối tên** (`PageHeader onBand`), header giữa = chip "⭐ n/m sao đảo" (m = 3 × số mục có sao), tên 28px trắng trong thân, thêm `PageFooter` CTA ghim 56 "Học tiếp: {mục dở đầu tiên} ▸" (Từ mới → Ghép câu → Truyện; đủ 3★ hết → "Luyện lại: …"). Hàng: đếm vào **trong tiêu đề** ("Từ mới **3/8**"), hàng câu hiện **sao** thay dòng đếm, hàng truyện trống thêm `grayscale(1)` + dòng "Đảo này chưa có truyện — nghe truyện ở {n} đảo khác nhé" với **n tính từ `STORIES`**, không hard-code.
22. **LevelStairs** (R21, R22): bỏ `md:hidden` ở footer (CTA 420×64 **có ở iPad ngang**); thay 5 `ipad:mt-*` ma thuật bằng `style={{left: 10%+i·20%, top: 70%−i·17.5%}}` trong hộp `relative flex-1`, ô 176×176, SVG `1080×600`; **xoá layout `md:` grid** — iPad dọc dùng lại zigzag phone với ô 300×96. Phone: vùng bậc `flex-1 min-h-0 overflow-y-auto` + `justify-between`, cuộn về đáy khi mount (bậc 1 thấy trước), Foxy 58×56, tag 12px, `short:h-[72px]`.
23. **Copy "Về bản đồ"** (R14): `HomeLabel` và `BackButton.mdLabel` đổi mốc từ `md:` sang **`ipad:`** — "Về bản đồ 🏝️" chỉ khi Home thật sự là bản đồ (iPad ngang); phone và iPad dọc đọc "Về trang chủ 🏠" ở cả 6 call-site.

**Truyện**

24. **StoryPlayer** (R23, R25, Q12, Q13): header chuẩn **trên** tranh, cụm giữa = chip "Cảnh n/N" + tên truyện 11px; bỏ pill gợi ý absolute → dòng 13px trên karaoke ở mọi frame; 2 trạng thái audio thành `Notice` 44px (`kind='info'` / `kind='error'` + `action={{label:'Thử lại'}}`) → cần `retry()` trong `useStoryPlayer`. ⏮⏭ **tròn** 64, chip tốc độ **44×40** radius 11, nhãn "🇻🇳 Phụ đề". **Q12: không có nhạc nền → không vẽ**, chỉ xoá dòng chú thích "Q12 chưa chốt". **Q13: giữ CTA đáy** (ghost "Bỏ qua ▸" / primary pulse "Tiếp tục: Quiz 3 câu →" / ghost "Về danh sách truyện").
25. **Karaoke hit 44×44** (R24, Q11) — `min-h-[44px]`, `px-1.5 py-2`, `gap-x-1`, bỏ `min-w-[64px]`. **Ngoại lệ có tên** với luật 64px của trẻ: từ karaoke là mục tiêu phụ (nghe lại 1 từ), floor 64 chỉ áp cho hành động chính (play, mic, CTA, ô đáp án). 9 từ ≈ 52px vừa 2 dòng trong 358.
26. **StoryQuiz thẻ đáp án** (R26, Q14): phone **hàng ngang** `min-h-96` emoji 56 + nhãn 20px; iPad `md:flex-1 md:max-w-[300px] md:aspect-[4/3]` emoji 96. Thêm nhánh `opt.image` (ảnh 16:9 thay emoji) tuy dữ liệu chưa có — **emoji là câu trả lời của Q14**, ảnh chỉ là cửa để sẵn.
27. **StoryQuiz 0/3** (R27): thang sao thành `0|1|2|3`, 0 đúng → 0★ Foxy **idle**, primary "🎧 Nghe lại truyện", nút thứ 3 là `LinkText` `min-h-[44px]` gạch chân (không phải nút 64). **`setStars` không đổi kiểu** — 0 sao đơn giản là **không gọi** (`setStars` chỉ tăng, ghi 0 là no-op); vẫn `logActivity`.

**Còn lại**

28. **`short:` không sinh luật mới cho danh sách** (R29) — ô tự co theo `1fr` (C6 ô 109 vẫn ≥ emoji 40 + 2 dòng). Ba chỗ dùng: A9 `short:h-[72px]`, phụ đề StoryPlayer mặc định **tắt khi `window.innerHeight < 700`** đọc lúc mount, C6 chỉ để kiểm chứng.
29. **Design không nói / design tự mâu thuẫn** (R32, R8): thẻ mở đầu ghi hàng "64/72" nhưng artboard C1 vẽ 96 → **chốt 96 cho truyện, 64 cho câu**, không có 72. Suy iPad theo quyết định 15; `?topic=` lạ, empty của C1/C5 (không thể rỗng) và loading giữ hành vi Phase 12.

## Luật ràng buộc
- Số đo nguyên văn từ brief §1–§2; token/bóng/radius Phase 12 và mọi thứ Phase 13 vừa chốt giữ nguyên — **không hex nào mới**.
- Ba frame kiểm chứng: 390×844, 834×1194, 1194×834 (+375×667 cho C6 và A9); chụp bằng `docs/design/current/shoot.mjs` vào `docs/design/current-phase14/`.
- Dữ liệu xấu nhất phải vừa hoặc cuộn **không tràn `PageBody`**: 64 ô ôn tập (C6) · 32 hàng + 8 H2 (C8) · 3 truyện (C1, bài toán thừa chỗ) · karaoke 9 từ / 40 ký tự 2 dòng trong 358 (C2) · quiz kết quả 0/3 (2 nút 56 + link 44 + Foxy 130 + sao 44 trong 844 và 667) · DailyMission 5 nhóm iPad ngang (5 cột 200 + footer trong 834).
- **Không `lg:` ở bất kỳ màn nào bị đụng.** `ipad:` thắng `md:` (Phase 13) ⇒ mọi `md:` viết cho iPad dọc (R13, R17, R21) phải kiểm **cả hai** frame iPad.
- Giữ `data-testid` (`page-body`, `result-card`, `word-chip`…); không đụng chữ ký `useSpeakingAttempt`, `createScorer`, `missionNav`, `progress/store` (0 sao không lưu — quyết định 27).
- Tests/lint/typecheck/build xanh, 0 act(); hook secret không bỏ qua.

## Phạm vi
**Làm:** 9 component/prop mới (quyết định 1–8) · 10 màn danh sách (9–15) · Home + banner (16–17) · nhiệm vụ/đảo/bậc (18–23) · truyện (24–27) · 6 logic mới (nhóm review, mục dở đầu tiên, thang sao 0–3, `retry()`, phụ đề theo chiều cao, đếm "n đảo khác") · `shoot.mjs` 10 kịch bản mới · ảnh trước/sau.
**Không làm:** khu người lớn (Phase 15) · 9 màn luyện nói (xong ở Phase 13, trừ B2 chỉ hạ cỡ ô) · ảnh `art/` · Home iPad **ngang** (bản đồ cũ) · **tách hook `useCountdown`/`useTeachCollapse`**: chỉ làm nếu một màn bị đụng cần tới — Phase 14 không đụng màn luyện nói nên **vẫn hoãn**, giữ làm gạch đầu dòng follow-up.

## Kiến trúc
- **Mới** `client/src/components/ui/list/`: `ListGrid.tsx`, `Tile.tsx`, `ListRow.tsx`, `StickyGroup.tsx`, `index.ts`. Xoá `components/ui/cardLink.ts`.
- **Sửa khung:** `ui/page/PageHeader.tsx` (`title`/`sub`/`align`/`onBand`), `ui/page/PageBody.tsx` (`fade`, `gap`), `ui/Button.tsx` (`size='sm'`), `ui/EmptyState.tsx` (`size='hero'`), `ui/Chip.tsx` (tone `coralSolid`), `ui/Stars.tsx` (mốc 13, 14), `ui/NoticeStack.tsx` (dòng "+N"), `ui/HomeLabel.tsx` + `ui/BackButton.tsx` (`md:` → `ipad:`).
- **Sửa component:** `components/MissionCard.tsx`, `components/Karaoke.tsx`, `components/PlayerControls.tsx`; `speaking/useStoryPlayer.ts` (`retry()`, phụ đề theo chiều cao).
- **Màn:** `WordList`, `StoryList`, `SentenceList`, `WordTopics`, `LevelSelect`, `SoundLevel`, `PairLevel`, `StarLevel`, `VoiceLevel`, `SoundWordList`, `Home`, `DailyMission`, `MissionComplete`, `TopicHub`, `LevelStairs`, `StoryPlayer`, `StoryQuiz` — giữ hook/dữ liệu, đổi thân sang khung danh sách + props header/footer.
- **`shoot.mjs`** thêm: `words-review` (seed 64 từ đến hạn), `stories`, `sentences-topic`, `mission-empty`, `mission-done-zero`, `topic-no-story` (`/topic/weather`), `quiz-result-zero` (chọn sai rồi đúng 3 lần — không cần fixture), `story-player-no-audio`, `home-3-banners`, `levels` ở `ipadp`.

## Kiểm chứng
- Mỗi task: tests + lint + typecheck; chụp màn liên quan ở 3 frame (+`VIEWPORTS=short` cho C6 và A9); probe `PageBody` phải hạ các mốc `phone/words-animals-full.png`, `phone/words-full.png`, `phone/sentences-full.png`, 5 file `phone/level-*-full.png`, `ipad|ipadp/sentences-full.png`.
- Cuối phase: sheet trước/sau (`current-phase13/shots` → `current-phase14`); README "Phase 14"; checklist iPad 5 hàng: số cột lưới đúng theo từng frame (3/5/6 và 2/3/4) · H2 nhóm dính khi cuộn C6/C8 · nút "+1 thông báo" ở Home mở sheet · header TopicHub nằm **trong** dải teal · header StoryPlayer **trên** tranh, không đè · quiz 0/3 hiện 0★ và không lưu sao.

Trạng thái: chưa triển khai — dòng này sẽ được cập nhật khi Phase 14 xong (nhánh, tasks, sai lệch ghi ở README §Phase 14).
