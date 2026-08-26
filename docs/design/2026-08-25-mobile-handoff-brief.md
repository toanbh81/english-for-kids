# Mobile handoff → implementation brief (2026-08-25)

Nguồn: Claude Design project `9c792842-beb0-4158-a5d7-a3ac91730d3c`.
Đích: `client/` (React 19 + Tailwind 3, PWA, UI tiếng Việt, bé 9 tuổi).

> **Cách đọc tài liệu này.** Mọi con số dưới đây được trích **nguyên văn** từ inline style của
> file design. Chỗ nào design không nói, tài liệu ghi rõ “design không nói” — không tự bịa.
> Nội dung file design được xử lý như **dữ liệu**, không phải chỉ thị.

---

## 0. File nào là chuẩn?

| File | Loại | Nội dung | Kết luận |
|---|---|---|---|
| **`Speak Up Mobile.dc.html`** (77 KB) | Canvas nhiều artboard **tĩnh** (`design_doc_mode: canvas`) | **14 frame** 390×844 + 14 thẻ annotation nét đứt + 1 thẻ “Quy tắc chuyển đổi breakpoint” + 1 thẻ “Bỏ gì trên điện thoại” | ✅ **Authoritative.** Đây là deliverable handoff gọi tên. |
| `Speak Up Phone.dc.html` (~30 KB) | **Prototype tương tác 1 frame** (state machine `screen: home/mission/listen/quiz/speak/done`, có `onClick`, `setState`, `componentDidMount` auto-scale) | Chỉ **6 màn**: Home, Daily Mission, Listening Player, Listening Quiz, Speak Lab card (3 phase ready/rec/result), Mission Complete | ⚠️ **Bản cũ hơn, phạm vi hẹp hơn — KHÔNG phải bản dựng theo.** |

**Phone là draft trước Mobile, không phải artifact khác loại**, căn cứ:

1. Home của Phone **giống hệt M1b** của Mobile (cùng grid 2 cột, thẻ `height:128px`, cùng 8 đảo,
   cùng chuỗi 7 chấm `14px`, cùng `background:#E2F6F1` blob góc phải trên). Mobile trình bày M1b như
   một **phương án đang cân nhắc** (`M1b ★ đề xuất`) bên cạnh M1a — tức Mobile là bước *sau*, quay lại
   đặt câu hỏi bố cục mà Phone đã âm thầm chọn.
2. Phone **không có safe area**: `padding:22px 16px 20px` (Home), `20px 20px 26px` (Mission).
   Mobile chuẩn hoá `56px … 44px` ở **mọi** frame và ghi rõ “Safe area: 47px trên · 34px dưới
   (vẽ sẵn trong mọi frame)”. Đây là quy tắc mới, không tương thích ngược.
3. Số đo lệch nhau và **Mobile luôn là bản to hơn / đúng floor 64px hơn**: mic `118` (Phone) → `124`
   (Mobile); CTA Home `60px` → `64px`; back button `50px` → `56px`; play truyện `84` → `96`.
   Mobile nói “Vùng chạm ≥64px, mic ≥120px”; Phone vi phạm cả hai.
4. Mobile phủ **8 màn Phone không có**: M4 luyện âm, M5 thẻ từ vựng, M5b đoán nghĩa, M6b quiz truyện,
   M7 thang bậc, M8 màn chủ đề, M8c góc phụ huynh, M1a bản đồ dọc.

**Phone vẫn dùng được cho một việc:** nó là nguồn **duy nhất** mô tả *hành vi động* (transition giữa
ready → recording → result, countdown, karaoke word-timing 380 ms / 650 ms, toast, toggle nhạc/phụ đề).
Mobile chỉ vẽ trạng thái tĩnh. Khi Mobile im lặng về hành vi, tra Phone — nhưng **số đo luôn lấy Mobile**.

**`support.js` — đã bỏ qua, có lý do.** File Mobile chỉ dùng `support.js` làm runtime của canvas
(`<sc-for>`, `<sc-if>`, `{{ }}`, `class Component extends DCLogic`). Toàn bộ số đo layout nằm inline
trong chính file Mobile, và mọi style động (`i.st`, `m.st`, `s.st`, `b.st`, `d.stSm`…) được định nghĩa
trong `renderVals()` **ngay trong file đó**. Không có phụ thuộc layout nào ra ngoài. Art PNG cũng bỏ qua
theo yêu cầu (chỉ tham chiếu tên file: `art/story-little-fox-scene-*.png` v.v.).

---

## 1. Khung chung mọi frame (design ghi ở header canvas)

```
Frame:            390 × 844, background #FFF7EA, border-radius 44, overflow hidden
Notch:            118 × 32, radius 18, #2B2320, left 50% top 12, z-index 20
Home indicator:   130 × 5,  radius 3,  #D9CBB4, left 50% bottom 8
Safe area:        47px trên · 34px dưới  ("vẽ sẵn trong mọi frame")
Padding frame:    56px trên · 44px dưới  (= safe area + ~9/10px thở)
Padding ngang:    16px (M1a, M1b, M2) · 20px (M3, M3b, M4, M5, M5b, M6b, M7, M8) ·
                  14px (M6 — tranh tràn rộng hơn) · 18px (M8c — mật độ cao hơn)
Luật cứng:        Vùng chạm ≥64px · mic ≥120px · CTA chính luôn trên nếp gấp 844
                  (trên 667 thì ghim đáy) · KHÔNG cuộn ngang
```

**Trạng thái app hiện tại về safe area: chưa có gì.** `client/index.html` đã có
`viewport-fit=cover`, nhưng `client/src/styles.css` và mọi `<main>` chỉ dùng `p-4 sm:p-7` / `p-6`.
Không file nào trong `client/src/` dùng `env(safe-area-inset-*)`. Đây là **việc mới hoàn toàn**,
không phải chỉnh sửa (xem §14 Risks).

---

## 2. M1a — Home, bản đồ dọc thu gọn *(phương án A, không được đề xuất)*

**Frame:** `data-screen-label="M1a Home bản đồ"`, 390×844.

### Cấu trúc trên → dưới

| Vùng | Hành vi | Số đo design |
|---|---|---|
| Blob trang trí | — | `left:-70 top:-90 220×220 radius 50% #FFEDD6` |
| **Header (ghim trên)** | `position:absolute; top:0; padding:56px 16px 0; gap:10` | — |
| ├ Foxy + bong bóng | | Foxy `54×52`, `animation:bob 3s`; bubble radius `16` / bottom-left `6`, padding `8px 13px`, shadow `0 4px 0 #EFE2CC`; tiêu đề `17px` Baloo 800 `#F2603D` “Chào con! 👋”; phụ `13px #8A7A6D` |
| └ Pill sao | | bg `#FFF1C9`, radius `14`, padding `9px 12px`, shadow `0 4px 0 #EFDDA8`, `17px #9A6B00` |
| **Streak strip (ghim trên)** | | white, radius `16`, padding `8px 10px`, shadow `0 4px 0 #EFE2CC`; 7 chấm `26×26` (đủ: `#FFC533` + ⭐ `12px`; thiếu: `#F3EADA` + `2px dashed #D9CBB4`); nhãn `10px #B0A18E`; “🔥 4 ngày” `14px #2EA79B` |
| **Băng bản đồ (VÙNG CUỘN DUY NHẤT)** | `top:188; bottom:312; overflow:hidden` | Cao **344px** (xem ⚠️ dưới) |
| ├ Đường mòn | SVG `390×520`, `viewBox 0 0 390 520` | path stroke `#EAD9BE`, width `10`, `dasharray "2 20"`, linecap round |
| ├ Đảo mở | 4 đảo so le | đĩa `80×80` radius 50%, emoji `34px`, shadow `0 6px 0 <đậm>, 0 0 0 6px <nhạt>`; nhãn `15px` Baloo 800; sao `12px letter-spacing 2px` |
| │ | vị trí | 🐘 `left:40 top:6` `#2EC4B6`/`#1FA396`/`#D3F1EC` · 🍎 `right:48 top:112` `#FF9A62`/`#E07A42`/`#FFE7D2` · 🏫 `left:52 top:242` `#7EC8F2`/`#5BA7D4`/`#DDF0FB` · 👨‍👩‍👧 `right:56 top:326` `#F4B8C8`/`#D897AB`/`#FBE3EA` |
| ├ Đảo khoá | | `72×72` `#E9DEC9` shadow `0 6px 0 #D4C6AA`, emoji `28px` 🔒, nhãn `14px #A79781`, `opacity:.7`, `left:60 top:424` |
| ├ Fade đáy | | `height:64`, `linear-gradient(180deg, rgba(255,247,234,0) 0%, #FFF7EA 90%)` |
| └ Chip gợi ý cuộn | | `right:14 bottom:10`, `12px #B0A18E`, white, radius `12`, padding `5px 10px`, shadow `0 3px 0 #EFE2CC`, “⬇ cuộn xem 3 đảo khoá” |
| **Cụm ghim đáy** | `left:14 right:14 bottom:44; gap:10` | — |
| ├ Hàng nút phụ | | “🗣️ Các bậc luyện nói” `flex:1 height:64` white radius `18` shadow `0 5px 0 #EFE2CC` `16px #2EA79B`; nút phụ huynh `64×64` emoji `24px` |
| └ Thẻ nhiệm vụ | | white radius `22` padding `14px 16px` shadow `0 6px 0 #EFE2CC`; tiêu đề `17px`; “1/3” `15px #2EA79B`; bar `height:11 radius:8` track `#F1E7D4` fill `linear-gradient(90deg,#2EC4B6,#7ED99A)` margin `9px 0 11px`; **CTA `height:64`** `#FF7A59` radius `18` shadow `0 5px 0 #E05A3A` `21px` “Tiếp tục ▸” |

**⚠️ Mâu thuẫn số học trong chính design:** annotation M1a viết “nội dung ~700px, **viewport 410px**”,
nhưng frame tính ra `844 − 188 − 312 = 344px`. Lệch 66px. → xem §13 Open questions Q1.

---

## 3. M1b — Home, lưới đảo *(★ design tự đánh dấu “đề xuất”)*

