# Vòng 2 "Khung luyện nói" → brief triển khai (2026-09-03)

Nguồn: `docs/design/round-2026-09/Speak Up Practice Frame.dc.html` (115 KB, kéo về 2026-09-03; 5 artboard B6 + 8 artboard biến thể phone + 8 iPad ngang + 9 thẻ biến thể + Q7–Q10).
Đích: `client/` sau Phase 12 (mọi màn đã trên `PageShell`; `ResultCard`, `MicButton`, `SpeakError` đã có). Phase triển khai: **Phase 13**.

> **Cách đọc.** Số đo trích **nguyên văn** từ inline style/`renderVals()`. Chỗ design không nói ghi "design không nói". Mã màn theo inventory (B1–B6, C4, C7, C9, B2). Phase 12 đã dựng phần "làm" (Foxy + mic + caption + lỗi + ResultCard + CTA); vòng này chủ yếu là **phần "dạy"** của từng màn và 3 điều chỉnh ở phần "làm".

---

## 0. Bốn quyết định gốc của design

1. **Vòng đời B0 = 4 trạng thái vẽ**: idle (gồm chờ scorer) → đang ghi → đang chấm (= idle + mic ⏳, **không hiện lại deck, không vẽ riêng**) → kết quả 3★ Azure / 1★ đơn giản.
2. **Phần "làm" giống hệt ở 9 màn**: Foxy + bong bóng · mic · caption/đếm ngược · dòng lỗi · ResultCard · CTA. Chỉ phần "dạy" đổi.
3. **Header không đè**: chip giữa (Đoạn 1/8 · Câu 3/10 · Âm 2/9 · Từ 1/3) + badge engine; **chip "Cảnh N/M", chip streak Word Pop ● ○ đều là chip giữa**; ô phải = LessonChip. Đang ghi: **Back & LessonChip mờ .4 (không bấm)**, chip giữa đổi "● Đang ghi" coral (`#FFE9DF`/`#E05A3A`).
4. **Tầng dạy gập (phone) khi có kết quả**: thu thành **1 dòng 15px `#D9C9AE`** ngay dưới header (emoji + câu, ellipsis, "▾ mở" 12px `#B0A18E`), **chạm để mở lại**. ResultCard chiếm body: ① thẻ sao ghim · ②–⑤ cuộn · ⑥ CTA footer.

---

## 1. Khung chung (carrier B6) — số đo theo frame

| | Phone 390×844 | iPad ngang 1194×834 | iPad dọc 834×1194 |
|---|---|---|---|
| Body | 2 tầng, gap 12 | 2 cột gap 24: dạy `flex:1` (≈616, padding 0 24) · làm **440** | 2 tầng gap 16: dạy `flex:1` · làm **300** cố định (idle/ghi) |
| Dạy (idle) | `flex:1` căn giữa, gap 10: mood 34px + "Đọc với giọng:" 16px · đoạn **24px** Baloo · nghĩa 13px · Nghe mẫu **56** (`#E2F6F1`, radius 18, bóng `0 5px 0 #C4E8E1`, 17px) · card tips trắng radius 16, 12px | căn giữa gap 16: mood 48 + 22px · đoạn **34px** `max-width:560` · nghĩa 17px `max-width:520` · Nghe mẫu **64** (radius 20, 20px) · tips 14px `max-width:520` | như iPad ngang, đoạn `max-width:640`, nghĩa 560 |
| Làm (idle) | ghim đáy, gap 10: Foxy **60×58** + bong bóng (radius 16/6, 15px, số giây coral) · mic **124** · caption 16px | căn giữa cột, gap 14: Foxy **72×70** + bong bóng 17px · mic **150** (`margin-top:14`) · caption 18px | tầng 300: xếp **ngang** gap 40: Foxy+bubble · (mic 150 + caption) |
| Đang ghi | đoạn phóng **26px giữ màu**, tips ẩn; Foxy listen "Foxy đang lắng nghe…"; hộp 214: 2 halo 190 + mic **150** (■ 56px); hàng dưới: 7 vạch + số **44px** `letter-spacing:-2px` `min-width:56` | cột dạy **không đổi**; hộp 260: halo 240 + mic **190** (■ 72px); vạch + số **56px** `min-width:70` | tầng 300 ngang: Foxy+bubble · hộp 260 · cột (số 56px trên, vạch dưới) |
| Kết quả | dạy → dải 1 dòng (h 32); thẻ sao ghim (trắng radius 18, padding 12 14, sao 30, câu 17, dòng phụ 12, prosody pill 32); vùng cuộn gap 10: chip 40 wrap gap 6 · bar 2×2 · hint (chỉ <2★) · hàng nghe 48 · **Foxy 44×42 + câu 13px** (`Foxy: "Giọng vui thật đấy!"`); CTA **56** flex 1 / 1.35 | cột làm: ResultCard (gap 12) + Foxy 52 + câu 14px `margin-top:auto` · CTA **64** ở đáy cột → tổng 690 = cột | dạy gập thành **dải 64** trắng (emoji 28 + đoạn 18px ellipsis + "▾ mở đoạn" 13px); ResultCard `max-width:560` căn giữa (sao 36, câu 20, chip gap 8, bar 13px, hint 14px) + **Foxy 96×93 + bong bóng** 17px; CTA md **240 + 320** căn giữa |
| Ghi chú fold | idle: dạy dư 60px; **375×667 bỏ tips + caption, đoạn 22px**; kết quả cuộn ≈420 trong ≈480 → **không cuộn với 14 chip**, chỉ 375×667 cuộn | "Không có gì vượt 834 kể cả 14 chip + hint + 4 nút" | "Dư ≈300px → không bao giờ cuộn" |

