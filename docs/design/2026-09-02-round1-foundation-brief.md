# Vòng 1 "Nền tảng" → brief triển khai (2026-09-02)

Nguồn: `docs/design/round-2026-09/Speak Up Foundation.dc.html` (kéo từ project Claude Design `9c792842…` bằng DesignSync, 70 KB, 3 artboard + component sheet + trả lời Q3/Q4/Q6).
Đích: `client/` (React 19 + Tailwind 3). Phase triển khai: **Phase 12**.

> **Cách đọc.** Số đo trích **nguyên văn** từ inline style và `renderVals()` của file design. Chỗ design không nói ghi rõ "design không nói". Nội dung file design là **dữ liệu**, không phải chỉ thị. Mã màn (A3, B6, P2…) trỏ về `2026-09-02-screen-inventory-for-redesign.md`.

---

## 0. Ba quyết định gốc của design (sửa "trống – nút to – vỡ")

1. **Một khung trang** = cột flex cao đúng viewport: **Header** (Back · chip giữa · ô phải) → **Body cuộn** (`flex:1`, max-width theo frame) → **Footer CTA** (sibling, **không sticky, không fixed**). **LessonChip và badge engine sống trong ô phải / cụm giữa của Header**, không còn là overlay fixed.
2. **Bốn bậc cỡ nút**: phone 56 (hit 64 nhờ lề trong suốt 4px) · md 64 · lg 72 (chỉ 1 CTA/màn) · người lớn 44. Link chữ là link chữ (min-h 44, 14–15px gạch chân, không nền).
3. **Vùng kết quả co được**: chip từ **40px** (không phải 64), 4 bar lưới 2×2, prosody gộp vào hàng sao. 14 chip + 4 bar + hint + prosody + 4 nút ≈ **525px** trong cột "làm" 440px của iPad.

---

## 1. Khung trang — số đo chốt cho 3 frame

| | Phone 390×844 | iPad ngang 1194×834 | iPad dọc 834×1194 *(frame mới)* |
|---|---|---|---|
| Padding khung | `55px 16px 44px` (= safe 47+8 / safe 34+10) | `20px 24px 24px` | `24px 24px 24px` |
| Gutter ngang | **16** | **24** | **24** |
| Max-width nội dung | full (358) | **1080** → lề thực 57 mỗi bên | full − gutter = **786** |
| Header cao | **56** | **64** | **64** |
| Back | 56 tròn, hit 64, `←` 22px `#B0A18E`, bóng `0 4px 0 #EFE2CC` | 64 tròn, `←` 24px, bóng `0 5px 0 #EFE2CC` | như iPad ngang |
| Chip giữa | `#E2F6F1` / `#1FA396`, Baloo 15px, radius 12, padding `7px 14px` | 17px, radius 14, padding `9px 16px` + 3 chấm 14px gap 6 (`#FF7A59` / `#E2D5C0`) | như iPad ngang, không chấm |
| Badge engine | 11px `#B0A18E` "◌ chế độ đơn giản" **dưới** chip giữa | chip xám 12px `#F3EADA`/`#A79781` radius 10 padding `6px 10px` **cạnh** chip giữa | như iPad ngang |
| Ô phải = LessonChip | **56×56** radius 18 `#FFF1C9` bóng `0 4px 0 #EFDDA8`, 🌞 18px + "3/11" 13px | pill **48** padding `0 16px` radius 16, 16px "🌞 Nhiệm vụ 3/11" | như iPad ngang |
| Body | `margin-top:10px; flex:1`, w 358, h ≈ 596; **vùng duy nhất được cuộn**; nội dung căn giữa khi ngắn | `margin-top:16px; flex:1; gap:24px` — 2 cột: **dạy `flex:1` (≈616)** · **làm `440px` flex:none, gap 16** | `margin-top:16px; gap:16px` — 2 tầng: **dạy `flex:1`** · **làm `300px` cố định** |
| Fade | 40px `linear-gradient(180deg, rgba(255,247,234,0), #FFF7EA)`, `margin:0 -16px` | (footer nằm trong cột "làm", không fade) | 40px, `margin:0 -24px` |
| Footer CTA | `margin-top:-30px`, gap 10, nút **56**: outline `flex:1` · primary `flex:1.35`; bottom = safe+10 | trong cột "làm": gap 12, nút **64** `flex:1` / `flex:1.35` | căn giữa, **max-width 572**: outline 240 + primary 320, gap 12, nút 64 |
| Toast | top safe+8, giữa, `max-width:min(360px, 100% − 2·gutter)`, tối đa 2 dòng, ẩn sau **2.4s**, đè header không đè body | top 16, max 360, `#2B2320`/`#FFF7EA`, radius 16, padding `12px 18px`, 15px/800, bóng `0 8px 24px rgba(43,35,32,.25)`, z 9 | top 32, max 360 |

