# Prompt gửi Claude Design — redesign toàn bộ Speak Up! (2026-09-02)

Làm trong project cũ `claude.ai/design/p/9c792842-beb0-4158-a5d7-a3ac91730d3c` để giữ token, Foxy và 14 frame đã có.
Mỗi vòng = 1 cuộc hội thoại mới. Đính kèm đúng file ghi ở đầu mỗi vòng.

## File đính kèm
| File | Dùng ở vòng |
|---|---|
| `docs/design/2026-09-02-screen-inventory-for-redesign.md` | mọi vòng |
| `docs/design/2026-08-25-mobile-handoff-brief.md` (§14 Q1–Q20) | 1, 3 |
| `docs/design/current/sheets/sheet-01.png` … `sheet-08.png` | theo bảng dưới |

| Sheet | Màn |
|---|---|
| 01 | Home 4 trạng thái · ProfileGate · DailyMission · MissionComplete |
| 02 | TopicHub ×2 · LevelStairs · 4 màn danh sách bậc |
| 03 | VoiceLevel · not-found · CloudStart 5 stage · PracticeCard idle |
| 04 | PracticeCard IPA ẩn · SoundWordList · SoundPractice · PairPractice ×2 · StarPractice |
| 05 | VoicePractice · StoryList · StoryPlayer ×3 · StoryQuiz idle/sai |
| 06 | StoryQuiz đúng/kết quả · StoryRetell · WordTopics · WordList ×2 · WordCard đoán |
| 07 | WordCard đoán sai/đúng/mặt trước/mặt sau · SentenceList ×2 · SentenceBuilder rỗng |
| 08 | SentenceBuilder ×3 · ParentGate ×2 · ParentDashboard ×2 |

---

## Vòng 1 — Nền tảng (đính kèm: inventory, brief cũ, sheet 01–08)

```
Tôi đang redesign toàn bộ app Speak Up! (trẻ 9 tuổi, UI tiếng Việt) trong project này. Giữ nguyên token màu, font Baloo 2 / Nunito, Foxy, bóng chunky, bo góc, chip, sao đã có trong project.

Đính kèm:
- screen-inventory: kiểm kê 33 màn từ code thật — đọc §1, §2, §4, §5 trước.
- 8 sheet ảnh chụp app hiện tại, mỗi hàng 1 màn/trạng thái, 3 cột phone 390×844 · iPad ngang 1194×834 · iPad dọc 834×1194. Dòng đỏ "⚠ tràn" dưới ảnh = màn cao hơn viewport. Ảnh chụp với engine chấm đơn giản nên badge "chế độ đơn giản" xám ở góc phải là bình thường.
- brief cũ: chỉ cần §14 (20 câu hỏi Q1–Q20 chưa được trả lời).

Ba vấn đề tôi thấy trong ảnh và muốn sửa tận gốc: chỗ trống lớn trên iPad (thẻ 448px giữa màn 1194, nội dung dồn lên trên), nút quá to (mọi nút mặc định 64–72px, kể cả link chữ và màn phụ huynh), vỡ/tràn khi nhiều dữ liệu (lưới cột cố định, chuỗi dài không cắt, vùng kết quả 14 từ).

Vòng này CHỈ làm nền tảng, chưa vẽ màn lẻ:

1. Khung trang thống nhất cho 3 frame: phone 390×844, iPad ngang 1194×834, iPad dọc 834×1194 (frame thứ ba là mới — hiện code cho iPad dọc nhận layout tablet, xem cột 3 sheet 01). Chốt trên 1 artboard: gutter ngang, vị trí nút Back, vị trí LessonChip (chip nhiệm vụ nổi) sao cho không đè gì, vị trí Toast trên safe-area, 1 cách ghim CTA đáy, max-width nội dung trên iPad.

2. Component sheet theo bảng §4 của inventory, đủ trạng thái, đặt cạnh nhau, ghi số đo inline:
   - Button: thêm size phone; 4 variant × md/lg/phone × disabled × pulse.
   - MicButton: disabled (chờ) / idle / processing (đang chấm) / recording (kèm mức âm).
   - ResultCard: chứa được 14 chip từ + 4 bar + hint + prosody + 4 nút trong 834px iPad; biến thể Azure vs chế độ đơn giản (không có nút Nghe mình, chip chỉ xanh/đỏ, bar Ngữ điệu trống).
   - Dòng lỗi lượt nói 5 loại: mic từ chối · không nghe rõ · trình duyệt không hỗ trợ · offline/máy chấm hỏng · hết giờ hôm nay.
   - Not-found chung (Foxy + câu + Back), 5 empty state, notice 6 loại (info / cảnh báo / lỗi / thành công / mã khôi phục / xoá dở), dialog xác nhận (thay window.confirm) và dialog nhập tên, loading/skeleton, sync 7 trạng thái, gộp 2 component sao thành 1, BackButton 3 cỡ.

3. Trả lời và GHI LÊN ARTBOARD (thẻ annotation) các câu: Q3 panel streak khi chạm, Q4 BackButton 56 hay 66, Q6 mic phone 124 hay 150.

Ràng buộc kỹ thuật ở cuối §5.2 inventory là cố định (8 đảo, 5 bậc, 3 từ/âm, hồ sơ không xoá được, chế độ đơn giản không có prosody, không có nhạc nền, không có ảnh cảnh truyện). Không đề xuất tính năng mới.
Mọi frame phải dùng dữ liệu xấu nhất ghi trong inventory: tên hồ sơ "Nguyễn Hoàng Bảo Ngọc Anh Thư", email 60 ký tự, câu "Chị của con có một con búp bê em bé.", 14 chip từ, 64 ô ôn tập.
```

