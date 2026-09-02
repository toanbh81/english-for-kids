# Speak Up! — Kiểm kê màn hình để redesign toàn bộ (2026-09-02)

**Mục đích.** Bản design gốc (Claude Design, 2026-08-23 iPad + 2026-08-25 Mobile) chỉ vẽ ~14 frame chính. Trong 11 phase, Claude Code đã tự dựng thêm ~19 màn và hàng chục trạng thái theo luồng tính năng mà không có design, nên giao diện hiện tại có chỗ trống lớn, nút quá to, và vỡ/tràn khi nhiều dữ liệu — trên cả iPad lẫn phone. Tài liệu này liệt kê **đầy đủ 33 màn + overlay + component**, mọi **trạng thái** (kể cả kết quả, lỗi, rỗng, tải), **dữ liệu động xấu nhất**, và **vấn đề layout đang có** của từng màn, để Claude Design thiết kế bổ sung và **đồng nhất cho 2 frame iPad ngang 1194×834 và phone 390×844**.

**Cách đọc.** Mỗi màn có: mục đích · vùng nội dung trên→dưới (kèm class Tailwind quyết định bố cục) · dữ liệu động & trường hợp xấu · **danh sách trạng thái** · điều hướng · vấn đề layout. Nhãn *"design Mx"* = đã có frame trong bộ Mobile/iPad; *"không có design"* = Claude Code tự vẽ. Các mã **Q1–Q20** trỏ về 20 câu hỏi mở trong `docs/design/2026-08-25-mobile-handoff-brief.md` §14 (chưa được trả lời).

**Không nằm trong tài liệu này:** ảnh chụp app hiện tại (chụp tay nếu cần), nội dung bài học, kiến trúc dữ liệu.

---

## 1. Khung chung & luật đã chốt

### 1.1 Hai frame chuẩn
| | Phone | iPad ngang |
|---|---|---|
| Frame design | 390×844 (safe area 47 trên / 34 dưới, vẽ sẵn) | 1194×834 |
| Trong code | mọi class **không prefix** = phone (<768) | variant `ipad:` = `min-width ≥1024 AND landscape AND min-height ≥692` (không phải mốc width) |
| Mốc giữa | `md:` = 768 = tablet dọc / iPad dọc | — |
| Hệ quả cần design biết | **iPad dọc (834×1194) và tablet 768–1023 nhận layout `md:`**, không phải layout iPad ngang: Home là lưới 2 cột (không có bản đồ), Speak Lab là lưới 2 cột (không có thang chéo), ParentDashboard 1 cột dài. Không có frame nào cho tình huống này. |

### 1.2 Luật cứng từ design cũ (code đang tuân)
- Vùng chạm trẻ em ≥64px · mic ≥120px · không cuộn ngang · CTA chính trên nếp gấp 844 (375×667: vừa hoặc ghim đáy).
- Màn phụ huynh là ngoại lệ "giao diện người lớn": chữ 12–14px, vùng chạm 36–48px (code đang dùng **4 mốc 36/44/48/64 trên cùng 1 màn**).
- Không đổi qua breakpoint: màu, bóng chunky, bo góc, Foxy, chip, sao.
- Safe area: `PAGE_SHELL` = `max(padding riêng màn, env(safe-area-inset) + 9/10px)` cho trên/dưới; **padding ngang do từng màn tự đặt** → hiện có 4 gutter phone khác nhau (14/16/20/24px) giữa các màn cách nhau 1 chạm.
- Quyết định sản phẩm đã chốt 2026-08-25: Home phone = M1b (bỏ bản đồ) · Dashboard giữ "Bản ghi gần đây" · đoán nghĩa đúng → chờ bé bấm "Tiếp theo →".

### 1.3 Token đang dùng
Xem §4 (component sheet) — màu/bóng/bo góc/font không đổi; **redesign không cần token mới**, chỉ cần gom 16 mã hex lẻ đang rải trong code về token.

---

## 2. Bảng tổng 33 màn + overlay

Ưu tiên: **A** = vỡ/tràn thật hoặc không có design và dùng hằng ngày · **B** = có design nhưng lệch nhiều · **C** = ổn, chỉ cần đồng nhất.

| # | Màn (component) | Route | Design? | Trạng thái | Ưu tiên | Vấn đề chính |
|---|---|---|---|---|---|---|
| A0 | AppErrorBoundary | (crash) | ✗ | 1 | C | trống trên iPad |
| A1 | ProfileGate | (bọc app) | ✗ | 6 | **A** | không rule iPad; overlay đè app |
| A2 | CloudStart | `/start` | ✗ | **28** | **A** | 8 stage, 14 câu lỗi, 5 link 64px chồng; thẻ 448px mọi width |
| A3 | Home | `/` | M1b + iPad | 22 | B | 2 layout/1 DOM; 3 banner có thể chồng; iPad dọc = lưới |
| A4 | MissionCard | (Home) | M1b | 4 | C | nhãn "xong" gãy 2 dòng trong slot absolute |
| A5 | StreakWeek | (Home) | M1b | 4 | C | panel "chi tiết khi chạm" chưa có design (Q3) |
| A6 | DailyMission | `/mission` | M2 | 12 | B | rỗng không CTA; 1–2 nhóm lơ lửng giữa màn |
| A7 | MissionComplete | `/mission/done` | M8b | 1 (+0 sao) | C | không có variant 0 sao |
| A8 | TopicHub | `/topic/:id` | M8 | 13 | B | 5/8 đảo "Sắp có"; CTA ghim đáy chưa làm |
| A9 | LevelStairs | `/levels` | M7 | 11 | B | 5 margin ma thuật iPad; phone không cuộn được |
| A10 | LevelSelect (Word Pop) | `/level/word-pop` | ✗ | 3 | **A** | not-found trần; H1 40px; 12 ô |
| A11 | SoundLevel (Tập âm) | `/level/sound-zoo` | ✗ | 2 | **A** | 9 ô lẻ hàng; không responsive |
| A12 | PairLevel | `/level/minimal-pairs` | ✗ | 2 | **A** | phone 1 cột 8 thẻ cao |
| A13 | StarLevel | `/level/sentence-stars` | ✗ | 2 | **A** | phone 1 cột 10 thẻ, hàng không đều |
| A14 | VoiceLevel | `/level/story-voice` | ✗ | 2 | **A** | phone 1 cột 8 thẻ |
| A15 | LessonChip | (overlay) | ✗ | 8 | **A** | đè chip cảnh & badge engine; hợp đồng gutter ngầm |
| A16 | Toast | (overlay) | ✓ (iPad) | 2 | B | dưới notch; không max-width |
| B1 | PracticeCard | `/practice/:id` | M3/M3b | 19 | B | không `ipad:`; deck mất 2/3 ô phone thấp |
| B2 | SoundWordList | `/sound/:ph` | ✗ | 7 | **A** | iPad dồn trên trống dưới; header 2 thiết kế |
| B3 | SoundPractice | `/sound/:ph/:id` | M4 | 18 | B | 3 hệ layout chồng; kết quả không giới hạn |
| B4 | PairPractice | `/pair/:id` | ✗ | 17 | **A** | slot chừa trống rồi vẫn tràn; không `ipad:` |
| B5 | StarPractice | `/star/:id` | ✗ (khung M3) | 15 | **A** | **iPad kết quả 959px > 834**; CTA 4 nút |
| B6 | VoicePractice | `/voice/:id` | ✗ (khung M3) | 15 | **A** | **iPad kết quả 1140px > 834**; 14 chip |
| C1 | StoryList | `/stories` | ✗ | 1 | **A** | `grid-cols-3` ô 87px phone |
| C2 | StoryPlayer | `/story/:id` | M6 | 14 | B | LessonChip đè chip cảnh; 9 từ × 64px |
| C3 | StoryQuiz | `/story/:id/quiz` | M6b | 10 | B | thẻ 270×250 cứng; 0 đúng = 1★ |
| C4 | StoryRetell | `/story/:id/retell` | ✗ | 14 | **A** | **0 rule phone**; cuộn qua mic |
| C5 | WordTopics | `/words` | ✗ | 2 | **A** | `grid-cols-3`; chip 22px tràn ô |
| C6 | WordList | `/words/:topic` | ✗ | 5 | **A** | **`grid-cols-4` ô 57px < emoji 64px**; review 64 ô |
| C7 | WordCard | `/words/:t/:w` | M5/M5b | 20+ | B | 2 hàng sticky che; mặt thẻ absolute tràn |
| C8 | SentenceList | `/sentences` | ✗ | 5 | **A** | 32 hàng ≈ 3300px; câu 24px 3 dòng |
| C9 | SentenceBuilder | `/sentence/:id` | ✗ (khung M3) | 14 | **A** | khay lớn dần đẩy mọi thứ; 2 cách ghim đáy |
| P1 | ParentGate | `/parent` (khoá) | ✗ | 5 | **A** | không rule nào; nút 64px trên màn 44px |
| P2 | ParentDashboard | `/parent` (mở) | M8c (~1/3) | **40+** (10 panel) | **A** | iPad dọc 1 cột >4000px; 4 mốc tap; 4 dialog native; không truncate |

Tổng: **33 màn/overlay, ~340 trạng thái**. 19 màn không có design; 6 màn vỡ thật ở iPad hoặc phone (B5, B6, C4, C6, P2, A2).

---

## 3. Chi tiết từng màn

## Nhóm A — Khung app, Home, nhiệm vụ, điều hướng

### A0. AppErrorBoundary — bọc ngoài router — *không có design*
- Fallback khi crash: Foxy `surprised` + H1 40px "Ôi, có lỗi rồi 🦊" + 1 dòng + nút `Về nhà` (lg, xoá lesson, reload về `/`). `h-full justify-center gap-7`, pad 2rem.
- **Vấn đề:** rất trống trên iPad; H1 40px không max-width.

### A1. ProfileGate — bọc ngoài router (không route) — *không có design*
- **Mục đích:** "Ai đang học nào? 👋" — chọn hồ sơ khi mở app lạnh và sau ≥5 phút rời app (chỉ khi ≥2 hồ sơ).
- **Vùng:** `main h-full justify-center px-6` → 1 Card `max-w-md p-6 gap-4`: H1 2xl · "Chạm vào tên của con nhé." (sm) · `ProfilePicker`.
- **Dữ liệu động:** số hồ sơ không giới hạn (lưới 2/3 cột trong thẻ 448px → cuộn); tên hồ sơ không giới hạn độ dài, không truncate; mặc định mọi hồ sơ = `🦊 Bé` nên trùng tên là chuyện thường.
- **Trạng thái:**
  1. 0–1 hồ sơ → không hiện gì (app vào thẳng).
  2. Mở lạnh, ≥2 hồ sơ, chưa chọn → **màn chọn toàn màn hình**, app chưa mount.
  3. Đã chọn trong 5 phút → bỏ qua.
  4. Quay lại sau ≥5 phút ẩn app / bfcache → **overlay `fixed inset-0 z-50`** đè lên app đang chạy (cùng markup).
  5. Chạm hồ sơ đang active → đóng ngay. Chạm hồ sơ khác → **reload toàn trang**.
  6. Storage hỏng/riêng tư/mark lỗi/lệch giờ → hỏi lại.