**Quy tắc kèm theo (design ghi):**
- Ô phải rộng **đúng bằng Back** để chip giữa luôn ở giữa. Màn có chip cảnh "Cảnh 2/4" → chip cảnh **là** chip giữa.
- Footer phone: 1 hoặc 2 nút; **3–4 nút → 2 nút phụ đưa vào body**.
- Màn danh sách & Home trên iPad ngang: chỉ 1 cột "dạy" rộng 1080, lưới 3–4 cột.
- iPad dọc: **token cỡ của iPad** (Back 64, nút md, mic 150, chữ iPad) nhưng **xếp dọc như phone**; "không phải layout md của phone phóng to". Copy "Về bản đồ" **chỉ** khi Home là bản đồ (iPad ngang); iPad dọc dùng "Về trang chủ 🏠".
- Không phần tử fixed/absolute nào trong Body.

---

## 2. Component sheet

### 2.1 Button
```
SZ  phone {h:56, fs:18, r:18, px:20}   md {h:64, fs:22, r:20, px:28}
    lg    {h:72, fs:26, r:24, px:36}   adult {h:44, fs:14, r:12, px:16}
V   primary   bg #FF7A59  c #FFFFFF  sh 0 5px 0 #E05A3A
    secondary bg #2EC4B6  c #FFFFFF  sh 0 5px 0 #1FA396
    outline   bg #FFFFFF  c #1FA396  sh 0 5px 0 #C4E8E1  bd 3px solid #C4E8E1
    ghost     bg transparent c #8A7A6D sh none          bd 3px dashed #E2D5C0
```
- Baloo 800, `white-space:nowrap`. **disabled**: `opacity .45`, bóng phẳng (`none`). **pulse** (chỉ primary, chỉ 1 nút/màn): `pulseCoral 1.6s ease-out infinite` = `box-shadow 0 5px 0 #E05A3A, 0 0 0 0→14px rgba(255,122,89,.55→0)` tại 60%.
- **lg** chỉ cho CTA chính duy nhất (MissionComplete, DailyMission). **adult** cho mọi nút ParentGate / Dashboard / CloudStart / dialog.
- Nút "↻ Thử lại" trong khung dùng viền `3px solid #EFE2CC` + bóng `0 5px 0 #EFE2CC` chữ `#8A7A6D` (khác outline teal ở sheet) — **design tự mâu thuẫn**, xem §4.

### 2.2 MicButton — 4 trạng thái
| state | phone | iPad | glyph | opacity | thêm | caption |
|---|---|---|---|---|---|---|
| disabled (chờ scorer) | 124 | 150 | 🎤 | .5 | vòng **172** `6px dashed #FFB899` `spin 3s linear` | "Đang chuẩn bị máy chấm…" |
| idle | 124 | 150 | 🎤 (50/60px) | 1 | — | "Chạm để nói nào!" |
| processing | 124 | 150 | ⏳ | .7 | **vùng dạy không hiện lại** | "Foxy đang chấm…" |
| recording | **150** | **190** | ■ | 1 | 2 halo `190px #FFE3D7` `halo 1.4s ease-out` (scale 1→1.35, opacity .55→0), halo 2 delay .7s; **7 vạch mức âm** 6×(10,18,28,22,14,24,12)px radius 3 `#FF7A59` `level 0.6+i·0.07s`, hàng cao 28 | **số đếm ngược thay caption** |
- Bóng luôn `0 8px 0 #E05A3A, 0 0 0 10px #FFE3D7`. Glyph `font-size = d × .4`. Phóng tại chỗ (`transform-origin:center`), **tầng "làm" chừa sẵn 214 = 190 + 24** cho mức âm nên không đổi chiều cao.
- Scorer chưa xong sau **3s** → dòng lỗi "Máy chấm chưa sẵn" (design nói ở mục skeleton).

