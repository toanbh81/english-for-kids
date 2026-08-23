# Deploy lên Vercel (để test trên iPad qua HTTPS thật)

Repo: https://github.com/toanbh81/english-for-kids

## Kiến trúc khi deploy
- `client/` (Vite PWA) → build tĩnh, xuất `client/dist`.
- `api/speech-token.mjs` → Vercel Serverless Function thay cho `server/` (Express chỉ dùng khi chạy local). Cùng đường dẫn `/api/speech-token`, nên client không cần cấu hình gì thêm (`VITE_API_BASE` để trống).
- File audio (`client/public/audio/**`) đã được commit nên bản deploy có tiếng ngay.

## Cấu hình 1 lần trên Vercel
1. https://vercel.com/new → **Import Git Repository** → chọn `toanbh81/english-for-kids`.
2. Màn **Configure Project**:
   - Framework Preset: **Other** (Vercel đọc `vercel.json` trong repo: install `pnpm install --frozen-lockfile`, build `pnpm --filter client build` rồi copy sang `dist` ở gốc, output `dist` (khớp cả khi Vercel dùng mặc định)).
   - Root Directory: để trống (root của repo).
   - **Environment Variables** (bắt buộc, áp dụng cho Production + Preview):
     - `AZURE_SPEECH_KEY` = key trong `server/.env` của bạn
     - `AZURE_SPEECH_REGION` = `southeastasia`
3. **Deploy**. Sau ~1–2 phút có URL dạng `https://english-for-kids-xxx.vercel.app`.
4. Kiểm tra: mở `https://<url>/api/speech-token` → phải trả JSON có `token`. Mở `https://<url>/` → app.

Mỗi lần push lên `main` Vercel tự deploy Production; push nhánh khác → tạo **Preview URL** riêng (xem trong tab Deployments) — dùng để test Phase 3/4 trước khi merge.

## Trên iPad
1. Safari → mở URL Vercel (HTTPS thật, không còn cảnh báo chứng chỉ → **service worker và PWA hoạt động đầy đủ**).
2. Share → **Add to Home Screen** → mở từ icon (toàn màn hình).
3. Lần đầu bấm mic: cho phép Micro.
4. Tắt Wi‑Fi để thử offline: app vẫn mở, nghe truyện/từ mẫu được; chấm phát âm chuyển sang "chế độ đơn giản".

## Bảo mật
- Key Azure chỉ nằm trong Environment Variables của Vercel; repo không chứa key (hook `scripts/check-secrets.sh` chặn khi commit/push).
- Endpoint token đang public (ai có URL cũng lấy được token 10 phút, tối đa tiêu quota F0 5 giờ/tháng). Nếu muốn chặt hơn: đặt Vercel **Deployment Protection** (Password) cho project, hoặc thêm secret header vào function sau này.

## Gỡ lỗi nhanh
- Build fail vì pnpm: Vercel tự nhận `packageManager: pnpm@9.15.9` trong `package.json`; nếu không, đặt Env `ENABLE_EXPERIMENTAL_COREPACK=1`.
- `/api/speech-token` trả `Azure not configured` → thiếu Env Vars, thêm rồi **Redeploy**.
- Không có tiếng → kiểm tra `https://<url>/audio/stories/little-fox/scene-1.mp3` tải được không.