- **Vấn đề:** không có rule iPad nào (thẻ 448px giữa 1194px); overlay z-50 ngang hàng Toast; hàng lưới cao không đều khi chỉ vài ô có dòng phân biệt.

### A2. CloudStart — `/start` — *không có design*
- **Mục đích:** "Đã dùng Speak Up rồi?" — khôi phục tiến độ lên máy này bằng email OTP hoặc mã khôi phục 8 ký tự. Chỉ tới được từ Home khi có cloud và **chưa có lịch sử nào** trên máy.
- **Vùng:** `main items-center` (không `justify-center` → bám trên) · nút `← Về nhà` 64px · Card `max-w-md p-6 gap-5`: tiêu đề xl + phụ sm · dải info vàng / dải lỗi đỏ · nút "Thử tải lại" (khi pull lỗi) · thân theo stage.
- **Trạng thái (màn nhiều trạng thái nhất app, 28):**
  - Cloud chưa cấu hình → redirect `/`.
  - **menu:** 2 nút (`Tôi có email đã liên kết` primary · `Tôi có mã khôi phục` outline) + link "Bắt đầu mới cho bé".
  - **gate:** `ParentQuestion` + "← Chọn cách khác" (bỏ qua nếu đã pass).
  - **email:** ô email 64px + chú xs + gửi (busy = mờ) + back.
  - **email-otp:** ô 6 số 2xl + "Sửa lại email".
  - **code:** ô 8 ký tự uppercase `tracking-widest` + gợi ý.
  - **abandon** (máy này đang có hồ sơ ẩn danh có dữ liệu): 4 biến thể copy — có số ("{n} hồ sơ, {stars} sao và {events} lượt luyện"), có số + "một phần đã lưu lên máy chủ", 0 sao/0 lượt (copy riêng), chưa kiểm tra được. Nút "Vẫn tiếp tục với {email}" (email thô trong nhãn nút 22px) + huỷ. 2 link tới `/parent`.
  - **Chọn hồ sơ:** tiêu đề "Chọn hồ sơ của bé" + "Tài khoản này có {n} hồ sơ" + `ProfilePicker busy` + dải lỗi trong thẻ.
  - Kết quả đăng nhập: 0 hồ sơ khôi phục được (dải **vàng**, về menu) · đúng 1 → tự khôi phục · ≥2 → chọn · pull lỗi → nút "Thử tải lại" · pull xong → **reload**.
  - Lỗi auth: 7 câu (email sai / chưa cấu hình / máy đang có hồ sơ khác ~150 ký tự / email chưa liên kết / mã sai-hết hạn / mất mạng / chung). Lỗi mã khôi phục: 7 câu (400/401/403/404/409/429/chung). Thêm: chưa có token, roster hỏng (mã không bị tiêu), network throw, fetch null, adopt null.
- **Vấn đề:** 5 link chữ gạch chân đều `min-h-[64px]` → thẻ cao hơn nhìn thấy; `max-w-md` ở mọi width; dải lỗi + nút thử lại nằm **trên** form nên lỗi dài đẩy form xuống; email không `break-all`.

### A3. Home — `/` — *design M1b (phone) + iPad map*
- **Mục đích:** bản đồ đảo — chào, streak, tổng sao, thẻ nhiệm vụ, 8 đảo, vào Speak Lab / phụ huynh.
- **Vùng (phone→iPad):** blob trang trí 300/340px cố định · header (Foxy md + SpeechBubble — phone bỏ chrome bong bóng · `StreakWeek` (chấm 30→24px qua selector con) + pill sao) · banner hết giờ (vàng) · banner mốc "liên kết email" (+ nút ✕ 64px `-my-3`) · banner A2HS iOS (+ ✕) · **khung map:** phone `grid-cols-2` (thẻ nhiệm vụ `col-span-2` trên cùng, H2 "🏝️ Đảo chủ đề", 8 đảo `h-32 md:h-40`), iPad `ipad:block aspect-[1194/834] max-h-[calc(100vh-180px)]` với 8 slot `%` tuyệt đối + SVG đường mòn `preserveAspectRatio=none`, thẻ nhiệm vụ `absolute bottom-2 left-2 w-[min(380px,32%)]` · hàng chân: CTA "🗣️ Các bậc luyện nói" (iPad: giữa đáy), link "Đã dùng Speak Up rồi?" (iPad `bottom-[100px]`), nút phụ huynh (phone: chỉ emoji; iPad: "👨‍👩‍👧 Phụ huynh", góc phải đáy).
- **Dữ liệu động:** đúng 8 đảo (**throw khi thêm đảo thứ 9**); tên đảo dài nhất "Trường học"; tổng sao & streak không giới hạn.
- **Trạng thái:** Foxy/lời chào 3 biến thể (idle / đã học hôm nay `happy` / xong nhiệm vụ `cheer`) · **redirect tự động** sang `/mission/done` lần đầu xong · hết giờ (banner) · banner mốc (cloud + chưa liên kết + streak ≥3 + chưa tắt) · banner A2HS (iOS, chưa cài, chưa tắt) · link khôi phục (cloud + chưa có lịch sử ở mọi hồ sơ) · đảo mở (Link, "Luyện thêm", StarRow) / khoá (🔒 + chip "Chưa mở khóa", `opacity`) · sao đảo 0–3 · iPad thấp <720 bỏ dòng "Luyện thêm", <800 đĩa 11vh · MissionCard 4 trạng thái.
- **Vấn đề:** 2 layout hoàn toàn khác trong 1 DOM; **iPad dọc & tablet 768–1023 nhận layout lưới phone** nhưng nút vẫn nói "Về bản đồ"; 3 số ma thuật (`bottom-[244px]`, `bottom-[100px]`, `100vh-180px`) phải khớp chiều cao header; 3–4 phần tử absolute ở chân không chồng nhau chỉ nhờ độ rộng; thẻ nhiệm vụ trạng thái "xong" **cao thêm 1 dòng** trong slot absolute; nút ✕ banner dùng `-my-3`; 3 banner có thể chồng cùng lúc (không design cái nào); đảo phone `h-32` cố định.

### A4. MissionCard — trong Home
- Card trắng `max-w-md`: "🌞 Nhiệm vụ hôm nay" + đếm `{done}/{total}` (tối đa 16/16) · `ProgressBar h-3.5` · dòng xanh "Hoàn thành! 🎉" (chỉ khi xong) · nút full-width.
- **Trạng thái:** rỗng (0/0, "Bắt đầu ▸") · chưa làm ("Bắt đầu ▸") · đang làm ("Tiếp tục ▸") · xong ("Hoàn thành rồi! 🎉 Chơi lại?" — 22px trong ~320px → **gãy 2 dòng**).

### A5. StreakWeek — trong Home
- Pill trắng: 7 chấm `30px` (nhãn T2…CN 11px trên) + "🔥 {n} ngày" lg. Chấm: xong (vàng ★) / chưa (đứt nét ○) / hôm nay (ring coral) → 4 biến thể. Streak 0 → "🔥 0 ngày".
- **Vấn đề:** kích thước chỉ đổi được từ ngoài qua selector `[&_[data-today]]`; `ring-offset-white` hardcode nền; ~290px rộng ở 30px. Design M1b muốn 7 chấm 14px + "chi tiết khi chạm" (**chưa có design panel đó**).

### A6. DailyMission — `/mission` — *design M2*
- **Vùng:** header (Back → `/`, H1 22→40px, phụ phone-only "5 bước nhỏ — 15 phút thôi!", chip `Bậc ⭐ n` + chip `{done}/{total}`) · lưới nhóm `grow content-center` (phone: hàng `h-[76px]` emoji·tiêu đề·caption·chip; md: thẻ cột; iPad: `grid-cols-{1..5}` theo số nhóm) · chân **sticky** (`-mx-4` + gradient) Foxy + CTA (`CTA_BUTTON` tự viết, không dùng `Button`).
- **Dữ liệu động:** 0–5 nhóm, mỗi nhóm ≤6 mục; tiêu đề tính ("Nghe 1 truyện", "5 thẻ phát âm"…); chip "≈ 24 phút" tối đa.
- **Trạng thái:** rỗng (**không có CTA, không có empty copy**) · chưa làm "Bắt đầu ▸" · đang làm "Tiếp tục ▸" · xong lần đầu → redirect `/mission/done` · xong rồi → CTA thành `Về trang chủ/bản đồ` (secondary lg) · nhóm hiện tại (viền teal 4px + " · bắt đầu ở đây!") · nhóm xong (pill "✓ Xong", vẫn bấm được) · 5 loại nhóm (🎧 teal / 🗣️ coral / 🧩 sun / 🧱 / 🔁) · 1–5 cột.
- **Vấn đề:** hàng phone `h-[76px]` cố định, truncate gánh; viền 4px nhóm hiện tại **bên trong** chiều cao cố định; 1–2 nhóm thì thẻ lơ lửng giữa màn phone (band trống trên/dưới); CTA copy style thủ công (`md:min-h-[72px] md:text-[26px]`); sticky `-mx` phải khớp `px` root.

### A7. MissionComplete — `/mission/done` — *design M8b*
- Cột giữa `h-full justify-center gap-4/5`, gradient nền: Confetti · Foxy `cheer` 145/155px · H1 30→52px · pill sao "+{n} ⭐" 2xl→30px · "🔥 Chuỗi {n} ngày liên tiếp — giỏi lắm!" · nút `Về trang chủ/bản đồ` (secondary lg).
- **Trạng thái:** **không có nhánh nào trong JSX** — chỉ dữ liệu: `+0 ⭐` và `Chuỗi 0 ngày` đều có thể xảy ra, không có variant. Vào bằng URL trực tiếp cũng render.
- **Vấn đề:** stack tinh chỉnh tay cho 667px, thêm 1 phần tử là vỡ; H1 52px không max-width; design M8b muốn hàng 7 chấm tuần 34px (chưa làm).