**Bong bóng Foxy ở idle** ghi số giây: "Đọc cả đoạn thật có hồn nhé! **13 giây**" (coral). Mỗi biến thể có câu `say` riêng (§2).

---

## 2. Chín biến thể — phần "dạy" (idle) + ghi chú ghi/kết quả

Chung: chip giữa teal `#E2F6F1`/`#1FA396` 15px radius 12 padding 7 14 (iPad 17px radius 14 padding 9 16); chip đôi (B3, B4) = teal bo trái + coral `#FFE9DF`/`#E05A3A` bo phải dính nhau.

### B1 PracticeCard — `/practice/:id` — chip "Thẻ 1/12" · say "Nói to, rõ trong 5 giây nhé!"
- **Phone:** thẻ emoji **140×140** radius 26 trắng bóng `0 8px 0 #EFE2CC`, emoji 76 · từ **44px** · nút mờ "👁 Xem phiên âm" **36** (`#F3EADA`/`#A79781` 14px, radius 12) · hàng 2 nút 56: "🔊 Nghe mẫu" (teal) + "👄 Khẩu hình" (`#FFF1E6`/`#C08457`, bóng `0 5px 0 #F2DFC9`) · dòng streak ● ○ 16px + "Nói đúng 2 lần liên tiếp → 3 sao" 12px. Tổng 350px; **375×667: thẻ 110, ẩn dòng streak** (● ○ đã ở chip giữa).
- **iPad cột dạy:** thẻ **220×220** radius 32 emoji 120 · từ **64px** · Xem phiên âm 44 · hàng nút md 64 · dòng streak 15px. **Ô khẩu hình bật thành panel 220×220 dưới hàng nút khi chạm** (không còn là ô thứ 3 luôn hiện).
- **Ghi:** thẻ thu 150→110, từ giữ 44, ẩn 2 nút; streak ở chip giữa.
- **Kết quả 3★:** 1 chip từ + 4 bar + thẻ sao. Word Pop: lần 1 ≥80 → **kẹt 2★ + "Nói đúng lần nữa để 3★!"** streak ●●; lần 2 → 3★ "Nói đúng 2 lần liên tiếp! 🎉". **1★ đơn giản:** chip đỏ, hint chung; **CTA gate: <3★ và <3 lần → chỉ "↻ Thử lại" full-width**, sau đó 2 nút.

