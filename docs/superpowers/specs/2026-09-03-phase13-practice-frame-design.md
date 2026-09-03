# Phase 13 — Khung luyện nói (vòng 2): phần "dạy" của 9 màn trên khung Phase 12

Trạng thái: đã triển khai 2026-09-03 (nhánh `phase13-practice`, tasks 1–12); sai lệch ghi ở README
§Phase 13.

Phase 12 dựng khung trang và phần "làm" (Foxy + mic + lỗi + ResultCard + CTA). Phase 13 vẽ lại **phần "dạy"** của 9 màn luyện nói theo vòng 2 của Claude Design, bổ sung 6 hành vi khung mà vòng 2 mới chốt (dải gập, header mờ khi ghi, chip đôi, đếm ngược cùng hàng, Foxy nhắc số giây, act xếp ngang ở iPad dọc), và áp số đo 3 frame cho từng màn.

**Số đo nằm trong brief, không ở đây:** `docs/design/2026-09-03-round2-practice-brief.md` (§1 khung, §2 chín biến thể, §3 Q7–Q10, §4 R1–R24, §5 rủi ro, §6 việc mới). Spec này chỉ ghi quyết định đã chốt và luật ràng buộc.

## Quyết định (người dùng duyệt 2026-09-03: "làm theo đề xuất" cho R1–R24)

1. **ResultCard giữ thứ tự ①–⑥**, thêm `fox?: { mood; say }` (hàng ⑤b sau hàng nghe; 44 phone / 52 iPad ngang / 96 + bong bóng iPad dọc) và `compact?: boolean` (chỉ ① + hint + ⑥, cho WordCard) (R2, R16). Dòng phụ `sub` là chỗ của "Nhịp: …" (R1) và "🔓 Đã mở khoá" (Q7).
2. **Tầng dạy gập là một dải chạm-mở-lại** (R3): `PageBody split` nhận `collapsed?: { emoji; label; onExpand }`; phone dải 32 (15px `#D9C9AE`, "▾ mở"), iPad dọc dải 64 trắng; iPad ngang không gập. Trạng thái mở/gập thuộc màn (`teachOpen`).
3. **Header khi đang ghi** (R4): `PageHeader` nhận `dimmed?` → Back và ô phải `opacity-40 pointer-events-none`; màn truyền chip giữa "● Đang ghi" coral khi `recording`.
4. **Chip đôi** (R5, Q8): component `ChipPair` (trái teal bo trái, phải coral bo phải, dính nhau). B3 "Âm n/9 · Từ n/3" luôn hiện, bỏ 3 chấm; B4 "Cặp n/8 · ɪ/iː".
5. **MicButton** thêm `countdownLayout: 'row' | 'column'` (R6): mặc định `row` (vạch + số một hàng, số `min-w-[56px]` phone / `min-w-[70px]` iPad); iPad dọc `column`.
6. **Foxy nhắc trước mic** (R7): component `SpeakPrompt { mood; say; seconds? }` = Foxy 60 (phone) / 72 (iPad) + SpeechBubble, số giây coral; đặt trước `MicButton` trong act; caption dưới mic giữ. Mỗi màn có `say` riêng theo brief §2.
7. **iPad dọc: act xếp ngang** (R8): trong `PageBody split`, act = `md:flex-row md:gap-10 ipad:flex-col`.
8. **B1**: ô khẩu hình thành panel bật/tắt bằng nút "👄 Khẩu hình" (R9): iPad 220×220 dưới hàng nút; phone 140×140 inline. Chip giữa "Thẻ 1/12 · ● ○" (R10); dòng streak dưới thẻ ẩn ở `short:`. CTA gate giữ.
9. **B3**: `extra` = SoundChip + "Từ {word} · N điểm"; hint 👅 hiện khi tone ≠ good → `ResultCard.forceHint` (R11).
10. **B4**: pha 1 lỗi một dòng "🙈 Nghe lại rồi chọn nhé" (R12); ô 96 phone / 200 iPad; pha 2 chip xanh 1 dòng thay Card tóm tắt.
11. **B5**: bỏ ô chừa 112 (R14); `sub` = dòng nhịp; card nhịp 480 trên iPad.
12. **C4**: câu 32 phone / 40 iPad, loa 56/64, không H1, không bar, CTA 1 primary + Thử lại (R15).
13. **C7**: kết quả `compact` đè hint dưới thẻ; thẻ không đổi cỡ; mic ẩn phone / cạnh CTA iPad; 3 nút đoán giữ emoji ở md (R17); peek 6s + 🔄 mờ + hint dưới thẻ (Q9).
14. **C9**: kết quả `ScoredWords` thay khay tại chỗ, ResultCard không lặp `words` (R18); iPad mic disabled từ đầu với caption "Xếp đúng câu trước nhé" (R19); Tiếp theo ở trong chủ đề khi vào từ `?topic=` (R20).
15. **B2**: Foxy + bong bóng dưới lưới 3 ô; iPad 1 cột, ô 200×180 căn giữa (R21).
16. **Variant `short:`** = `(max-width:767px) and (max-height:700px)` thay mọi query thô (R22).
17. **Đang chấm**: teach không đổi ở cả 8 màn có mic (R23) — kiểm bằng test.
18. **Design không nói** (R24): iPad dọc cho 8 biến thể = phone xếp dọc với token iPad; Word Pop kẹt 2★ → `praise` "Nói đúng lần nữa để 3★!".