### A8. TopicHub — `/topic/:id` — *design M8*
- **Vùng:** dải teal `absolute` phone-only cao `calc(180px + safe-top)` bo đáy 40 · Back (phone 64px teal) · header: đĩa trắng 92px emoji (md: emoji 64px không đĩa), tên 30→40px (trắng trên phone), StarRow, phone-only "Đảo số {n} · Luyện thêm nhé!" · 3 hàng `SECTION` `min-h-[84px]/[96px]` `flex-wrap`: Từ mới `x/8` · Câu `x/4` · Truyện (0..n) — mỗi hàng emoji·tiêu đề·đếm·`TodayChip`·StarRow·chevron (phone). Cột `max-w-3xl`.
- **Dữ liệu động:** truyện/đảo = 0, 1 hoặc 2 (**5/8 đảo không có truyện**); `titleVi` + `title` không truncate.
- **Trạng thái:** id lạ / đảo khoá → `LockedTopic` (🔒 96px + "Chưa mở khóa" 40px + Back) · hàng có trong nhiệm vụ hôm nay (viền teal 3px phone + chip "Có trong nhiệm vụ hôm nay") · không truyện → thẻ mờ chip "Sắp có 📖" · sao 0–3 mỗi hàng/đảo.
- **Vấn đề:** dải teal decor và nội dung header là 2 số độc lập phải khớp (chữ trắng chỉ đúng khi dải đủ cao); `flex-wrap` phone → tiêu đề truyện dài nhân đôi chiều cao hàng, `md:flex-nowrap` bỏ van an toàn đúng lúc chip to lại; không có rule `ipad:`; **CTA ghim đáy "Học tiếp: …" trong design M8 chưa làm**.

### A9. LevelStairs — `/levels` — *design M7*
- **3 layout:** phone cột zigzag ngược (`flex-col-reverse`, `self-start/end`, tile `h-[84px] w-[236px]`, SVG đường mòn `viewBox 0 0 350 560` công thức `y=504−i·112`, **root `max-md:overflow-hidden` = không cuộn được**, CTA ghim đáy "Luyện bậc {n}: {tên} {emoji}") · md `grid-cols-2` tile `h-[180px]` · iPad `grid-cols-5` chéo bằng **5 `ipad:mt-[240/180/120/60/0px]`**. Header: H1 2 cách viết ("Các bậc luyện nói 🗣️" phone / "Speak Lab 🗣️" md). Blob 320px md+.
- **Dữ liệu:** đúng 5 bậc, tất cả mở (trạng thái khoá "Sắp có" **không tới được** với dữ liệu hiện tại).
- **Trạng thái:** bậc mở / khoá · Foxy đứng ở bậc đầu tiên <3★ (hết 3★ → bậc cuối), tile đó ring teal + `animate-bob` · tag phone "ĐANG HỌC" / "✓" / rỗng · sao 0–3 (5 reducer khác nhau) · CTA có/không.
- **Vấn đề:** 5 margin ma thuật không liên hệ chiều cao viewport (iPad ngang thấp mất 1/3 band cho `mt-240`); phone clip nếu không vừa; SVG `preserveAspectRatio=none`; đường mòn và tile ghép bằng công thức chứ không bằng layout.

### A10–A14. Năm màn danh sách bậc — *không có design* (cùng 1 shell gần y hệt)
Shell chung: `main px-6` · cột `max-w-5xl gap-5` · Back `self-start` (LevelSelect thêm pill "🗣️ Xem các bậc" 64px) · header giữa H1 **40px** + phụ lg · lưới `CARD_LINK` (`p-6 rounded-xl3 shadow-card`) + StarRow. **Không có rule phone/iPad nào** — chưa qua Phase 10.
| Màn | Route | Số ô | Ô gồm | Cột |
|---|---|---|---|---|
| A10 LevelSelect (Word Pop) | `/level/word-pop` | 12 | emoji 56px · từ 2xl · sao | 2 / md 3 / lg 4 |
| A11 SoundLevel (Tập âm) | `/level/sound-zoo` | 9 | `/ipa/` 56px coral · từ ví dụ 2xl · sao (= min 3 từ) | 2 / md 3 (`min-h-[168px]`, hàng cuối lẻ) |
| A12 PairLevel (Nghe & chọn) | `/level/minimal-pairs` | 8 | emoji 34 + từ 26 / "/" / emoji + từ · chip contrast `ɪ/iː` · sao | **1** / md 2 / lg 4 |
| A13 StarLevel (Sentence Stars) | `/level/sentence-stars` | 10 | câu EN 26px (gãy 2 dòng) · nghĩa VI base · sao | **1** / md 2 / lg 3 (hàng cao không đều) |
| A14 VoiceLevel (Story Voice) | `/level/story-voice` | 8 | emoji mood 56px · chip mood coral · câu đầu 22px · sao | **1** / md 2 / lg 3 |
- **Trạng thái chung:** chỉ 1 (lưới) + sao 0–3/ô. LevelSelect id lạ → **`<p>Không tìm thấy</p>` trần, không shell, không back**. Không có empty state.
- **Vấn đề:** phone `grid-cols-1` → 8–10 thẻ `p-6` xếp dọc rất dài; H1 40px ở 320px; emoji 56px chiếm gần hết ô 2 cột; `max-w-5xl` (1024) ≠ 1194 của Home; 5 bản sao shell nên gộp 1.

### A15. LessonChip — overlay toàn app
- `fixed z-40`: phone = tròn 64px góc **trên phải** (🌞 + "{n}/{n}" 13px), md+ = pill góc **dưới phải** "🌞 Nhiệm vụ {done}/{total}" → `/mission`.
- **Trạng thái:** ẩn ở `/`, `/mission*`, `/parent*`, khi lesson xong, khi đang ở đúng route mục nhiệm vụ (trừ `/story/:id/quiz|retell`), khi luyện tự do · hiện phone / hiện md.
- **Vấn đề:** dựa vào **hợp đồng ngầm** mọi màn luyện chừa gutter `min-w-[66px]` góc phải; tự thừa nhận che "Cảnh 2/4" và badge engine của StoryPlayer 53–86% thời gian; lặp lại biểu thức safe-area thay vì dùng `PAGE_SHELL`.

### A16. Toast — overlay
- `fixed top-6 z-50` pill đen chữ kem lg, **không max-width** (tin dài tràn đối xứng 2 mép, không cuộn được), **`top-6` chui dưới notch** (không dùng safe-area), z ngang ProfileGate overlay. 2 trạng thái: null / có tin.

### A17. HomeLabel / BackButton mdLabel
- "Về trang chủ 🏠" (<768) / "Về bản đồ 🏝️" (≥768) — nhưng bản đồ thật chỉ có ở `ipad:` (≥1024 ngang) → **tablet 768–1023 và iPad dọc hứa "bản đồ" nhưng nhận lưới**.

## Nhóm B — Sáu màn luyện nói (khung M3/M3b/M4)

Khung chung cả 6 màn: `main h-full overflow-y-auto px-5 md:px-6` · cột `max-w-5xl` (**1024 — iPad 1194 dư 85px mỗi bên**) `min-h-full items-center` · header 3 ô: `BackButton` 66×66 · cụm giữa (chip đếm + chấm) · **ô phải `min-w-[66px]` chừa cho LessonChip** (hiện badge "chế độ đơn giản" khi Web Speech) · thân · dòng lỗi · khối mic `mt-auto`. Query thô `[@media(max-width:767px) and (max-height:700px)]` dùng 3–7 lần/màn để **xoá bớt nội dung** trên phone thấp. Không màn nào dùng sticky.

### B0. Vòng đời một lượt nói (chung cho mọi màn) — *design chỉ vẽ 3 phase ready/rec/result*
1. **Chờ scorer** (0–3s đầu): mic `disabled` mờ 50%, vẫn 🎤 — không phân biệt được với idle.
2. **Idle** — mic 🎤 150px + "Chạm để nói nào!" (ẩn phone thấp).
3. **Đang kiểm tra Azure sau khi bấm** — mic ⏳ mờ.
4. **Đếm ngược + ghi** — mic 190px ⏹ + 2 vòng halo `animate-ring` + glyph scale theo âm lượng; số đếm 6→1 (VoicePractice **13→1**, hai chữ số) 44→56px coral; Foxy `listening` "Foxy đang lắng nghe…"; văn bản mục tiêu mờ `#D9C9AE` (PairPractice giữ nguyên màu).
5. **Đang chấm** — **không có màn riêng**: deck idle hiện lại (SoundPractice: ô từ *xuất hiện trở lại* trong lúc chờ, tối đa 15s), chỉ mic ⏳ là tín hiệu.
6. **Kết quả** — Stars (animate) · Foxy + câu · `ScoredWords` · `HintCard` · hàng nghe (`🎧 Nghe mình` chỉ khi có blob = **chỉ Azure**, `🔊 Nghe mẫu`) · `ScoreBars` · hàng CTA (`↻ Thử lại` + primary). 3★ → `Confetti fixed inset-0 z-50` 2s.
7. **Băng kết quả:** ≥80 → 3★ "Tuyệt vời!" Foxy `cheer` · ≥60 → 2★ "Tốt lắm! Sửa một chút nhé" `happy` · <60 → 1★ "Thử lại nào!" `idle`. **Khác nhau chỉ ở số sao + confetti + mood Foxy**; màu chip theo từng từ.
8. **Lỗi** — 1 dòng đỏ xl trên mic, **chỉ 3 câu cho ~12 nguyên nhân:**
   - "Bé cho phép dùng mic nhé! 🎤" (mic từ chối / không thiết bị / Web Speech start lỗi)
   - "Không nghe rõ, bé thử lại nhé!" (Azure NoMatch / timeout 15s / hết hạn token / **quota 401-429** / payload lỗi / decode lỗi)
   - "Trình duyệt này chưa hỗ trợ nhận dạng giọng nói" (chỉ tới được khi Azure đã hỏng + không có webkitSpeechRecognition → **kẹt vĩnh viễn**, mic vẫn bấm được)
   - **Không có thông báo nào** cho: offline, token endpoint hỏng, captive portal → âm thầm rớt xuống Web Speech, tín hiệu duy nhất là badge xám 15 ký tự góc phải.
   - Web Speech nghe không ra gì → **không phải lỗi**, trả kết quả 1★ mọi chip đỏ.
9. **Chế độ đơn giản (Web Speech) khác gì trên màn:** badge "chế độ đơn giản"; chip từ **chỉ xanh/đỏ** (điểm 0/100, không có amber); bar "Ngữ điệu —" 0%; `ProsodyChip` xám "Chưa chấm được ngữ điệu"; HintCard luôn tip chung, không có `(âm "…")`; **mất nút 🎧 Nghe mình** → hàng CTA đổi bố cục; SoundPractice **không thể 3★**, VoicePractice **tối đa 2★**.
10. **Không có trạng thái "hết giờ hôm nay"** ở màn luyện nào (chỉ Home có banner).
11. **Not-found** cả 6 màn: `<p>` trần không shell không back ("Không tìm thấy thẻ/âm/cặp từ/câu/đoạn").