### B3 SoundPractice — `/sound/:ph/:id` — chip đôi "Âm 2/9 · Từ 1/3" (Q8) · say "Chạm rồi đọc: \"three\""
- **Phone:** tầng âm cam `#FFF1E6` radius 20 padding 12 14 bóng `0 6px 0 #F2DFC9`: khẩu hình **56** (radius 16 trắng, 30px) · IPA **40px** `#C08457` · loa **56** tròn teal · tip 13px `#9A6B00` ≤2 dòng. Tầng từ trắng radius 22 padding 14 bóng `0 8px 0 #EFE2CC`: emoji 60 · từ **40px** · IPA 15px `#A79781` · Nghe mẫu 56. **375×667: ẩn IPA từ, tip KHÔNG ẩn.** Bỏ 3 chấm tiến trình riêng.
- **iPad cột dạy:** tầng âm **hàng ngang** `max-width:560` (khẩu hình 64 · IPA **72** coral · tip 17 · loa 64), tầng từ card **300×300** (emoji 96 · từ 56 · IPA 20 · Nghe mẫu md).
- **Ghi:** tầng âm giữ, từ 40 giữ màu, IPA từ ẩn, ô khẩu hình wiggle.
- **Kết quả:** **không ScoredWords/ScoreBars**; SoundChip 4 tone chấm ÂM "✓ /θ/" 40px + dòng "Từ three · 88 điểm" 13px; sao: âm ≥80 → 3★. Đơn giản: unknown "? /θ/" + "Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!" (Azure không bắt được: "Chưa nghe rõ âm này"); tip 👅 luôn khi ≠ good; không thể 3★.

### B4 PairPractice — `/pair/:id` — chip đôi "Cặp 1/8 · ɪ/iː" · say "Nói cả hai từ: ship, sheep"
- **Pha 1 (nghe & chọn, chưa có mic), 3 trạng thái:** chưa bấm loa (loa 56 teal `outline:4px #C4E8E1` pulse, 2 ô **96×96** radius 18 mờ .45, "Bấm 🔊 trước nhé", tick "ship ○ · sheep ○") · đã phát & đúng (ô đúng bóng `0 6px 0 #7ED99A, 0 0 0 4px #B9ECC8`, "✅ Đúng rồi! 🎉" xanh, tick ✓) · đã phát & sai (ô sai bóng hồng `#F8A3AE/#FFD4DA`, **1 dòng duy nhất "🙈 Nghe lại rồi chọn nhé"** → hết tràn slot). iPad pha 1: nút Nghe md + 2 ô **200×200** (emoji 80, từ 36) + tick 17px.
- **Pha 2 (nói):** chip xanh 1 dòng "✓ Nghe & chọn xong: ship ✓ · sheep ✓" (`#E3F6E8`/`#2E8B4A` 13px) thay Card tóm tắt · "Giờ nói cả hai từ nhé" 17px · 2 thẻ từ **150** (emoji 48 · từ 30 · IPA 13; iPad 220: emoji 84 · từ 44 · IPA 17) · Nghe mẫu 56/64. **Mic chỉ render ở pha 2.**
- **Kết quả:** 2 chip + 4 bar + **Nghe mình trong hàng nghe** (không trong vùng cuộn). Chỉ 3★ animate. Đơn giản: 2 chip cùng màu; CTA luôn 2 nút.

### B5 StarPractice — `/star/:id` — chip "Câu 3/10" · say "Nói cả câu một hơi nhé!"
- **Phone:** câu nhấn **32/26px** (nhấn coral, ‿ 22px teal) wrap ≤2 dòng · nghĩa 14 · chú thích 12 `#B0A18E` · Nghe mẫu 56 · card nhịp trắng radius 18 padding 14 (chấm **24/12**, gap 16, caption "Nhịp của câu — chạm 🔊 để nghe lại" 12px). **Không có ô chừa 112px** — bong bóng Foxy nói "một hơi".
- **iPad:** câu **48/40** `max-width:560` · nghĩa 20 · chú thích 14 · Nghe mẫu md · card nhịp **480** (chấm 24/12).
- **Ghi:** câu giữ màu, card nhịp `animate-beat` theo mẫu vừa phát, chú thích ẩn.
- **Kết quả:** thứ tự cố định thẻ sao → chip 6 → bar → hint; **dòng nhịp 3 băng nằm ở dòng phụ thẻ sao** ("Nhịp: 🎵 tốt"), không thêm hàng. Chip toàn xanh nhưng 1★ → thẻ sao ghi "Trôi chảy 42%".

