# Speak Up! — Web app luyện nói tiếng Anh cho bé 9 tuổi (iPad)

## 1. Mục tiêu & nguyên tắc

- Đối tượng: 1 bé 9 tuổi, chưa có thói quen nói, nghe-nói yếu.
- Mục tiêu cốt lõi: **tạo thói quen mở miệng nói mỗi ngày** (10–15 phút/ngày), không phải nhồi kiến thức.
- Nguyên tắc:
  1. Mỗi phiên ngắn (≤ 15 phút), kết thúc bằng phần thưởng nhìn thấy được.
  2. Mọi bài đều có bước **Nghe → Nhại → Tự nói** (listen – repeat – produce).
  3. Đánh giá phát âm **khích lệ**: mỗi lần chỉ ra đúng 1 điểm cần sửa.
  4. Không đăng nhập, không quảng cáo; chạy offline được sau lần tải đầu (PWA).

## 2. Kiến trúc giải pháp

### 2.1 Nền tảng
| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| App | **PWA (Vite + React + TypeScript)**, "Add to Home Screen" trên iPad | Chạy toàn màn hình như app, không cần App Store |
| Thu âm | Web `MediaRecorder` + `getUserMedia` | Safari iOS ≥ 14.5 hỗ trợ; xuất `audio/mp4` (AAC) |
| Giọng mẫu | Audio thu sẵn bằng Neural TTS (Azure "Jenny/Guy Neural" hoặc ElevenLabs) | Ổn định; Web Speech của Safari chất lượng kém |
| Chấm phát âm | **Azure Speech – Pronunciation Assessment** (mục 2.3) | Điểm theo âm vị / từ / câu, có ngữ điệu (prosody) |
| Nghe + chữ chạy | Audio + timestamp từng từ (word-level) | Karaoke highlight chính xác |
| Backend | Serverless nhẹ (Vercel / Cloudflare Functions) để giấu API key & proxy Azure | Bảo mật key |
| Lưu tiến trình | `IndexedDB` trên iPad (tuỳ chọn sync Supabase sau) | Không cần tài khoản |

### 2.2 Mô-đun nội dung

```
Bản đồ hành trình ─┬─ 🎧 Nghe kể chuyện (Listening)
                   ├─ 🗣️ Phòng phát âm (Speak Lab)
                   ├─ 🧩 Từ vựng (Words)
                   └─ 🧱 Ghép câu / ngữ pháp nói (Sentence Builder)
```

**A. Nghe kể chuyện (Listening)**
- Mỗi bài = 1 truyện 60–120 giây, 6–10 cảnh, mỗi cảnh 1 hình minh hoạ lớn.
- Nhạc nền nhẹ (âm lượng riêng, tắt được) + hiệu ứng âm thanh theo cảnh.
- Chữ chạy karaoke: từ đang đọc phóng to + đổi màu theo timestamp từng từ.
- Tốc độ 0.75x / 1x, bấm vào từ bất kỳ để nghe lại từ đó, bật/tắt phụ đề tiếng Việt.
- Sau khi nghe: 3 câu hỏi chọn tranh + 1 câu "Bé kể lại" (ghi âm, chấm mức khích lệ).

**B. Phòng phát âm (Speak Lab) — trọng tâm**, 5 cấp tăng dần:

| Cấp | Tên | Nội dung | Tiêu chí chấm |
|---|---|---|---|
| 1 | Sound Zoo | Từng âm khó: /θ/ /ð/ /ʃ/ /tʃ/ /v/ /z/ … kèm animation khẩu hình | Accuracy từng âm vị |
| 2 | Word Pop | Từ đơn theo chủ đề (animals, food, school…) | Accuracy + âm nào sai |
| 3 | Minimal Pairs | ship/sheep, bat/bad, three/tree | Phân biệt đúng âm mục tiêu |
| 4 | Sentence Stars | Câu 4–8 từ, chú ý trọng âm & nối âm | Accuracy + Fluency + Completeness |
| 5 | Story Voice | 2–3 câu liền, thể hiện ngữ điệu (hỏi / ngạc nhiên / vui) | + Prosody |

Luồng mỗi thẻ: **Nghe mẫu → Xem khẩu hình → Bấm mic nói → Nhận kết quả → Nói lại (≤ 3 lần) → Sao**.

**C. Từ vựng (Words):** thẻ hình + âm; ôn theo spaced repetition; mỗi từ phải "nói để mở khoá" (đạt ≥ 60 điểm mới tính đã học).

**D. Ghép câu (Sentence Builder):** kéo-thả khối từ thành câu đúng → nghe máy đọc câu vừa ghép → bé đọc lại → chấm. Ngữ pháp học qua *nói*, không qua lý thuyết.

### 2.3 Đánh giá phát âm — cách hoạt động