### B1. PracticeCard — `/practice/:cardId` (Sound Zoo 27 thẻ · Word Pop 12 thẻ) — *design M3/M3b*
- **Vùng:** header (Back → `/mission` hoặc `/level/{id}`; đếm `n/N` + hàng chấm `h-4` **chỉ khi ≤12 thẻ và không trong nhiệm vụ**; badge) · **deck 3 ô:** thẻ emoji `h-[96px]`→`md 220×220` emoji 56→104px · từ 64px + IPA + `SAMPLE_CHIP` (nút tự chế 64px teal, không dùng `Button`) · ô khẩu hình `h-16`→`md 220×220` (**ẩn hẳn phone thấp**) · hàng streak Word Pop (● ○ 2xl, luôn hiện kể cả khi ghi/kết quả) · lỗi · mic.
- **Trạng thái riêng:** Word Pop ẩn IPA sau nút mờ "Xem phiên âm" (reset mỗi thẻ) · **Word Pop streak:** sao kẹt ≤2 tới khi 2 lần liên tiếp ≥80, lần thắng thay câu "Nói đúng 2 lần liên tiếp! 🎉" · **CTA gate:** <3★ và <3 lần → **chỉ `↻ Thử lại`** (hàng 1 nút), sau đó 2 nút (`flex-[1.35]`) · chạm chip từ → phát mẫu · "Chưa có audio mẫu" (idle + kết quả) · thẻ cuối → "Hoàn thành 🎉" về `/level/{id}`.
- **Vấn đề:** không có `ipad:` (cột đơn lớn dần trên iPad); deck ~700px trong cap 1024 → trống giữa; 2/3 ô deck biến mất trên phone thấp = bài học khác hẳn; `SAMPLE_CHIP` copy y nguyên sang SoundPractice; hàng CTA đổi độ rộng theo engine.

### B2. SoundWordList — `/sound/:ph` (9 âm × 3 từ) — *không có design (Q19)*
- **Vùng:** Back → `/levels` hoặc `/mission` · header: phone = thẻ cam `#FFF1E6` (IPA 40px `#C08457` + nút loa tròn 64 + tip), md = tan thành text giữa (IPA 72px coral, loa có nhãn, `md:order-1..4`) · "Chọn một từ để luyện nhé!" · lưới **luôn đúng 3 ô** (`grid-cols-1 md:grid-cols-3`, ô `min-h-[96px]/[184px]`: emoji 40→64 · từ 22→28 · IPA · sao).
- **Trạng thái:** not-found · thường · vào từ nhiệm vụ cũ (Back = "Nhiệm vụ") · "Chưa có audio âm này" (phone chiếm 1 dòng mới) · tip có/không · sao 0–3. Không mic, không lỗi, không "xong cả 3".
- **Vấn đề:** cột không `min-h-full`/`flex-1` → iPad dồn trên, trống dưới ~400px; 3 ô rộng ~330px cho 1 từ; `md:contents` + 4 `md:order` đảo thứ tự đọc giữa phone/iPad; `CARD_LINK` bị call-site đè `max-md:flex-row`; header là thẻ trên phone, không là gì trên iPad.

### B3. SoundPractice — `/sound/:ph/:cardId` — *design M4 — màn tham chiếu Phase 10*
- **Vùng:** header (chip teal `Âm n/N`, chip coral `Từ n/3` **chỉ khi ghi/kết quả**, 3 chấm) · **iPad tách 2 cột:** trái `teach-col` (tầng âm: thẻ cam phone / `md:contents` — chip khẩu hình 64px `md:hidden`, IPA 40→72px, loa, tip; tầng từ: emoji 76→84px, `SAMPLE_CHIP`, từ 42→56px, IPA, chip `Từ n/3`, `order-1..5`) · phải `do-col` **`ipad:w-[400px]` cứng**: ô khẩu hình `168×200` (md+) / đếm ngược / kết quả · lỗi · mic.
- **Kết quả riêng của màn (chấm âm, không chấm từ):** `SoundChip` **4 tone**: good ≥80 ✓ xanh · ok 60–79 ～ vàng · fix <60 ✗ đỏ · **unknown** trắng "?" + câu — **2 copy khác nhau theo engine** (Web Speech: "Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!" · Azure không bắt được âm: "Chưa nghe rõ âm này — thử lại nhé!") — *nơi duy nhất trong app phân biệt engine bằng chữ* · tip 👅 giấy vàng khi tone ≠ good · dòng "Từ {word} · N điểm" (điểm **từ**, ngay dưới chip nói âm chưa chấm) · thẻ sao phone 1 hàng (`Stars sm` + câu: 3 "Từ này tuyệt lắm!" / 2 "Gần được rồi, luyện thêm nhé!" / 1 "Nghe mẫu rồi thử lại nhé!") · sao: <60→1, âm ≥80→3, còn lại 2; `best` chỉ tăng · Confetti 3★ · CTA luôn 2 nút (không gate), từ cuối "Hoàn thành 🎉" về `/sound/:ph`. Không có `ScoredWords`, không `ScoreBars`.
- **Vấn đề:** 3 hệ layout chồng nhau (phone / `md:contents` tan thẻ / `ipad:` đóng hộp lại) — comment 38 dòng giải thích; `order-1..5`; query thấp-phone 7 lần xoá IPA từ + caption mic; 2 quy ước CTA phone khác nhau trong 1 file; **kết quả không phải vùng cuộn có giới hạn** (khác 3 màn kia) → CTA bị đẩy; chữ khổng lồ 72/84/56px.

### B4. PairPractice — `/pair/:id` (8 cặp) — *không có design (Q19)*
- **Vùng:** header (chip coral `Cặp n/8` + chip teal sm contrast `ɪ/iː`) · **pha nghe:** prompt · nút `🔊 Nghe` secondary lg (`px-12 text-[30px]`) · 2 ô `OPTION` `min-h-[150px]`→`md 240×220` (emoji 56→96, từ 26→44) · **ô phản hồi chừa sẵn `min-h-[64px]/[80px]` trống** · dòng tick "ship ✓ · sheep ○" · **pha nói:** Card tóm tắt 1 dòng ("Nghe & chọn: …" — ẩn phone khi có kết quả) · mục tiêu "ship, sheep" 30→44px · lỗi · mic.
- **Trạng thái:** not-found · nghe chưa bấm loa (ô mờ `disabled`, loa `pulse`, "Bấm 🔊 trước nhé") · đã phát (ô bật, slot trống) · **đúng** (✅ 34→44 + Foxy `happy` "Đúng rồi! 🎉", ô tắt lại) · **sai** (🙈 + Foxy `surprised` "Nghe lại nhé" + dòng 2 "Bấm 🔊 nghe lại nhé" — **duy nhất 2 dòng → tràn slot chừa**) · cả 2 tick → pha nói (không quay lại) · nói idle · ghi (đếm ngược **dưới** mục tiêu, mục tiêu giữ màu) · kết quả (Stars animate **chỉ 3★**, câu, 2 chip, Hint, `🎧 Nghe mình` **nằm trong vùng cuộn** chứ không ở hàng CTA) · CTA luôn 2 nút · Web Speech: 2 chip cùng xanh hoặc cùng đỏ. Mic **không render** trong pha nghe. "Chưa có audio mẫu" chỉ ở pha nghe.
- **Vấn đề:** 2 slab cố định; slot chừa trống rồi vẫn tràn; tick in 2 chỗ; call-site đè `px`/`text` của `size=lg`; không `ipad:` → cột ~700px trong cap 1024, chiều cao thừa.

### B5. StarPractice — `/star/:id` (10 câu, ≤6 từ) — *không có design (khung M3/M3b)*
- **Vùng:** header 1 chip `Câu n/10` · **iPad tách:** trái: `StressedSentence` (nhấn 32→48px coral, thường 27→40, `‿` teal) + nghĩa VI sm→lg + chú "Chữ cam = nhấn mạnh · ‿ = nối âm" (ẩn phone thấp) + `🔊 Nghe mẫu` + Card nhịp `max-w-2xl` (1 chấm/từ: nhấn 24px coral, thường 12px teal, `animate-beat` theo `--beat`, re-key mỗi lần phát) · phải `ipad:w-[400px]`: ô chừa `min-h-[112px]` "Nói cả câu một hơi nhé!" (ẩn phone thấp → ô 112px rỗng) / đếm ngược / kết quả.
- **Kết quả:** phone ẩn toàn bộ cột trái, iPad giữ; vùng cuộn phone + `ipad:overflow-y-auto`, **md: không giới hạn**. Thứ tự: Stars (animate 3★) · câu ("Tuyệt vời!" / "Hay lắm!" / "Thử lại nhé" — **khác** câu `toFeedback`) · **dòng nhịp** 3 băng ("Nhịp: 🎵 tốt" / "Nhịp: 🙂 khá — nói liền hơi hơn nhé" / "Nhịp: 🐢 chậm") · `ScoredWords` · `ScoreBars` · Hint. Sao: 3 cần accuracy ≥80 **và** fluency ≥80 **và** completeness ≥80; 2 cần acc ≥60 & comp ≥60 → **chip toàn xanh nhưng 1★ có thể xảy ra**. **Hàng CTA tới 4 nút** (`🎧 Nghe mình` · `🔊 Nghe mẫu` · `↻ Thử lại` + primary full-width hàng riêng); mất `🎧` trên Web Speech → 3 nút.
- **Vấn đề:** 4 max-width khác nhau trên 1 màn (5xl/3xl/2xl/xl); hàng chấm không wrap; inline style mỗi chấm; `result-readout` mang `max-md:*` + `md:contents` + 8 `ipad:*` cùng lúc; câu 6 từ 48/40px ≈ 700px vừa khít cap iPad; **iPad kết quả 959px > 834** (đã ghi nhận README).

### B6. VoicePractice — `/voice/:id` (8 đoạn, ≤14 từ) — *không có design (khung M3/M3b)*
- **Vùng:** header 1 chip `Đoạn n/8` · trái: mood (emoji 38→56 + "Đọc với giọng: {moodVi}" lg→2xl) · `Passage` 24→34px (**>12 từ dùng `lg:text-[30px]` — `lg:` duy nhất trong nhóm**; `!`/`?` cuối câu tô coral) + nghĩa VI ≤94 ký tự `max-w-2xl` + `🔊 Nghe mẫu` · Card tips 3 dòng 13→14px (**ẩn phone thấp**) · phải `ipad:w-[400px]`: ô chừa 64px "Đọc cả đoạn thật có hồn nhé!" / đếm ngược **13→1** / kết quả.
- **Kết quả:** `ProsodyChip` **đầu tiên** (good/ok/fix/none xám) · Stars · câu ("Đọc có hồn quá!" / "Hay lắm!" / "Thử lại nhé") · `ScoreBars` · `ScoredWords` (**tới 14 chip 64px ≈ 5 hàng ≈ 370px phone**) · Hint. Sao: Web Speech/không prosody → **tối đa 2**; Azure: prosody ≥80 & acc ≥70 → 3, prosody ≥60 → 2. CTA 3+1 như B5.
- **Vấn đề:** vùng kết quả lớn nhất app, xử lý bằng scroller chứ không bằng design; **iPad kết quả 1140px > 834** (README); thứ tự `ScoreBars`/`ScoredWords` ngược với B5; `gap-2` chặt hơn mọi màn anh em; 4 chế độ cỡ chữ (phone/md/lg/ipad) trên 1 phần tử.