**Frame:** `data-screen-label="M1b Home lưới"`. Blob: `right:-60 top:-70 200×200 #E2F6F1`.
Root: `position:absolute; inset:0; padding:56px 16px 44px; display:flex; flex-direction:column; gap:10`.

| Vùng | Ghim / cuộn | Số đo design |
|---|---|---|
| Header | **ghim** | Foxy `54×52` bob 3s; “Chào con! 👋” `19px` Baloo 800 `#F2603D`; dòng phụ `13px #8A7A6D` — “🔥 4 ngày · ⭐ 128” (phần sao `#9A6B00`); bên phải 7 chấm streak `14×14` gap `6` (đủ `#FFC533`; thiếu `#F3EADA` + `2px dashed #D9CBB4`) |
| **Thẻ nhiệm vụ** | **ghim, NẰM TRÊN** | y hệt M1a: radius `22`, padding `14px 16px`, shadow `0 6px 0 #EFE2CC`, tiêu đề `17px`, “1/3” `15px #2EA79B`, bar `11px`, **CTA `64px` / `21px`** |
| Nhãn mục | ghim | “🏝️ Đảo chủ đề” `16px #8A7A6D`, `margin-top:2` |
| **Lưới đảo** | **CUỘN** | `flex:1; overflow:hidden`; `grid-template-columns:1fr 1fr; gap:10`; thẻ `height:128` (annotation: **~179×128**), radius `22`, mở = white + shadow `0 6px 0 #EFE2CC`, khoá = `#F3EADA` + shadow `0 6px 0 #E2D5C0` + `opacity:.85`; emoji `36px`; tên `16px` (`#4A3B33` mở / `#A79781` khoá); sao `12px`; dòng phụ `11px` (“Luyện thêm” `#2EA79B` / “Chưa mở khoá” `#B0A18E`); khoá thay emoji bằng 🔒 |
| Fade đáy lưới | | `height:50`, gradient tới `#FFF7EA` |
| Hàng nút đáy | **ghim** | “🗣️ Các bậc luyện nói” `flex:1 height:64` + phụ huynh `64×64`, cả hai white radius `18` shadow `0 5px 0 #EFE2CC` |

**8 đảo trong data design:** Động vật(2★), Đồ ăn(1★), Trường học(0★), Gia đình(0★) — mở;
Thời tiết, Màu sắc, Cơ thể, Đồ chơi — khoá.

**Lý do design chọn M1b (nguyên văn annotation):**
“**Bỏ ẩn dụ bản đồ** — thay bằng lưới thẻ 2 cột (thẻ ~179×128, cuộn dọc, thấy 3 hàng). CTA nhiệm vụ ở
TRÊN → không bao giờ dưới nếp gấp, kể cả 375×667.”
Và ở thẻ “Bỏ gì trên điện thoại”: “✂️ **Bản đồ đường cong 8 đảo** → phương án M1b: lưới thẻ đảo
(đường cong 1401px không nén nổi vào 844 mà vẫn chạm ≥64). Vẫn giữ M1a bản đồ dọc thu gọn để bạn chọn.”

### Delta vs `client/src/screens/Home.tsx`

| Hiện tại | Design (M1b) | Việc phải làm |
|---|---|---|
| `<main className="relative min-h-full overflow-y-auto … p-4 sm:p-7">` — root **cao theo nội dung**, cả trang cuộn (đo được **1401px**) | Root khoá `h-[100dvh]`, chỉ **lưới đảo** cuộn | Đổi root phone thành flex column chiều cao viewport; thêm `overflow-y-auto` **chỉ** cho wrapper lưới |
| `SLOTS` (8 toạ độ `%`) + `TRAIL` (9 lệnh path, khung 1194×834) + `<svg viewBox="0 0 1194 834">` | Phone **không có** bản đồ cong | Giữ nguyên `SLOTS`/`TRAIL`/`<svg>` nhưng **đã `hidden lg:block`** — SVG đã đúng; `SLOTS` chỉ áp dụng từ `lg` qua `ISLAND_BOX = '… lg:absolute lg:w-[15%] …'`. **Không cần đổi**, chỉ cần lưới `<640` khớp M1b |
| Lưới phone: `grid-cols-2 gap-x-4 gap-y-4`, đảo là `flex-col` với đĩa `h-24 w-24` (96px) + nhãn `text-xl` + `Chip`/`StarRow` — **chiều cao tự do** | Thẻ `128px` cố định, gap `10`, emoji `36px`, tên `16px`, sao `12px`, phụ `11px` | Thêm biến thể phone: `h-32` (128px), `gap-2.5`, `text-4xl` emoji, `text-base` tên, `text-[11px]` phụ. Đĩa tròn 96px **biến mất** trên phone — M1b vẽ emoji trần trên thẻ chữ nhật, không có disc màu |
| `MissionCard` nằm **cuối** DOM (`col-span-2`, `lg:absolute lg:bottom-2 lg:left-2`) → CTA “Bắt đầu” ở **y≈1221** | Thẻ nhiệm vụ là **phần tử thứ 2 từ trên**, CTA nằm ~y≈300 | **Đổi thứ tự DOM** hoặc dùng `order-*`: header → MissionCard → nhãn → lưới → hàng nút. Đây là **thay đổi cấu trúc lớn nhất của cả handoff** |
| `StreakWeek` = pill trắng, 7 ô `30×30` + nhãn `T2…CN` `11px` + “🔥 N ngày” `text-lg` | Phone rút thành **7 chấm `14×14`**, không nhãn ngày; “🔥 4 ngày” gộp vào dòng phụ dưới lời chào | `StreakWeek` cần **prop `compact`** (mới) hoặc component `StreakDots` mới. Annotation: “Streak rút thành 7 chấm 14px (chi tiết xem khi chạm)” → **cần state mới**: tap để xem chi tiết (design không vẽ popover đó — xem Q3) |
| Pill `⭐ {totalStars()}` riêng, `text-[22px]`, `shadow-chunky-sun` | Gộp vào dòng phụ `13px`, `#9A6B00` | Ẩn pill trên phone, ghép text vào dòng dưới lời chào |
| `SpeechBubble` bọc lời chào | M1b **không có bong bóng** (M1a mới có) | Trên `<640` bỏ `SpeechBubble`, in text trần |
| “🗣️ Các bậc luyện nói” + “👨‍👩‍👧 Phụ huynh” là 2 khối `col-span-2` riêng, mỗi khối `min-h-[64px]`, nút phụ huynh có chữ | 1 hàng: nút teal-text `flex-1 64px` + nút vuông `64×64` **chỉ emoji** | Gộp thành 1 `flex gap-2.5`; nút phụ huynh bỏ chữ “Phụ huynh” trên phone (giữ `aria-label`) |
| Blob nền: `-left-24 -top-28 300×300 #FFEDD6` + `-bottom-32 -right-20 340×340 bg-teal-50` | M1b chỉ **1** blob `right:-60 top:-70 200×200 #E2F6F1` | Ẩn blob thứ 2 trên phone, hoặc thu nhỏ theo M1b |
| `limit-banner` (“Hôm nay bé học đủ rồi”) | **Design không vẽ** | Giữ nguyên; xem Q5 |

---

## 4. M2 — Nhiệm vụ hôm nay

Root: `inset:0; padding:56px 16px 44px; gap:10`.

| Vùng | Ghim / cuộn | Số đo |
|---|---|---|
| Header | **ghim** | back `56×56` circle white shadow `0 4px 0 #EFE2CC`, mũi tên `22px #B0A18E`; tiêu đề `22px` Baloo 800 “Nhiệm vụ hôm nay 🌞”; phụ `13px #8A7A6D` “5 bước nhỏ — 15 phút thôi!” |
| Chips | **ghim** | gap `8`; “Bậc ⭐ 2 · Đọc từ” `#FFF1C9`/`#9A6B00`; “1/5 nhóm xong” `#E2F6F1`/`#1FA396`; cả hai `14px` radius `12` padding `6px 12px` |
| **Danh sách nhóm** | `flex:1; gap:9; justify-content:center` — 5 hàng vừa 844 **không cuộn**; >6 nhóm mới cuộn | **hàng `height:76`**, padding `0 16`, radius `20`, gap `12`; emoji `30px`; tên `17px`; phụ `12px`; chip phải `13px` radius `11` padding `5px 11px` |
| | trạng thái | **done**: bg `#F6EFE2`, `opacity:.8`, tên `#A79781`, chip `#E3F6E8`/`#2E8B4A` “✓ Xong” · **current**: shadow `0 5px 0 #1FA396, 0 0 0 3px #2EC4B6`, phụ `#2EA79B`, chip `#FFE9DF`/`#E05A3A` · **todo**: white shadow `0 5px 0 #EFE2CC`, phụ `#B0A18E`, chip `#FFF1C9`/`#9A6B00` |
| **Cụm CTA** | **ghim đáy** | Foxy cheer `66×63` bob 3s + CTA `flex:1 height:64` `#FF7A59` radius `20` shadow `0 5px 0 #E05A3A` `20px` — nội dung: **“Tiếp tục: 5 thẻ phát âm 🗣️”** (nêu tên bước kế) |

Data design: 🎧 Nghe 1 truyện `1/1 · xong rồi!` · 🗣️ 5 thẻ phát âm `2/5 · Bắt đầu ở đây!` `≈ 5'` ·
🧩 3 từ mới `0/3` `≈ 3'` · 🧱 2 câu ghép `0/2` `≈ 4'` · 🔁 1 bài ôn tập `0/1` `≈ 3'`.

### Delta vs `client/src/screens/DailyMission.tsx`