### B6 VoicePractice — `/voice/:id` — chip "Đoạn 1/8" · say "Đọc cả đoạn thật có hồn nhé! 13 giây"
- Xem §1. **ProsodyChip nằm trong thẻ sao** (không phải hàng riêng đầu tiên). 3★ cần prosody ≥80 & acc ≥70; đơn giản tối đa 2★.

### C4 StoryRetell — `/story/:id/retell` — chip "Kể lại · cảnh 3/7" · say "Bé kể lại câu này nhé — 8 giây"
- **Phone (lần đầu có rule phone):** card trắng radius 22 padding 22 18: dòng "🦊 The Little Fox · cảnh 3/7" 12px · câu **32px** · nghĩa 15 · loa **56** tròn teal. **H1 36 bỏ** (chip giữa thay). Mic 124 dưới card, **không cuộn qua mic**. Ghi 8s → đếm 8→1.
- **iPad:** card `max-width:560` padding 32 28: câu **40** · nghĩa 20 · loa 64.
- **Ghi:** card giữ, Foxy listen. **Kết quả:** băng dễ (≥60 → 3★ "Tuyệt vời! 🦊"; 35–59 → 2★ "Hay lắm!"; <35 → 1★ "Bé kể tốt lắm, thử lại nhé!" Foxy idle); thẻ sao + chip từ (3–4) + Nghe mình/Nghe mẫu; **không bar**; CTA chỉ 1 primary + Thử lại.

### C7 WordCard — `/words/:t/:w` — chip "Từ mới 2/8" (ô phải "⭐ 128" khi không có LessonChip) · say "Đọc to từ trên thẻ nhé!"
- **Pha 0 đoán nghĩa (Q10):** emoji 64 · từ 36 · "🔊 Nghe lại" 44 · 3 lựa chọn **56** (emoji 26 + chữ 18, trắng, bóng `0 5px 0 #EFE2CC`); đúng: viền xanh `0 5px 0 #7ED99A, 0 0 0 4px #B9ECC8` + ✅, 2 lựa chọn khác mờ .5 khoá, Foxy happy 48 + banner xanh "Đoán đúng rồi! 🎉", **CTA 56 ở footer, không tự chuyển**; sai: rung 400ms + ring hồng 5px, chọn lại, Foxy surprised "Thử lại nhé" 1.5s. **iPad: 3 nút 56 có emoji cả iPad** (không bỏ emoji ở md).
- **Thẻ lật:** `width:min(320px,82%)` tỉ lệ 16/17 radius 30 bóng `0 10px 0 #EFE2CC`; **peek `rotateY −18°` mỗi 6s** tới lần lật đầu; **icon 🔄 22px góc phải trên opacity .3**, tắt sau lần lật đầu; hint 13px `#B0A18E` **dưới** thẻ "Mặt sau: nghĩa + câu ví dụ + 🔊" (Q9: không có nhãn chữ trên thẻ). Mặt trước: emoji 90 · từ 38 · IPA 16 · loa 56. Mặt sau `#FFF1E6` bóng `0 10px 0 #F2DFC9`: nghĩa **34** coral · câu ví dụ 16 · "🔊 Nghe câu ví dụ" 44 (`#C08457`). iPad thẻ **320×360 cố định**; ôn tập chưa gợi ý: mặt trước = nghĩa + "?" + nút Gợi ý (không 🔊).
- **Ghi:** thẻ giữ kích thước (**không đổi 360→300**), peek dừng, 🔄 ẩn; mặt đang hiện giữ nguyên.
- **Kết quả (Q7):** **thẻ sao mini đè dòng hint dưới thẻ** (trắng radius 14 padding 8 12: ★ 22px + "Điểm: 78 · 🔓 Đã mở khoá" 12px sun-700; chưa mở: "Điểm: 52 · thử lại để mở khoá"). **Không ScoredWords** (1 từ), không bar. Footer Thử lại + Tiếp theo; mic ẩn (phone) / giữ cạnh CTA (iPad). Retry: Foxy surprised + HintCard dưới thẻ sao mini; demote Leitner nếu đã mở.