### B7. Component dùng chung trong luyện nói
| Component | Biến thể / trạng thái | Ghi chú layout |
|---|---|---|
| **MicButton** | `idle` 150px 🎤 · `recording` 190px ⏹ + 2 halo + scale theo level · `processing` 150 ⏳ mờ · `disabled` 150 🎤 mờ (giống idle trừ opacity) | **Không có class responsive nào**; bóng `0 10px 0 + ring 12px` → 174/214px thật; design phone muốn 124 (Q6 chưa chốt) |
| **ScoreBars** | 4 bar cố định: Chính xác · Trôi chảy · Đầy đủ · Ngữ điệu; `null` → 0%, nhãn "Ngữ điệu —" | phone `grid-cols-2`, md `flex` bar `w-[130px]` cố định |
| **ScoredWords** | 3 tone: good ✓ xanh · ok ～ vàng · fix ✗ đỏ; mỗi chip là `<button>` 64px, chữ 2xl→34px | `flex-wrap`; chỉ PracticeCard có `onWordTap`, còn lại nút không làm gì |
| **ProsodyChip** | good / ok / fix / **none** (xám "Chưa chấm được ngữ điệu") | 64px, chữ 20→30px |
| **StressedSentence** | từ nhấn coral 32→48 · thường 27→40 · `‿` teal 22→32 | 1 aria-label cho cả dòng |
| **HintCard** | 1 biến thể: giấy vàng 👅 28→44px, "Sửa từ này: {word}" + ` (âm "…")` tuỳ chọn | `max-w-xl`, không bao giờ ẩn |
| **Foxy** | mood `idle / listening / happy / cheer / surprised`; size `sm 64 / md 96 / lg 160` **px cứng**; `say` → SpeechBubble `max-w-[280px]` | aria-hidden |
| **SpeechBubble** | 1 biến thể, title xl + subtitle sm | không responsive |
| **Stars** (practice) vs **StarRow** (list) | **2 component sao gần trùng**: Stars `sm 36→40px / md 36→58px` stagger 0.22s; StarRow `xl/3xl/5xl` stagger 0.15s | cần gộp |
| **SceneDots** | pill trắng chấm 10px, active coral | chỉ StoryPlayer dùng; PracticeCard/SoundPractice tự vẽ chấm 16px 3 trạng thái (qua/hiện/tới) |
| **Confetti** | `fixed inset-0 z-50` 1.6s | đè mọi thứ |
- **Lặp code:** `CTA_PHONE` định nghĩa y nguyên trong 4 file, `CTA_IPAD` 2 file, `SAMPLE_CHIP` 2 file, countdown effect + khối mic + dòng lỗi lặp 5 lần — không có component "khung luyện nói" dùng chung dù design gọi M3/M3b là "khung chung 5 loại bài".

## Nhóm C — Truyện, từ vựng, ghép câu

Số liệu nội dung (trường hợp xấu nhất layout phải chịu):
- **Truyện:** 3 (🦊 The Little Fox 7 cảnh · 🦁 At the Zoo 6 · 🥞 My Breakfast 6), mỗi truyện 3 câu quiz × 3 lựa chọn. Dòng karaoke dài nhất **9 từ / 40 ký tự**; phụ đề VI dài nhất 59 ký tự. **Mọi cảnh chưa có ảnh** (`image: undefined`) → luôn là emoji 160px trên nền gradient. Câu kể lại dài nhất 21 ký tự.
- **Từ:** 8 chủ đề × 8 = 64 từ; dài nhất `elephant`; nghĩa VI dài nhất "màu xanh dương"; IPA 10 ký tự; câu ví dụ 22 ký tự.
- **Câu ghép:** 32 (4/chủ đề), 3–6 ô; 2 câu 6 ô; prompt VI dài nhất 36 ký tự; `s31` có 2 ô "The"/"the" (đổi chỗ = sai, xoá cả khay).
- Không màn nào trong nhóm này có `Confetti`.

### C1. StoryList — `/stories` — *không có design (Q19)*
- Back "Về nhà" · H1 40px "🎧 Nghe kể chuyện" · **`grid-cols-3` cố định mọi width** (ô `CARD_LINK p-6`: emoji 72px · tên EN 26px · tên VI lg · StarRow).
- **Trạng thái:** chỉ sao 0–3/ô. Không loading/rỗng/khoá (truyện không bao giờ khoá). Vào truyện từ đây = luôn tự do (không mang mission state).
- **Vấn đề:** phone 375px mỗi ô ~87px chứa emoji 72 + chữ 26px → nội dung rộng hơn ô; `gap-6`; H1 40px.

### C2. StoryPlayer — `/story/:id` — *design M6*
- **Vùng:** `main px-3.5 md:px-4` **không có max-width** (desktop tràn mép) · header title+titleVi **chỉ md+** (phone không có tên truyện) · **tranh** `aspect-[16/9] flex-none` phone / `md:max-h-[52vh] flex-1`: `SceneArt` gradient + emoji 160px, **3 overlay absolute** trên tranh: Back (phone 64px) góc trái, chip "Cảnh N/M" (số **chỉ hiện phone**, md `sr-only`) + `SceneDots` (md+) góc phải, pill gợi ý chạm (md+) góc phải dưới · thanh tiến trình phone-only 11px (tự vẽ, không dùng `ProgressBar` vì tránh gradient) · dòng gợi ý phone cao · `Karaoke` (từ active 28→44px coral / đã đọc 21→32 xám `#CDBFA9` / chưa 21→32 ink; **mỗi từ `min-h-[64px] min-w-[64px]`** → 9 từ chắc chắn 2–3 dòng; phụ đề VI dưới) · dòng trạng thái audio · `PlayerControls` (play 96→104px, 2 nút bước 64px, 🐢/🐇, `Toggle` phụ đề 58×32) · CTA chân.
- **Trạng thái:** not-found (nút "← Nhiệm vụ"/"← Truyện") · nhiệm vụ vs tự do · cảnh N/M · **chưa bắt đầu** (không từ nào sáng) · playing ❚❚ / paused ▶ · tự chuyển cảnh · **ended** → CTA đổi từ ghost "Bỏ qua ▸" sang primary pulse "Tiếp tục ▸"; ▶ khi ended = phát lại từ đầu · chạm từ = phát lại từ đó · tốc độ 1 ↔ 0.75 (ring peach trên 🐢/🐇) · phụ đề bật (mặc định **bật**) / tắt · **không có timing** → "Chưa có giọng đọc — chữ chạy theo nhịp ước lượng" · **audio lỗi / autoplay bị chặn iOS** → "Không phát được giọng đọc" · **Không có toggle nhạc nền** (design M6 vẽ có — Q12) · không có loading ảnh.
- **Vấn đề:** `LessonChip` fixed góc phải trên **đè chip "Cảnh N/M"** trên phone (code tự nhận); 2 mô hình kích thước tranh khác nhau phone/md; emoji 160px gần đầy hộp 204px; hex ngoài token (`#F1E7D4`, `#CDBFA9`, `#1FA396`); `PlayerControls` sống sót ở 390px nhờ `order-1/2/3`; design M6 vẽ 6 từ vừa 2 dòng, code 9 từ × 64px không thể (Q11).

### C3. StoryQuiz — `/story/:id/quiz` — *design M6b*
- **Màn hỏi:** header (`BACK_LINK` pill tự chế "← Truyện" — màn duy nhất không dùng `BackButton` + chip teal "Câu N/3") · hàng câu hỏi `max-w-3xl`: Foxy md + SpeechBubble (md+) · bong bóng trắng: câu EN 19→30px, VI 14→lg, nút 🔊 64px · **3 thẻ đáp án**: phone cột `flex-1 min-h-[96px]` full-width, md **`h-[270px] w-[250px]` cứng** hàng ngang; emoji **64→110px**, nhãn lg→xl, badge góc phải 3xl→4xl · **slot banner cố định `h-[46px]/[60px]`** (chừa để thẻ không nhảy).
- **Trạng thái hỏi:** idle (shadow thường) · **đúng** (shadow xanh 2 lớp hex + ✅ + Foxy `happy` + bubble "🦊 Đúng rồi!" md + banner xanh "Đúng rồi! Giỏi quá! 🎉", **tự chuyển sau 900ms**, khoá chạm) · **sai** (shadow đỏ + 🙈 + Foxy `surprised` + banner vàng "Gần đúng rồi — thử lại nhé! 💪", **không tự chuyển, không lộ đáp án đúng**, câu đó mất điểm lần đầu) · sang câu tiếp.
- **Màn kết quả** (`main` riêng, `justify-center`): Foxy lg + StarRow lg + "Bé trả lời đúng N/3" 2xl + 3 nút lg (`CTA_PHONE` full-width phone / hàng md): "Kể lại câu chuyện →" primary · "Nghe lại" outline · "Về nhiệm vụ →" secondary hoặc `HomeLabel`. Sao: 3 đúng → 3★ Foxy `cheer` animate · 2 → 2★ `happy` · **1 hoặc 0 đúng → đều 1★** ("…0/3" vẫn 1 sao đầy).
- **Vấn đề:** `/3` hard-code 2 chỗ + thang sao; 2 shadow hex đa lớp ngoài token; bubble Foxy `max-md:hidden` trùng nội dung banner; kết quả `justify-center` + 3 nút lg full-width có thể vượt phone thấp; đáp án là emoji, design M6b vẽ ảnh 170px (Q14).

### C4. StoryRetell — `/story/:id/retell` — *không có design (Q19)*
- **Vùng:** cột `max-w-4xl gap-4` · header: Back · **H1 36px "Bé kể lại nhé"** · gutter engine 66px · Card `max-w-2xl px-8 py-7`: câu EN **40px** + VI xl + nút 🔊 64px teal · lỗi 2xl · kết quả (Stars md · câu 3xl · hàng CTA) · hàng mic: Foxy sm + MicButton 150/190.
- **Trạng thái:** not-found · mic 4 trạng thái · lỗi 3 câu · **băng kết quả riêng, rất dễ:** ≥60 → 3★ "Tuyệt vời! 🦊" `cheer` animate · 35–59 → 2★ "Hay lắm!" `happy` · <35 → 1★ "Bé kể tốt lắm, thử lại nhé!" `idle` · `🎧 Nghe mình` chỉ khi có blob · "Thử lại" · CTA thứ 3 ba biến thể ("Tiếp theo →"/"Về nhiệm vụ →"/"Hoàn thành 🎉" hoặc "Về danh sách truyện") · mẫu: mp3 cảnh → TTS → im lặng (**không có dòng "chưa có audio"**) · badge engine · ghi 8s (khác 6s mặc định).
- **Vấn đề:** **không có 1 rule `md:`/`max-md:` nào** — phone nhận nguyên layout iPad (câu 40px, H1 36px gãy 2 dòng cạnh gutter 66px, mic 150–190); kết quả + 3 CTA nằm **trên** mic trong flow → trang cuộn qua mic; gutter 66px chừa trống ngay chỗ LessonChip đậu.