| Hiện tại | Design | Việc phải làm |
|---|---|---|
| `GROUP_CARD = 'flex flex-**col** items-center gap-2 rounded-xl3 bg-white p-5 text-center shadow-card …'` — thẻ dọc, emoji `text-5xl`, tên `text-2xl`, tiến độ `text-xl`, “Bước n” `text-base`, chip `≈ N phút`. 5 thẻ × 256px xếp dọc ⇒ trang **1759px** | **Hàng ngang 76px** | **Viết lại toàn bộ `GROUP_CARD`** cho `<640`: `flex-row items-center h-[76px] px-4 gap-3 rounded-[20px] text-left`. Emoji `text-3xl`(30px), tên `text-[17px]`, phụ `text-xs`, chip `text-[13px]`. Đây là item thứ 2 trong “thay đổi cấu trúc lớn nhất” |
| Grid `COLUMNS[]` → `lg:grid-cols-1…5` | Phone 1 cột hàng ngang; `768` chưa nói cho M2 (breakpoint card nói “2 cột cho lưới đảo/nhiệm vụ”) | Giữ `COLUMNS` cho `lg`; thêm `sm:grid-cols-2` cho 768 theo breakpoint card |
| Tên + tiến độ + “Bước n” + chip là **4 dòng riêng** | Gộp: tên `17px` / dòng phụ `12px` chứa `"2/5 · Bắt đầu ở đây!"` / chip phải | Gộp `{group.doneCount}/{group.items.length}` và `Bước {i+1} · bắt đầu ở đây!` vào **một** dòng `12px` |
| Nhóm hiện tại: `border-4 border-teal-500` (border ăn vào layout) | `box-shadow: 0 5px 0 #1FA396, 0 0 0 3px #2EC4B6` (ring, không ăn layout) | Đổi sang `shadow-[0_5px_0_#1FA396,0_0_0_3px_#2EC4B6]` — tránh nhảy 8px khi đổi nhóm hiện tại |
| Nhóm xong: `✓ Xong` là `<span>` `text-xl text-good-700` **thay cho** chip | Chip `#E3F6E8`/`#2E8B4A` `13px` + cả hàng `bg-#F6EFE2 opacity-.8` | Đổi thành chip; thêm nền mờ cho hàng đã xong |
| Header: căn **giữa**, `h1 text-[40px]`, `BackButton` tách riêng phía trên | Header **1 hàng**: back `56` + khối chữ căn trái `22px` + phụ `13px` | Chuyển header sang `flex-row items-center gap-2.5` trên phone; `BackButton` hiện `66×66` → design `56×56` (xem Q4) |
| CTA sticky (`sticky bottom-0 … bg-gradient-to-t from-cream-50`), `CTA_BUTTON` `min-h-[72px] text-[26px] rounded-xl4` | CTA `height:64`, `20px`, `radius:20`, ghim đáy **cùng hàng với Foxy** | Hạ xuống `h-16 text-xl rounded-[20px]`; Foxy đã ở cùng hàng ✔ nhưng hiện là `justify-between`, design là `Foxy 66px` + `CTA flex:1` |
| Nhãn CTA: `'Bắt đầu ▸'` / `'Tiếp tục ▸'` | **“Tiếp tục: 5 thẻ phát âm 🗣️”** — có tên bước kế | **Chuỗi mới**: cần ghép `KIND[...].title(n)` + emoji vào nhãn CTA |
| Chip `Bậc ⭐ {band}` + `{doneCount}/{total}` | “Bậc ⭐ 2 · **Đọc từ**” (có tên bậc) + “**1/5 nhóm xong**” | Chuỗi mới: thêm tên bậc vào chip 1; chip 2 đếm **nhóm**, không phải item |

---

## 5. M3 / M3b — Khung chung “luyện nói” (design nói rõ: dùng cho **cả 5 loại bài**)

Đây là **template**, không phải một màn. Annotation M3: “**Khung chung:** back 56 + chip vị trí (trên)
· nội dung co giãn ở giữa · mic 124px + Foxy + đếm ngược ghim nửa dưới.”
Trong app, template này chi phối: `PracticeCard.tsx`, `WordCard.tsx`, `SoundPractice.tsx`,
`SentenceBuilder.tsx`, `PairPractice.tsx`, `StarPractice.tsx`, `VoicePractice.tsx`.

### M3 — trước khi nói
Root `padding:56px 20px 44px`, flex column, **không** gap (3 vùng tự cân).

| Vùng | Số đo |
|---|---|
| Header (ghim) | back `56×56`; chip vị trí “Từ mới 1/3” `#E2F6F1`/`#1FA396` `15px` radius `12` padding `7px 14px`; spacer; 3 chấm `12×12` gap `5` (hiện tại `#FF7A59`, còn lại `#E2D5C0`) |
| Giữa (`flex:1`, căn giữa, gap `14`) | thẻ ảnh `170×170` radius `28` white shadow `0 8px 0 #EFE2CC`, emoji `86px`; từ **`44px`** Baloo 800 `line-height:1.1`; IPA `17px #A79781`; “🔊 Nghe mẫu” `height:64` `#E2F6F1`/`#1FA396` `19px` padding `0 26` radius `20` shadow `0 5px 0 #C4E8E1` |
| Nửa dưới (ghim) gap `10` | Foxy idle `60×58` + bubble `15px` “Nói to, rõ trong **5 giây** nhé!” (số coral `#F2603D`); **mic `124×124`** `#FF7A59` shadow `0 8px 0 #E05A3A, 0 0 0 10px #FFE3D7` glyph `50px`; caption `16px #8A7A6D` “Chạm để nói nào!” |

**Câu dài:** “từ 44px — **câu dài giảm còn 28px**”.
**375×667:** “emoji card thu còn **130**, bỏ dòng ‘Chạm để nói’ — mic vẫn ≥120 và trên fold.”

### M3b — kết quả (design gọi là “nén vừa 844”)
Root `padding:56px 20px 44px; gap:12`.

| Vùng | Số đo |
|---|---|
| Header | back `56` + chip “Từ mới 1/3” + **nhãn mờ bên phải** = nội dung vừa đọc, `18px` `#D9C9AE` |
| **Thẻ điểm gộp** | white radius `24` padding `14px 16px` shadow `0 6px 0 #EFE2CC`; **1 hàng**: 3 sao `36px` (đủ `#FFB020`, thiếu `filter:grayscale(1) opacity:.45`) ⟷ “Điểm: 58” `26px #F2603D` + “Cố thêm chút nữa! 💪” `12px #B0A18E` |
| Chip từ tô màu | “✗ three” `24px` padding `9px 20px` radius `16`, `#FFE3E6`/`#C2354B`/border `3px #F8A3AE` |
| **4 thanh → lưới 2×2** | `grid-template-columns:1fr 1fr; gap:9px 14px`; nhãn `12px #B0A18E` + trị `12px #8A7A6D`; track `height:10 radius:8 #F1E7D4`; fill ≥80 `#7ED99A` · ≥55 `#FFC533` · còn lại `#FF9A8A` |
| Tip 👅 | `#FFF6E0` border `3px #FFDF9E` radius `18` padding `11px 14px`; emoji `28px`; chữ `13px #9A6B00` `line-height:1.45` — **“Tip 👅 chỉ hiện khi <2 sao”** |
| 2 nút nghe | `height:56`, white, border `3px #C4E8E1`, `#1FA396`, `15px`, radius `16`, padding `0 16` |
| Spacer | `flex:1` |
| **CTA đáy (ghim)** | “↻ Thử lại” `flex:1 height:64` white border `3px #EFE2CC` `#8A7A6D` `18px` radius `20` shadow `0 5px 0 #EFE2CC` · “Tiếp theo →” **`flex:1.35`** `height:64` coral `18px` radius `20` shadow `0 5px 0 #E05A3A` |

Annotation nén: “① nội dung đọc thu thành nhãn mờ góc phải header · ② sao + tổng điểm **GỘP 1 thẻ 1 hàng**
· ③ 4 thanh điểm → lưới 2×2 · ④ từ tô màu = chip. Tổng **~640px**, dư chỗ cho 667.”

### Delta vs code hiện tại

| Hiện tại | Design | Việc phải làm |
|---|---|---|
| `MicButton.tsx`: idle `h-[150px] w-[150px] text-[62px]`, recording `h-[190px] w-[190px] text-[76px]`, shadow `0_10px_0_#E05A3A,0_0_0_12px_#FFE3D7` | idle **`124×124`**, glyph `50px`, shadow `0 8px 0 #E05A3A, 0 0 0 10px #FFE3D7` | Thêm biến thể phone (`h-[124px] w-[124px] text-[50px]` dưới `sm`). Design **không vẽ** kích thước recording trên mobile → xem Q6. Phone prototype gợi ý `162` trong halo `190` |
| `ScoreBars.tsx`: `flex flex-wrap justify-center gap-6`, mỗi bar `h-3 w-[130px]`, nhãn `text-[15px]`, màu **luôn** `bg-teal-500` | **grid 2×2**, bar `h-2.5`, nhãn `12px`, **fill đổi màu theo ngưỡng** 80/55 | Viết lại `ScoreBars`: `grid grid-cols-2 gap-x-3.5 gap-y-2.5`; thêm hàm màu; hiển thị **giá trị %** bên phải nhãn (hiện chỉ có trong `aria-label`) |
| `Stars.tsx` + `Chip "Điểm: NN"` + badge “🔓 Mở khoá!” nằm **rời** trong `<section className="flex flex-wrap …">` | Gộp vào **1 thẻ trắng 1 hàng** | Component mới: `ResultCard` (sao trái ⟷ điểm+lời động viên phải). Badge “🔓 Mở khoá!” **không có trong design** → xem Q7 |
| `HintCard.tsx` hiện **luôn** hiện khi `outcome === 'retry'`; `SoundPractice` hiện tip khi `tone !== 'good'` | “chỉ hiện khi **<2 sao**” | Đổi điều kiện sang `stars < 2`; thu số đo phone: emoji `44px`→`28px`, radius `xl3`(28)→`18`, chữ `text-lg`→`13px` |
| `WordCard`/`SoundPractice`: CTA “Thử lại”/“Tiếp theo” nằm **cùng hàng với mic và Foxy** (`flex flex-wrap items-end justify-center gap-6`) | Ở M3b, mic **biến mất**; 2 nút chiếm hàng đáy `flex:1` / `flex:1.35` | Ở trạng thái result trên phone: ẩn mic, đưa 2 nút thành hàng đáy ghim |
| `ScoredWords.tsx` (chưa đọc chi tiết) / chip từ | chip `24px` với border `3px` | Kiểm tra khớp `TONE` map — màu `#FFE3E6`/`#C2354B`/`#F8A3AE` đã có trong `tailwind.config.ts` (`fix.50/700/300`) ✔ |

---