1. Bé bấm mic, app thu 2–8 giây, gửi audio + câu tham chiếu lên backend.
2. Backend gọi Azure Speech `PronunciationAssessment` (granularity = Phoneme, bật Prosody, `en-US`).
3. Azure trả: điểm tổng 0–100, Accuracy, Fluency, Completeness, Prosody; mỗi từ có điểm + `ErrorType` (Mispronunciation / Omission / Insertion); mỗi âm vị có điểm.
4. App dịch thành **phản hồi cho trẻ**:
   - 0–59: 1 sao, "Thử lại nào!" + nhấn đỏ từ sai nhất.
   - 60–79: 2 sao, "Tốt lắm! Sửa từ này nhé" + 1 từ.
   - 80–100: 3 sao, pháo hoa.
   - Tô màu từng từ: xanh (tốt) / vàng (tạm) / đỏ (cần sửa). Bấm từ đỏ → nghe mẫu + nghe lại giọng mình.
   - Gợi ý khẩu hình cho âm sai ("Đặt lưỡi giữa hai hàm răng cho âm /θ/").
5. Lưu bản ghi + điểm để cha mẹ xem trong **Parent Dashboard** (khoá bằng câu hỏi toán).

Dự phòng mất mạng: vẫn nghe & nhại, bản ghi lưu tạm, chấm khi có mạng.

Chi phí: Azure Speech ≈ $1/giờ audio; 15 phút/ngày ≈ dưới $1/tháng, free tier 5 giờ/tháng.

### 2.4 Gamification (vừa đủ)
- Sao → mở khoá đồ trang trí cho linh vật **Foxy** (cáo nhỏ). Foxy "nói theo" khi bé nói.
- Streak hiển thị bằng lịch tuần có sao.
- Nhiệm vụ hằng ngày cố định: 1 bài nghe + 5 thẻ phát âm + 3 từ mới ≈ 12 phút.

### 2.5 Lộ trình
1. **Tuần 1–2:** khung PWA, thu âm trên Safari iPad, tích hợp Azure, Speak Lab cấp 1–2 (chứng minh kỹ thuật).
2. **Tuần 3:** Listening karaoke + 3 truyện đầu; Parent Dashboard.
3. **Tuần 4:** Words, Sentence Builder, Foxy, streak.
4. Sau đó: mỗi tuần thêm 1 truyện + 1 chủ đề.

**Phase 2 (Listening) implemented 2026-08-23.**

**Phase 3 (Words, Sentence Builder, Mission/Foxy, Parent Dashboard) implemented 2026-08-23.**

**Phase 5 (learning path: Tập âm/Đọc từ/Học từ mới/Nghe & chọn) implemented 2026-08-23.**

**Phase 6 (Sentence Stars & Story Voice) implemented 2026-08-23.**

**Phase 7 (topic map & daily lesson engine) implemented 2026-08-24.**

**Phase 8 (mission flow & practice polish) implemented 2026-08-25.**

### 2.6 Quyết định đã chốt (22/08/2026)
- **Bộ chấm phát âm:** Azure Speech Pronunciation Assessment, tier **F0 miễn phí 5 giờ/tháng** (chính) + **Web Speech API** của Safari (fallback khi offline / hết quota, chỉ chấm mức từ). Cả hai nằm sau một interface chung `scorePronunciation(audio, targetText) → PronunciationResult` để có thể đổi engine sau này.
  - Đã loại: DeepSeek/Kimi (LLM text, không phân tích âm thanh); Gemini audio (không ra điểm ổn định); tự host wav2vec2/Kimi-Audio (tốn công, kém chính xác với giọng trẻ em); SpeechAce/ELSA (quá đắt).
- Giọng chuẩn **Mỹ (en-US)**.
- Lộ trình mục 2.5 được duyệt; bắt đầu từ Speak Lab + thu âm trên Safari iPad.
- Nội dung tự biên soạn, hình minh hoạ tạo bằng AI. 1 người dùng, chưa cần đăng nhập.

---

## 3. DESIGN BRIEF — gửi cho Claude Design

> Sao chép từ đây xuống để yêu cầu thiết kế.

### Bối cảnh
Thiết kế giao diện web app **"Speak Up!"** cho **iPad (landscape 1194×834 và portrait 834×1194)**. Người dùng duy nhất là **một bé 9 tuổi** (đọc được tiếng Việt, tiếng Anh cơ bản). App giúp bé **luyện nói tiếng Anh mỗi ngày**: nghe truyện có chữ chạy, luyện phát âm với mic và được chấm điểm, học từ vựng, ghép câu. Bé hiện ngại nói nên giao diện phải **mời gọi, an toàn, khen thưởng**, không gây áp lực.