### 2.3 Đếm ngược · Badge engine · LessonChip
- Đếm ngược: ô **96×96** tròn `#FFF1E6`, Baloo **44px** `#F2603D`; 2 chữ số `letter-spacing:-2px` → không nhảy bề rộng.
- Badge engine: Azure = **không có badge**. Chế độ đơn giản = chip xám như §1, luôn cạnh chip giữa.
- LessonChip: phone 56×56 · iPad pill 48 — **cả hai trong header, không fixed**.

### 2.4 ResultCard — thứ tự cố định cho cả 6 màn luyện
Hộp 440 (cột "làm"), `#FFF7EA` radius 22 padding 16 gap 12:
1. **Thẻ sao + điểm + prosody** (1 hàng, 64): trắng radius 18 padding `12px 14px` bóng `0 5px 0 #EFE2CC` gap 12 · sao 30px gap 3 (`#FFB020` / `#E2D5C0`) · câu khen Baloo 18px + dòng "Điểm: 86 · 2 từ cần sửa" 12px `#8A7A6D` · pill prosody 32 padding `0 10px` radius 10 12px (good `#E3F6E8`/`#2E8B4A` "🎭 Ngữ điệu tốt"; none `#F3EADA`/`#A79781` "— ngữ điệu").
2. **Chip từ**: h **40**, padding `0 12px`, radius 12, Baloo 15px, border 3, `flex-wrap gap 6`. Tone: good `#E3F6E8`/`#2E8B4A`/bd `#B9ECC8` "✓ " · ok `#FFF3D6`/`#9A6B00`/`#FFDF9E` "～ " · fix `#FFE3E6`/`#C2354B`/`#F8A3AE` "✗ ".
3. **4 bar** `grid 1fr 1fr gap 8px 14px`: nhãn 12px/800 (`#8A7A6D` · giá trị `#4A3B33`), track h 10 radius 8 `#F1E7D4`, fill ≥80 `#7ED99A` · ≥55 `#FFC533` · còn lại `#FF9A8A`; null → width 0, giá trị "—".
4. **HintCard** (chỉ khi <2★): `#FFF6E0` border `3px #FFDF9E` radius 16 padding `9px 12px`, 👅 24px, chữ 13px `#9A6B00`.
5. **Hàng nghe** 48: nút trắng border `3px #C4E8E1` radius 14 Baloo 15px `#1FA396` "🎧 Nghe mình" · "🔊 Nghe mẫu", gap 8. Chế độ đơn giản: còn 1 nút full.
6. **Hàng CTA** 64 gap 10 (`flex:1` / `flex:1.35`).
- Tổng ≈ **525px** với 14 chip. Phone: cùng thứ tự, **① và ⑥ ghim, ②–⑤ cuộn**.
- Chế độ đơn giản: chip chỉ xanh/đỏ, không chip vàng "～", prosody xám, bar Ngữ điệu trống nhãn "—".
- **SoundChip (B3)** cùng cỡ chip 40, thêm tone **unknown**: trắng border `3px #E2D5C0` chữ `#8A7A6D` "? /θ/" + câu dưới chip.