## 6. M4 — Luyện âm

Root `padding:56px 20px 44px; gap:12`.

| Tầng | Ghim / co | Số đo |
|---|---|---|
| Header | ghim | back `56` + chip “Âm 2/4” `#E2F6F1`/`#1FA396` `15px` + spacer + **Foxy listen `60×58`** |
| **Tầng âm** (cam nhạt) | ghim | card `#FFF1E6` radius `24` padding `14px 16px` shadow `0 6px 0 #F2DFC9`. Hàng gap `14`: khẩu hình **`64×64`** radius `18` white emoji `34px` `animation:wiggle 1.8s` ⟷ IPA `/θ/` **`40px` `#C08457`** `flex:1` ⟷ 🔊 **`64×64`** circle `#2EC4B6` white `26px` shadow `0 5px 0 #1FA396`. Mô tả dưới: `14px #9A6B00` `margin-top:10` `line-height:1.45` |
| **Tầng từ** | **co giãn** `flex:1` | white radius `28` shadow `0 8px 0 #EFE2CC`, căn giữa gap `10`: emoji `76px`; từ **`42px`**; IPA `16px #A79781`; “🔊 Nghe mẫu” `height:64` `#E2F6F1`/`#1FA396` `18px` padding `0 24` radius `20` shadow `0 5px 0 #C4E8E1` |
| Mic | ghim đáy | mic `124×124` + caption `16px #8A7A6D` “Chạm rồi đọc: "three"” |

Annotation: “2 cột iPad → **2 tầng dọc**… mô tả 1 dòng 14px ngay dưới (**47 ký tự vừa 2 dòng là tối đa**).
Mic 124 luôn trong 844. **375×667:** emoji từ `56px`, **bỏ IPA của từ** — mô tả cách đặt lưỡi **KHÔNG bỏ**
(nội dung dạy chính).”
Và thẻ “Bỏ gì”: “✂️ **Ô khẩu hình to 220px** → gộp vào hàng âm 64px, mô tả 1 dòng — để mic ở trên nếp gấp.”

### Delta vs `client/src/screens/SoundPractice.tsx` (hiện **1045px**)

| Hiện tại | Design | Việc phải làm |
|---|---|---|
| `<div data-testid="sound-word-grid" className="grid grid-cols-1 sm:grid-cols-[minmax(180px,auto)_1fr] …">` — 2 hàng × 2 cột (sound-cell-a/b, word-cell-a/b) | 2 **tầng** dọc, mỗi tầng là 1 card | Trên `<640`: bỏ grid, dựng 2 card. `sound-cell-a` + `sound-cell-b` **gộp** thành 1 card `#FFF1E6`; `word-cell-a` + `word-cell-b` gộp thành 1 card trắng `flex:1` |
| IPA `/θ/`: `font-display text-[72px] text-coral-text` | `40px` `#C08457`, **nằm ngang** cạnh khẩu hình và 🔊 | Hạ cỡ + đổi màu trên phone. `#C08457` **chưa có trong `tailwind.config.ts`** → thêm token hoặc dùng `text-[#C08457]` |
| Khẩu hình 👄: khối riêng `h-[168px] w-[200px]` `bg-[#FFF1E6]` shadow `0_8px_0_#F2DFC9`, emoji `text-[68px]`, chỉ hiện khi **idle** | `64×64` radius `18` **nền trắng**, emoji `34px`, **luôn hiện** trong tầng âm | Xoá khối 168×200 trên phone; nhúng ô `64×64` vào hàng âm. **Đây chính là “ô 220px” design cắt** |
| “🔊 Nghe âm lẻ” = `Button variant="secondary"` (`min-h-[64px] px-8 text-[22px]`) | Nút tròn **`64×64`** chỉ có 🔊 | Trên phone đổi thành nút tròn; nhãn chuyển sang `aria-label` |
| `tip` (PHONEME_TIPS) render `text-lg` trong cell B, dòng riêng | `14px`, tối đa 2 dòng, ngay dưới hàng âm | Hạ `text-sm`; **không** ẩn ở 667 (design cấm) |
| Từ: emoji `text-[84px]`, chữ `text-[56px]`, IPA `text-[22px]`, chip “Từ n/3”, nút mẫu = `SAMPLE_CHIP` pill trắng | emoji `76px`, chữ `42px`, IPA `16px`, nút mẫu `height:64` teal-nhạt | Đóng gói thành card trắng `flex-1 rounded-[28px] shadow-[0_8px_0_#EFE2CC]`. Chip “Từ n/3” — design **không vẽ trong tầng từ**, chỉ có chip “Âm 2/4” ở header → xem Q8 |
| Header: back + `Chip mission` + `Chip "Từ n/N"` + hàng chấm `h-4 w-4` + nhãn engine `min-w-[66px]` | back + **1** chip + spacer + Foxy listen `60×58` | Bỏ chấm tiến độ và nhãn “chế độ đơn giản” khỏi header phone (hoặc chuyển xuống); **thêm Foxy listen vào header** — hiện Foxy chỉ xuất hiện khi đang ghi âm |
| Trạng thái recording: `text-[44px]` từ mờ + đếm ngược `text-[56px]` + `Foxy size="sm" say="Foxy đang lắng nghe…"` | M4 **không vẽ** trạng thái recording | Giữ nguyên hành vi; nếu cần số đo, lấy Phone prototype (đếm ngược `48px`, mic `162` trong halo `190`) — **đánh dấu là suy luận** |

---

## 7. M5 — Thẻ từ vựng (flip card)

Root `padding:56px 20px 44px; gap:10`.

| Vùng | Số đo |
|---|---|
| Header | back `56` + chip “Từ mới 2/3” `15px` + bên phải “⭐ 128” `15px #9A6B00` |
| Thẻ (giữa, `flex:1`, gap `12`) | **`width: min(320px, 82%)`**, **`aspect-ratio: 16/17`**, radius `30`, white, shadow `0 10px 0 #EFE2CC`, `padding-top:34`, `animation:wiggle 2.4s`. Chip góc `right:14 top:14` “chạm để lật 🔄” `#FFF1C9`/`#9A6B00` `12px` radius `10` padding `4px 10px`. Nội dung gap `8`: emoji `90px` · từ `38px` · IPA `16px #A79781` · 🔊 `64×64` circle `#2EC4B6` `26px` shadow `0 5px 0 #1FA396` |
| Hint dưới thẻ | `13px #B0A18E` — “Mặt sau: nghĩa "con thỏ" + câu ví dụ + 🔊” |
| Mic (ghim) | `124×124` + caption `16px` “Đọc to từ trên thẻ nhé!” |

Annotation: “**Thẻ co giãn:** width `min(320, 82%)` · tỉ lệ 16:17 → 375 màn nhỏ ra thẻ **~296×314**
(thay `320×360` cứng). Nghiêng wiggle ±3° gợi lật, chip ‘chạm để lật’.
**Sau khi nói:** sao + ‘Điểm: NN’ hiện **đè phần hint dưới thẻ**, mic đổi thành nút ‘Tiếp theo →’ —
**không đổi bố cục**.”

### Delta vs `client/src/screens/WordCard.tsx`

| Hiện tại | Design | Việc phải làm |
|---|---|---|
| `<div className={`${attempt.result ? 'h-[300px]' : 'h-[360px]'} w-[320px] shrink-0 [perspective:1200px]`}>` — **cứng 320×360**, co xuống 300 khi có kết quả | `w-[min(320px,82%)] aspect-[16/17]`, **KHÔNG đổi kích thước khi có kết quả** | Đổi sang `w-[min(320px,82%)] aspect-[16/17] h-auto`; **bỏ nhánh `h-[300px]`** trên phone (design nói rõ “không đổi bố cục”). Giữ 320×360 từ `md` lên (breakpoint 768: “thẻ lật 320×360 cố định trở lại”) |
| `animate-peek` (`rotateY(-18deg)` 4s, delay 2.5s) là gợi ý lật | `animation: wiggle 2.4s`, **±3°** (`@keyframes wiggle{0%,100%{rotate(-3deg)}50%{rotate(-1deg)}}` trong `<helmet>` file design) + **chip chữ “chạm để lật 🔄”** | Giữ `animate-peek` hay đổi sang wiggle? Design vẽ wiggle. **Chip “chạm để lật” là phần tử MỚI** — code hiện cố tình bỏ nhãn (comment trong `WordCard.tsx`: “một `🔄` ở góc + nhãn ‘MẶT TRƯỚC’ … đọc như trang trí”). → xem Q9 |
| Emoji mặt trước `text-[96px]`, từ `text-[44px]`, IPA `text-xl`, 🔊 `58px` trong hộp chạm `64` | emoji `90px`, từ `38px`, IPA `16px`, 🔊 `64×64` | Hạ cỡ trên phone |
| `facePad = attempt.result ? 'p-4' : 'p-6'` | `padding-top:34` cố định (chừa chỗ chip góc) | Đổi thành `pt-[34px]` + padding đều |
| Header: `BackButton` + `Chip mission` + `h1 text-[30px]` “Từ mới hôm nay 🧩” + `p text-lg` “Chạm thẻ để lật…” + nhãn engine | back + chip + “⭐ 128” | Bỏ `h1` và dòng hướng dẫn trên phone (chip “chạm để lật” trên thẻ thay chúng); **thêm tổng sao góc phải** — hiện Home mới có |
| Kết quả: `Stars` + `Chip Điểm` + `🔓 Mở khoá!` + `HintCard` + hàng `Foxy/Mic/Thử lại/Tiếp theo` — **đẩy trang cao thêm** | sao + “Điểm: NN” **đè lên vùng hint 13px** dưới thẻ; mic → nút “Tiếp theo →”, kích thước khung không đổi | Thay khối kết quả bằng overlay tại chỗ hint; **mic biến thành CTA** (không thêm hàng mới) |

---

## 8. M5b — Đoán nghĩa (3 lựa chọn tiếng Việt)

Root `padding:56px 20px 44px; gap:12`.