### C9 SentenceBuilder — `/sentence/:id` — chip "Câu 2/4" · say "Đúng rồi! Giờ đọc câu lên nhé"
- **Phone:** prompt 15px · khay `min-height:76` viền đứt 3px radius 18 gap 8 padding 8 (ô **44** `min-width:44` radius 12 17px, màu vai: Ai `#DDF0FB/#7EC8F2/#2E6F9E` · Làm gì `#FFE7D2/#FF9A62/#B85E2A` · Cái gì `#FFF1C9/#FFC533/#9A6B00`) · chú giải 3 pill 11px · banner "Đúng rồi! 🎉" xanh · "🔊 Đọc câu cho bé nghe" 56. **3 trạng thái khay:** rỗng ("thả vào đây" 13px) · đang xếp 2/6 ("Còn 4 ô nữa") · đầy & sai (khay rung `.4s`, viền `#F8A3AE`, "🦊 Chưa đúng — thử lại nhé" đỏ) → xoá khay.
- **iPad:** prompt 22 · khay **640×96** radius 22 (ô **56** 22px radius 14) · kho 6 ô một hàng · khi đúng: nút Đọc câu md; **mic ở cột làm từ đầu (disabled tới khi đúng)**.
- **Ghi:** khay đúng giữ, kho + chú giải ẩn, ô giữ màu vai. **Kết quả:** **ScoredWords 6 chip THAY khay tại chỗ** (cùng thứ tự) → không nhảy layout; 4 bar + hint; Tiếp theo **không xuyên chủ đề khi vào từ `?topic=`**. Sai ở bước xếp không tính là kết quả nói.

### B2 SoundWordList — `/sound/:ph` — chip "Âm 2/9" · **không mic** · say "Luyện đủ 3 từ để xanh cả âm!"
- **Phone:** tầng âm **cùng component với B3** · "Chọn một từ để luyện nhé!" 17px · lưới **3 cột** ô trắng radius 18 bóng `0 5px 0 #EFE2CC` `min-height:120` (emoji 40 · từ 17 · IPA 12 · sao 12px) · **Foxy 60 + bong bóng lấp chỗ trống** thay vì kéo ô.
- **iPad:** 1 cột (không cột làm): tầng âm ngang `max-width:640`, 3 ô **200×180** căn giữa ("không kéo rộng 330"), Foxy 72 + bong bóng.

---

## 3. Trả lời Q7 · Q8 · Q9 · Q10 (đã ghi trên artboard)
- **Q7** — bỏ badge "🔓 Mở khoá!" riêng; gộp vào dòng phụ thẻ sao: "Điểm: 78 · 🔓 Đã mở khoá" (sun-700); chưa mở: "Điểm: 52 · thử lại để mở khoá".
- **Q8** — giữ cả hai, gộp thành **chip đôi** "Âm 2/9" teal + "Từ 1/3" coral ở chip giữa, luôn hiện; bỏ 3 chấm tiến trình. Rộng ≈150px, vừa ô giữa phone (230).
- **Q9** — không nhãn chữ; 3 tín hiệu: peek −18° mỗi 6s, icon 🔄 mờ, hint dưới thẻ.
- **Q10** — đã chốt: đoán đúng → chờ bé bấm "Tiếp theo →" (như Phase 10 quyết định 3).

---

## 4. Mâu thuẫn với code Phase 12 & câu hỏi mở