### 2.5 Dòng lỗi lượt nói — 5 loại (thay 1 dòng đỏ trần)
Dải `min-height 56`, `#FFE3E6` border `3px #F8A3AE` radius 16 padding `8px 8px 8px 14px`, **max-width 440, ngay trên mic**: icon 22 · tiêu đề Baloo 15 `#C2354B` · dòng phụ 12 `#8A7A6D` (nguyên nhân kỹ thuật, cho phụ huynh) · nút hành động 40 padding `0 14px` radius 12 trắng 14px `#C2354B`.
| icon | tiêu đề (bé) | dòng phụ | nút |
|---|---|---|---|
| 🎤 | Bé cho phép dùng mic nhé! | mic bị từ chối / không có thiết bị | Mở cài đặt |
| 👂 | Không nghe rõ, bé thử lại nhé! | NoMatch · timeout 15s · payload lỗi | Thử lại |
| 🌐 | Trình duyệt này chưa nghe được | không có nhận dạng giọng nói | Mở Chrome |
| 📡 | Mất kết nối — dùng chế độ đơn giản | offline / máy chấm hỏng / quota 429 | Tiếp tục |
| 🌙 | Hôm nay bé học đủ rồi! Mai gặp lại nhé | hết giới hạn phút/ngày · **mic khoá** | Về nhà |
"Hết giờ" khoá mic (disabled) và **đổi CTA thành "Về trang chủ"**.

### 2.6 Không tìm thấy (chung) · 5 empty state
- Not-found: Foxy `surprised` **96×93** · tiêu đề Baloo 22 "Ơ, không tìm thấy thẻ này 🦊" (đổi theo màn: thẻ / âm / cặp từ / câu / đoạn / truyện / đảo) · phụ 14 `#8A7A6D` "Có thể đường dẫn bị lỗi. Về nhà rồi chọn lại nhé." · nút secondary 56 "← Về trang chủ". Căn giữa, gap 12.
- Empty: hộp `#FFF7EA` radius 18 padding 16 `min-height 150` căn giữa, gap 6: emoji **34** · tiêu đề Baloo **16** · phụ **12** `#8A7A6D` · (CTA outline **44** border `3px #C4E8E1` radius 14 14px `#1FA396` nếu có việc tiếp). Phụ huynh: emoji 24, chữ 14/12.
| | tiêu đề | phụ | CTA |
|---|---|---|---|
| 📚 | Chưa có từ cần ôn hôm nay | Học thêm từ mới, mai quay lại ôn nhé! | Từ mới hôm nay → |
| 🎙️ | Chưa có bản ghi nào | Bản ghi xuất hiện sau khi bé luyện nói. | — |
| 🔤 | Chưa đủ dữ liệu âm | Cần ≥ 5 lượt nói để thấy âm hay sai. | — |
| 📈 | Chưa có lịch sử luyện | Biểu đồ sẽ hiện từ ngày học đầu tiên. | — |
| 🌞 | Hôm nay chưa có nhiệm vụ | Bé có thể luyện tự do bất kỳ đảo nào. | Luyện tự do → |

### 2.7 Notice — 6 loại
Chung: `flex items-start gap 12`, radius 16, border 3, padding `10px 10px 10px 14px`, icon 20, tiêu đề 14/800, phụ 12/700 `opacity .85` `overflow-wrap:anywhere`; nút hành động 40 padding `0 12px` radius 12 `rgba(255,255,255,.7)` 13px; ✕ 40×40 opacity .6 khi tắt được.
| loại | bg / border / chữ | ví dụ | tắt | hành động |
|---|---|---|---|---|
| ℹ️ info | `#E2F6F1` / `#C4E8E1` / `#1FA396` | Thêm Speak Up vào Màn hình chính | ✕ | Cách làm |
| ⚠️ cảnh báo | `#FFF1C9` / `#FFDF9E` / `#9A6B00` | Hôm nay bé học đủ rồi 🦊 — Giới hạn 20 phút/ngày | — | — |
| ⛔ lỗi | `#FFE3E6` / `#F8A3AE` / `#C2354B` | Máy này đang có hồ sơ của tài khoản khác | — | Góc phụ huynh |
| ✅ thành công | `#E3F6E8` / `#B9ECC8` / `#2E8B4A` | Đã liên kết tài khoản + email 61 ký tự | ✕ | — |
| 🔑 credential | `#FFFFFF` / `#2EC4B6` / `#4A3B33` | Mã khôi phục: mã Baloo **24px letter-spacing 4** nền trắng radius 10 padding `6px 12px` + nút "Chép mã" 40 teal | — | — |
| ⏳ xoá dở | `#F3EADA` / `#E2D5C0` / `#6B5B4D` | Đã xoá xong trên máy này… | — | Thử xoá lại |
Khi 2–3 banner cùng hiện (Home): xếp dọc theo ưu tiên **lỗi → cảnh báo → info, tối đa 2**, cái thứ 3 thành dòng "+1 thông báo" *(vẽ ở vòng 3)*.