### Phong cách
- Tươi sáng, tròn trịa, "playful but clean" — hướng Duolingo Kids / Khan Academy Kids; KHÔNG rối như game mobile.
- Màu: nền kem sáng; chủ đạo cam san hô + xanh ngọc; điểm nhấn vàng (sao). Màu chấm phát âm: xanh lá (tốt) / vàng (tạm) / đỏ hồng (cần sửa), luôn kèm icon để người mù màu phân biệt được.
- Font tròn, dễ đọc: Nunito / Fredoka / Baloo 2. Chữ nội dung ≥ 20px; câu đang luyện 32–48px.
- Linh vật **Foxy** (cáo nhỏ) xuất hiện xuyên suốt, 5 biểu cảm: chờ, lắng nghe, vui, cổ vũ, ngạc nhiên. Foxy há miệng "nói theo" khi bé nói.
- Vùng chạm ≥ 64×64px; nút mic ≥ 120px, đặt giữa-dưới màn hình.
- Ít chữ, nhiều icon + hướng dẫn bằng âm thanh; hướng dẫn tiếng Việt ngắn, nội dung học tiếng Anh.
- Hiệu ứng: chuyển cảnh nhẹ, confetti khi 3 sao, nút mic rung nhẹ khi đang thu.

### 10 màn hình cần thiết kế

1. **Home / Bản đồ hành trình** — đường đi cong qua các "đảo" chủ đề (Animals, Food, School, Family…), mỗi đảo hiện số sao; góc trên: streak tuần (7 ô có sao) + tổng sao; Foxy chào và hiện "Nhiệm vụ hôm nay" với tiến độ.
2. **Daily Mission** — thẻ lớn 3 bước (🎧 Nghe 1 truyện → 🗣️ 5 thẻ phát âm → 🧩 3 từ mới), thời gian ước tính mỗi bước, nút "Bắt đầu" to.
3. **Listening – Player (quan trọng)** — hình minh hoạ cảnh chiếm ~60% phía trên; dưới là dải chữ karaoke 2 dòng: **từ đang đọc phóng to + màu cam, từ đã đọc xám nhạt**; điều khiển: Play/Pause lớn, tốc độ 🐢/🐇, bật/tắt nhạc nền 🎵, bật/tắt phụ đề Việt; tiến trình theo cảnh (chấm tròn). Có trạng thái "bấm vào 1 từ để nghe lại".
4. **Listening – Quiz** — chọn 1 trong 3 tranh; Foxy phản hồi đúng/sai.
5. **Speak Lab – Chọn cấp** — 5 cấp xếp bậc thang: Sound Zoo → Word Pop → Minimal Pairs → Sentence Stars → Story Voice; cấp chưa mở có ổ khoá, cấp hiện tại có Foxy đứng.
6. **Speak Lab – Thẻ luyện (quan trọng nhất)** — 3 trạng thái:
   - *Sẵn sàng:* từ/câu cỡ lớn ở giữa, IPA nhỏ bên dưới, hình nghĩa bên trái, khung animation khẩu hình bên phải, nút 🔊 nghe mẫu, nút mic lớn ở dưới.
   - *Đang thu:* mic phồng to, vòng sóng âm quanh mic, đếm ngược 5s, Foxy áp tai lắng nghe.
   - *Kết quả:* 1–3 sao rơi xuống; câu **tô màu từng từ** (xanh/vàng/đỏ); đúng 1 thẻ gợi ý "Sửa từ này: *three* — đặt lưỡi giữa hai răng" kèm icon khẩu hình; nút "Nghe mình" / "Nghe mẫu"; nút "Thử lại" và "Tiếp theo"; 4 thanh nhỏ (Chính xác / Trôi chảy / Đầy đủ / Ngữ điệu) không hiện số lớn.
7. **Minimal Pairs** — 2 thẻ hình cạnh nhau (ship 🚢 / sheep 🐑): nghe rồi chọn, sau đó đọc cả 2.
8. **Words – Thẻ từ vựng** — thẻ lật: trước = hình + từ, sau = nghĩa Việt + câu ví dụ; nút mic "Nói để mở khoá", ổ khoá mở ra khi đạt.
9. **Sentence Builder** — khối từ màu (chủ ngữ xanh, động từ cam, tân ngữ vàng) kéo thả vào khay câu; 🔊 đọc câu vừa ghép; mic để bé đọc lại.
10. **Parent Dashboard** (mở bằng câu hỏi "7 × 8 = ?") — phong cách người lớn, đơn giản: biểu đồ phút luyện/ngày 2 tuần, điểm phát âm trung bình theo cấp, các âm bé hay sai (/θ/, /v/…), bản ghi âm gần đây (nghe lại được), cài giới hạn thời gian/ngày.

### Components cho design system
- Nút Mic: idle / recording / processing / disabled
- Từ karaoke: chưa đọc / đang đọc / đã đọc
- Từ chấm điểm: good / ok / fix (+ tooltip khẩu hình)
- Thẻ sao 0–3, Streak chip, Thanh tiến trình nhiệm vụ
- Foxy 5 biểu cảm
- Thẻ gợi ý sửa âm
- Nút primary/secondary lớn; Toggle (nhạc nền, phụ đề)

### Bàn giao
- Landscape + portrait cho màn 1, 3, 6.
- Prototype flow: Home → Daily Mission → Listening Player → Quiz → Speak Lab card (3 trạng thái) → hoàn thành nhiệm vụ.
- Design tokens (màu, font, spacing, radius) để dev dùng Tailwind.
