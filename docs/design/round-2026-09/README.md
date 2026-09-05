# Redesign 2026-09 — file kéo về từ Claude Design (DesignSync, 2026-09-02)

Project: `claude.ai/design/p/9c792842-beb0-4158-a5d7-a3ac91730d3c` ("Speak Up", loại project thường). Kéo bằng `DesignSync get_file`; số đo nằm inline trong style của từng file.

| Vòng | File | Artboard | Trạng thái |
|---|---|---|---|
| 1 Nền tảng | `Speak Up Foundation.dc.html` (70 KB) | Khung phone / iPad ngang / iPad dọc + component sheet (Button, MicButton, đếm ngược, badge, LessonChip, ResultCard, 5 lỗi, not-found, 5 empty, 6 notice, dialog, skeleton, sync 7, Stars gộp, BackButton 3 cỡ) + trả lời Q3/Q4/Q6 | ✅ đủ |
| 2 Khung luyện nói | `Speak Up Practice Frame.dc.html` (115 KB, cập nhật 2026-09-03) | B6 phone idle / recording / result · B6 iPad ngang · B6 iPad dọc · **8 biến thể còn lại** (B1 B3 B4 B5 C4 C7 C9 + SoundWordList) idle ở phone + iPad ngang · trả lời Q7–Q10 | ✅ đủ |
| 3 Danh sách & điều hướng | `Speak Up Lists & Nav.dc.html` (85 KB) | C6 review ×3 frame · C1 · C8 · A3 Home iPad dọc + phone 3 banner · A6 rỗng + iPad ngang · A7 0 sao · A8 · A9 phone + iPad · C2 · C3 ×2 | ✅ (khung danh sách chung dùng C6 làm carrier) |
| 4 Khu người lớn | `Speak Up Parent Zone.dc.html` (68 KB, 2026-09-03) | P1 ParentGate phone + iPad ngang · A1 ProfileGate overlay phone · A2 CloudStart 8 stage · P2 Dashboard iPad dọc + phone (10 panel, 3 frame) · dialog thật · Q17/Q18 | ✅ đủ |

`tokens/` — 4 file CSS token của design system trong project (colors, effects, spacing, typography). Project còn có `components/*.jsx|.d.ts|.prompt.md` (Button, Chip, Stars, GameCard, SpeechBubble, Foxy, MicButton) và `guidelines/*.card.html` — chưa kéo, kéo khi viết brief vòng 1.

Bước tiếp: brief vòng 1 đã viết → `../2026-09-02-round1-foundation-brief.md`; spec + plan Phase 12 đã viết và **Phase 12 đã triển khai xong** (2026-09-03, nhánh `phase12-foundation`, tasks 1–16 — xem `docs/superpowers/specs/2026-09-02-phase12-foundation-redesign-design.md` và README.md §"Phase 12 — Nền tảng redesign"). **Phase 13 (vòng 2) cũng đã triển khai xong** (2026-09-03, nhánh `phase13-practice`, tasks 1–12 — xem `docs/superpowers/specs/2026-09-03-phase13-practice-frame-design.md` và README.md §"Phase 13 — Khung luyện nói (vòng 2)"). **Phase 14 (vòng 3) cũng đã triển khai xong** (2026-09-04, nhánh `phase14-lists-nav`, tasks 1–16 — xem `docs/superpowers/specs/2026-09-03-phase14-lists-nav-design.md` và README.md §"Phase 14 — Danh sách và điều hướng (vòng 3)"). **Phase 15 (vòng 4 — khu người lớn) cũng đã triển khai xong** (2026-09-05, nhánh `phase15-parent-zone`, tasks 1–16 — xem `docs/superpowers/specs/2026-09-04-phase15-parent-zone-design.md` và README.md §"Phase 15 — Khu người lớn (vòng 4)") ⇒ **cả bốn vòng của redesign 2026-09 đã triển khai**.

Hai việc còn treo từ vòng 3 vẫn CHƯA đụng tới — Phase 15 không chạm màn trẻ em nên không có lý do
buộc phải làm: xoá alias `xl2/xl3/xl4` + `components/Stars.tsx` (deprecated, nay đã tới cột mốc
"Phase 15" mà ghi chú deprecate từng hứa, nhưng cả hai alias vẫn còn được `PlayerControls.tsx`,
`Card.tsx`, `DailyMission.tsx`, `Home.tsx`, `PairPractice.tsx`, `SentenceBuilder.tsx` và các test
liên quan dùng trực tiếp — xoá đòi phải sửa từng call site đó trước) và tách
`useCountdown`/`useTeachCollapse` (countdown lặp 8×, collapse lặp 6× trên các màn luyện nói của
Phase 13; Phase 15 chỉ đụng 4 màn người lớn nên vẫn không có màn luyện nói nào ép buộc việc tách).

Việc để lại mới của Phase 15, **sau làn sửa cuối** (chi tiết ở README.md §Phase 15 "Việc để lại"):
- Cả ba mốc chiều cao đều **trượt** khi chấm bằng đơn vị của spec (pixel của `-full.png`): phone
  1235 (≈1100), ipad 1032 (≤834), ipadp 1296 (≤1194). Lever `PanelGrid` xếp cột ở `ipad:` đã lấy
  hết phần dễ lấy (−48 ở `parent-dashboard`, −274 ở `parent-dashboard-recordings-20`); phần còn lại
  là các chiều cao brief quy định từng con số. Đề nghị đặt lại baseline trong MỘT đơn vị duy nhất.
- `Panel`'s `scroll` + fade 40px được ship và có test nhưng **không màn nào truyền prop đó** — park
  theo ruling (quyết định 30 "mở rộng tại chỗ" thắng §1.2's scroll body); hoặc dùng thật, hoặc xoá
  cả prop lẫn bài test.
- `Recording.score` mới được ghi ở 1/8 call site `saveRecording` (`PairPractice.tsx`), nên cột
  "điểm" trống với bản ghi từ bảy màn còn lại — mở rộng ở một phase sau.
- Flaky test đã biết `'the limit panel prints today against the limit in its title row and steps
  by 5'` (`ParentDashboard.test.tsx`, nêu tên từ `task-14-review.md` mục (vii)) — không thuộc phạm
  vi Phase 15, không tái hiện được trong môi trường cô lập, **không sửa ở làn cuối**.

Đã đóng ở làn sửa cuối (trước đây nằm trong danh sách này): `RemoteRowState.noAudio` (xoá hẳn —
không có nguồn phát), `AccountCard`'s `OTP_INPUT` (gộp vào `adult/fieldStyles.ts`),
`ProfilePicker`'s `byDate` (nay in "Tạo dd/mm"), test ranh giới tone chip 49/50/70/71 (đã thêm).