### 2.8 Dialog (thay `window.confirm` / `prompt`)
- Giao diện người lớn: `width:min(420px, 100% − 32px)`, radius 20, padding 20, gap 12, bóng `0 16px 40px rgba(43,35,32,.3)`, scrim `rgba(74,59,51,.45)`. Không Foxy, không emoji trang trí.
- Tiêu đề Baloo 18 · thân 13 `#8A7A6D` · nút **44** radius 12 padding `0 16px` 14px, **hành động luôn bên phải**: Huỷ (border `2px #E2D5C0`, `#8A7A6D`) · phá huỷ `#C2354B` trắng · lưu `#2EC4B6` trắng.
- Ô nhập 44 border `2px #2EC4B6` radius 12 15px, nhãn 12 `#8A7A6D`, đếm "29/40" 11 `#B0A18E`. **Tên tối đa 40 ký tự; hiển thị rút gọn = 2 từ cuối** ("Anh Thư").
- 4 copy: xoá tiến trình (2 bản: chỉ máy này / kèm cloud — nút đỏ) · đăng xuất ("Bé vẫn học được, tiến độ sẽ không đồng bộ" — nút coral) · thêm hồ sơ / đổi tên. **Busy = spinner trong nút, không đóng được khi busy.**

### 2.9 Loading / skeleton
Shimmer `linear-gradient(90deg,#F3EADA 25%,#FFF7EA 50%,#F3EADA 75%)` size `400px 100%`, `1.4s linear`, radius 8. Skeleton **giữ đúng chiều cao thẻ cuối**: thẻ Tài khoản **168**, hàng Tiến độ từ xa **72** (avatar tròn 40 + 2 dòng 160/70%). Scorer đang tạo: mic disabled + vòng đứt nét + caption; **>3s → lỗi "Máy chấm chưa sẵn"**.

### 2.10 Sync — 7 trạng thái (pill 32, padding `0 10px`, radius 10, 12px, icon + chữ; trong header thẻ Tài khoản)
| state | icon | chữ | bg / chữ |
|---|---|---|---|
| off | — | ẩn (cloud chưa cấu hình) | — |
| offline | ⚡ | Ngoại tuyến | `#F3EADA` / `#8A7A6D` |
| pending N | ● | Chưa đồng bộ 500 mục | `#FFF1C9` / `#9A6B00` |
| syncing | ◌ xoay 1.2s | Đang đồng bộ… | `#E2F6F1` / `#1FA396` |
| synced | ✓ | Đã đồng bộ | `#E3F6E8` / `#2E8B4A` |
| error | ⚠ | Không đồng bộ được + nút "Thử lại" 32 border 2 | `#FFE3E6` / `#C2354B` |
| last synced | 🕘 | Đồng bộ lúc 09:41 | `#F3EADA` / `#8A7A6D` |

### 2.11 Stars — 1 component (gộp `Stars` + `StarRow`)
size **sm 16 / md 28 / lg 44** · value 0–3 · `letter-spacing 2px` · đủ `#FFB020`, thiếu `#E2D5C0` (không grayscale filter) · `animate` stagger **0.18s**, chỉ khi có kết quả mới.