## Vòng 2 — Khung luyện nói (đính kèm: inventory, sheet 03–08, kết quả vòng 1)

```
Dùng nền tảng và component sheet đã chốt ở vòng trước. Đọc inventory §3 nhóm B (B0–B7), C4, C7, C9. Ảnh hiện tại: sheet 03 (PracticeCard), 04 (SoundWordList, SoundPractice, PairPractice, StarPractice), 05 (VoicePractice), 06 (StoryRetell, WordCard), 07 (WordCard), 08 (SentenceBuilder).

Lưu ý ảnh chỉ có trạng thái idle và các bước tương tác không cần mic. Trạng thái đang ghi / đang chấm / kết quả mô tả ở B0 (11 bước) — chưa có ảnh vì không chụp được, nhưng đã đo: kết quả Story Voice cao 1140px và Sentence Stars 959px trên iPad 834px.

Vẽ MỘT khung luyện nói chung theo vòng đời B0, cho cả 3 frame:
- iPad: 2 cột — "dạy" bên trái (từ/câu/âm/mẫu), "làm" bên phải (mic → đếm ngược → kết quả).
- phone: cột dạy gập lại khi có kết quả; vùng kết quả là vùng cuộn có giới hạn; CTA luôn nhìn thấy.
- Header: Back · chip tiến độ · badge engine · LessonChip không đè nhau (hiện đang đè, xem ảnh word-card-back sheet 07).

Rồi 9 biến thể, chỉ đổi phần "dạy":
B1 PracticeCard (thẻ emoji + từ + khẩu hình; Word Pop ẩn IPA + streak 2 lần)
B3 SoundPractice (tầng âm + tầng từ; kết quả là SoundChip 4 tone chấm ÂM, không chấm từ)
B4 PairPractice (thêm pha nghe & chọn trước pha nói: 2 ô, đúng/sai, 2 tick)
B5 StarPractice (câu nhấn trọng âm + card nhịp + dòng "Nhịp: …")
B6 VoicePractice (đoạn 14 từ + mood + tips; đếm ngược 2 chữ số 13→1; ProsodyChip)
C4 StoryRetell (1 câu + loa; hiện không có rule phone nào)
C7 WordCard (đoán nghĩa 3 lựa chọn → thẻ lật 2 mặt → nói; badge "🔓 Mở khoá!")
C9 SentenceBuilder (khay + chú giải vai + kho ô 6 ô; sai = rung rồi xoá khay)
(+ B2 SoundWordList là màn danh sách 3 từ, vẽ ở vòng 3)

Mỗi biến thể vẽ 4 trạng thái × 3 frame: idle · đang ghi · kết quả 3★ (Azure) · kết quả 1★ (chế độ đơn giản).
Trường hợp phải vừa: B6 kết quả 14 chip từ + 4 bar + prosody + hint + 4 nút trong 834px iPad.
Trả lời trên artboard: Q7 badge Mở khoá, Q8 chip "Từ n/3", Q9 nhãn "chạm để lật", Q10 luồng đoán nghĩa (đã chốt: chờ bé bấm Tiếp theo).
```

## Vòng 3 — Danh sách và điều hướng (đính kèm: inventory, brief cũ §14, sheet 01–03, 05–07)