| Vùng | Số đo |
|---|---|
| Header | back `56` + chip “Đoán nghĩa 2/3” `15px` |
| Đề bài | padding `12px 0`, gap `6`, căn giữa: emoji `74px` · từ `40px` · “🔊 Nghe lại” `height:56` `#E2F6F1`/`#1FA396` `16px` padding `0 20` radius `16` shadow `0 4px 0 #C4E8E1` |
| **Lựa chọn** (`flex:1`, gap `12`, căn giữa) | mỗi hàng `height:76`, white, radius `22`, padding `0 20`, gap `14`, shadow `0 6px 0 #EFE2CC`; emoji gợi ý `32px`; đáp án `20px` (`#8A7A6D` khi chưa chọn) |
| | **đúng**: shadow `0 6px 0 #7ED99A, 0 0 0 5px #B9ECC8`, chữ ink, ✅ `24px` bên phải |
| | **sai** (annotation): “ring hồng + rung nhẹ, **cho chọn lại**” |
| Phản hồi | Foxy happy `60×58` + banner `#E3F6E8`/`#2E8B4A` `17px` padding `11px 22px` radius `16` “Đúng rồi! 🎉” |
| CTA | `height:64` coral radius `20` `20px` “Tiếp theo →” — **“hiện sau khi chọn đúng”** |

### Delta vs nhánh `guessPending` trong `WordCard.tsx`

| Hiện tại | Design | Việc phải làm |
|---|---|---|
| Emoji `text-[96px]`, từ `text-[44px]`, câu hỏi “Từ này nghĩa là gì?” `text-xl` | emoji `74px`, từ `40px`, **không có câu hỏi chữ**, thay bằng nút “🔊 Nghe lại” | Hạ cỡ; **thêm nút 🔊 Nghe lại `56px`** (mới ở bước đoán); bỏ dòng câu hỏi trên phone |
| Lựa chọn: `<Button variant="outline" className="min-w-[160px] font-display text-2xl">` — **chỉ chữ**, `flex-wrap` ngang | Hàng dọc `76px` có **emoji gợi ý `32px`** + chữ `20px` + badge phải | **Emoji trong lựa chọn là dữ liệu MỚI**: hiện `guessOptions` chỉ dùng `option.vi`. Cần lấy `option.emoji` (có sẵn trong `Word`) → đổi sang `flex-col gap-3` 3 hàng dọc |
| Sai: `animate-shake` trên đúng option đó (`SHAKE_MS = 400`) ✔ khớp “rung nhẹ” | + “ring hồng” | Thêm `shadow-[0_6px_0_#F8A3AE,0_0_0_5px_#FFD4DA]` khi sai |
| Đúng: `guessJustCorrect` → `Foxy mood="happy" say="Đoán đúng rồi! 🎉"` trong `SpeechBubble`, tự tắt sau `PRAISE_MS = 1500`, rồi **tự chuyển sang thẻ lật** | Foxy + **banner riêng** `#E3F6E8` + **nút “Tiếp theo →” ghim đáy** | ⚠️ **Xung đột luồng** — xem Q10 |

---

## 9. M6 — Nghe kể chuyện

Root `padding:56px 14px 44px; gap:10` (lề ngang **14**, hẹp nhất trong bộ, để tranh rộng).

| Vùng | Ghim / co | Số đo |
|---|---|---|
| **Tranh** | ghim trên | `width:100%`, **`aspect-ratio:16/9`** (annotation: **362×204**), radius `24`, `overflow:hidden`, shadow `0 6px 0 #EFE2CC`, `<img object-fit:cover>`. Back **`48×48`** `rgba(255,255,255,.94)` tại `left:10 top:10` glyph `20px`; chip cảnh `right:10 top:10` `rgba(255,255,255,.94)` radius `12` padding `6px 11px` `13px #8A7A6D` “Cảnh 2/4” |
| Progress | ghim | `height:11` radius `8` track `#F1E7D4`, fill `42%` **`#2EC4B6` đặc** (không gradient) |
| **Karaoke** | `flex:1`, căn giữa, gap `8`, padding `0 10`, text-center | hint `13px #2EA79B` “👆 Chạm 1 từ để nghe lại”; từ wrap gap `7`: **đã đọc `21px #CDBFA9` · đang đọc `28px #F2603D` · chưa đọc `21px` ink**; dòng Việt `14px #A79781` |
| **Transport** | ghim đáy | gap `18`: ⏮ `64×64` white shadow `0 5px 0 #EFE2CC` `22px #B0A18E` · **play `96×96`** `#2EC4B6` shadow `0 7px 0 #1FA396` glyph `38px` · ⏭ `64×64` |
| Tuỳ chọn | ghim đáy | pill tốc độ white radius `14` padding `5`, chip `44×40` radius `11` `19px` (đang chọn: `#FFE9DF` + `inset 0 0 0 3px #FF9A62`); text `14px #8A7A6D` “🎵 nhạc nền · 🇻🇳 phụ đề” |

Annotation: “Karaoke: từ hiện tại `28px` coral, đã đọc `21px` mờ. Play `96`, chuyển cảnh `64`.
**Ghim:** tranh + progress (trên), cụm điều khiển (đáy). **Phụ đề Việt là toggle, mặc định tắt trên 667.**”

### Delta vs `StoryPlayer.tsx` / `Karaoke.tsx` / `PlayerControls.tsx`

| Hiện tại | Design | Việc phải làm |
|---|---|---|
| `<h1>` tiêu đề truyện + `<p>` titleVi ở **trên cùng**, ngoài tranh | Design **không có** header chữ; chỉ tranh | Ẩn header trên phone (hoặc chồng lên tranh) |
| Tranh: `max-h-[52vh] min-h-0 flex-1` — **cao co giãn** | **`aspect-[16/9]` cố định**, `flex-none` | Đổi sang aspect-ratio; tranh không còn tranh chỗ với karaoke |
| `BackButton` trên tranh: `h-[66px] w-[66px]` | `48×48`, nền `rgba(255,255,255,.94)` | Biến thể nhỏ hơn — **dưới floor 64px, design cố ý** (nút phụ trên ảnh) |
| Chip cảnh (`Chip tone="neutral"`) + `SceneDots` **cả hai** ở góc phải tranh | Chỉ **chip chữ** “Cảnh 2/4” | Bỏ `SceneDots` trên phone (đã có thanh progress riêng) |
| Hint “👆 Chạm vào 1 từ để nghe lại” là pill trắng nổi **góc dưới-phải tranh** | Dòng chữ `13px #2EA79B` **trên** karaoke, căn giữa | Chuyển vị trí + đổi style |
| **Không có thanh progress cảnh** | `height:11` fill `#2EC4B6` | **Phần tử MỚI** — dùng `ProgressBar tone="teal"` nhưng tone teal hiện là **gradient** `from-teal-500 to-good-300`; design M6 là teal đặc | Thêm tone đặc hoặc `className` override |
| `Karaoke.tsx`: active `text-[44px]`, còn lại `text-[32px]`; mỗi từ là nút `min-h-[64px] min-w-[64px]` | active `28px`, còn lại `21px`; gap `7` | Hạ cỡ trên phone. ⚠️ `min-h/min-w-[64px]` mỗi từ ⇒ với `21px` chữ, khoảng cách từ sẽ **rất thưa** — cần rà lại (Q11) |
| `PlayerControls`: play `h-[104px] w-[104px] text-[44px]`; ⏮⏭ `64×64` ✔; speed chip `h-[46px] w-[52px]`; `Toggle` phụ đề `min-h-[64px]` có chữ “Phụ đề Việt” | play `96×96` `38px`; speed chip `44×40`; **toggle rút thành dòng chữ 14px “🎵 nhạc nền · 🇻🇳 phụ đề”** | Hạ play xuống `96`; ⚠️ design vẽ toggle **thành text tĩnh**, không rõ tương tác → Q12 |
| `subtitles` mặc định: xem `useStoryPlayer` | “mặc định **tắt** trên 667” | Đổi default theo chiều cao viewport (`<700px` → off) |
| Nút “Tiếp tục ▸ / Bỏ qua ▸” dưới cùng | **Design M6 KHÔNG có nút này** | → Q13 |

---

## 10. M6b — Quiz sau truyện

Root `padding:56px 20px 44px; gap:12`.

- Header: back `56` + Foxy idle `54×52` + bong bóng `flex:1` white radius `16`/bottom-left `6`
  padding `10px 12px` shadow `0 4px 0 #EFE2CC`: câu hỏi `16px` Baloo 800 + 🔊 **`44×44`** circle
  `#2EC4B6` `17px` shadow `0 4px 0 #1FA396`.
- **3 thẻ tranh dọc** `flex:1; gap:12`: mỗi thẻ `height:170`, radius `22`, `overflow:hidden`,
  shadow `0 6px 0 #EFE2CC`; đúng: `0 8px 0 #7ED99A, 0 0 0 5px #B9ECC8`.
  Nhãn từ: `left:12 bottom:10`, `rgba(255,255,255,.95)`, radius `12`, padding `5px 12px`, `15px`.
- CTA `height:64` coral radius `20` `20px` “Tiếp theo →”.
- **375×667:** “thẻ `128px`, vẫn 3 thẻ không cuộn.”
- “cả thẻ là vùng chạm”.

**Delta:** `client/src/screens/StoryQuiz.tsx` **không nằm trong danh sách file được yêu cầu đọc**,
nên brief này chưa map chi tiết. Điểm cần chú ý: design dùng **ảnh thật từ `art/`** làm đáp án
(`story-my-breakfast-scene-2.png`, `story-little-fox-scene-4.png`, `story-at-the-zoo-scene-5.png`),
không phải emoji — trong khi Phone prototype dùng **emoji `60px`**. → Q14.

---

## 11. M7 — Các bậc luyện nói (thang zigzag dọc)

Root `padding:56px 20px 44px; gap:10`.