### 2.12 BackButton — 3 cỡ + trên tranh
| | nhìn | hit | glyph | bóng | ghi chú |
|---|---|---|---|---|---|
| Trẻ · phone | 56 | 64 (lề trong suốt 4px) | 22px `#B0A18E` | `0 4px 0 #EFE2CC` | |
| Trẻ · iPad | 64 | 64 | 24px | `0 5px 0 #EFE2CC` | |
| Người lớn | 44, radius 14, padding `0 14px 0 10px` | 44 | 18px + nhãn "Về nhà" 14px `#8A7A6D` | `0 3px 0 #EFE2CC` | có nhãn |
| Trên tranh (StoryPlayer) | 48, `rgba(255,255,255,.94)` | 64 | 20px | không | góc 8/8 |
**Bỏ 66** — 66 sinh ra để chống bị bóp; khung mới cho Back `flex:none`.

---

## 3. Trả lời Q3 · Q4 · Q6 (đã ghi trên artboard)
- **Q3 — panel streak:** chạm cụm 7 chấm (hit 64×44) mở **bottom sheet** (phone, iPad dọc) / **popover 360** neo dưới cụm chấm (iPad ngang). Nội dung: "Tuần này của con 🔥" 20px + pill "⭐ 128" · hàng 7 ngày (nhãn T2–CN 11px · chấm **34** · phút 12px `#2EA79B`, "hôm nay" `#F2603D`, "—" `#B0A18E`) · 3 ô số `#FFF7EA` radius 14 (Chuỗi hiện tại `#2EA79B` · **Dài nhất** · Tuần này) 20px · nút Đóng 56 outline. Sheet: trắng, radius `28 28 0 0`, padding `10 16 44`, tay cầm 44×5. Chấm: xong `#FFC533` + ⭐; chưa `#F3EADA` `2px dashed #D9CBB4`; hôm nay ring `0 0 0 4px #FFE9A8`; ngày tương lai opacity .45. Streak 0 → "0 ngày · bắt đầu hôm nay nhé!". **Cùng cụm 34px dùng ở MissionComplete (M8b)** — 1 component, 2 chỗ.
- **Q4 — BackButton:** 56 nhìn / 64 hit trên phone; iPad 64; người lớn 44 có nhãn; trên tranh 48/64. Bỏ 66.
- **Q6 — Mic phone:** idle **124** → ghi **150** (halo tới 190). iPad 150 → 190. Lý do: 124 + ring 10 = 144 chiếm 37% bề ngang 390; 150 idle làm tầng "làm" phone cao 200+ và đẩy CTA khỏi 667.

---

## 4. Mâu thuẫn & câu hỏi mở (cần chốt trước khi code)