```
Đọc inventory §3 nhóm A (A3–A17) và C1, C5, C6, C8, B2. Ảnh: sheet 01 (Home, DailyMission, MissionComplete), 02 (TopicHub, LevelStairs, 4 danh sách bậc), 03 (VoiceLevel, not-found), 05 (StoryList, StoryPlayer, StoryQuiz), 06 (WordTopics, WordList), 07 (SentenceList).

1. Một khung danh sách chung cho 10 màn (A10–A14, B2, C1, C5, C6, C8): header (Back + H1 + phụ) + lưới ô 2/3/4 cột theo frame; ô có sao / chip khoá / chip mood / IPA; hàng dài kiểu SentenceList; empty state; not-found. Hiện phone dùng lưới 1 cột (8–10 thẻ dài 2000px+) hoặc 3–4 cột cố định (ô 57px nhỏ hơn emoji 64px) — xem ảnh -full.
   Trường hợp phải vừa: WordList ôn tập 64 ô; StoryList 3 ô trên phone 390; SentenceList 32 hàng.

2. Home (A3): frame iPad dọc; quy tắc khi 2–3 banner cùng hiện (hết giờ + mốc email + cài PWA — sheet 01 có từng cái); MissionCard trạng thái "xong" (nhãn dài gãy dòng); panel streak khi chạm (Q3).

3. DailyMission: trạng thái rỗng (hiện không có CTA); iPad ngang với 5 nhóm (ảnh sheet 01 cho thấy tràn 1189px).
   MissionComplete: biến thể 0 sao. TopicHub: CTA ghim đáy "Học tiếp: …" và đảo không có truyện (5/8 đảo). LevelStairs: iPad không dùng 5 margin cố định, phone cuộn được.

4. StoryPlayer (sheet 05): LessonChip không đè chip "Cảnh N/M"; karaoke 9 từ; trạng thái chưa có giọng đọc / không phát được. Trả lời Q11 (64px/từ), Q12 (code KHÔNG có nhạc nền), Q13 (nút Tiếp tục/Bỏ qua), Q14 (quiz ảnh hay emoji).
   StoryQuiz: kết quả 0/3 (hiện vẫn 1 sao), thẻ đáp án không cố định 270×250.

Mỗi màn vẽ 3 frame. Ghi số đo inline.
```

## Vòng 4 — Khu người lớn (đính kèm: inventory, sheet 01, 03, 08)

```
Đọc inventory §3 nhóm P (P1, P2 với 10 panel), A1, A2. Ảnh: sheet 01 (ProfileGate), 03 (CloudStart 5 stage), 08 (ParentGate, ParentDashboard 2 trạng thái + ảnh -full trong thư mục current/).

Đây là giao diện NGƯỜI LỚN: chữ 12–14px, vùng chạm 44px, không áp luật 64px của trẻ. Hiện code dùng 4 mốc tap 36/44/48/64 trên cùng 1 màn và 4 hộp thoại native của trình duyệt.

1. Cùng một ngôn ngữ cho 3 cổng: ProfileGate (A1: 1 / 3 / 8 hồ sơ, tên dài, overlay khi quay lại sau 5 phút), ParentGate (P1: câu hỏi nhân, sai), CloudStart (A2: 8 stage — menu, gate, email, OTP, mã khôi phục, chọn hồ sơ, "abandon" 4 biến thể copy — và 14 câu lỗi; vẽ đủ).

2. ParentDashboard cho 3 frame, đặc biệt iPad dọc (hiện 1 cột dài >1700px): sắp 10 panel thành lưới cân; vị trí "Đặt lại tiến trình"; thẻ Tài khoản 11 trạng thái (đang tải, không session ×2, form email, busy, OTP, lỗi 6 câu, mã khôi phục, đã liên kết với email 60 ký tự, đăng xuất); sync 7 trạng thái; Tiến độ từ xa 7 trạng thái/hàng; biểu đồ có empty state; "Điểm trung bình" thêm loại truyện; Bản ghi gần đây 20 hàng; Giới hạn ngày với giá trị tuỳ chỉnh; Bài học (auto vs bậc không cùng sáng).

3. Dialog thật thay window.confirm/prompt: xoá tiến trình (2 copy), đăng xuất, thêm hồ sơ (nhập tên), đổi tên.

Trả lời trên artboard: Q17 biểu đồ 7 hay 14 ngày, Q18 giữ Bản ghi gần đây (đã chốt: giữ).
```

## Sau mỗi vòng
- Yêu cầu Claude Design xuất `.dc.html` vào `docs/design/`.
- Bắt nó ghi câu trả lời Q-số lên artboard, không chỉ trong chat.
- Kiểm tra mỗi frame đã dùng dữ liệu xấu nhất chưa; nếu vẽ dữ liệu đẹp thì hỏi lại.
- Khi cả 4 vòng xong: viết brief triển khai từ các file `.dc.html` (giống `2026-08-25-mobile-handoff-brief.md`), rồi chạy lại `docs/design/current/shoot.mjs` để so trước/sau.
