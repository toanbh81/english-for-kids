# Ảnh chụp app hiện tại (2026-09-02) — để gửi Claude Design

Chụp tự động bằng Playwright (Edge headless) từ dev build `http://localhost:5174`, commit `499a59b`.
Mã màn (A3, B5, P2…) trỏ về `docs/design/2026-09-02-screen-inventory-for-redesign.md` §3.

## Thư mục
| Thư mục | Nội dung |
|---|---|
| `sheets/` | **8 contact sheet** — mỗi hàng 1 màn/trạng thái, 3 cột phone · iPad ngang · iPad dọc. Gửi Claude Design **bộ này** trước. |
| `phone/` | 390×844 @2x, mobile UA + touch — 59 ảnh |
| `ipad/` | 1194×834 @2x — 60 ảnh |
| `ipadp/` | 834×1194 @2x — 8 màn tiêu biểu (iPad dọc chưa có design) |
| `*-full.png` | Ảnh **cuộn toàn bộ** cho màn tràn viewport — chính là bằng chứng "vỡ/tràn". |
| `shoot.mjs`, `sheet.mjs` | Script chụp và ghép, chạy lại được sau khi có UI mới (xem cuối file). |

## Điều kiện chụp — đọc trước khi so với design
- **Engine chấm là Web Speech** (dev không có Azure) → mọi màn luyện hiện badge xám "chế độ đơn giản" ở góc phải trên. Trên iPad thật với Azure, badge này trống.
- **Không có mic** → không có ảnh trạng thái *đang ghi / đang chấm / kết quả 1–3★* của 9 màn luyện nói. Các trạng thái đó mô tả chữ ở inventory B0, B1–B6, C4, C7, C9; số đo tràn đã đo ở README dự án (Story Voice kết quả 1140px, Sentence Stars 959px trên iPad).
- **Dữ liệu seed**: 5 ngày luyện (~57 phút), 36 sao, 3 hồ sơ (1 tên dài) ở ảnh `profile-gate` / `parent-dashboard-profiles`; streak hiển thị 0 vì streak tính theo ngày hoàn thành nhiệm vụ, không seed được.
- `reducedMotion: reduce` → không có animation (Foxy không bob, thẻ không nhắc lật).
- Mã khôi phục trong ảnh dashboard là của tài khoản ẩn danh rỗng tạo lúc chụp — không có giá trị.
- Không có nhạc nền, không có ảnh cảnh truyện (emoji + gradient) — đúng với code.

## Trạng thái có trong ảnh (58 tên file)
Home: `home-fresh` (máy mới, có link khôi phục) · `home` · `home-over-limit` (banner hết giờ) · `home-ios-a2hs` (phone, banner cài PWA) · `profile-gate`.
Nhiệm vụ: `mission` · `mission-done`. Đảo: `topic-animals` · `topic-locked`. Bậc: `levels` · `level-word-pop` · `level-sound-zoo` · `level-pairs` · `level-stars` · `level-voice` · `level-notfound`.
Khôi phục: `start-menu` · `start-gate` · `start-gate-wrong` · `start-email` · `start-code`.
Luyện nói (idle): `practice-idle` · `practice-ipa-hidden` · `sound-list` · `sound-practice-idle` · `pair-listen` · `pair-listen-armed` · `star-idle` · `voice-idle` · `retell-idle`.
Truyện: `stories` · `story-player` · `story-player-playing` · `story-player-ended` · `quiz-idle` · `quiz-wrong` · `quiz-correct` · `quiz-result`.
Từ: `words` · `words-animals` · `words-review-empty` · `word-guess` · `word-guess-wrong` · `word-guess-correct` · `word-card-front` · `word-card-back`.
Câu: `sentences` · `sentences-topic` · `sentence-empty` · `sentence-partial` · `sentence-wrong` · `sentence-correct`.
Phụ huynh: `parent-gate` · `parent-gate-wrong` · `parent-dashboard` (+`-full`) · `parent-dashboard-profiles` (+`-full`).

## Màn tràn viewport (có `-full.png`)
Phone: 5 màn danh sách bậc (1244–2420px), `words` (946), `sentences` (2192), `parent-dashboard` (1745).
iPad ngang 1194×834: `mission` (1189), `levels` (1496), `level-stars` (1020), `level-voice` (971), `sentences` (1964), `parent-dashboard` (1733).
iPad dọc 834×1194: `parent-dashboard` (xem `ipadp/parent-dashboard-full.png`).
Trong sheet, ô nào tràn có dòng đỏ "⚠ tràn" ngay dưới ảnh.

**Phát hiện mới khi chụp:** `ipad/mission.png` — DailyMission với 5 nhóm ở 1194×834 xếp **2 cột** (nhóm thứ 5 rơi xuống dưới CTA, trang cao 1189px) thay vì hàng 5 cột như Phase 8 mô tả. Cần kiểm tra code (`COLUMNS[5]` trong `DailyMission.tsx`) trước khi coi đây là "thiết kế hiện tại".

## Chạy lại
```bash
# dev server http (không SSL): pnpm --filter client exec vite --mode nossl --port 5174
cd docs/design/current && npm i playwright-core@1.47.2 && node shoot.mjs        # tất cả frame
SHOTS=home,mission node shoot.mjs phone                                          # chỉ vài ảnh
node sheet.mjs                                                                   # ghép sheet
```
Cần Edge cài sẵn (`channel: 'msedge'`), không tải browser.