| # | Vấn đề | Chi tiết | Đề xuất |
|---|---|---|---|
| R1 | **Độ dày bóng nút: 3 giá trị** | Vòng 1 vẽ nút `0 5px 0`; token design-system `--edge-coral: 0 8px 0`; code `shadow-chunky-coral: 0 6px 0`. Card: sheet `0 5px 0 #EFE2CC` vs code `shadow-card 0 8px 0`. | Lấy **vòng 1 (5px)** cho nút; giữ card 8px như token. Ghi vào tailwind: `chunky-* = 0 5px 0`. |
| R2 | **Bo góc md đổi 28 → 20** | Brief cũ §15.5 cấm sửa `SIZE.md` vì đổi bo góc cả app trên iPad. Vòng 1 **cố ý** đặt md radius 20, lg 24 (code: xl3 28 / xl4 34). | Chấp nhận thay đổi toàn app — đây là redesign. Cập nhật token `xl3`? **Không**: thêm size map mới, giữ token radius cho card. |
| R3 | **Chip từ 40px là `<button>`** (PracticeCard chạm để phát mẫu) | Luật trẻ ≥64 vs chip 40. Design không nói hit area cho chip. | Chip từ thành `<span>` không tương tác; PracticeCard bỏ `onWordTap` (1 từ, đã có nút Nghe mẫu). |
| R4 | **Sao `#FFB020` vs token `sun-400 #FFC533`** | Vòng 1 và token `--color-star` đều `#FFB020`; code dùng `#FFC533`. | Thêm token `star: #FFB020`; `sun-400` giữ cho pill/chip. |
| R5 | **Radius lẻ vẫn còn** | Vòng 1 dùng 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 — không theo scale chip 12 / bubble 22 / card 28 / panel 34 của token. | Đặt scale mới trong tailwind: `r10 r12 r14 r16 r18 r20 r22 r24 r28`, bỏ `xl2/xl3/xl4` dần. |
| R6 | **iPad dọc = breakpoint nào?** | Design: iPad dọc dùng token iPad, xếp dọc. Code: `ipad:` = ≥1024 **ngang**; `md:` = ≥768 gồm cả tablet 768–1023. Design không nói tablet 768–833. | `md:` (≥768) = "iPad dọc" (token iPad, xếp dọc); `ipad:` (≥1024 ngang) = 2 cột. Tablet nhỏ hơn 834 nhận cùng layout iPad dọc. |
| R7 | **Footer sibling vs sticky hiện có** | WordCard (2 hàng sticky), DailyMission (sticky + `-mx`), SentenceBuilder (`mt-auto`) — 3 cách. | Một `PageFooter` sibling trong `PageShell`; xoá 3 cách cũ. |
| R8 | **LessonChip vào header = đổi kiến trúc** | Hiện `LessonChip` render 1 lần ngoài `<Routes>`; hợp đồng gutter 66px ở 9 màn. | `PageHeader` nhận slot `right`; `LessonChip` thành component trong header, logic ẩn/hiện giữ nguyên (`missionNav`). Xoá gutter `min-w-[66px]`. |
| R9 | **"Hết giờ" trên màn luyện là logic mới** | Chỉ Home đọc `getLimitMinutes()`. Design muốn màn luyện khoá mic + CTA "Về trang chủ". | `useSpeakingAttempt` (hoặc `PracticeFrame`) đọc `minutesToday ≥ limit` → `micState='locked'` + lỗi 🌙. |
| R10 | **"Mất kết nối — dùng chế độ đơn giản" cần lộ fallback đang âm thầm** | `createScorer` rớt xuống Web Speech không báo. | `createScorer` trả `{scorer, fallbackReason}`; hook phát lỗi 📡 1 lần/phiên, nút "Tiếp tục" đóng dải. |
| R11 | **"Mở cài đặt" / "Mở Chrome"** | Web không mở được Settings iOS. Design không nói đích. | Nút mở sheet hướng dẫn 3 bước (ảnh). Vẽ ở vòng 2 hoặc tự làm theo Notice info. |
| R12 | **Scorer >3s → "Máy chấm chưa sẵn"** | Không có timer hiện nay. | Timer 3s trong hook; lỗi dùng dải 👂 với dòng phụ "máy chấm chưa sẵn". |
| R13 | **Tên hồ sơ ≤40 + rút gọn 2 từ cuối** | Server không giới hạn; UI hiển thị "Anh Thư". Hồ sơ tên 1 từ ("Bé") → rút gọn = chính nó. | `profileState.addProfile/rename` clamp 40; helper `shortName()` dùng ở ProfilePicker/Home/Dashboard. |
| R14 | **"Dài nhất" (longest streak)** | Không có hàm. | Thêm `longestStreak(events)` trong `activity.ts`. |
| R15 | **Toast 2.4s, 2 dòng** | `useToast` timing hiện tại: kiểm tra. | Chuẩn hoá 2400ms, `line-clamp-2`. |
| R16 | **Sync `syncing`/`error`/`lastSyncedAt`** | Có trong `SyncStatus`, chưa in. | `SyncPill` đọc cả 3; "Thử lại" gọi `flushNow()`. |
| R17 | **ResultCard: HintCard chỉ khi <2★** | Code: `tone !== 'good'` / `outcome === 'retry'` (SoundPractice, WordCard). | Chuẩn: `stars < 2`. |
| R18 | **ScoreBars 2×2 mọi width** | Code: phone 2×2, md hàng ngang `w-[130px]`. Design: 2×2 trong cột 440 ở mọi frame. | Bỏ nhánh `md:flex`. |
| R19 | **Nút "↻ Thử lại" viền `#EFE2CC`** (khung) vs outline `#C4E8E1` (sheet) | Design tự mâu thuẫn. | Outline = teal `#C4E8E1` (sheet là nguồn chuẩn); "Thử lại" dùng outline. |
| R20 | **Nút "Về trang chủ" trong not-found = secondary teal 56** trên phone; iPad? | Design không vẽ not-found iPad. | Cùng component, size md trên iPad. |