### C5. WordTopics — `/words` — *không có design (Q19)*
- Back "Về nhà" · H1 40px "Từ mới hôm nay 🧩" + phụ lg · **`grid-cols-3` cố định**: ô đầu luôn là Ôn tập (📚 64px + `Chip sun` 22px "Ôn tập hôm nay (N)", N 0–64) · 1 ô/chủ đề **đã mở** (emoji 64 · tên 26px · "N/8 đã mở khoá" lg).
- **Trạng thái:** 4–8 chủ đề (khoá = **vắng mặt**, không có ô khoá) · chip ôn tập (0) không style riêng, vẫn bấm được · "0/8…8/8" chữ thường, không bar/sao/xong.
- **Vấn đề:** chip 22px 22 ký tự trong ô ~87px phone; H1 40px; không rule responsive.

### C6. WordList — `/words/:topic` và `/words/review` — *không có design*
- Back (review → `/words` "Từ vựng"; chủ đề → **`/topic/:id`** đảo, không về `/words`) · H1 40px emoji + tên · **`grid-cols-4` cố định** ô `CARD_LINK`: emoji 64 · từ 24px · `Chip` 🔓 (sun) / 🔒 (neutral).
- **Trạng thái:** review / chủ đề / not-found (guard có Back) · **rỗng** chỉ ở review: "Chưa có từ cần ôn hôm nay 🎉" · khoá/mở mỗi từ (**ô khoá vẫn là Link**, khoá chỉ trang trí) · không sao.
- **Dữ liệu:** chủ đề = 8 ô (2 hàng); **review tới 64 ô = 16 hàng** không ảo hoá.
- **Vấn đề:** ô ~57px ở 375px chứa emoji 64px — **tràn nặng nhất nhóm**; không rule responsive.

