# Redesign 2026-09 — file kéo về từ Claude Design (DesignSync, 2026-09-02)

Project: `claude.ai/design/p/9c792842-beb0-4158-a5d7-a3ac91730d3c` ("Speak Up", loại project thường). Kéo bằng `DesignSync get_file`; số đo nằm inline trong style của từng file.

| Vòng | File | Artboard | Trạng thái |
|---|---|---|---|
| 1 Nền tảng | `Speak Up Foundation.dc.html` (70 KB) | Khung phone / iPad ngang / iPad dọc + component sheet (Button, MicButton, đếm ngược, badge, LessonChip, ResultCard, 5 lỗi, not-found, 5 empty, 6 notice, dialog, skeleton, sync 7, Stars gộp, BackButton 3 cỡ) + trả lời Q3/Q4/Q6 | ✅ đủ |
| 2 Khung luyện nói | `Speak Up Practice Frame.dc.html` (80 KB) | B6 phone idle / recording / result · B6 iPad ngang · B6 iPad dọc | ⚠ chỉ có carrier B6; 8 biến thể B1/B3/B4/B5/C4/C7/C9 chưa vẽ |
| 3 Danh sách & điều hướng | `Speak Up Lists & Nav.dc.html` (85 KB) | C6 review ×3 frame · C1 · C8 · A3 Home iPad dọc + phone 3 banner · A6 rỗng + iPad ngang · A7 0 sao · A8 · A9 phone + iPad · C2 · C3 ×2 | ✅ (khung danh sách chung dùng C6 làm carrier) |
| 4 Khu người lớn | `Speak Up Parent Zone.dc.html` | — | ❌ page rỗng, chưa làm |

`tokens/` — 4 file CSS token của design system trong project (colors, effects, spacing, typography). Project còn có `components/*.jsx|.d.ts|.prompt.md` (Button, Chip, Stars, GameCard, SpeechBubble, Foxy, MicButton) và `guidelines/*.card.html` — chưa kéo, kéo khi viết brief vòng 1.

Bước tiếp: brief vòng 1 đã viết → `../2026-09-02-round1-foundation-brief.md`; spec + plan Phase 12 đã viết và **Phase 12 đã triển khai xong** (2026-09-03, nhánh `phase12-foundation`, tasks 1–16 — xem `docs/superpowers/specs/2026-09-02-phase12-foundation-redesign-design.md` và README.md §"Phase 12 — Nền tảng redesign"). Tiếp theo là Phase 13 (vòng 2 — bố cục từng màn).