---

## 5. Rủi ro cho iPad (không được regress)
1. **`Button`**: thêm `phone` và `adult`, **đổi radius md/lg** (R2) — chạy lại ảnh `docs/design/current/shoot.mjs` để so mọi màn.
2. **`MicButton`**: 124 ở base, `md:` 150; recording 150 / `md:` 190. Hiện code 150/190 không prefix → thêm prefix, không đổi số iPad.
3. **`ScoreBars`**: bỏ nhánh md hàng ngang (R18) — chấp nhận, vì nằm trong cột 440.
4. **Chip từ 64 → 40** ở mọi width (R3) — chấp nhận.
5. **`BackButton` 66 → 56/64** — mọi màn có `max-md:h-16` override phải gỡ.
6. **LessonChip** rời `App.tsx` → mọi màn phải dùng `PageHeader`, nếu không chip biến mất. Thứ tự: dựng `PageShell` trước, chuyển từng màn, giữ `LessonChip` global cho màn chưa chuyển (2 đường song song trong 1 phase là chấp nhận được).
7. **`PAGE_SHELL` safe-area** giữ nguyên biểu thức, chỉ đổi padding nghỉ: phone 55/44 đã = safe+8/+10; iPad 20–24.
8. **Test hiện có** assert `data-testid="streak-dot"`, `data-today`, `group-${kind}`, `sync-status`, `remote-*` — giữ testid khi thay component.

---

## 6. Tóm tắt việc mới (Phase 12)

**Component mới / gộp** (`client/src/components/ui/`):
`PageShell` + `PageHeader` + `PageBody` + `PageFooter` (3 frame) · `Button` size `phone | md | lg | adult` + `pulse` chuẩn · `LinkText` (min-h 44) · `MicButton` 4 state + `LevelBars` · `Countdown` (ô 96) · `EngineBadge` · `LessonChip` (trong header) · `ResultCard` (①–⑥) + `WordChip` 40 (4 tone kể cả `unknown`) · `SpeakError` 5 loại · `NotFound` · `EmptyState` (trẻ / người lớn) · `Notice` 6 loại + `NoticeStack` (ưu tiên, max 2) · `Dialog` + `useDialog` (confirm / destructive / prompt, busy) · `Skeleton` · `SyncPill` 7 · `Stars` (gộp, sm/md/lg) · `BackButton` (phone/ipad/adult/onArt) · `StreakPanel` (sheet/popover) + `WeekDots` 34 · `Toast` (2.4s, max 360, 2 dòng, safe-top).

**Token mới** (`tailwind.config.ts`): `star #FFB020` · radius scale 10–28 · `chunky-*` 5px · màu `#F1E7D4` (track) `#FF9A8A` (bar thấp) `#FFE9A8` (ring hôm nay) `#C4E8E1` (viền outline) `#FFF1E6` (ô đếm ngược).

**Logic mới**: hết giờ trên màn luyện (R9) · lộ fallback engine (R10) · timer scorer 3s (R12) · clamp tên 40 + `shortName` (R13) · `longestStreak` (R14) · `SyncPill` đọc `syncing/lastError/lastSyncedAt` (R16) · 4 dialog thay `window.confirm/prompt`.

**Không làm ở vòng 1**: màn lẻ (vòng 2–4), ảnh `art/` cho truyện, "+1 thông báo" (vòng 3), sheet hướng dẫn "Mở cài đặt" (R11).

**Thứ tự triển khai đề xuất**: token → `Button/Stars/BackButton` (ảnh so sánh) → `PageShell` 3 frame + `LessonChip` → `MicButton/Countdown/EngineBadge` → `ResultCard/WordChip/SpeakError` → `NotFound/EmptyState/Notice/Dialog/Skeleton/SyncPill` → `StreakPanel`. Mỗi bước chạy `pnpm test` + `shoot.mjs`.