### C7. WordCard — `/words/:topic/:wordId` — *design M5 + M5b — màn nhiều trạng thái nhất nhóm*
- **Vùng:** header: Back (3 đích: `/mission` "Nhiệm vụ" / `/words/review` "Ôn tập" / `/topic/:id` tên đảo) · chip teal "Từ mới N/M" hoặc "Ôn tập N/M" · H1 30px **ẩn phone** · dòng gợi ý sm→lg · gutter engine.
- **Nhánh A — Đoán nghĩa (M5b)** (chỉ khi từ mới, box 0, đọc 1 lần khi mount): emoji 74→96px (56 phone thấp) · từ 40→44px · "Từ này nghĩa là gì?" (ẩn phone thấp) · **3 nút outline**: phone hàng full-width 76px có emoji 32px dẫn đầu, md pill `min-w-[160px]` **không emoji** · Foxy sm · CTA **sticky bottom** "Tiếp theo →" (chỉ khi đúng).
  - Trạng thái: idle · **sai** (`animate-shake` 400ms, Foxy `surprised` "Thử lại nhé", thử vô hạn, không phạt) · **đúng** (viền xanh + ✅ + Foxy `happy` "Đoán đúng rồi! 🎉" + CTA hiện; chờ bé bấm — quyết định Phase 10 #3).
- **Nhánh B — Thẻ lật (M5) + nói:** shell `aspect-[16/17] w-[min(320px,82%)]` phone (68% phone thấp), md `320×360` → **`320×300` khi có kết quả** (phone cố ý không đổi cỡ) · 2 mặt absolute 3D `rotateY`:
  - **Mặt trước, từ mới:** emoji 90px (64 phone thấp) · từ 38→44px · IPA base→xl · nút 🔊 64px.
  - **Mặt trước, ôn tập chưa gợi ý:** nghĩa VI + `?` + nút mờ "Gợi ý", **không có 🔊** (tránh lộ đáp án).
  - **Mặt trước, ôn tập đã gợi ý:** nghĩa + từ + IPA + 🔊.
  - **Mặt sau:** nền cam `#FFF1E6`: nghĩa 30→36px coral · câu ví dụ lg→22px · `SPEAK_CHIP` "🔊 Nghe câu ví dụ".
  - `animate-peek` nhắc lật (4s, delay 2.5s) tới lần lật đầu · phím Enter/Space lật · "Chưa có audio mẫu".
  - **Hàng kết quả** (khi có feedback hoặc unlocked): `Stars sm animate` · `Chip teal` "Điểm: N" (bỏ nếu NaN) · badge "🔓 Mở khoá!" (sun, `shadow-chunky-sun`; design M5 không có — Q7) · `HintCard` khi retry · lỗi 3 câu.
  - **Kết quả:** ≥60 → `unlocked` (promote Leitner, Foxy `cheer`) · <60 → `retry` (demote nếu đã mở, Foxy `surprised` "Thử lại nhé") · sao 3/2/1 theo `toFeedback` nhưng **không hiện câu** "Tuyệt vời!".
  - **Hàng đáy sticky** 4 tổ hợp: chưa có kết quả = Foxy + mic + "🎤 Nói để mở khoá" · có kết quả phone = Foxy + 2 CTA (mic **ẩn**) · có kết quả md = Foxy + mic + 2 CTA · nhãn CTA `mission.label` / "Tiếp theo →".
- **Vấn đề:** 2 hàng `sticky bottom-0 bg-cream-50` che nội dung phía sau khi paint đầu (comment 14 dòng); 3 tầng responsive; mặt thẻ absolute → nội dung dài tràn im lặng; hex ngoài token `#FFF1E6 #F2DFC9 #7ED99A`; cỡ thẻ đổi khi có kết quả chỉ ở md.

### C8. SentenceList — `/sentences` và `?topic=` — *không có design (Q19)*
- Back ("Quay lại" → `/topic/:id` khi lọc; "Về nhà" khi không) · H1 40px "🧱 Ghép câu[ — tên chủ đề]" · nhóm theo chủ đề `gap-7`: H2 26px (chỉ khi không lọc) + hàng `ROW min-h-[80px] px-6`: câu VI 24px + StarRow md.
- **Trạng thái:** lọc hợp lệ (4 hàng) · không lọc (**16–32 hàng + ≤8 H2 ≈ 3300px cuộn**) · `?topic=` lạ → coi như không lọc · chủ đề khoá vắng mặt · sao 0–3 (không có "xong") · không empty state (không thể rỗng).
- **Vấn đề:** 36 ký tự VI 24px cạnh StarRow 3xl trong `px-6` → 3 dòng ở 375px; không rule responsive; `justify-between` trên `max-w-4xl` desktop đẩy sao cách chữ 700px.

### C9. SentenceBuilder — `/sentence/:id` — *không có design (khung M3 "5 loại bài")*
- **Vùng:** header (Back → `/mission` hoặc `/sentences?topic=` · chip "Câu N/M"/"Ôn tập N/M" · H1 24→36px "Ghép câu nào! 🧱" · gợi ý 13px→lg · gutter) · prompt VI base→xl · **khay** `max-w-3xl min-h-[76px]/[96px]` viền đứt + placeholder absolute "thả vào đây" · **chú giải** 3 pill vai (Ai? sky / Làm gì? peach / Cái gì? sun) · **kho ô** `TILE min-h-[64px] min-w-[64px]` 21→26px (6 ô "elephant" ≈ 800px → 2 hàng phone) · khối kết quả/nói.
- **Trạng thái:** not-found · khay rỗng / một phần (ô giữ màu vai ở cả 2 nơi) · **đầy & sai** → khay `animate-shake` 400ms rồi **xoá sạch khay** (không đánh dấu ô sai, không điểm một phần) · **đầy & đúng** → tự phát mẫu, Foxy `cheer` "Đúng rồi! 🎉", hiện hàng nói (nút "🔊 Đọc câu cho bé nghe" + MicButton + Foxy) · "Chưa có audio mẫu" · mic 4 trạng thái · lỗi 3 câu · **đã chấm**: Stars md (animate 3★) · câu · `ScoredWords` (chạm = phát mẫu) · Hint · `ScoreBars` (ẩn phone thấp) · CTA "Thử lại" + primary — **phone: khay + chú giải + kho biến mất** (từng đo 1470px ở 390×844), `ScoredWords` thay khay · sao ghi mỗi lần, chỉ tăng.
- **Vấn đề:** ghim đáy bằng `mt-auto` (comment nói sticky sai) trong khi WordCard dùng sticky — 2 cách không tương thích; khay lớn dần khi đặt ô → mọi thứ dưới nhảy; vai ngữ pháp chỉ mã hoá bằng màu, chú giải ẩn trên phone sau khi đúng; `max-w-3xl` trong `max-w-4xl`; "next" đi xuyên chủ đề.

### C10. Primitive UI (sheet component) — `components/ui`
| Primitive | Variants / props | Ghi chú cho redesign |
|---|---|---|
| **Button** | `variant` primary (coral + `chunky-coral`) · secondary (teal) · outline (trắng viền teal/30) · ghost (đứt nét) · `size` **md** `min-h-[64px] px-8 text-[22px] rounded-xl3` · **lg** `min-h-[72px] px-10 text-[26px] rounded-xl4` · `pulse` · `to` (Link) | **Không có size phone** → 3 màn vá bằng `CTA_PHONE` riêng; ParentDashboard vá bằng `max-md:` |
| **Chip** | tone teal / coral / sun / neutral · size sm 16px / md 18px · `rounded-full px-4 py-2` | Là `<span>`, không tap target |
| **Card** | `rounded-xl3 bg-white shadow-card`, không padding | mỗi màn tự padding |
| **BackButton** | tròn **66px** cố định, `←`, `label` + `mdLabel` (tên a11y đổi theo breakpoint) | design nói 56/48 (Q4); nhiều màn đè `max-md:h-16` |
| **ProgressBar** | `h-3.5` track, tone teal (**gradient duy nhất trong hệ**) / coral / sun | StoryPlayer tránh dùng vì gradient |
| **Toggle** | hàng 64px, track 58×32, knob 24, `role` switch/button | |
| **StarRow** vs **Stars** | 2 component sao: StarRow xl/3xl/5xl stagger 0.15s (list, quiz) · Stars 36→58 / 36→40 stagger 0.22s (practice) | gộp 1 |
| **SceneDots · SpeechBubble · HomeLabel · Toast · Confetti** | xem nhóm A/B | |
| **CARD_LINK** (chuỗi class) | `flex-col items-center gap-2 rounded-xl3 bg-white p-6 shadow-card active:scale-95` | ô danh sách chung, bị call-site đè `max-md:flex-row` |

**Token (`tailwind.config.ts`):** cream `#FFF7EA` · canvas `#EFE5D6` · ink 900/500/300 `#4A3B33/#8A7A6D/#B0A18E` · line-200 `#EFE2CC` · coral 500/600/50/text `#FF7A59/#E05A3A/#FFE9DF/#F2603D` · teal 500/600/50 `#2EC4B6/#1FA396/#E2F6F1` · sun 400/50/700 `#FFC533/#FFF1C9/#9A6B00` · good/ok/fix 700/50/300 · sky-400 `#7EC8F2` · peach-400 `#FF9A62`. Font display Baloo 2 700/800, body Nunito 600/700/800. Radii xl2 20 / xl3 28 / xl4 34 (**code còn dùng lẻ 14/18/22/24/28**). Shadow đều offset cứng không blur. Breakpoint: mặc định Tailwind + variant `ipad` = `≥1024 ngang ≥692 cao` (không phải screen).
**Hex ngoài token đang rải trong code:** `#F1E7D4 #CDBFA9 #FFF1E6 #F2DFC9 #E2D5C0 #B9ECC8 #FFD4DA #FFDF9E #FFF6E0 #FFE3D7 #C08457 #D9C9AE #F3EADA #D9CBB4 #EFDDA8 #C4E8E1`.

## Nhóm P — Khu phụ huynh

### P1. ParentGate — `/parent` (khoá) — *không có design*

- **Mục đích:** câu hỏi nhân (3–9 × 3–9) chặn khu người lớn, nhớ 10 phút trong session.
- **Vùng:** nút `← Về nhà` (pill trắng 64px, `self-start`) → thẻ `ParentQuestion` (`max-w-md`, `p-8`, `gap-6`): tiêu đề "Dành cho phụ huynh" · phép tính 44px · ô nhập `h-16 w-32` · nút `Vào` 64px/22px. Cả cụm `justify-center` giữa màn.
- **Dữ liệu động:** không (đáp án 9–81).
- **Trạng thái:**
  1. Câu hỏi mới (chưa sai).
  2. Sai → dòng đỏ "Chưa đúng, thử lại" + **đổi câu hỏi mới**, ô nhập trống. Dòng đỏ **không bao giờ tắt** cho tới khi rời màn.
  3. Gửi rỗng = sai (không có thông báo "chưa nhập").
  4. Đúng → thay bằng Dashboard (không chuyển cảnh, không chrome chung).
  5. Không có khoá sau N lần sai, không đếm, không cooldown (cố ý).
- **Điều hướng vào:** Home (nút phụ huynh + link "liên kết email" trên banner mốc), CloudStart (link "Góc phụ huynh"). **Ra:** `/` hoặc Dashboard.
- **Vấn đề layout:** không có rule `md:` nào — phone và iPad y hệt; thẻ 28rem lạc giữa 1194px; 3 cỡ chữ display cạnh tranh (44/24/22); nút `Vào` 64px trên màn mà chính Dashboard tuyên bố nút người lớn 44px; nút back nằm trong stack giữa màn thay vì góc trên.

### P2. ParentDashboard — `/parent` (đã mở) — *design M8c chỉ vẽ ~1/3*

Màn dày nhất app (958 dòng). Cột `max-w-5xl`, gap 12/24px. **Chỉ có lưới 2 cột `ipad:grid-cols-[1.4fr_1fr]`** (≥1024 ngang, cao ≥692); iPad **dọc** = 1 cột dài >4000px trường hợp xấu. Chỉ 2/10 panel nằm trong lưới; tài khoản + tiến độ từ xa + nút đặt lại luôn full-width.

Thứ tự panel trên→dưới và trạng thái từng panel:

**P2.0 Back + Header** — `← Về nhà` (48→64px md) · H1 21→36px · dòng "Tuần này: N phút · điểm TB X/100" (N=0, X=`—` khi trống, không có empty copy) · nút "🔐 Đã mở khoá bằng câu hỏi · Khoá lại" (nhãn dài, gãy 2–3 dòng ở 320px). *(Chỉ hiện khi cloud có cấu hình:)*

**P2.1 Thẻ Tài khoản** — header "Tài khoản" + dòng sync bên phải:
- Sync: `off` (ẩn) · `Ngoại tuyến` · `Chưa đồng bộ N mục` (N≤500) · `Đã đồng bộ ✓`. **Không có** trạng thái "đang đồng bộ", "lỗi sync", "lần cuối lúc…" dù dữ liệu có sẵn.
- Thân (3 nhánh):
  1. `Đang tải…` (luôn là frame đầu tiên khi mount → thẻ nhảy chiều cao).
  2. **Không có session** (2 biến thể online/offline, nền vàng) — không có form nào.
  3. **Ẩn danh, chưa liên kết:** đoạn đồng ý + ô email `h-11` + nút `Liên kết` (64px trên iPad, lệch với ô 44px) → **bận** (chỉ mờ nút, không spinner) → **OTP**: câu "Nhập mã 6 số vừa gửi tới {email}" + ô `w-32` + `Xác nhận` + link "Sửa lại email" → **lỗi** (6 câu khác nhau, cùng 1 style: sai định dạng / chưa kết nối / máy đang có hồ sơ khác / mã sai-hết hạn / mất mạng / lỗi chung) · **Mã khôi phục** 8 ký tự nền vàng "chụp màn hình lại nhé" (biến mất không giải thích nếu fetch lỗi).
  4. **Đã liên kết:** email thô (không truncate, không `min-w-0` → tràn ở 320px) + `Đăng xuất` → `window.confirm` → về nhánh 2 (không phải nhánh 3). Đăng xuất lỗi: **im lặng**.
- **Khối Hồ sơ** (border-top trong cùng thẻ): "Hồ sơ" + `+ Thêm hồ sơ` (36px, teal) · hàng "{avatar} {tên}" + `Đổi tên` (underline 36px) · cảnh báo "Chưa đọc được danh sách hồ sơ" (roster hỏng; nút thêm vẫn bật) · thông báo lỗi thêm (đỏ) · `ProfilePicker` chỉ khi ≥2 hồ sơ · nút `Xem từ xa` (36px, `aria-pressed` **không có style bật/tắt**). Thêm/đổi tên dùng `window.prompt`; đổi hồ sơ = `location.reload()`. Không có xoá hồ sơ, không có chọn avatar.

**P2.2 Thẻ "Chưa xem được tiến độ từ xa"** — 1 câu trong cả 1 Card, không nút thử lại. Chỉ khi fetch trả `null`.

**P2.3 Thẻ "Tiến độ từ xa"** — tự hiện khi tài khoản có hồ sơ khác máy này, hoặc khi bật `Xem từ xa`. Mỗi hồ sơ = 1 `<li>` viền: tên (+ "· đang dùng trên máy này") → `Đang tải…` / `Không tải được…` (đỏ) / `Chưa có dữ liệu nào trên máy chủ` / 2 dòng số (chuỗi ngày · phút tuần · 3 điểm TB) + "Âm hay sai: /ɪ/ (62), …" (1 dòng không xuống dòng) + chú thích "bản ghi không đồng bộ" **lặp lại mỗi hồ sơ**. Không có tap target nào. Full-width 1024px cho 5 dòng chữ.

**P2.4 Biểu đồ "Phút luyện mỗi ngày"** (cột trái iPad) — 14 cột (7 trên phone, ẩn 7 cột đầu + nhãn), plot **cố định `h-24 md:h-40`**, bar & đường mục tiêu bằng inline style, hôm nay = coral, nhãn `DD/MM` 10px. **Không có empty state** (14 cột 2%). Tổng dưới = tuần (phone) / 14 ngày (iPad).

**P2.5 "Điểm trung bình"** — H2 **ngoài** card (khác mọi panel) + 3 ô `grid-cols-3` cố định mọi width, số 26→40px, `—` khi null. Thiếu loại `story`.

**P2.6 "Âm hay sai"** (cột phải) — 0 → `<p>Chưa đủ dữ liệu</p>` không style; 1–5 pill `rounded-full` đỏ "/θ/ — trung bình 62 (1234 lần)" (gãy dòng thì pill vỡ) + tip vàng **ẩn hoàn toàn dưới 768**.

**P2.7 "Bản ghi gần đây"** — `<details>`: phone đóng (summary 64px), ≥768 mở (quyết định 1 lần khi mount). 0 → `<p>Chưa có bản ghi</p>`; 1–20 hàng viền: nút play tròn 44→**64px** + `DD/MM HH:MM` + câu (không truncate). Phát lỗi: im lặng. Không xoá.

**P2.8 "Giới hạn mỗi ngày"** — 3 chip 15/20/30 (44→64px, coral khi active; giá trị tuỳ chỉnh = **không chip nào sáng**) + ô số `w-20` 5–60 bước 5 "phút / ngày"; gõ từng phím ghi store, blur thì snap. Trạng thái "đã hết giờ hôm nay" **không có ở đây** (nằm ở Home).

**P2.9 "Bài học"** — hàng "Độ khó" + nút `Tự động` (teal) · 5 nút bậc 1–5 (coral; **auto và bậc cùng sáng**) · "Độ dài" 3 nút "Ngắn ~8 phút / Vừa ~12 / Dài ~18" (12px trong 3 cột 320px) · chú "Áp dụng từ bài học ngày mai". 8 nút 44→64px ≈ 200px trên iPad.

**P2.10 Đặt lại tiến trình** — nút outline **ở đáy cùng của scroll dài nhất**, 64px/22px trên iPad. `window.confirm` 2 câu (local-only / kèm cloud) → không có busy (double-tap được) → không có xác nhận thành công → nếu server chưa xoá: notice vàng "Đã xoá xong trên máy này. Bản lưu trên tài khoản thì chưa…" (có thể **hiện sẵn khi mở màn** nhiều ngày sau).

- **Mùi xuyên suốt Dashboard:** 4 mốc tap khác nhau trên 1 màn (36/44/48/64); 3 hộp thoại native (`confirm`×2, `prompt`×2) không có component dialog; 2 empty-state không style vs 5 notice vàng/đỏ (cùng nền vàng cho cảnh báo, mã khôi phục và xoá dở); không có `truncate`/`break-words`/`min-w-0` ở đâu cả; cột phải (âm sai + 20 bản ghi + 2 thẻ cài đặt) dài gấp nhiều lần cột trái; không có skeleton — thẻ tài khoản đổi chiều cao vài lần trong giây đầu; các luồng khôi phục (spec flow 3–4) nằm ở `/start`, không có ở đây.
- **ProfilePicker** (dùng chung `/parent`, `/start`, ProfileGate): lưới `grid-cols-2 sm:grid-cols-3` (không bao giờ >3 cột), ô 64px viền, emoji 30px + tên + dòng phân biệt khi trùng tên: `Tạo DD/MM/YYYY` → `Tạo DD/MM HH:MM` → `Mã xxxxxxxx`. Active = viền teal. `busy` = mờ (chỉ `/start` dùng).

---

## 4. Component sheet — những gì cần vẽ trạng thái

Sheet cũ (speak-up-screens) chỉ có Button/Chip/Card/Foxy/sao. Redesign cần **thêm trạng thái** cho các component sau (chi tiết props ở B7 và C10):

| Component | Trạng thái cần vẽ (phone + iPad) | Hiện trạng |
|---|---|---|
| **Button** | primary / secondary / outline / ghost × md / lg × **size phone mới** × disabled × pulse | không có size phone; 4 file tự vá |
| **MicButton** | disabled (chờ scorer) · idle · **processing (đang chấm)** · recording (+ mức âm) | 150/190px cứng; disabled ≈ idle; design phone 124 chưa chốt (Q6) |
| **Thẻ kết quả nói** (ResultCard M3b) | 3★ / 2★ / 1★ × Azure / Web Speech · với/không `🎧 Nghe mình` · 1–14 chip từ · có/không HintCard · ProsodyChip 4 tone | 6 màn tự lắp khác nhau; thứ tự phần tử khác nhau (B5 vs B6) |
| **Dòng lỗi lượt nói** | mic từ chối · không nghe rõ · trình duyệt không hỗ trợ · **offline/Azure hỏng (chưa có)** · **hết giờ hôm nay (chưa có)** | 1 dòng đỏ, 3 câu cho 12 nguyên nhân |
| **Badge engine** | Azure (ẩn) / "chế độ đơn giản" | chữ xám 15 ký tự ở gutter 66px, bị LessonChip đè |
| **Đếm ngược** | 1 chữ số (6→1) / **2 chữ số (13→1)** | |
| **ScoredWords** | good / ok / fix × 1 / 2 / 6 / 14 chip × phone / iPad | chip 64px không co |
| **ScoreBars** | 4 bar; bar "Ngữ điệu —" null | 2×2 phone / hàng iPad |
| **SoundChip** (B3) | good / ok / fix / **unknown** (2 câu) | chỉ SoundPractice |
| **HintCard** | có/không `(âm "…")` | không bao giờ ẩn |
| **Sao** | gộp `Stars` + `StarRow` thành 1 component, size sm/md/lg, có/không animate | 2 component |
| **Chấm tiến trình** | SceneDots (player) và chấm 3 trạng thái qua/hiện/tới (practice) | 2 cách vẽ |
| **Không tìm thấy** | 1 màn chung: Foxy + câu + Back | 8 màn `<p>` trần không có nút về |
| **Empty state** | rỗng review từ · rỗng bản ghi · chưa đủ dữ liệu âm · rỗng lịch sử · nhiệm vụ rỗng | 2 `<p>` không style, phần còn lại không có |
| **Notice / banner** | info (vàng) · cảnh báo · lỗi (đỏ) · thành công (xanh) · **credential (mã khôi phục)** · **xoá dở** | cùng nền vàng cho 4 ý khác nhau |
| **Dialog xác nhận** | xoá tiến trình (2 copy) · đăng xuất · thêm/đổi tên hồ sơ (nhập text) | 4 `window.confirm/prompt` native |
| **Loading / skeleton** | thẻ tài khoản · tiến độ từ xa · scorer đang tạo | "Đang tải…" text, thẻ nhảy chiều cao |
| **Sync status** | off · offline · pending N · synced · **syncing (chưa có)** · **error (chưa có)** · **last synced (chưa có)** | 1 span không icon |
| **ProfilePicker** | 1 / 2–3 / 4–8 hồ sơ × active / busy × có dòng phân biệt | 2/3 cột, không truncate |
| **Toast** | ngắn / dài 2 dòng | không max-width, dưới notch |
| **LessonChip** | phone (tròn 64) / iPad (pill) | góc khác nhau theo breakpoint |
| **BackButton** | 66 (trẻ) / phụ huynh 48 / trên tranh | Q4 chưa chốt |
| **Card danh sách** (`CARD_LINK`) | ô lưới 2/3/4 cột × với sao / với chip khoá / với chip mood | 1 chuỗi class bị đè |
| **Toggle** | on / off × có nhãn / không nhãn (phone) × **pressed-button style cho "Xem từ xa"** | |

---

## 5. Vấn đề xuyên suốt & yêu cầu gửi Claude Design

### 5.1 Vấn đề xuyên suốt (nguyên nhân của "trống – nút to – vỡ")
1. **Trống trên iPad:** 8 màn bọc nội dung trong `max-w-md` (448px) hoặc `max-w-3xl/4xl/5xl` (768–1024px) trên frame 1194 mà không có bố cục 2 cột; các màn danh sách/khung không có `min-h-full` nên dồn lên trên. Đặc biệt A1, A2, P1, B2, P2 (thẻ tài khoản full-width cho 5 dòng chữ).
2. **Nút quá to:** `Button md` = 64px/22px và `lg` = 72px/26px là **mặc định** cho mọi nút kể cả link chữ gạch chân (A2: 5 link × 64px), nút phụ huynh (P2: `Liên kết`, `Đặt lại` 64px trên iPad), 20 nút play 64px (P2.7); `BackButton` 66px cố định; mic 150/190 không co; H1 40px trên 5 màn danh sách ở 320px.
3. **Vỡ/tràn khi nhiều dữ liệu:** lưới cột cố định (C1 `grid-cols-3`, C5 `grid-cols-3`, C6 `grid-cols-4`) · chuỗi không giới hạn không truncate (tên hồ sơ, email, câu bản ghi, nhãn nút chứa email, Toast) · vùng kết quả nói 14 chip × 64px (B6) · 32 hàng câu (C8) · 64 ô review (C6) · P2 iPad dọc 1 cột · **B5/B6 vượt 834px trên iPad ngay cả frame gốc**.
4. **Hai (ba) hệ breakpoint:** `md:` 768 vs `ipad:` (1024 ngang) vs query thô "phone thấp ≤700 cao" xoá bớt nội dung → phone thấp học bài **khác** phone cao; iPad dọc/tablet không có frame nào, nhưng copy vẫn hứa "Về bản đồ".
5. **Không có "khung luyện nói" thật:** design gọi M3/M3b là khung chung 5 loại bài, code có **6 bản sao** với header/CTA/lỗi/mic lặp và thứ tự phần tử khác nhau.
6. **Trạng thái không có design:** đang chấm (pending), lỗi theo nguyên nhân, offline, hết giờ, rỗng, not-found, loading, sync error, dialog xác nhận — mỗi thứ hoặc thiếu hoặc là text trần.
7. **Overlay va chạm:** LessonChip (fixed góc phải trên phone) đè chip "Cảnh N/M", badge engine và gutter 66px của mọi màn luyện; Toast `top-6` dưới notch; ProfileGate overlay `z-50` ngang Toast; Confetti `z-50` đè tất cả.

### 5.2 Yêu cầu cụ thể cho Claude Design
**Bắt buộc, cho cả 2 frame (phone 390×844 + iPad 1194×834):**
1. **Khung trang thống nhất:** 1 gutter ngang, 1 vị trí Back, 1 vị trí LessonChip **không đè** gì, 1 vị trí Toast trên safe-area, 1 cách ghim CTA đáy (sticky hay sibling — chọn 1), 1 max-width nội dung cho iPad (1194 hay 1024).
2. **Khung "luyện nói" chung** (M3 mở rộng) với đủ vòng đời B0 (11 trạng thái) — rồi 6 biến thể B1–B6 + C4 + C7 + C9 chỉ đổi phần "dạy" bên trái, phần "làm" bên phải giữ nguyên. iPad: 2 cột (dạy / làm); phone: dạy gập lại khi có kết quả. **Vùng kết quả phải chứa được 14 chip từ + 4 bar + hint + prosody + 4 nút trong 834px iPad và trong vùng cuộn có giới hạn ở phone.**
3. **Khung "danh sách"** chung cho 10 màn (A10–A14, B2, C1, C5, C6, C8): header (Back + H1 + phụ) + lưới ô 2/3/4 cột theo frame, ô có sao / chip khoá / chip mood, hàng dài (C8), empty state, not-found.
4. **Khung "cổng người lớn"**: ParentGate (P1) + CloudStart 8 stage (A2) + ProfileGate (A1) cùng một ngôn ngữ (thẻ giữa màn, 2 cột trên iPad?), với dialog/notice/loading/error là component thật thay `window.confirm/prompt`.
5. **ParentDashboard iPad dọc** (834×1194) và ngang: sắp lại 10 panel thành lưới cân (hiện cột phải dài gấp nhiều lần cột trái); quyết định vị trí "Đặt lại tiến trình"; vẽ sync 7 trạng thái, thẻ tài khoản 11 trạng thái (kể cả OTP, mã khôi phục, lỗi 6 câu), tiến độ từ xa 7 trạng thái/hàng, biểu đồ empty state, "Điểm trung bình" thêm loại `story`.
6. **Home (A3)**: frame cho **iPad dọc** + quy tắc khi **2–3 banner cùng hiện** (hết giờ + mốc email + A2HS) + MissionCard trạng thái "xong" + panel streak khi chạm (Q3).
7. **Trạng thái còn thiếu** (§4): pending/đang chấm, 5 loại lỗi lượt nói, offline, hết giờ trên màn luyện, not-found chung, 5 empty state, loading/skeleton, quiz 0/3, MissionComplete 0 sao, DailyMission rỗng.
8. **Component sheet** đầy đủ theo bảng §4, kèm **size phone cho Button** và mic 124 vs 150 (Q6), BackButton 56 vs 66 (Q4).

**Quyết định chờ Design/Sản phẩm (đã nêu ở brief cũ, chưa chốt):** Q3 panel streak · Q4 BackButton · Q5 banner hết giờ · Q6 mic phone · Q7 badge "🔓 Mở khoá!" · Q8 chip "Từ n/3" · Q11 karaoke 64px/từ · Q12 toggle nhạc (code **không có** nhạc nền) · Q13 nút Tiếp tục/Bỏ qua ở player · Q14 quiz ảnh hay emoji · Q17 biểu đồ 7/14 ngày · Q19 12 màn thiếu (nay là 19).

**Ràng buộc kỹ thuật design cần tôn trọng:** 8 đảo cố định (thêm đảo 9 = throw) · 5 bậc cố định · 3 từ/âm · 3 câu quiz/truyện · bản ghi ≤20, không sync · hồ sơ không giới hạn, không xoá được, tên không giới hạn · Web Speech không có prosody/blob/điểm lẻ (0 hoặc 100) · không có nhạc nền · không có ảnh cảnh truyện (emoji + gradient) · Foxy 5 mood 3 size cố định.

### 5.3 Nguồn
- Code: `client/src/screens/*.tsx`, `client/src/components/**`, `client/tailwind.config.ts` (đọc toàn bộ ngày 2026-09-02, commit `499a59b`).
- Design cũ: `docs/design/README.md`, `docs/design/2026-08-25-mobile-handoff-brief.md` (§13 breakpoint, §14 Q1–Q20, §15 risks, §16 việc mới), `docs/superpowers/specs/2026-08-26-phase10-mobile-layout-design.md` (3 quyết định).
- Số đo đã đo: README §"Phase 10" (B5 959px, B6 1140px, P2 1268px phone, C9 1470px trước khi gập).