| # | Vấn đề | Chi tiết | Đề xuất |
|---|---|---|---|
| R1 | **ResultCard ①: prosody + dòng phụ nhịp** | Design gộp ProsodyChip vào thẻ sao (đã làm Phase 12) **và** dùng dòng phụ (`sub`) cho "Nhịp: 🎵 tốt" (B5) / "Trôi chảy 42%". Code: `sub` tự do → chỉ cần B5 truyền. | Không đổi component; B5 truyền `sub=rhythmLine`. |
| R2 | **Foxy + câu trong ResultCard** | Design thêm Foxy 44×42 + `Foxy: "…"` 13px sau hàng nghe (phone), Foxy 52 `margin-top:auto` (iPad), Foxy 96 + bong bóng (iPad dọc). Code ResultCard không có. | Thêm prop `fox?: { mood, say }` → hàng ⑤b sau hàng nghe; cỡ theo frame. |
| R3 | **Tầng dạy gập = dải chạm mở lại** | Code Phase 12 chỉ `max-md:hidden` cột dạy khi có kết quả. Design: dải 32 (phone) / 64 (iPad dọc) ellipsis + "▾ mở", chạm để mở lại. | `PageBody split` nhận `collapsed?: { label, emoji, onExpand }`; body render dải thay tầng dạy; state `teachOpen` trong màn. |
| R4 | **Header khi đang ghi** | Design: Back + LessonChip mờ .4 không bấm; chip giữa "● Đang ghi" coral. Code: không có. | `PageHeader` nhận `dimmed?` (áp `opacity-40 pointer-events-none` lên back/right); màn truyền chip "● Đang ghi" khi `recording`. |
| R5 | **Chip đôi** (B3, B4) | Code: 2 chip rời (B3 coral chỉ khi ghi/kết quả; B4 chip + chip sm). | `Chip` thêm prop `pair` hoặc component `ChipPair` (trái teal bo trái, phải coral bo phải). B3 luôn hiện; bỏ 3 chấm. |
| R6 | **Đếm ngược & vạch cùng hàng** (phone/iPad ngang) | Code `MicButton`: vạch trên, số dưới (2 hàng). Design phone/ngang: **1 hàng** vạch + số (`gap 14/16`), số `min-width 56/70`; iPad dọc: số trên, vạch dưới. | `MicButton` prop `countdownLayout='row'|'column'` (mặc định row; iPad dọc column). |
| R7 | **Bong bóng Foxy có số giây** ở idle | Design: "… **13 giây**" coral trong bong bóng. Code: caption "Chạm để nói nào!" dưới mic + không có bong bóng ở idle. | Màn truyền `say` vào `MicButton`? Không — thêm hàng Foxy+SpeechBubble **trước** mic trong phần làm (component `SpeakPrompt { mood, say, seconds }`), caption dưới mic giữ. |
| R8 | **Mic iPad dọc xếp ngang** trong tầng 300 | Code `PageBody split` act = cột dọc. | `act` container: `md:flex-row md:gap-10 ipad:flex-col` (portrait = md không ipad). |
| R9 | **B1 ô khẩu hình → panel bật/tắt** | Code: ô thứ 3 luôn hiện (md), ẩn phone thấp. | Nút "👄 Khẩu hình" toggle panel 220×220 (iPad) / sheet? Design phone không vẽ panel → **phone: toggle inline dưới hàng nút, 140×140**. |
| R10 | **B1 dòng streak ở chip giữa** | Design: "Thẻ 1/12 · ● ○" trong chip giữa **và** dòng streak dưới thẻ (phone cao); 375×667 chỉ chip. | Chip giữa nhận `● ○`; dòng dưới thẻ `[maxh700]:hidden`. |
| R11 | **B3 SoundChip + dòng điểm từ** | Code `extra` slot đã có. Design: "Từ three · 88 điểm" 13px dưới chip; **tip 👅 luôn khi ≠ good** (không phải `stars<2`). | `extra` giữ; SoundPractice truyền `hint` khi tone ≠ good và ResultCard cho phép `forceHint`. |
| R12 | **B4 pha 1 sai 1 dòng** | Code: 2 dòng (🙈 + "Bấm 🔊 nghe lại nhé") tràn slot. | Gộp thành "🙈 Nghe lại rồi chọn nhé"; ô 96 phone / 200 iPad. |
| R13 | **B4 Nghe mình trong hàng nghe** | Phase 12 đã chuyển vào ResultCard. | Không đổi. |
| R14 | **B5 bỏ ô chừa 112** | Code có `min-h-[112px]` reserve. | Bỏ; bong bóng Foxy thay. |
| R15 | **C4 rule phone** | Phase 12 đã lên khung; design chốt câu 32 phone / 40 iPad, loa 56/64, bỏ H1. | Áp số. |
| R16 | **C7 kết quả "đè" hint dưới thẻ, không ScoredWords, không bar** | Code Phase 12 dùng ResultCard đầy đủ (1 chip + bar?) cho WordCard. Design: thẻ sao mini thay hint, thẻ giữ kích thước, mic ẩn phone. | WordCard dùng `ResultCard` biến thể `compact` (chỉ ① + hint + ⑥) hoặc component `StarsMini`; bỏ `md:h-[300px]` khi có kết quả. |
| R17 | **C7 iPad giữ emoji ở 3 nút đoán** | Code md: pill `min-w-[160px]` không emoji. | Bỏ `md:hidden` trên emoji. |
| R18 | **C9 ScoredWords thay khay tại chỗ** | Code: khay ẩn `max-md:hidden`, ResultCard trong act. | Kết quả: khay render `ScoredWords` tại vị trí khay (teach), ResultCard trong act **không** lặp chip (`words` bỏ) → ResultCard ①③④⑤⑥ + chip ở khay. |
| R19 | **C9 mic ở cột làm từ đầu (disabled)** trên iPad | Code: mic chỉ sau khi đúng. | iPad: `MicButton state="disabled"` với caption "Xếp đúng câu trước nhé"; phone: giữ như cũ (design không vẽ). |
| R20 | **C9 Tiếp theo không xuyên chủ đề** | Code `goNext` đi qua `SENTENCES` phẳng. | Khi vào từ `?topic=`, next = câu tiếp trong chủ đề; hết → về `/sentences?topic=`. |
| R21 | **B2 Foxy lấp chỗ trống; iPad 1 cột ô 200×180** | Code: lưới 3 cột `min-h-[184px]` md, trống dưới. | Áp số; thêm Foxy + bong bóng dưới lưới. |
| R22 | **375×667** | Design nói: B6 bỏ tips + caption, đoạn 22; B1 thẻ 110 + ẩn streak; B3 ẩn IPA từ. Code dùng query thô `[@media(max-width:767px)_and_(max-height:700px)]`. | Chuẩn hoá thành variant tailwind `short:` = `(max-width:767px) and (max-height:700px)`. |
| R23 | **Đang chấm** | Design: idle + mic ⏳, **không hiện lại deck**. Phase 12 đã gate SoundPractice; các màn khác? | Kiểm tra 8 màn: teach không đổi khi `processing`. |
| R24 | Design không nói | 375×667 cho C7/C9/B4/B5 kết quả; iPad dọc cho 8 biến thể (chỉ có B6); Word Pop "kẹt 2★" copy trong thẻ sao. | Suy từ B6: iPad dọc = phone xếp dọc với token iPad; Word Pop: `praise` = "Nói đúng lần nữa để 3★!". |