## Luật ràng buộc
- Số đo nguyên văn từ brief §1–§2; token/cỡ nút/mic của Phase 12 giữ nguyên.
- Ba frame kiểm chứng: 390×844 (+375×667 cho B1/B3/B6), 834×1194, 1194×834; chụp bằng `docs/design/current/shoot.mjs` vào `docs/design/current-phase13/`; B6 phải fit 834 ở cả 4 trạng thái iPad ngang (kết quả đo bằng fixture `?fixture=result` dev-only, xem Phạm vi).
- Không đụng `useSpeakingAttempt`, `createScorer`, `missionNav` (trừ R20 trong SentenceBuilder).
- Không phần tử fixed/absolute trong body ngoài Confetti, peek card faces, scrim.
- Giữ `data-testid` (`result-card`, `word-chip`, `mic-halo`, `countdown`, `page-body`, `streak-dot`…).
- Tests/lint/typecheck/build xanh, 0 act(); hook secret không bỏ qua.

## Phạm vi
**Làm:** 7 component/prop mới (quyết định 1–7, 16) · phần dạy 9 màn theo brief §2 ở 3 frame · 3 logic (R16 compact, R19 mic disabled iPad, R20 next trong chủ đề) · **fixture dev-only** `?fixture=result3|result1` cho 8 màn có mic (chỉ khi `import.meta.env.DEV`) để chụp và đo trạng thái kết quả headless · ảnh trước/sau.
**Không làm (Phase 14–15):** danh sách/điều hướng vòng 3, khu người lớn vòng 4, ảnh `art/`, sheet hướng dẫn mic.

## Kiến trúc
- `components/ui/page/PageBody.tsx`: `split.collapsed`, act `md:flex-row … ipad:flex-col`. `PageHeader.tsx`: `dimmed`. `components/ui/ChipPair.tsx`.
- `components/speak/`: `SpeakPrompt.tsx`, `MouthPanel.tsx` (B1), `MicButton` `countdownLayout`, `ResultCard` `fox`/`compact`/`forceHint`.
- `tailwind.config.ts`: variant `short`.
- Màn: mỗi màn giữ hook/logic Phase 12; đổi JSX phần dạy + props khung.
- Fixture: `speaking/fixture.ts` đọc `?fixture=` (DEV only) và trả `PronunciationResult` giả cho `useSpeakingAttempt` qua `resetKey`-independent override; tắt hoàn toàn ở production build.

## Kiểm chứng
- Mỗi task: tests + lint + typecheck; chụp màn liên quan 3 frame; B6/B5 kết quả đo ≤834 ở iPad ngang (fixture).
- Cuối phase: sheet trước/sau; README "Phase 13"; checklist iPad: 3 hàng (chip đôi, dải gập mở lại, khẩu hình bật/tắt).