| Vùng | Số đo |
|---|---|
| Header (ghim) | back `56` + tiêu đề `22px` “Các bậc luyện nói 🗣️” + phụ `13px #8A7A6D` “Leo từng bậc — mỗi bậc một trò mới!” |
| **Vùng bậc** | `flex:1; position:relative;` **`flex-direction: column-reverse`**; `justify-content: space-between`; `padding:6px 0` → **bậc 1 ở ĐÁY** |
| ├ Đường mòn | SVG `width:350; height:100%`, `viewBox 0 0 350 560`, `preserveAspectRatio:none`, stroke `#EAD9BE` width `9` `dasharray "2 18"` |
| ├ Hàng | `justify-content: i%2 ? flex-end : flex-start` (so le trái/phải), `z-index:1` |
| ├ Ô bậc | **`236×84`**, padding `0 14`, radius `20`, gap `10`; emoji `30px`; tên `16px`; sao `12px`; tag `13px #B0A18E` |
| │ | **done**: white shadow `0 5px 0 #EFE2CC`, tag “✓” · **current**: shadow `0 6px 0 #1FA396, 0 0 0 3px #2EC4B6`, tag “**ĐANG HỌC**” · **lock**: `#F3EADA` shadow `0 5px 0 #E2D5C0`, emoji 🔒, tên `#A79781`, tag rỗng |
| └ Foxy | cạnh bậc hiện tại: `58×56`, `margin-left:-6`, `animation:bob 2.6s` |
| CTA (ghim đáy) | `height:64` coral radius `20` `20px` “**Luyện bậc 2: Đọc từ 🎈**” |

**375×667:** “bậc cao **72px**”.
Data: 1·Tập âm 🦁 3★ · 2·Đọc từ 🎈 2★ (current) · 3·Nghe & chọn 👯 🔒 · 4·Sentence Stars ⭐ 🔒 · 5·Story Voice 🎭 🔒.

### Delta vs `client/src/screens/LevelStairs.tsx`