---

## 5. Rủi ro (những gì Phase 12 vừa dựng có thể vỡ)
1. **ResultCard** thêm `fox` và `compact` — 8 màn đang truyền props; thêm prop optional, không đổi thứ tự ①–⑥.
2. **PageBody split** thêm `collapsed` và layout act ngang ở md — Task 9's test (`ipad:flex-row`, `md:h-[300px]`) giữ; thêm assertion mới.
3. **MicButton** thêm `countdownLayout` — mặc định phải giữ test Task 6 (đổi mặc định thành row → cập nhật test).
4. **PageHeader** `dimmed` — không đụng LessonChip logic.
5. Query thô → variant `short:` — thay ở ~6 file; grep `max-height:700px`.
6. Không đụng `useSpeakingAttempt` (trừ khi R23 lộ bug).

---

## 6. Tóm tắt việc mới (Phase 13)
**Component:** `ChipPair` · `SpeakPrompt` (Foxy + bong bóng + số giây) · `ResultCard.fox` + `ResultCard.compact` · `PageBody.collapsed` (dải gập) · `PageHeader.dimmed` · `MicButton.countdownLayout` · `MouthPanel` (B1 toggle) · tailwind variant `short`.
**Màn (phần dạy, 3 frame):** B1, B2, B3, B4 (pha 1 + 2), B5, B6, C4, C7 (pha 0 + thẻ), C9 (3 trạng thái khay). **Logic:** C9 next trong chủ đề (R20); C7 kết quả compact (R16); B4 copy sai 1 dòng (R12).
**Kiểm chứng:** 3 frame × idle cho 9 màn + B6 4 trạng thái; 375×667 cho B1/B3/B6; so `docs/design/current-phase12/shots` → `current-phase13`.