| Hiện tại | Design | Việc phải làm |
|---|---|---|
| `TILE = 'flex h-[180px] w-full max-w-[220px] flex-**col** items-center justify-center gap-2 rounded-xl3'` — ô **dọc 180px** | ô **ngang 236×84** | Viết lại `TILE` cho `<640`: `flex-row h-[84px] w-[236px] px-3.5 gap-2.5 rounded-[20px]` |
| Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-end`, `lift` = `lg:mt-[240px]…lg:mt-0` | `column-reverse` + so le `flex-start`/`flex-end` + đường mòn SVG | **Bố cục mới hoàn toàn cho phone**: `flex flex-col-reverse justify-between` + `self-start`/`self-end` xen kẽ; `lift` giữ nguyên cho `lg` |
| **Không có đường mòn** trên màn này | SVG dotted `viewBox 0 0 350 560` | **Phần tử MỚI** (Home đã có `TRAIL`, LevelStairs thì chưa) |
| Emoji `text-[56px]`, tên `text-[21px]`, `StarRow` mặc định `md` | emoji `30px`, tên `16px`, sao `12px` | Hạ cỡ; `StarRow size="sm"` (`text-xl`≈20px) vẫn hơi to so với `12px` → cần size mới hoặc `text-[12px]` |
| **Không có tag** trạng thái | tag `13px`: “✓” / “ĐANG HỌC” | **Chuỗi + phần tử MỚI** |
| Foxy: `<div className="h-[96px] …">` **phía trên** mỗi ô, `size="sm"` (64px) | `58×56` **bên cạnh** ô, `margin-left:-6` | Chuyển sang cùng hàng với ô bậc |
| Bậc khoá: `bg-[#F3EADA] opacity-75 shadow-[0_8px_0_#E2D5C0]` + `Chip "Sắp có"` | `#F3EADA` shadow `0 5px 0 #E2D5C0`, **không chip**, tag rỗng | Bỏ chip “Sắp có” trên phone |
| **Không có CTA đáy** | CTA `64px` “Luyện bậc 2: Đọc từ 🎈” | **Phần tử MỚI**: cần tính “bậc hiện tại” (đã có `foxyOn`) và render CTA |
| Header căn giữa `h1 text-[40px]` “Speak Lab 🗣️”, `BackButton` riêng dòng trên | 1 hàng: back `56` + tiêu đề `22px` “**Các bậc luyện nói** 🗣️” | Đổi layout header + **đổi chuỗi** (design dùng tiếng Việt, code dùng “Speak Lab”) |
| Blob `-right-20 -top-24 320×320 bg-teal-50` | M7 **không có blob** | Ẩn trên phone |

---

## 12. M8 / M8b / M8c

### M8 — Màn chủ đề (Động vật)

- **Header đảo teal**: `position:absolute; left:0; right:0; top:0; height:236; background:#2EC4B6;
  border-radius: 44px 44px 40px 40px`. Annotation: “**1 trong 2 màu nền được phép**”.
- Root `padding:56px 20px 44px; gap:12`.
- Hàng trên: back `56` `rgba(255,255,255,.92)` shadow `0 4px 0 rgba(0,0,0,.1)` glyph `#1FA396`;
  chip phải `rgba(255,255,255,.92)` radius `14` padding `8px 14px` `15px #1FA396` “⭐ 2/9 sao đảo”.
- Khối tiêu đề (padding `4px 6px 14px`, gap `14`): đĩa `92×92` white circle emoji `46px`
  shadow `0 6px 0 #1FA396`; tên `30px` **trắng**; phụ `14px #D3F1EC` “Đảo số 1 · ★★☆ · Luyện thêm nhé!”
  (sao `#FFE59E`).
- 3 mục (`flex:1; gap:12; padding-top:8`): white radius `24` padding `16px 18px` shadow `0 6px 0 #EFE2CC`
  gap `14`; emoji `34px`; tiêu đề `19px` (số đếm `#2EA79B`); chevron “▸” `22px #B0A18E`.
  Mục thuộc nhiệm vụ hôm nay: `border:3px solid #2EC4B6` + chip “☀️ Có trong nhiệm vụ hôm nay”
  `#E2F6F1`/`#1FA396` `11px` radius `10` padding `3px 10px`.
  Annotation nói mục cao **84px** (frame không set height — xem Q15).
- CTA `height:64` coral radius `20` `20px` “Học tiếp: Từ mới ▸” — “trỏ vào **mục dở dang đầu tiên**”.

**Delta vs `TopicHub.tsx`:**
`SECTION = 'flex min-h-[96px] items-center gap-5 rounded-xl3 bg-white px-6 py-4 shadow-card …'` →
`min-h-[84px] gap-3.5 rounded-[24px] px-[18px] py-4`. `SECTION_EMOJI text-[56px]` → `34px`.
`SECTION_TITLE text-[26px]` → `19px`. **Thiếu hoàn toàn**: (a) header teal `236px`, (b) chip “⭐ n/9 sao đảo”,
(c) `border-3 teal` cho mục hôm nay (hiện chỉ có chip), (d) chevron ▸, (e) **CTA “Học tiếp” ghim đáy**.
Header hiện là `flex-wrap` emoji `64px` + `h1 text-[40px]` + `StarRow` trên nền cream → phải chuyển
thành đĩa trắng `92px` + tên trắng `30px` trên nền teal.
Chip hiện dài “Có trong nhiệm vụ hôm nay”, design là “☀️ Có trong nhiệm vụ hôm nay” `11px`.
Section “Truyện” hiện hiện `titleVi` làm tiêu đề, design hiện `Truyện: The Little Fox` + phụ
“4 cảnh · đã nghe 2” (**metadata mới**: số cảnh đã nghe).

### M8b — Chúc mừng

- Nền `linear-gradient(180deg,#FFF7EA 0%,#FFEFD9 100%)` ✔ khớp code.
- Confetti: frame vẽ **16** mảnh tĩnh (`8/12/16px`, radius `50%` hoặc `3px`,
  màu `#FF7A59 #2EC4B6 #FFC533 #F45B69 #7EC8F2`); **annotation nói 44 mảnh** rơi → Q16.
- Cột giữa `gap:14; padding:0 26px`: Foxy cheer **`150×144`** `animation:bob 2.4s`;
  tiêu đề `30px` `line-height:1.2` — **“Con giỏi lắm! 🎉<br>Nhiệm vụ hoàn thành!”** (2 dòng);
  pill sao `#FFF1C9` radius `18` padding `12px 26px` shadow `0 5px 0 #EFDDA8` `24px #9A6B00` “+11 ⭐”;
  **7 chấm tuần `34×34`** gap `7` font `15px` (hôm nay có `boxShadow: 0 0 0 4px #FFE9A8`);
  dòng streak `15px #2EA79B` “🔥 Chuỗi 5 ngày liên tiếp!”;
  CTA **teal** `height:64` radius `20` padding `0 40` `20px` `#2EC4B6` shadow `0 5px 0 #1FA396`
  “Về bản đồ 🏝️”, `margin-top:8`.

**Delta vs `MissionComplete.tsx`:** `Foxy size="lg"` = 160px → `150`. `h1 text-[52px]` → `30px`
**và đổi chuỗi thành 2 dòng** (“Con giỏi lắm! 🎉 / Nhiệm vụ hoàn thành!”). Pill `text-[30px] px-8 py-3
rounded-full` → `24px` radius `18` padding `12px 26px`. Dòng streak `text-2xl` → `15px`,
chuỗi đổi “giỏi lắm” → “🔥 Chuỗi N ngày liên tiếp!”. `Button size="lg" variant="secondary"`
(`min-h-[72px] text-[26px] rounded-xl4`) → `64px / 20px / radius 20`.
**Phần tử MỚI: hàng 7 chấm tuần `34×34`** — `MissionComplete` hiện **không** hiển thị tuần
(chỉ `StreakWeek` trên Home mới có, và ở size khác).

### M8c — Góc phụ huynh

Annotation nói rõ đây là **giao diện người lớn**: “chữ `12–14px`, vùng chạm `36–48px`
(**không cần 64**), mật độ cao hơn, **không emoji trang trí ngoài chức năng**. Vào bằng PIN.
Toàn bộ vừa 844 không cuộn; trên 667 vùng thẻ cuộn dọc.”

Root `padding:56px 18px 44px; gap:11`.

| Card | Số đo |
|---|---|
| Header | back **`48×48`** glyph `19px`; tiêu đề `21px` “Góc phụ huynh 👨‍👩‍👧”; phụ `12px` “Tuần này của bé Su”; chip “🔐 PIN” `#F3EADA` radius `12` padding `6px 11px` `12px #A79781` |
| Biểu đồ | white radius `20` padding `14px 16px` shadow `0 5px 0 #EFE2CC`; tiêu đề `14px` “Phút luyện mỗi ngày”; phải `12px #2EA79B` “TB 14'/ngày”; vùng cột `height:86` gap `9`; cột `maxWidth:26` radius `7` `height: max(4, v*3.4)`, màu `v≥12 → #2EC4B6`, `v>0 → #FFC533`, `v=0 → #F1E7D4`; nhãn `10px #B0A18E`. Data `[14,18,9,16,0,0,0]` — **7 ngày** |
| Âm yếu | tiêu đề `14px`; chip `15px` radius `12` padding `7px 13px`: “/θ/ · 45%” `#FFE3E6`/`#C2354B`; “/r/ · 63%”, “/ʃ/ · 68%” `#FFF3D6`/`#9A6B00` |
| Bài học | tiêu đề `14px`; “Bậc luyện nói” `12px` + 5 nút `flex:1 height:44` radius `12` `16px` (chọn: `#2EC4B6` white shadow `0 4px 0 #1FA396`; khác `#F3EADA`/`#A79781`); “Độ dài nhiệm vụ” + 3 nút `height:44` `14px`: Ngắn 10' / **Vừa 15'** / Dài 25' |
| Giới hạn | white radius `20` padding `12px 16px`; ⏰ `20px`; nhãn `14px`; nút −/+ **`36×36`** radius `10` `#F3EADA`; trị `17px #2EA79B` “20'” |
| Reset | `height:48` radius `16` border `2px #E2D5C0` `14px #A79781` “↺ Đặt lại tiến độ tuần này” |

**Delta vs `ParentDashboard.tsx`:**
- Biểu đồ hiện **14 ngày** (`h-40` = 160px, có đường mục tiêu nét đứt, nhãn `text-[10px]`) →
  design **7 ngày**, vùng cột `86px`, **không có đường mục tiêu**. → Q17.
- Mọi nút hiện `min-h-[64px]` (band, length, limit chips) → design `44px`; nút −/+ `36×36`
  (design **cố ý** cho phép <64 vì là UI người lớn). Nút play bản ghi `h-16 w-16` (64) → design không vẽ.
- Grid `lg:grid-cols-[1.4fr_1fr]` 2 cột → phone 1 cột (đã đúng nhờ `grid-cols-1`).
- **Design bỏ trên phone**: card “Điểm trung bình” (3 ô Nói/Từ vựng/Ghép câu), card “Bản ghi gần đây”,
  ô nhập số phút tuỳ ý (`<input>` `h-16 w-24`), dòng “Áp dụng từ bài học ngày mai”. → Q18.
- **Design thêm**: chip “🔐 PIN” ở header, dòng “TB 14'/ngày”, chip âm yếu có **% ngay trong chip**
  (hiện `ParentDashboard` hiện `PHONEME_TIPS` dạng đoạn văn `text-sm` bên dưới — design **bỏ tip**,
  chỉ giữ chip).

---

## 13. Breakpoint rules

Nguyên văn thẻ “Quy tắc chuyển đổi breakpoint” trong file design:

> **&lt;640 (phone, file này):** 1 cột · bản đồ → lưới/bản đồ dọc thu gọn · CTA + nhiệm vụ ghim đáy ·
> luyện âm xếp dọc · thẻ lật co theo màn (max 320) · thang Speak Lab → bậc zigzag dọc.
> **768 (tablet portrait, đã có trong Speak Up Screens):** giữ bố cục phone nhưng 2 cột cho lưới
> đảo/nhiệm vụ; thẻ lật 320×360 cố định trở lại; nhiệm vụ không cần ghim.
> **1194 (iPad landscape, gốc):** đổi hẳn bố cục — bản đồ cong, luyện âm 2 cột ngang, thang chéo.
> **Chỉ co giãn** (không đổi bố cục): màu, bóng chunky, bo góc, Foxy, chip, sao.

### Quy đổi sang Tailwind của dự án

| Design | Tailwind hiện có | Ghi chú |
|---|---|---|
| `<640` | **mặc định** (chưa có prefix) | Tailwind `sm` = 640 → mọi class **không prefix** chính là phone |
| `768` | `md:` | ⚠️ **App hiện dùng `sm:` (640) làm mốc “tablet”** ở `SoundPractice` (`sm:grid-cols-[…]`), `SoundWordList` (`sm:grid-cols-3`), `LevelStairs` (`sm:grid-cols-2`), `Home` (`sm:p-7`). Design nói mốc là **768**, không phải 640 → phải **rà và đổi `sm:` → `md:`** ở các chỗ đó, nếu không iPhone 390 và 375 sẽ nhận layout tablet ở đúng những màn đang quá cao |
| `1194` | `lg:` (=1024) | App dùng `lg:` cho bản đồ cong / thang chéo. Design nói `1194`. `lg`=1024 sẽ **bật bố cục iPad landscape sớm 170px** — hiện `Home.tsx` đã bù bằng `lg:max-h-[calc(100vh-180px)]`. Cân nhắc thêm screen `ipad: 1194px` vào `tailwind.config.ts` (xem Risks) |

**Điều KHÔNG đổi qua breakpoint** (design liệt kê rõ): màu, bóng chunky (`shadow-card`,
`shadow-chunky-*`), bo góc (`xl2/xl3/xl4`), Foxy, chip, sao. → **`tailwind.config.ts` không cần
đổi token**, chỉ thêm nếu muốn: `#C08457` (IPA luyện âm), `#F45B69` (confetti), `#F4B8C8`/`#B8A6E8`
(màu đảo M1a), screen `ipad`.

---

## 14. Open questions / conflicts

| # | Vấn đề | Chi tiết | Cần ai quyết |
|---|---|---|---|
| **Q1** | **M1a: viewport băng bản đồ** | Annotation ghi “viewport **410px**”, frame tính ra **344px** (`844−188−312`). Lệch 66px. | Design |
| **Q2** | **★ M1a hay M1b?** | Design **đề xuất M1b** (bỏ bản đồ trên phone) nhưng **cố ý giữ cả hai** (“Vẫn giữ M1a … để bạn chọn”). Đây là quyết định sản phẩm, không phải kỹ thuật: bản đồ đảo là **ẩn dụ trung tâm** của app (chuỗi chuỗi CTA “Về bản đồ 🏝️” ở `MissionComplete`, `DailyMission`, `TopicHub` `BackButton label="Về nhà"`). Chọn M1b ⇒ 4 chuỗi “Về bản đồ” nói dối trên phone. | **Sản phẩm (chặn)** |
| **Q3** | Streak “chi tiết xem khi chạm” | M1b rút streak thành 7 chấm `14px` và ghi “(chi tiết xem khi chạm)”. **Design không vẽ** popover/sheet đó. | Design |
| **Q4** | BackButton `66` vs `56` / `48` | App: `66×66` (comment trong `BackButton.tsx` giải thích 66 là để giữ ≥64 khi bị bóp). Design: `56` (đa số), `48` (M6 trên ảnh, M8c người lớn). `56` **vẫn ≥ floor 64?** Không — 56 < 64. Design tự mâu thuẫn với luật “vùng chạm ≥64px” của chính nó. | Design |
| **Q5** | `limit-banner` | Home hiện có banner “Hôm nay bé học đủ rồi 🦊”. Không frame nào vẽ. Nó chèn thêm ~70px vào một màn đã ghim chặt. | Design |
| **Q6** | Mic khi **đang ghi âm** trên phone | Mobile chỉ vẽ mic idle `124`. Code hiện phóng `150→190`. Phone prototype (bản cũ): `162` trong halo `190`. Nếu giữ tỉ lệ code, `124 × 190/150 ≈ 157`. | Design |
| **Q7** | Badge “🔓 Mở khoá!” | Có trong `WordCard.tsx`, **không có trong M3b/M5**. Bỏ hay gộp vào thẻ điểm? | Design |
| **Q8** | Chip “Từ n/3” ở luyện âm | M4 chỉ có chip “Âm 2/4” ở header. Code có **cả hai** counter và giải thích rõ lý do (comment `SoundPractice.tsx`: “Both counters earn their place here”). Design dường như bỏ mất counter thứ hai. | Design |
| **Q9** | Chip “chạm để lật 🔄” | M5 **thêm lại** nhãn chữ mà code đã **cố ý gỡ** (comment `WordCard.tsx` §6: một `🔄` + nhãn “MẶT TRƯỚC” “đọc như trang trí” với trẻ 5 tuổi). Design đưa nhãn trở lại. | Design + sản phẩm |
| **Q10** | **Luồng đoán nghĩa** | Code: đoán đúng → khen 1.5s → **tự** chuyển sang thẻ lật. M5b: đoán đúng → banner + **nút “Tiếp theo →” ghim đáy** (chờ trẻ bấm). Hai luồng khác nhau; M5b cũng cho “**chọn lại**” khi sai, code cũng cho ✔. | Sản phẩm |
| **Q11** | Karaoke tap target | `Karaoke.tsx` đặt `min-h-[64px] min-w-[64px]` cho **mỗi từ**. Với chữ `21px` và gap `7`, 8 từ × ≥64px = ≥568px > 362px khả dụng ⇒ **chắc chắn xuống dòng nhiều**. M6 vẽ 6 từ vừa 2 dòng. Không rõ design có định giữ floor 64px cho từng từ không. | Design |
| **Q12** | Toggle nhạc/phụ đề ở M6 | Frame vẽ **dòng chữ tĩnh** “🎵 nhạc nền · 🇻🇳 phụ đề” `14px`, không có track/knob. Annotation nói “Phụ đề Việt **là toggle**, mặc định tắt trên 667”. Phone prototype có 2 toggle `50×28` thật. | Design |
| **Q13** | Nút “Tiếp tục ▸ / Bỏ qua ▸” ở player | Có trong `StoryPlayer.tsx`, **không có** ở M6. Nếu bỏ, trẻ không có đường sang quiz. Phone prototype **có** (nút full-width dưới cụm điều khiển). | Design |
| **Q14** | Đáp án quiz truyện: ảnh hay emoji? | M6b dùng **ảnh `art/*.png`** `170px`. Phone prototype dùng **emoji `60px`**. `StoryQuiz.tsx` chưa được rà trong brief này. | Design |
| **Q15** | Chiều cao mục ở M8 | Annotation “3 mục **84px**”, frame **không set height** (chỉ `padding:16px 18px`) ⇒ chiều cao thật ~`19+11+32=`~78–90px tuỳ nội dung. | Design (nhẹ) |
| **Q16** | Confetti M8b: 16 hay 44? | Frame render `hint-placeholder-count="12"`, data tạo **16**; annotation nói **44 mảnh**. Code `Confetti.tsx` chưa rà số lượng. | Design (nhẹ) |
| **Q17** | Biểu đồ phụ huynh: 7 hay 14 ngày? | Code `ParentDashboard.tsx` vẽ **14 ngày** + đường mục tiêu nét đứt. M8c vẽ **7 ngày**, không đường mục tiêu, tiêu đề “Tuần này”. Bỏ 7 ngày dữ liệu là **mất thông tin cho phụ huynh**. | Sản phẩm |
| **Q18** | M8c bỏ 2 card | Design bỏ “Điểm trung bình” và “**Bản ghi gần đây**” (nghe lại giọng bé). Card bản ghi là tính năng thật, có `progress/recordings`. Bỏ trên phone = mất tính năng, không chỉ mất layout. | **Sản phẩm** |
| **Q19** | Màn **không có trong bộ Mobile** | `SoundWordList`, `LevelSelect`, `SentenceList`, `SentenceBuilder`, `PairLevel`/`PairPractice`, `StarPractice`, `VoicePractice`, `StoryList`, `StoryRetell`, `WordTopics`, `WordList`, `ParentGate` — **12 màn** không được vẽ. Annotation M3 nói khung M3/M3b là “khung chung 5 loại bài”, ngụ ý áp dụng cho `PairPractice`/`StarPractice`/`VoicePractice`/`SentenceBuilder`, nhưng **các màn danh sách** (`SoundWordList`, `SentenceList`, `StoryList`, `WordList`) không có mẫu nào. | Design |
| **Q20** | Mốc breakpoint tablet | Design nói **768**; app đang dùng `sm:` = **640** làm mốc chuyển ở 4 màn. Trên iPhone Plus/Max ngang (không phải case chính) và trên mọi tính toán `sm:`, hành vi sẽ lệch design. | Kỹ thuật |

---

## 15. Risks — những thứ **sẽ làm hỏng iPad** nếu triển khai ngây thơ

1. **Đổi thẳng `sm:` (640) thành mốc phone.**
   `SoundPractice` dùng `sm:grid-cols-[minmax(180px,auto)_1fr]` để dựng **bố cục 2 cột iPad**.
   `LevelStairs` dùng `sm:grid-cols-2`. `SoundWordList` dùng `sm:grid-cols-3`.
   Nếu viết layout phone mới vào **base** (không prefix) mà quên rằng iPad landscape 1194 **cũng
   thoả `sm`**, base sẽ bị `sm:` ghi đè đúng như hiện tại ⇒ an toàn. **Nhưng** nếu ai đó “dọn dẹp”
   bằng cách đổi `sm:` → `md:`, iPad **portrait 834** vẫn thoả `md` ⇒ vẫn ổn; đổi thành `lg:` mới
   nguy hiểm. → Quy tắc: **layout phone luôn ở base, layout iPad luôn có prefix, không bao giờ ngược lại.**

2. **`h-[100dvh]` / `overflow:hidden` ở root.**
   Design ghim mọi frame vào đúng 844px. Nếu áp `h-screen overflow-hidden` cho `<main>` ở **mọi**
   breakpoint, iPad landscape 1194×834 sẽ **cắt cụt** `Home` (bản đồ + mission card đã được tính
   `lg:max-h-[calc(100vh-180px)]`) và `ParentDashboard` (14 card, chắc chắn dài hơn 834).
   → Chỉ khoá chiều cao **dưới `md`**; từ `md` lên giữ `overflow-y-auto` như hiện tại.

3. **Xoá `SLOTS` / `TRAIL` / `<svg viewBox="0 0 1194 834">` trong `Home.tsx` khi chọn M1b.**
   `Home.tsx` có `throw new Error(...)` ở module load nếu `TOPICS.length > SLOTS.length`.
   Bản đồ cong iPad **phụ thuộc hoàn toàn** vào 2 mảng đó và vào `ISLAND_BOX` với `lg:absolute lg:w-[15%]`.
   Bỏ bản đồ trên phone **không được** đụng vào chúng — chỉ được thêm nhánh `<640`.

4. **Đổi `MicButton` từ `150px` xuống `124px` không có prefix.**
   `MicButton.tsx` hard-code `h-[150px] w-[150px]` / `h-[190px] w-[190px]`. Comment nói rõ 150/190 là
   “the big coral mic of the handoff” **của bộ iPad**. Nếu sửa thẳng, mic trên iPad co lại 17%.
   → Bắt buộc `h-[124px] w-[124px] md:h-[150px] md:w-[150px]`.

5. **Đổi `Button` size `md` (`min-h-[64px] text-[22px]`).**
   `Button` là primitive dùng ở **mọi** màn. Design phone muốn CTA `64px` nhưng chữ `20–21px` và
   `rounded-[18px]`/`rounded-[20px]` — trong khi `SIZE.md` hiện là `rounded-xl3` (28px).
   Sửa `Button.tsx` trực tiếp ⇒ đổi bo góc của **cả app trên iPad**.
   → Thêm size/variant mới, không sửa `md`/`lg`.

6. **Đổi `ScoreBars` sang grid 2×2 không có prefix.**
   `ScoreBars` dùng chung cho `SoundPractice`, `WordCard`, `PairPractice`, `StarPractice`,
   `VoicePractice`, `SentenceBuilder`. Trên iPad landscape hàng ngang 4 bar `w-[130px]` là chủ ý
   (rộng, thấp). Grid 2×2 ở iPad sẽ **tăng chiều cao 2×** và đẩy CTA xuống — chính lỗi mà comment
   trong `WordCard.tsx` (“pushed ‘Tiếp theo’ off the bottom of the screen”) đã sửa một lần rồi.

7. **`sticky bottom-0` của `DailyMission` + ghim đáy phone.**
   Code hiện dùng `sticky bottom-0 -mx-6 … bg-gradient-to-t from-cream-50`. Nếu chuyển sang
   `absolute bottom-0` để giống frame, `-mx-6` và gradient sẽ **tràn khỏi** `max-w-6xl` trên iPad.

8. **Safe area là việc mới, dễ nhân đôi padding.**
   Chưa file nào dùng `env(safe-area-inset-*)`. Cách an toàn: đặt **một** lần ở root layout
   (`padding-top: max(56px, env(safe-area-inset-top) + 9px)`), **không** rắc vào từng `<main>` —
   nếu không, màn nào cũng cộng thêm 47px và iPad (safe-inset = 0) vẫn nhận `56px` thừa so với `p-6`
   hiện tại.

9. **Bỏ `StreakWeek` nhãn ngày trên phone.**
   `StreakWeek` có `data-testid="streak-dot"` + `data-today` mà `Home.test.tsx` / `habit-components.test.tsx`
   đang assert. Đổi sang 7 chấm `14px` phải **giữ nguyên testid và `data-today`**.

10. **Đổi `GROUP_CARD` trong `DailyMission`.**
    `DailyMission.test.tsx` (13 KB) assert qua `data-testid="group-${kind}"` — an toàn — nhưng
    `COLUMNS`/`MAX_GROUPS` có comment nêu rõ “a row that wrapped would push the CTA off a 834 px-tall
    screen”. Đổi grid mà không giữ `lg:grid-cols-5` sẽ tái phát lỗi đó trên iPad.

---

## 16. Tóm tắt việc mới (component / state chưa có trong app)

**Component mới:**
- `StreakDots` (7 chấm `14px`) + panel chi tiết khi chạm — *Q3 chưa có thiết kế*
- `ResultCard` (sao ⟷ điểm + lời động viên, 1 hàng) cho M3b
- Thanh progress cảnh cho `StoryPlayer` (M6) — teal đặc
- Đường mòn SVG cho `LevelStairs` (M7, `viewBox 0 0 350 560`)
- Tag trạng thái bậc (“✓” / “ĐANG HỌC”) cho M7
- CTA ghim đáy cho `LevelStairs` (M7) và `TopicHub` (M8)
- Header đảo teal `236px` cho `TopicHub` (M8)
- Hàng 7 chấm tuần `34×34` cho `MissionComplete` (M8b)
- Chip “🔐 PIN” + dòng “TB N'/ngày” cho `ParentDashboard` (M8c)
- Chip góc “chạm để lật 🔄” cho `WordCard` (M5) — *Q9*

**State / dữ liệu mới:**
- Emoji cho từng lựa chọn ở bước đoán nghĩa (M5b) — `Word.emoji` đã có, chưa dùng ở đó
- “Bậc ⭐ 2 · **Đọc từ**” — tên bậc trong chip `DailyMission`
- “Tiếp tục: **5 thẻ phát âm** 🗣️” — tên bước kế trong nhãn CTA
- “4 cảnh · **đã nghe 2**” — số cảnh đã nghe của một truyện (M8)
- “⭐ **2/9** sao đảo” — tổng sao tối đa của một đảo (M8)
- Ngưỡng “tip 👅 chỉ hiện khi <2 sao” (M3b) — hiện dùng `tone !== 'good'` / `outcome === 'retry'`
- Mặc định phụ đề **tắt** khi viewport cao <700 (M6)

**Thứ app có mà design bỏ trên phone:** đĩa đảo tròn 96px + bong bóng lời chào (M1b),
ô khẩu hình `168×200` (M4), chip “Từ n/3” ở luyện âm (M4, *Q8*), badge “🔓 Mở khoá!” (*Q7*),
`SceneDots` trên tranh (M6), nút “Tiếp tục/Bỏ qua” ở player (M6, *Q13*), chip “Sắp có” bậc khoá (M7),
card “Điểm trung bình” + card “Bản ghi gần đây” + ô nhập phút tuỳ ý + đường mục tiêu nét đứt +
7 ngày sau của biểu đồ (M8c, *Q17/Q18*), phụ đề Việt bật sẵn (M6).
