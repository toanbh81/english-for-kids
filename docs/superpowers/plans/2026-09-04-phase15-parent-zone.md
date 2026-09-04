# Phase 15 — Khu người lớn (vòng 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bốn màn người lớn (A1 ProfileGate, A2 CloudStart, P1 ParentGate, P2 ParentDashboard) nói **một ngôn ngữ** — **một thẻ cổng** (`GateCard` 420/r20/p20, căn trái), **một mốc chạm** (hộp thấy 28–36, vùng chạm ≥44, không nút trẻ em 56/64) và **một lưới panel** (`PanelGrid` 1/2/3 cột với đủ 10 panel bên trong) — ở phone 390×844, iPad dọc 834×1194, iPad ngang 1194×834 (+375×667 cho cả bốn màn). Thay 4 chỗ tự dựng `Card max-w-md`, 9 chỗ lặp `Card px-4 py-3.5 md:p-6`, 10 chỗ `md:min-h-[64px]`/`md:h-16`, và **hạ ba mốc cuộn của dashboard** (`phone/parent-dashboard-full.png` 1821 → ≈1100 · `ipad/parent-dashboard-full.png` 1643 → ≤834 · `ipadp/parent-dashboard-full.png` mới → ≤1194).

**Architecture:** Khung dùng chung hạ trước (Task 1: `Button variant='danger'`, `SyncPill` 7 trạng thái + `size` + gate `hasSession`, `Notice icon?`, `EmptyState variant='dashed'`, `AccountCardSkeleton` 150, `Dialog placeholder?` — **và chỉ vậy** —, `tailwind` `animate-shake`; Task 2: `components/ui/GateCard.tsx` + thư mục mới `components/adult/` với `Panel`/`PanelGrid`/`FieldRow`/`SegRow`/`Stepper`; Task 3: `MinutesChart`/`RecordingRow`/`RemoteRow`; Task 4: `AccountCard` 11 trạng thái; Task 5: `ProfilePicker` 3 mật độ + `ParentQuestion` viết lại). Rồi từng màn (Task 6 P1, Task 7 A1, Task 8–9 A2, Task 10–14 P2 theo cụm panel), Task 15 chuỗi 5 dialog ở call-site, Task 16 chụp đủ 3 frame + `short`, README, checklist. **Mặc định của mọi component sửa không đổi một byte** cho 33 màn ngoài nhóm này.

**Tech Stack:** React 19, react-router-dom, Tailwind 3 (variant `ipad` — đã compile `@media (…) { &:is(&) }` nên **outrank `md:`** — và `short`), Vitest + Testing Library (jsdom, `globals: true`), oxlint, tsc. Ảnh: `docs/design/current/shoot.mjs` + `sheet.mjs` (`SHOTS`, `SHOTS_DIR`, `VIEWPORTS`, `IPADP_ONLY`, probe overflow đọc `[data-testid="page-body"]`), dev server `pnpm --filter client exec vite --mode nossl --port 5174 --strictPort`.

**Spec:** `docs/superpowers/specs/2026-09-04-phase15-parent-zone-design.md` (35 quyết định).
**Số đo & copy:** `docs/design/2026-09-04-round4-parent-zone-brief.md` (§0 năm quyết định gốc, §1 thẻ cổng + lưới panel theo frame, §2 bốn màn + 11 trạng thái thẻ Tài khoản + 7 trạng thái Tiến độ từ xa + 14 câu lỗi + 4 dialog, §3 Q17/Q18, §4 R1–R31, §5 mười rủi ro, §6 việc mới). Brief thắng về **số đo**, spec thắng về **quyết định**.

## Global Constraints

Luật ràng buộc của spec, nguyên văn + cụ thể hoá:

- **Luật người lớn (quyết định 1).** Trong nhóm A1/A2/P1/P2: hộp **thấy được** là **28 / 32 / 36 / 44**, mọi hộp <44 phải mang dải hit (`after:-inset-*`, mẫu `Button.tsx:22` `HIT` và `Notice.tsx:38` `CHILD_HIT_BAND`); **không nút trẻ em 56/64 ở bất kỳ đâu trong nhóm** — xoá cả 10 chỗ `md:min-h-[64px]`/`md:h-16`/`min-h-[64px]`: `ParentDashboard.tsx:883,903,929,962,979,999`, `CloudStart.tsx:432,521,539`, `ProfilePicker.tsx:95`, cộng `Button` mặc định `md` ở `ParentQuestion.tsx:69`. Chữ: thân **13–14px**, phụ **12px**, help **11px**, tiêu đề thẻ/dialog **18px**, H1 dashboard **20/24**. Đây là **đảo chiều** doc comment `ParentDashboard.tsx:47-56` ("vùng chạm 36–48") và comment `:877-881` ("the 64 px row is the child floor") — **phải sửa hai đoạn comment đó trong cùng task đụng tới chúng**, nếu không lần review sau khôi phục đúng những dòng vừa xoá (rủi ro 1).
- **Số đo nguyên văn từ brief §1–§2**; token/bóng/radius Phase 12 và mọi thứ Phase 13/14 vừa chốt giữ nguyên — **không hex nào mới**, hai ngoại lệ **có tên**: `#FFF6E0` (nền tip âm sai — brief đã ghi là chỗ duy nhất không có token; dùng `bg-[#FFF6E0]`) và `#D9CBB4` (viền đứt của seg `dim`, brief §2 P2#7 ghi nguyên văn, tra `tailwind.config.ts:20-42` không có token → `border-[#D9CBB4]`). Cả hai vào Ruling ở Task 16.
- **Bảng màu brief §1.2 ghi nhầm một dòng:** `#F1E7D4` **không phải** `line-200`. Trong `tailwind.config.ts`: `line-200 = #EFE2CC` (dòng 24), `track = #F1E7D4` (dòng 38). Ý định của brief là "token đường kẻ của app" ⇒ mọi hairline design ghi `1px/2px #F1E7D4` viết **`border-line-200`** (đúng với 33 màn hiện có, ví dụ `ParentDashboard.tsx:639`), không đẻ hex mới. Ghi Ruling.
- **Ba (bốn) frame kiểm chứng:** 390×844, 834×1194, 1194×834, **+375×667 (`VIEWPORTS=short`) cho cả bốn màn**; chụp vào `docs/design/current-phase15/shots/`.
- **Không `lg:` và không `sm:`** ở bất kỳ file nào bị đụng (`ProfilePicker.tsx:83` `sm:grid-cols-3` là mốc thứ 4 ngoài 3 frame — xoá).
- **`ipad:` outrank `md:`** (Phase 13) ⇒ mọi `md:` viết cho **iPad dọc** vòng này (lưới 2 cột, panel 14/16, chart 14 ngày, picker 4 cột, thẻ Tài khoản 2 cột trong) **phải kiểm cả hai frame iPad bằng ảnh**, không chỉ bằng test class. Rule chỉ dành cho iPad ngang phải viết `ipad:`. **Không `ipad:!`**.
- **Base class thắng `className` đè** (Phase 14, bài học `Chip size='xs'`) ⇒ `SegRow`, `Stepper`, chip âm sai, `Button variant='danger'` là **variant thật**, không đè từ ngoài (rủi ro 6).
- **Giữ mọi `data-testid` đang có**: `page-body`, `header-right`, `account-card`, `sync-status`, `skeleton`, `skeleton-account`, `no-session`, `profile-unreadable`, `profile-notice`, `reset-notice`, `remote-view-toggle`, `remote-progress-card`, `remote-progress-unknown`, `remote-profile`, `remote-empty`, `minute-bar`, `profile-reask`, `empty-state`. Test cũ (`ParentDashboard.test.tsx`, `CloudStart.test.tsx`, `ProfileGate.test.tsx`, `ProfilePicker.test.tsx`, `ui.test.tsx`, `dialog.test.tsx`) bám vào chúng.
- **Không đụng `cloud/auth.ts`, `cloud/sync.ts`, `cloud/profileState.ts`, `cloud/remote.ts`, `progress/*`, các hook `useCloud*`** — trừ **ba thay đổi được phép**: (1) thêm `'result'` vào `Stage` và chuyển `info`/`retryId` vào thân stage đó trong `CloudStart.tsx` (R8), (2) gộp 4 câu lỗi hệ thống thành 1 hằng + `action` "Thử lại" trong `CloudStart.tsx` (R10), (3) `writeMark` của `ProfileGate` trả `boolean` (R7). Nếu R20/R22 buộc thêm trường (`score` cho `Recording`, `score` cho event `story`) thì đó là thay đổi **thứ tư**, **phải ghi Ruling riêng trước khi làm** — xem Task 3 Step 0.
- **`Dialog`/`DialogProvider`/`useDialog` chỉ được thêm `placeholder?`** — không gì khác. Cụ thể: `Dialog.tsx` (biến thể `prompt` của `DialogRequest` + `placeholder` trên `<input>`) và `DialogContext.ts` (`PromptOptions.placeholder?: string` — `DialogProvider.tsx` `:78-80` đã `...o` nên **không đổi một dòng nào**), `useDialog.ts` **không đụng**. Mọi thay đổi khác ở bốn file này là hồi quy so với Phase 12 (rủi ro 8).
- **Toàn bộ copy người lớn giữ tiếng Việt.** Không thêm màn trẻ em, không đụng 9 màn luyện nói và 10 màn danh sách.
- **Tests/lint/typecheck/build xanh, 0 act() warning.** Lệnh: `pnpm --filter client test`, `lint`, `typecheck`, `build` (trên shell người dùng: `pnpm.cmd`). Cảnh báo lint đã biết của `LessonChip` vẫn được chấp nhận.
- **Không bỏ qua hook secret**: mỗi commit chạy `bash scripts/check-secrets.sh staged`; không bao giờ `--no-verify`, không bao giờ in `client/.env`.
- **Chạy mọi lệnh từ gốc repo** `D:/ToanBH/SourceCode/english-speaking`. Một commit cho mỗi task. Nhánh mới `phase15-parent-zone` từ `main` (head `1fc763a`).
- **Ảnh mỗi task:** từ `docs/design/current/`, dev server chạy nền:
  `SHOTS=<ids> SHOTS_DIR=../current-phase15/shots node shoot.mjs <phone|ipad|ipadp>`; báo lại mọi dòng `overflow`.

---

### Task 1: `Button variant='danger'` · `SyncPill` 7 trạng thái + `size` + `hasSession` · `Notice icon?` · `EmptyState variant='dashed'` · `AccountCardSkeleton` 150 · `Dialog placeholder?` · `animate-shake`

**Files:**
- Modify: `client/src/components/ui/Button.tsx`, `client/src/components/ui/SyncPill.tsx`, `client/src/components/ui/Notice.tsx`, `client/src/components/ui/EmptyState.tsx`, `client/src/components/ui/Skeleton.tsx`, `client/src/components/ui/Dialog.tsx`, `client/src/components/ui/DialogContext.ts`, `client/tailwind.config.ts`
- Test: `client/src/components/ui/ui.test.tsx`, `client/src/components/ui/dialog.test.tsx`

**Interfaces:**
- Consumes: `SyncStatus` (`cloud/sync.ts:420` — `state`, `pending`, `lastSyncedAt`, `lastError`, `syncing`; **không đổi**).
- Produces:
  - `ButtonVariant` thêm `'danger'`.
  - `SyncPill` nhận thêm `hasSession?: boolean` và `size?: 'sm' | 'md'` (mặc định `'md'` = chuỗi class hôm nay). Export `SyncPillSize`.
  - `NoticeProps` thêm `icon?: string` (đè icon mặc định, **giữ tone**).
  - `EmptyState` thêm `variant?: 'card' | 'dashed'` (mặc định `'card'`).
  - `AccountCardSkeleton` cao `h-[150px]` (từ 168).
  - `PromptOptions` + `DialogRequest['prompt']` thêm `placeholder?: string`.
  - `tailwind.config.ts`: keyframe + animation `shake`.

- [ ] **Step 1: Failing tests**

```tsx
// ui.test.tsx
it('Button danger is a pale-red outline on white — a real variant, not a className', () => {
  render(<Button size="adult" variant="danger">↺ Đặt lại tiến trình…</Button>)
  expect(screen.getByRole('button')).toHaveClass('bg-white', 'text-fix-700', 'border-2', 'border-fix-300', 'min-h-[44px]', 'rounded-r12')
})
it('SyncPill keeps its six old states byte-identical at the default size', () => {
  render(<SyncPill status={{ ...base } as SyncStatus} onRetry={() => {}} />)
  expect(screen.getByTestId('sync-status')).toHaveClass('h-8', 'rounded-r10', 'px-2.5', 'text-[12px]')
})
it('SyncPill merges the clock state into "✓ Đã đồng bộ · HH:MM" on good-50', () => {
  render(<SyncPill status={{ ...base, lastSyncedAt: new Date(2026, 8, 2, 9, 41).getTime() } as SyncStatus} onRetry={() => {}} />)
  const pill = screen.getByTestId('sync-status')
  expect(pill).toHaveTextContent('✓ Đã đồng bộ · 09:41')
  expect(pill).toHaveClass('bg-good-50', 'text-good-700')
})
it('SyncPill says "Chưa kết nối" only when a session is known to be missing — never when cloud is off', () => {
  const { rerender } = render(<SyncPill status={{ ...base } as SyncStatus} hasSession={false} onRetry={() => {}} />)
  expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Chưa kết nối')
  rerender(<SyncPill status={{ ...base, state: 'offline' } as SyncStatus} hasSession={false} onRetry={() => {}} />)
  expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Ngoại tuyến')   // offline wins over no-session
  rerender(<SyncPill status={{ ...base, state: 'off' } as SyncStatus} hasSession={false} onRetry={() => {}} />)
  expect(screen.queryByTestId('sync-status')).toBeNull()                          // cloud unconfigured stays silent
  rerender(<SyncPill status={{ ...base } as SyncStatus} onRetry={() => {}} />)
  expect(screen.getByTestId('sync-status')).toHaveTextContent('✓ Đã đồng bộ')     // hasSession undefined = old behaviour
})
it('SyncPill size sm is the 28px pill of the narrow panel', () => {
  render(<SyncPill status={{ ...base } as SyncStatus} size="sm" onRetry={() => {}} />)
  expect(screen.getByTestId('sync-status')).toHaveClass('h-7', 'rounded-lg', 'px-2', 'text-[11px]')
})
it('Notice icon overrides the glyph and keeps the kind tone', () => {
  render(<Notice kind="warn" adult icon="📡" title="Đang ngoại tuyến — sẽ tự kết nối khi có mạng." />)
  expect(screen.getByRole('status')).toHaveClass('bg-sun-50', 'text-sun-700')
  expect(screen.getByText('📡')).toBeInTheDocument()
  expect(screen.queryByText('⚠️')).toBeNull()
})
it('EmptyState dashed is a 120px dashed box and leaves the card variant untouched', () => {
  const { rerender } = render(<EmptyState adult variant="dashed" emoji="📈" title="Chưa có lịch sử luyện" sub="Biểu đồ hiện từ ngày học đầu tiên." />)
  const box = screen.getByTestId('empty-state')
  expect(box).toHaveClass('min-h-[120px]', 'rounded-r12', 'border-2', 'border-dashed', 'border-sand-edge', 'bg-transparent')
  expect(box.className).not.toMatch(/bg-cream-50|min-h-\[150px\]/)
  rerender(<EmptyState adult emoji="🎙️" title="Chưa có bản ghi nào" sub="Bản ghi xuất hiện sau khi bé luyện nói." />)
  expect(screen.getByTestId('empty-state')).toHaveClass('min-h-[150px]', 'rounded-r18', 'bg-cream-50')
})
it('AccountCardSkeleton holds 150px', () => {
  render(<AccountCardSkeleton />)
  expect(screen.getByTestId('skeleton-account')).toHaveClass('h-[150px]')
  expect(screen.getByTestId('skeleton-account').className).not.toMatch(/h-\[168px\]/)
})
// dialog.test.tsx
it('a prompt renders its placeholder and nothing else about the dialog changes', async () => {
  renderWithProvider()
  act(() => { void dialogRef.current!.prompt({ title: 'Thêm hồ sơ mới', label: 'Tên của bé', maxLength: 40, placeholder: 'Ví dụ: Bé Su' }) })
  const input = await screen.findByLabelText('Tên của bé')
  expect(input).toHaveAttribute('placeholder', 'Ví dụ: Bé Su')
  expect(input).toHaveClass('h-11', 'rounded-r12', 'border-2', 'border-teal-500')
  expect(screen.getByText('0/40')).toBeInTheDocument()
})
it('a prompt without a placeholder has none', async () => { /* …expect(input).not.toHaveAttribute('placeholder') */ })
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/components/ui` → FAIL.

- [ ] **Step 3: Implement**

`Button.tsx` — `export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'`, thêm vào `VARIANT`:
```tsx
  // R14 / quyết định 11: hàng "Đặt lại tiến trình" của dashboard. Viền 2px (không 3 như outline —
  // brief §1.2 vẽ `2px #F8A3AE`), chữ #C2354B, nền trắng, không bóng: một nút phá huỷ không được
  // trông "bấm được cho vui" như primary. Là VARIANT THẬT vì base class luôn thắng className đè.
  danger: 'bg-white text-fix-700 border-2 border-fix-300',
```

`SyncPill.tsx` — chữ ký `({ status, hasSession, size = 'md', onRetry })`; giữ nguyên `if (status.state === 'off') return null` **ở đầu** (off = cloud chưa cấu hình; `hasSession` không được lật nó — rủi ro 3). Thứ tự nhánh:
```tsx
const SIZE = {
  sm: 'h-7 rounded-lg px-2 text-[11px]',        // 28 · r8 · 11 — trong panel hẹp (bảng 11 trạng thái)
  md: 'h-8 rounded-r10 px-2.5 text-[12px]',     // 32 · r10 · 12 — header panel Tài khoản (chuỗi cũ)
} as const
const v = status.lastError
  ? { cls: 'bg-fix-50 text-fix-700', ic: '⚠', t: 'Không đồng bộ được', retry: true }
  : status.syncing
    ? { cls: 'bg-teal-50 text-teal-600', ic: '◌', t: 'Đang đồng bộ…', spin: true }
    : status.state === 'offline'
      ? { cls: 'bg-sand text-ink-500', ic: '⚡', t: 'Ngoại tuyến' }
      // Nhánh thứ 7. Gate bằng `hasSession === false`, KHÔNG bằng `state === 'off'`: hai câu hỏi
      // khác nhau — "máy này có cloud không" (off, đã return null trên kia) và "đã có phiên chưa".
      : hasSession === false
        ? { cls: 'bg-sand text-ink-500', ic: '⚡', t: 'Chưa kết nối' }
        : status.state === 'pending'
          ? { cls: 'bg-sun-50 text-sun-700', ic: '●', t: `Chưa đồng bộ ${status.pending} mục` }
          : status.lastSyncedAt
            ? { cls: 'bg-good-50 text-good-700', ic: '✓', t: `Đã đồng bộ · ${hhmm(status.lastSyncedAt)}` }
            : { cls: 'bg-good-50 text-good-700', ic: '✓', t: 'Đã đồng bộ' }
```
span: `inline-flex items-center gap-1.5 whitespace-nowrap font-extrabold ${SIZE[size]} ${v.cls}`; nút "Thử lại" đi theo `size` (`h-7`/`h-8`) và mang `HIT`-band khi `size==='sm'` (28 < 44): `relative after:absolute after:-inset-2 after:content-['']`.

`Notice.tsx` — `icon?: string` trong `NoticeProps`, `{icon ?? k.icon}` ở `:60`. Docblock: "③ của thẻ Tài khoản dùng tone `warn` với 📡 — tone nói mức độ, icon nói *chuyện gì*".

`EmptyState.tsx` — `variant?: 'card' | 'dashed'`; `const DASHED = 'min-h-[120px] rounded-r12 border-2 border-dashed border-sand-edge bg-transparent'`; class gốc tách `min-h-[150px] rounded-r18 bg-cream-50` ra khỏi chuỗi base để nhánh `dashed` không mang theo (dùng `variant === 'dashed' ? DASHED : 'min-h-[150px] rounded-r18 bg-cream-50'`). **Không đổi** `size='hero'` của Phase 14.

`Skeleton.tsx:17` — `h-[168px]` → `h-[150px]` (R28, quyết định 15).

`Dialog.tsx` — biến thể `prompt` của `DialogRequest` thêm `placeholder?: string`; `<input … placeholder={req.placeholder}>`. `DialogContext.ts` — `PromptOptions` thêm `placeholder?: string`. **Không đụng gì khác trong bốn file dialog.**

`tailwind.config.ts` — `keyframes.shake` + `animation.shake` (R4, dùng ở `ParentQuestion`):
```ts
// 300ms, biên độ nhỏ: một ô nhập trả lời sai thì *lắc đầu*, không nhảy múa.
shake: {
  '0%, 100%': { transform: 'translateX(0)' },
  '20%, 60%': { transform: 'translateX(-5px)' },
  '40%, 80%': { transform: 'translateX(5px)' },
},
// animation:
shake: 'shake .3s ease-in-out 1',
```

- [ ] **Step 4: Run** `vitest run src/components/ui` + toàn bộ suite + lint + typecheck → PASS. Hai test cũ phải sửa **cùng lúc**: `ui.test.tsx:529-530` ("Đồng bộ lúc 09:41" → "Đã đồng bộ · 09:41") và `:532-533` (`state: 'off'` vẫn `toBeNull`). Không chuỗi class nào của 33 màn ngoài nhóm đổi.
- [ ] **Step 5: Ảnh** — chưa màn nào dùng. Chạy `SHOTS=parent-dashboard,parent-gate,profile-gate,start-menu SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame) làm **ảnh gốc so sánh** và ghi lại `scrollHeight` của `parent-dashboard` ở cả 3 frame (đây là ba mốc phải hạ).
- [ ] **Step 6: Commit** — `feat(ui): Button danger, SyncPill 7 states + size, Notice icon, EmptyState dashed, skeleton 150, Dialog placeholder, animate-shake`

---

### Task 2: `ui/GateCard.tsx` + `components/adult/`: `Panel`, `PanelGrid`, `FieldRow`, `SegRow`, `Stepper`

**Files:**
- Create: `client/src/components/ui/GateCard.tsx`, `client/src/components/adult/Panel.tsx`, `client/src/components/adult/PanelGrid.tsx`, `client/src/components/adult/FieldRow.tsx`, `client/src/components/adult/SegRow.tsx`, `client/src/components/adult/Stepper.tsx`, `client/src/components/adult/index.ts`
- Modify: `client/src/components/ui/index.ts` (thêm `export { GateCard }`)
- Test: `client/src/components/adult/adult.test.tsx`, `client/src/components/ui/ui.test.tsx` (khối `GateCard`)

**Interfaces:**
- Consumes: không component nào khác (chỉ token Tailwind). `SegRow`/`Stepper` **không** dùng `Button`/`Chip` (base class thắng `className` — rủi ro 6).
- Produces:
  - `<GateCard className? children />` — `data-testid="gate-card"`.
  - `<Panel title right? collapsible? defaultOpen? col? scroll? testId? children />`, `col?: 'full'`, `collapsible?: boolean`, `scroll?: boolean` — `data-testid="panel"` (hoặc `testId`).
  - `<PanelGrid className? children />` — `data-testid="panel-grid"`.
  - `<FieldRow label input error? help? action? htmlFor? />` với `input: ReactNode` (ô do call-site dựng để giữ `value`/`onChange`/`aria-label`), `action?: { label: string; onClick: () => void }` — `data-testid="field-row"`, dải lỗi `data-testid="field-error"`.
  - `<SegRow segs={{ key, label, tone: 'on'|'off'|'dim', onClick, ariaLabel? }[]} className? />` — `data-testid="seg-row"`, mỗi seg `data-testid="seg"` + `data-tone`.
  - `<Stepper value onChange min=5 max=60 step=5 label width?: 64|56 />` — `data-testid="stepper"`, nút `aria-label="Giảm"/"Tăng"`.

- [ ] **Step 1: Failing tests** — mỗi giá trị class của brief §1.1/§1.2 có một assert.

```tsx
it('GateCard is Dialog.tsx:84 in another place: 420, r20, p20, gap 12, left-aligned', () => {
  render(<GateCard><h1>Dành cho phụ huynh</h1></GateCard>)
  const card = screen.getByTestId('gate-card')
  expect(card).toHaveClass('flex', 'w-[min(420px,calc(100%-32px))]', 'flex-col', 'gap-3', 'rounded-r20', 'bg-white', 'p-5', 'shadow-[0_6px_0_#EFE2CC]', 'text-left')
  expect(card.className).not.toMatch(/max-w-md|text-center|\blg:|\bsm:/)
})
it('Panel is white r16 with the 13/14px title and the phone/iPad padding pair', () => {
  render(<Panel title="Phút luyện mỗi ngày"><i /></Panel>)
  expect(screen.getByTestId('panel')).toHaveClass('flex', 'flex-col', 'gap-2', 'rounded-r16', 'bg-white', 'px-3.5', 'py-3', 'shadow-card-xs', 'md:gap-2.5', 'md:px-4', 'md:py-3.5')
  expect(screen.getByRole('heading', { level: 2 })).toHaveClass('font-display', 'text-[13px]', 'font-extrabold', 'text-ink-900', 'md:text-[14px]')
})
it('Panel right slot sits on the title row; col=full spans every frame', () => {
  render(<Panel title="⏰ Giới hạn mỗi ngày" col="full" right={<span>Hôm nay: 12/25'</span>}><i /></Panel>)
  expect(screen.getByText("Hôm nay: 12/25'").parentElement).toHaveClass('flex', 'items-center', 'justify-between', 'gap-2')
  expect(screen.getByTestId('panel')).toHaveClass('md:col-span-2', 'ipad:col-span-3')
})
it('a collapsible Panel is a 56px row with a chevron on the phone and open from md up', () => {
  render(<Panel title="Bản ghi gần đây · 20" collapsible><b>row</b></Panel>)
  const summary = screen.getByRole('button', { name: /Bản ghi gần đây/ })
  expect(summary).toHaveClass('flex', 'min-h-[56px]', 'items-center', 'justify-between', 'md:hidden')
  expect(screen.getByText('▸')).toHaveClass('text-[14px]', 'text-ink-300')
  fireEvent.click(summary)
  expect(screen.getByText('▾')).toBeInTheDocument()
  expect(screen.getByText('row')).toBeVisible()
})
it('a scroll Panel gets the flex-1 scroller and the 40px bottom fade', () => {
  render(<Panel title="Tiến độ từ xa" scroll><i /></Panel>)
  expect(screen.getByTestId('panel-scroll')).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'after:sticky', 'after:bottom-0', 'after:h-10', 'after:to-white')
})
it('PanelGrid is 1/2/3 columns with gap 10/14 and no lg:', () => {
  render(<PanelGrid><i /></PanelGrid>)
  const grid = screen.getByTestId('panel-grid')
  expect(grid).toHaveClass('grid', 'grid-cols-1', 'gap-2.5', 'md:grid-cols-2', 'md:gap-3.5', 'ipad:grid-cols-3')
  expect(grid.className).not.toMatch(/\blg:|\bsm:/)
})
it('FieldRow: 12px label above, 44px input, an 18px error gutter that is always there, 11px help', () => {
  render(<FieldRow label="Email của bố mẹ" htmlFor="e" input={<input id="e" className="h-11" />} help="Chỉ dùng để gửi mã xác nhận và giữ tiến độ. Không gửi quảng cáo." />)
  expect(screen.getByText('Email của bố mẹ')).toHaveClass('text-[12px]', 'font-extrabold', 'text-ink-500')
  expect(screen.getByTestId('field-error')).toHaveClass('min-h-[18px]', 'text-[12px]', 'font-extrabold', 'text-fix-700')
  expect(screen.getByTestId('field-error')).toBeEmptyDOMElement()
  expect(screen.getByText(/Không gửi quảng cáo/)).toHaveClass('text-[11px]', 'font-bold', 'text-ink-300')
})
it('FieldRow error keeps the layout still and can carry a 44px retry inside the gutter', () => {
  const onClick = vi.fn()
  render(<FieldRow label="Mã 6 số" input={<input />} error="Không kết nối được máy chủ — thử lại sau" action={{ label: 'Thử lại', onClick }} />)
  expect(screen.getByTestId('field-error')).toHaveTextContent('Không kết nối được máy chủ — thử lại sau')
  const retry = screen.getByRole('button', { name: 'Thử lại' })
  expect(retry).toHaveClass('h-11', 'rounded-r12', 'border-2', 'border-sand-edge', 'text-[12px]')
  fireEvent.click(retry); expect(onClick).toHaveBeenCalled()
})
it('SegRow: 44px segs, three tones, dim is the dashed sand one', () => {
  render(<SegRow segs={[
    { key: 'a', label: 'Tự động', tone: 'on', onClick: () => {} },
    { key: '1', label: '1', tone: 'off', onClick: () => {} },
    { key: '2', label: '2', tone: 'dim', onClick: () => {} },
  ]} />)
  const segs = screen.getAllByTestId('seg')
  expect(segs[0]).toHaveClass('h-11', 'flex-1', 'rounded-r12', 'text-[13px]', 'bg-coral-500', 'text-white')
  expect(segs[1]).toHaveClass('border-2', 'border-line-200', 'bg-cream-50', 'text-ink-500')
  expect(segs[2]).toHaveClass('bg-[#EFE2CC]', 'text-ink-500', 'border-2', 'border-dashed', 'border-[#D9CBB4]')
  expect(segs[2]).toHaveAttribute('data-tone', 'dim')
  expect(segs.every(s => !/min-h-\[64px\]|md:h-16/.test(s.className))).toBe(true)
})
it('Stepper: 36px −/+ inside a 44 hit band, a 64×36 teal box, step 5 clamped to 5..60', () => {
  const onChange = vi.fn()
  render(<Stepper value={25} onChange={onChange} label="Tuỳ chỉnh" />)
  const minus = screen.getByRole('button', { name: 'Giảm' })
  expect(minus).toHaveClass('h-9', 'w-9', 'rounded-r10', 'bg-sand', 'relative', "after:absolute", 'after:-inset-1')
  expect(screen.getByTestId('stepper-value')).toHaveClass('h-9', 'w-16', 'rounded-r10', 'border-2', 'border-teal-500', 'font-display', 'text-[16px]', 'text-teal-600')
  fireEvent.click(screen.getByRole('button', { name: 'Tăng' })); expect(onChange).toHaveBeenCalledWith(30)
  fireEvent.click(minus); expect(onChange).toHaveBeenCalledWith(20)
  expect(screen.getByText('5–60, bước 5')).toHaveClass('text-[11px]')
})
it('Stepper never emits a number outside 5..60 and keeps a hidden input for a11y', () => {
  const onChange = vi.fn()
  const { rerender } = render(<Stepper value={60} onChange={onChange} label="Tuỳ chỉnh" />)
  fireEvent.click(screen.getByRole('button', { name: 'Tăng' })); expect(onChange).not.toHaveBeenCalled()
  rerender(<Stepper value={5} onChange={onChange} label="Tuỳ chỉnh" />)
  fireEvent.click(screen.getByRole('button', { name: 'Giảm' })); expect(onChange).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Phút mỗi ngày')).toHaveAttribute('type', 'number')
  expect(screen.getByLabelText('Phút mỗi ngày')).toHaveClass('sr-only')
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/components/adult src/components/ui` → FAIL.

- [ ] **Step 3: Implement** — bảy file, mỗi giá trị lấy từ brief §1.1/§1.2 và quyết định 2–6.

```tsx
// GateCard.tsx — R1 / quyết định 2. Cùng thẻ với Dialog.tsx:84 (420 · r20 · p20 · gap 12), khác
// chỗ đặt: trong PageBody center thay vì trong scrim. Bóng là bóng thẻ (`0 6px 0 #EFE2CC`), không
// phải bóng dialog. CĂN TRÁI — 4 call-site cũ bỏ `max-w-md` (448) và `text-center`.
export function GateCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div data-testid="gate-card" className={`flex w-[min(420px,calc(100%-32px))] flex-col gap-3 rounded-r20 bg-white p-5 text-left shadow-[0_6px_0_#EFE2CC] ${className}`}>
      {children}
    </div>
  )
}
```

```tsx
// Panel.tsx — R13 / quyết định 3. KHÔNG đè `Card` từ ngoài: `Card` là `rounded-xl3` (28), Panel là
// r16 — hai vai trò khác nhau (rủi ro 6).
const BOX = 'flex flex-col gap-2 rounded-r16 bg-white px-3.5 py-3 shadow-card-xs md:gap-2.5 md:px-4 md:py-3.5'
const TITLE = 'font-display text-[13px] font-extrabold text-ink-900 md:text-[14px]'
// Fade đáy 40 của vùng cuộn. Brief ghi gradient tới `#FFF7EA` (nền TRANG); panel nền TRẮNG, nên
// dùng `to-white` — vệt kem trên nền trắng là một đường kẻ nhìn thấy được. Ghi Ruling ở Task 16.
const SCROLL = "min-h-0 flex-1 overflow-y-auto after:pointer-events-none after:sticky after:bottom-0 after:mt-auto after:block after:h-10 after:shrink-0 after:bg-gradient-to-b after:from-transparent after:to-white after:content-['']"
```
Thân: `col === 'full'` → thêm `md:col-span-2 ipad:col-span-3`. `collapsible` (chỉ phone — quyết định 29/30): một `<button>` `flex min-h-[56px] items-center justify-between gap-2 text-left md:hidden` mang `<h2>` + `▾`/`▸` (`text-[14px] text-ink-300`), một `<h2>` `hidden md:flex` cho iPad, và thân bọc `open ? '' : 'hidden md:block'`. `defaultOpen` mặc định `false` — **không** `matchMedia` trong component (giữ quyết định của call-site, `ParentDashboard.tsx:172`). `right` nằm cùng hàng tiêu đề: `<div className="flex items-center justify-between gap-2">`.

```tsx
// PanelGrid.tsx — R12 / quyết định 4. MỘT cây DOM: thứ tự DOM = thứ tự phone, hai frame kia chỉ
// đổi số cột (rủi ro 4). Panel muốn "cột 3 ở iPad ngang" phải chấp nhận vị trí của nó ở phone.
export function PanelGrid({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div data-testid="panel-grid" className={`grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3.5 ipad:grid-cols-3 ${className}`}>{children}</div>
}
```

```tsx
// FieldRow.tsx — R9 / quyết định 5. Dải lỗi LUÔN chiếm 18px, kể cả khi rỗng: một form nhảy 18px
// mỗi lần sai là một form đẩy nút ra khỏi ngón tay đang bấm.
<div data-testid="field-row" className="flex flex-col gap-1">
  <label htmlFor={htmlFor} className="text-[12px] font-extrabold text-ink-500">{label}</label>
  {input}
  <div data-testid="field-error" className="flex min-h-[18px] items-center gap-2 text-[12px] font-extrabold leading-[1.4] text-fix-700">
    {error && <span className="min-w-0 flex-1">{error}</span>}
    {error && action && <button type="button" onClick={action.onClick} className="h-11 shrink-0 rounded-r12 border-2 border-sand-edge px-3 text-[12px] font-extrabold text-ink-500">{action.label}</button>}
  </div>
  {help && <p className="text-[11px] font-bold leading-snug text-ink-300">{help}</p>}
</div>
```
Ô nhập do call-site dựng, nhưng chuỗi class chuẩn được export cạnh nó để 6 chỗ không tự chế:
```tsx
export const FIELD_INPUT = 'h-11 w-full truncate rounded-r12 border-2 border-sand-edge px-3 text-[14px] font-bold text-ink-900 outline-none focus:border-teal-500'
export const FIELD_INPUT_ERROR = 'border-fix-700'
// Ô OTP / mã khôi phục: Baloo 22, tracking 6, căn giữa (brief §2 A2 ④⑤).
export const FIELD_INPUT_CODE = 'text-center font-display text-[22px] font-extrabold tracking-[6px]'
```

```tsx
// SegRow.tsx — R23/R24 / quyết định 6. `dim` là tone THỨ BA, không phải `off` mờ đi: nó nói "đang
// được chọn hộ, không phải do bạn bấm" (Bài học · Tự động → bậc hiện tại).
const TONE = {
  on: 'bg-coral-500 text-white shadow-chunky-coral',
  off: 'border-2 border-line-200 bg-cream-50 text-ink-500',
  dim: 'border-2 border-dashed border-[#D9CBB4] bg-[#EFE2CC] text-ink-500',
} as const
// seg: `h-11 flex-1 rounded-r12 font-display text-[13px] font-extrabold whitespace-nowrap active:translate-y-[2px]`
```

```tsx
// Stepper.tsx — R23 / quyết định 6. Bỏ `<input type="number">` hiện (`ParentDashboard.tsx:947`):
// bàn phím số của iOS che nửa màn ngay dưới ô. −/+ bước 5 là đủ; input ẩn giữ đường a11y.
const BTN = "flex h-9 w-9 items-center justify-center rounded-r10 bg-sand font-display text-[18px] font-extrabold text-ink-500 relative after:absolute after:-inset-1 after:content-['']"
const BOX = 'flex h-9 w-16 items-center justify-center rounded-r10 border-2 border-teal-500 font-display text-[16px] font-extrabold text-teal-600 max-md:w-14'
```
`onChange` chỉ gọi khi giá trị mới nằm trong `[min, max]` (test trên khoá điều này); `<input type="number" className="sr-only" aria-label="Phút mỗi ngày" min max step value onChange>` đứng cuối; chú thích `5–60, bước 5` `text-[11px] font-bold text-ink-300`.

`adult/index.ts` re-export cả năm + type; `ui/index.ts` thêm `export { GateCard }`.

- [ ] **Step 4: Run** `vitest run src/components` + lint + typecheck → PASS.
- [ ] **Step 5: Ảnh** — chưa màn nào dùng (component thuần). Không chụp.
- [ ] **Step 6: Commit** — `feat(adult): GateCard, Panel, PanelGrid, FieldRow, SegRow, Stepper — the parent-zone frame`

---

### Task 3: `MinutesChart`, `RecordingRow`, `RemoteRow` (+ **kiểm dữ liệu `score`** trước khi vẽ cột điểm)

**Files:**
- Create: `client/src/components/adult/MinutesChart.tsx`, `client/src/components/adult/RecordingRow.tsx`, `client/src/components/adult/RemoteRow.tsx`
- Modify: `client/src/components/adult/index.ts`, (**có điều kiện, xem Step 0**) `client/src/progress/recordings.ts`, `client/src/screens/PairPractice.tsx`
- Test: `client/src/components/adult/adult-rows.test.tsx`, (có điều kiện) `client/src/progress/recordings.test.ts`

**Interfaces:**
- Consumes: `EmptyState variant='dashed'` (Task 1), `Recording` (`progress/recordings.ts:6`), `RemoteStats` (`cloud/remote.ts:39`), `minutesPerDay` trả `{ day: string; minutes: number }[]`.
- Produces:
  - `<MinutesChart days={{ day, minutes }[]} limitMinutes range={7|14} onRangeChange? todayKey />` — `data-testid="minutes-chart"`, cột giữ `data-testid="minute-bar"` + `data-minutes` (**testid cũ, đừng đổi**).
  - `<RecordingRow ts text score? playing? error? onPlay />` — `data-testid="recording-row"`.
  - `<RemoteRow name sub state={'loading'|'error'|'empty'|'data'|'thisDevice'|'stale'|'noAudio'} onAction? />` — `data-testid="remote-row"`.

- [ ] **Step 0: Kiểm dữ liệu (làm TRƯỚC mọi dòng code) — quyết định 8 và 28 phụ thuộc vào nó**

```bash
grep -n "export type Recording" client/src/progress/recordings.ts
grep -rn "saveRecording(" client/src --include=*.tsx | grep -v test
grep -n "kind: 'story'" client/src/screens/StoryQuiz.tsx
grep -n "export function averageScoreByKind" -A 8 client/src/progress/activity.ts
```
Kết quả đã biết khi viết kế hoạch (phải xác nhận lại, không tin bản ghi này):
- `Recording` = `{ id; ts; text; blob }` — **không có `score`**. Người ghi **duy nhất** là `PairPractice.tsx:86`, và `result.overall` đang nằm sẵn trong tầm với ở đúng dòng trên nó (`:85` đã ghi `score: result.overall` vào `logActivity`).
- Event `story` do `StoryQuiz.tsx:90` ghi **không có `score`** ⇒ `averageScoreByKind(events).story` **luôn `null`** ⇒ ô "Truyện" luôn hiện "—". **Đó đúng như artboard vẽ** (brief §2 P2#4 vẽ `Truyện "—"`), nên quyết định 28 **không cần** thay đổi nào ngoài UI. Ghi nhận, không sửa `activity.ts`.
- [ ] **Ruling "thay đổi thứ tư" (bắt buộc ghi trước khi sửa, spec §Luật ràng buộc):**
  > **Ruling T3-1.** Cột điểm của "Bản ghi gần đây" (quyết định 8 / R22) cần một trường dữ liệu chưa có. Đây là **thay đổi thứ tư** ngoài ba thay đổi logic được phép. Nội dung: thêm `score?: number` (tuỳ chọn) vào `Recording` trong `progress/recordings.ts:6` và truyền `result.overall` tại **một** người ghi duy nhất `PairPractice.tsx:86`. Vì sao an toàn: trường là tuỳ chọn nên 20 bản ghi cũ đọc lại vẫn hợp lệ; IndexedDB không có schema cho giá trị; bản ghi **không đồng bộ** (`ParentDashboard.tsx:767` — blob chỉ nằm trên máy đã ghi) nên không có hợp đồng máy chủ nào bị đụng; `saveRecording` không đọc trường này. Vì sao vẫn phải là Ruling: nó vượt ra ngoài "vòng này là giao diện".
  > **Nhánh dự phòng** (nếu review từ chối thay đổi thứ tư): **bỏ hẳn cột điểm**, `RecordingRow` không nhận `score`, và ghi vào README §Ruling rằng artboard vẽ điểm nhưng dữ liệu không có — **không** vẽ một cột luôn rỗng và cũng **không** hứa sẽ có sau.
  Ghi Ruling vào `.superpowers/sdd/2026-09-04-phase15-parent-zone/progress.md` **trước** Step 1, rồi làm theo nhánh đã chọn. Bản kế hoạch này viết tiếp theo nhánh **đã ghi Ruling và làm thay đổi thứ tư**; nếu chọn nhánh dự phòng thì bỏ `score` khỏi mọi assert và khỏi `shoot.mjs` seed.

- [ ] **Step 1: Failing tests**

```tsx
it('MinutesChart draws four bar colours, a 4% floor and 26px capped bars', () => {
  render(<MinutesChart days={DAYS14} limitMinutes={20} range={14} todayKey={DAYS14[13].day} />)
  const bars = screen.getAllByTestId('minute-bar')
  expect(bars).toHaveLength(14)
  expect(bars[13]).toHaveClass('bg-coral-500')                       // hôm nay
  expect(bars[12]).toHaveClass('bg-teal-500')                        // ≥20
  expect(bars[11]).toHaveClass('bg-sun-400')                         // >0
  expect(bars[10]).toHaveClass('bg-line-200', 'h-1')                 // 0 → cao 4
  expect(bars[0].parentElement).toHaveClass('flex-1', 'max-w-[26px]')
  expect(bars[0]).toHaveClass('rounded-[7px]')
  expect(screen.getByTestId('minutes-plot')).toHaveClass('h-[86px]', 'gap-[9px]', 'md:h-[120px]', 'md:gap-1.5')
})
it('MinutesChart labels three milestones, not fourteen, and names the target line', () => {
  render(<MinutesChart days={DAYS14} limitMinutes={20} range={14} todayKey={DAYS14[13].day} />)
  expect(screen.getAllByTestId('day-label')).toHaveLength(3)
  expect(screen.getByText('hôm nay')).toHaveClass('text-coral-text')
  expect(screen.getByText("mục tiêu 20'")).toHaveClass('text-[10px]', 'text-sun-700')
  expect(screen.getByTestId('target-line')).toHaveClass('border-t-2', 'border-dashed', 'border-sun-400')
})
it('MinutesChart range 7 draws seven bars and hides the range switch on the phone', () => {
  render(<MinutesChart days={DAYS14} limitMinutes={20} range={7} todayKey={DAYS14[13].day} onRangeChange={() => {}} />)
  expect(screen.getAllByTestId('minute-bar')).toHaveLength(7)
  expect(screen.getByTestId('range-switch')).toHaveClass('hidden', 'md:inline-flex')
  fireEvent.click(screen.getByRole('button', { name: '14' }))
})
it('MinutesChart with no history is the dashed empty box, never fourteen 2% bars', () => {
  render(<MinutesChart days={[]} limitMinutes={20} range={14} todayKey="" />)
  expect(screen.getByTestId('empty-state')).toHaveClass('min-h-[120px]', 'border-dashed')
  expect(screen.queryByTestId('minute-bar')).toBeNull()
})
it('RecordingRow is a 44px row: 36px teal play in a 44 hit, 11px date, one-line sentence, banded score', () => {
  render(<RecordingRow ts={TS} text={LONG_61} score={86} onPlay={() => {}} />)
  expect(screen.getByTestId('recording-row')).toHaveClass('flex', 'h-11', 'items-center', 'gap-2.5', 'border-b', 'border-line-200')
  const play = screen.getByRole('button', { name: 'Phát' })
  expect(play).toHaveClass('h-9', 'w-9', 'rounded-full', 'bg-teal-500', 'after:-inset-1')
  expect(play.className).not.toMatch(/md:h-16|h-11 w-11/)
  expect(screen.getByText('02/09 09:41')).toHaveClass('text-[11px]', 'font-extrabold', 'text-ink-300')
  expect(screen.getByText(LONG_61)).toHaveClass('truncate', 'text-[13px]')
  expect(screen.getByText('86')).toHaveClass('text-[11px]', 'text-good-700')
})
it('RecordingRow scores band at 80 and 50, and an absent score shows nothing at all', () => {
  const { rerender } = render(<RecordingRow ts={TS} text="hi" score={72} onPlay={() => {}} />)
  expect(screen.getByText('72')).toHaveClass('text-sun-700')
  rerender(<RecordingRow ts={TS} text="hi" score={48} onPlay={() => {}} />)
  expect(screen.getByText('48')).toHaveClass('text-fix-700')
  rerender(<RecordingRow ts={TS} text="hi" onPlay={() => {}} />)
  expect(screen.queryByTestId('recording-score')).toBeNull()
})
it('RecordingRow playing swaps ▶ for ❚❚ and draws a 3px bar; a failed play turns the row red', () => {
  const { rerender } = render(<RecordingRow ts={TS} text="hi" playing onPlay={() => {}} />)
  expect(screen.getByRole('button', { name: 'Dừng' })).toHaveTextContent('❚❚')
  expect(screen.getByTestId('recording-progress')).toHaveClass('h-[3px]', 'bg-teal-500')
  rerender(<RecordingRow ts={TS} text="hi" error onPlay={() => {}} />)
  expect(screen.getByTestId('recording-row')).toHaveClass('bg-fix-50')
  expect(screen.getByText('Không phát được')).toHaveClass('text-[11px]', 'text-fix-700')
})
it('RemoteRow squeezes every number into one ellipsised 11px line with a 36px row button', () => {
  render(<RemoteRow name="Nguyễn Hoàng Bảo Ngọc Anh Thư" sub="🔥 4 ngày · 58'/tuần · Nói 79 · Từ 77 · Câu 70 · Âm sai /θ/ 46" state="data" onAction={() => {}} />)
  expect(screen.getByTestId('remote-row')).toHaveClass('flex', 'min-h-[56px]', 'items-center', 'gap-2.5', 'border-b', 'border-line-200')
  expect(screen.getByText(/Nguyễn Hoàng/)).toHaveClass('truncate', 'text-[13px]', 'font-extrabold')
  expect(screen.getByText(/58'\/tuần/)).toHaveClass('truncate', 'text-[11px]', 'font-bold')
  expect(screen.getByRole('button', { name: 'Chi tiết' })).toHaveClass('h-9', 'rounded-r10', 'border-2', 'border-sand-edge', 'text-[12px]')
})
it('RemoteRow error offers a retry, thisDevice appends "· máy này", stale and empty have no button', () => {
  const { rerender } = render(<RemoteRow name="Bé · máy này" sub="Không tải được — kiểm tra mạng." state="error" onAction={() => {}} />)
  expect(screen.getByText(/Không tải được/)).toHaveClass('text-fix-700')
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  rerender(<RemoteRow name="Minh" sub="Cập nhật 12 ngày trước · 🔥 0 · 0'/tuần" state="stale" onAction={() => {}} />)
  expect(screen.getByText(/12 ngày trước/)).toHaveClass('text-ink-300')
  rerender(<RemoteRow name="Bé" sub="Chưa có dữ liệu trên máy chủ." state="empty" />)
  expect(screen.queryByRole('button')).toBeNull()
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/components/adult` → FAIL.

- [ ] **Step 3: Implement**

```tsx
// MinutesChart.tsx — R19/Q17 / quyết định 7 và 27. `range` do MÀN quyết định (14 mặc định ở
// md:/ipad:, 7 ở phone — `PHONE_DAYS` đã đúng trong code từ Phase 12); component chỉ vẽ.
const BAR = (m: number, isToday: boolean) =>
  isToday ? 'bg-coral-500' : m >= 20 ? 'bg-teal-500' : m > 0 ? 'bg-sun-400' : 'bg-line-200 h-1'
// Cột: `w-full rounded-[7px]`, chiều cao `Math.max(4, (m / scaleMax) * 100)%` — 4, không 2:
// một cột 2% ở plot 86px là 1.7px, mỏng hơn đường kẻ và đọc như "không có".
// Ba nhãn mốc: days[0] · days[Math.floor(n/2)] · "hôm nay" (`text-coral-text`), 10px.
// Nút đổi: `hidden md:inline-flex` (quyết định 27 — phone không có nút), nền `bg-sand rounded-r10 p-[3px]`,
// mỗi ô `h-[26px] rounded-lg px-2 text-[12px]`, ô chọn `bg-white shadow-[0_2px_0_#E2D5C0]`.
```
Plot: `<div data-testid="minutes-plot" className="relative flex h-[86px] items-end gap-[9px] md:h-[120px] md:gap-1.5">`; đường mục tiêu `<div data-testid="target-line" className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-sun-400" style={{ top: `${targetTopPct}%` }} />` + nhãn `mục tiêu {limit}'` `absolute right-0 text-[10px] font-bold text-sun-700`. `days.length === 0` → `<EmptyState adult variant="dashed" emoji="📈" title="Chưa có lịch sử luyện" sub="Biểu đồ hiện từ ngày học đầu tiên." />`.

```tsx
// RecordingRow.tsx — R22/Q18 / quyết định 8 và 30. Hàng 44 (không 64: quyết định 1), ▶ 36 trong
// hit 44, câu MỘT dòng ellipsis (câu dài nhất design vẽ là 61 ký tự).
const SCORE = (s: number) => (s >= 80 ? 'text-good-700' : s >= 50 ? 'text-sun-700' : 'text-fix-700')
```
Hàng: `<div data-testid="recording-row" className={`flex h-11 items-center gap-2.5 border-b border-line-200 ${error ? 'bg-fix-50' : ''}`}>`; nút `aria-label={playing ? 'Dừng' : 'Phát'}` với `❚❚`/`▶`; ngày `text-[11px] font-extrabold text-ink-300 shrink-0`; câu `min-w-0 flex-1 truncate text-[13px] font-bold text-ink-900`; điểm `data-testid="recording-score"` `shrink-0 text-[11px] font-extrabold ${SCORE(score)}`; lỗi → thêm `<span className="shrink-0 text-[11px] font-extrabold text-fix-700">Không phát được</span>`; `playing` → `<div data-testid="recording-progress" className="h-[3px] w-full animate-pulse bg-teal-500" />` ngay dưới hàng (bọc cả hai trong `<div className="flex flex-col">`).

```tsx
// RemoteRow.tsx — R18 / quyết định 9 và 31. Ba dòng số của hôm nay (`ParentDashboard.tsx:753-761`)
// nén thành MỘT chuỗi do màn dựng và truyền vào — ellipsis, không xuống dòng tự do.
const SUB = { data: 'text-ink-500', thisDevice: 'text-ink-500', error: 'text-fix-700', empty: 'text-ink-300', stale: 'text-ink-300', noAudio: 'text-ink-500', loading: 'text-ink-300' }
const ACTION = { error: 'Thử lại', data: 'Chi tiết', thisDevice: 'Chi tiết', stale: 'Chi tiết', noAudio: 'Chi tiết' }
```
Hàng: `min-h-[56px] gap-2.5 border-b border-line-200 py-1.5`; 🦊 `text-[20px] leading-none shrink-0`; khối chữ `min-w-0 flex-1 flex-col`; nút hàng `h-9 shrink-0 rounded-r10 border-2 border-sand-edge px-2.5 text-[12px] font-extrabold text-ink-500` (36 trong hit 44 → `relative after:absolute after:-inset-1 after:content-['']`). `state === 'loading'` → `<RemoteRowSkeleton />` (giữ component Phase 12).

(Nếu đã chọn nhánh Ruling) `progress/recordings.ts:6` → `export type Recording = { id: string; ts: number; text: string; blob: Blob; score?: number }`; `PairPractice.tsx:86` → `saveRecording({ id: …, ts: …, text: targetText, blob, score: result.overall })`; thêm một test vào `recordings.test.ts` chứng minh bản ghi **không** có `score` vẫn đọc lại được.

- [ ] **Step 4: Run** `vitest run src/components/adult src/progress src/screens/PairPractice` + lint + typecheck → PASS.
- [ ] **Step 5: Ảnh** — chưa màn nào dùng. Không chụp.
- [ ] **Step 6: Commit** — `feat(adult): MinutesChart 4 colours + range switch, RecordingRow 44, RemoteRow 7 states (+ optional Recording.score)`

---

### Task 4: `AccountCard` — 11 trạng thái tách khỏi thân `ParentDashboard`

**Files:**
- Create: `client/src/components/adult/AccountCard.tsx`
- Modify: `client/src/components/adult/index.ts`
- Test: `client/src/components/adult/account-card.test.tsx`

**Interfaces:**
- Consumes: `SyncPill` (`status`, `hasSession`, `size='sm'|'md'`), `Notice` (`kind`, `icon?`, `adult`, `title`, `sub`, `code`), `AccountCardSkeleton`, `FieldRow` + `FIELD_INPUT`/`FIELD_INPUT_ERROR`/`FIELD_INPUT_CODE`, `Button size='adult'`.
- Produces: một component **thuần trình bày** — mọi hàm bất đồng bộ vẫn ở `ParentDashboard` (Task 11 chỉ nối dây):
```tsx
export type AccountState =
  | { kind: 'loading' }                                             // ①
  | { kind: 'noSession'; online: boolean }                          // ② + ③ (tách theo `online`)
  | { kind: 'link'; email: string; busy?: boolean; error?: string } // ④ + ⑤ + ⑦
  | { kind: 'otp'; email: string; otp: string; busy?: boolean; error?: string } // ⑥
  | { kind: 'linked'; email: string; signingOut?: boolean; pending?: number }   // ⑨ + ⑪
  | { kind: 'syncError'; email: string | null; pending: number }    // ⑩
export function AccountCard(props: {
  state: AccountState
  sync: SyncStatus
  hasSession: boolean
  recoveryCode: string | null                                       // ⑧ (đi kèm ④–⑦)
  onEmailChange: (v: string) => void
  onOtpChange: (v: string) => void
  onSendOtp: () => void
  onVerifyOtp: () => void
  onEditEmail: () => void
  onSignOut: () => void
  onRetryConnect: () => void
  onRetrySync: () => void
}): JSX.Element
```
  `data-testid="account-card-body"`; giữ `data-testid="no-session"` cho nhánh ②/③ (test cũ `ParentDashboard.test.tsx:734,900,916` bám vào nó).

- [ ] **Step 1: Failing tests** — mười một `it(...)`, mỗi trạng thái một cái; brief §2 "Thẻ Tài khoản — 11 trạng thái" là nguồn của từng chuỗi.

```tsx
const base = { sync: SYNCED, hasSession: true, recoveryCode: null, ...noopHandlers }
it('① loading is the 150px skeleton under a "…" pill', () => {
  render(<AccountCard {...base} state={{ kind: 'loading' }} />)
  expect(screen.getByTestId('skeleton-account')).toHaveClass('h-[150px]')
  expect(screen.getByTestId('account-card-body')).toHaveClass('min-h-[150px]')
})
it('② no session online: info notice + "Thử kết nối", pill "⚡ Chưa kết nối"', () => {
  render(<AccountCard {...base} hasSession={false} state={{ kind: 'noSession', online: true }} />)
  const n = screen.getByTestId('no-session')
  expect(n).toHaveClass('bg-teal-50', 'text-teal-600')
  expect(n).toHaveTextContent('Chưa kết nối được tài khoản. Bé vẫn học bình thường, tiến độ lưu trên máy.')
  expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Chưa kết nối')
  expect(screen.getByRole('button', { name: 'Thử kết nối' })).toHaveClass('min-h-[44px]')
})
it('③ no session offline is its own state: warn tone with the 📡 icon and no button', () => {
  render(<AccountCard {...base} hasSession={false} sync={OFFLINE} state={{ kind: 'noSession', online: false }} />)
  const n = screen.getByTestId('no-session')
  expect(n).toHaveClass('bg-sun-50', 'text-sun-700')
  expect(n).toHaveTextContent('Đang ngoại tuyến — sẽ tự kết nối khi có mạng.')
  expect(within(n).getByText('📡')).toBeInTheDocument()
  expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Ngoại tuyến')
  expect(screen.queryByRole('button', { name: 'Thử kết nối' })).toBeNull()
})
it('④ the link form is one sentence, a 44px field and a "Liên kết" button', () => {
  render(<AccountCard {...base} sync={PENDING12} state={{ kind: 'link', email: '' }} />)
  expect(screen.getByText('Liên kết email để giữ tiến độ và xem trên máy khác.')).toHaveClass('text-[12px]')
  expect(screen.getByLabelText('Email của bố mẹ')).toHaveClass('h-11', 'rounded-r12', 'border-2', 'border-sand-edge')
  expect(screen.getByPlaceholderText('email@vidu.com')).toBeInTheDocument()
  expect(screen.getByTestId('sync-status')).toHaveTextContent('● Chưa đồng bộ 12 mục')
})
it('⑤ busy dims the button, spins a 16px ring inside it and keeps the typed email', () => {
  render(<AccountCard {...base} state={{ kind: 'link', email: 'me@ex.com', busy: true }} />)
  const btn = screen.getByRole('button', { name: /Đang gửi…/ })
  expect(btn).toBeDisabled()
  expect(btn).toHaveClass('opacity-70')
  expect(within(btn).getByTestId('button-spinner')).toHaveClass('h-4', 'w-4')
  expect(screen.getByLabelText('Email của bố mẹ')).toHaveValue('me@ex.com')
})
it('⑥ OTP: the 61-char email sits inside the sentence, the code box is Baloo 20 tracking 6, "Sửa lại email" is 44', () => {
  render(<AccountCard {...base} state={{ kind: 'otp', email: EMAIL61, otp: '4821' }} />)
  expect(screen.getByTestId('otp-sentence')).toHaveClass('truncate')
  expect(screen.getByTestId('otp-sentence')).toHaveAttribute('title', EMAIL61)
  expect(screen.getByLabelText('Mã 6 số')).toHaveClass('text-center', 'font-display', 'text-[20px]', 'tracking-[6px]', 'border-teal-500')
  const edit = screen.getByRole('button', { name: 'Sửa lại email' })
  expect(edit).toHaveClass('min-h-[44px]')
  expect(edit.className).not.toMatch(/min-h-\[36px\]/)
})
it('⑦ an error reddens the field and puts the sentence in the field gutter, not after the form', () => {
  render(<AccountCard {...base} state={{ kind: 'otp', email: EMAIL61, otp: '48', error: 'Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.' }} />)
  expect(screen.getByLabelText('Mã 6 số')).toHaveClass('border-fix-700')
  expect(screen.getByTestId('field-error')).toHaveTextContent('Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.')
  expect(screen.getByRole('button', { name: 'Gửi lại mã' })).toBeInTheDocument()
})
it('⑧ the recovery code keeps the Phase 12 credential Notice', () => {
  render(<AccountCard {...base} recoveryCode="QZQJ7MFC" state={{ kind: 'link', email: '' }} />)
  expect(screen.getByText('QZQJ7MFC')).toHaveClass('tracking-[4px]')
  expect(screen.getByText(/Chỉ hiện 1 lần/)).toBeInTheDocument()
})
it('⑨ linked: a 61-char email in a 44px read-only box, one line, ellipsised, with a title', () => {
  render(<AccountCard {...base} sync={SYNCED_AT} state={{ kind: 'linked', email: EMAIL61 }} />)
  const box = screen.getByTestId('linked-email')
  expect(box).toHaveClass('h-11', 'truncate', 'min-w-0', 'rounded-r12', 'border-2', 'border-line-200')
  expect(box).toHaveAttribute('title', EMAIL61)
  expect(screen.getByTestId('sync-status')).toHaveTextContent('✓ Đã đồng bộ · 09:41')
  expect(screen.getByRole('button', { name: 'Đăng xuất' })).toHaveClass('min-h-[44px]')
})
it('⑩ sync error: the ⚠ pill, the count sentence and a "Thử lại" that calls onRetrySync', () => {
  const onRetrySync = vi.fn()
  render(<AccountCard {...base} onRetrySync={onRetrySync} sync={SYNC_ERROR} state={{ kind: 'syncError', email: EMAIL61, pending: 3 }} />)
  expect(screen.getByTestId('sync-status')).toHaveTextContent('⚠ Không đồng bộ được')
  expect(screen.getByText('3 mục chưa lên máy chủ. Sẽ thử lại khi có mạng.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); expect(onRetrySync).toHaveBeenCalled()
})
it('⑪ signing out: the syncing pill, the "đang lưu" sentence and a half-faded button', () => {
  render(<AccountCard {...base} sync={SYNCING} state={{ kind: 'linked', email: EMAIL61, signingOut: true, pending: 3 }} />)
  expect(screen.getByTestId('sync-status')).toHaveTextContent('◌ Đang đồng bộ…')
  expect(screen.getByText('Đang lưu 3 mục còn lại trước khi đăng xuất…')).toBeInTheDocument()
  const btn = screen.getByRole('button', { name: 'Đăng xuất' })
  expect(btn).toBeDisabled(); expect(btn).toHaveClass('opacity-50')
})
it('no control in any of the eleven states is a 56/64 child button', () => {
  for (const state of ALL_11_STATES) {
    const { unmount } = render(<AccountCard {...base} state={state} />)
    for (const b of screen.queryAllByRole('button')) {
      expect(b.className).not.toMatch(/min-h-\[56px\]|min-h-\[64px\]|md:h-16|md:min-h-\[64px\]/)
    }
    unmount()
  }
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/components/adult/account-card` → FAIL.

- [ ] **Step 3: Implement** — chép từng chuỗi từ brief §2 (bảng 11 trạng thái); JSX gốc lấy từ `ParentDashboard.tsx:548-637` và **hạ mọi mốc** theo quyết định 1.

- Khung: `<div data-testid="account-card-body" className="flex min-h-[150px] flex-col gap-2.5">` — 150 giữ cao qua cả 11 trạng thái (không nhảy khi ①→④).
- Pill: `<SyncPill status={sync} hasSession={hasSession} size="md" onRetry={onRetrySync} />` — Task 11 đặt nó vào `Panel right`; `size="sm"` cho mọi chỗ hẹp hơn.
- ②/③: `<Notice kind={online ? 'info' : 'warn'} icon={online ? undefined : '📡'} adult testId="no-session" title={…} />`. Hai câu **mới, ngắn hơn** `noSessionNotice()` (`ParentDashboard.tsx:110-120`) — tách ③ khỏi ② là quyết định 10; hàm cũ **bị xoá ở Task 11**.
- ④/⑤/⑦: `FieldRow label="Email của bố mẹ"` + `<input className={`${FIELD_INPUT} ${error ? FIELD_INPUT_ERROR : ''}`} placeholder="email@vidu.com" …>`; nút `Button size="adult"`, `busy` → nhãn "Đang gửi…", `disabled`, `opacity-70`, kèm `<span data-testid="button-spinner" aria-hidden className="h-4 w-4 animate-[spin_1.2s_linear_infinite] rounded-full border-2 border-white/40 border-t-white" />`.
- ⑥: `FieldRow label="Mã 6 số"` + input `${FIELD_INPUT} ${FIELD_INPUT_CODE} text-[20px] border-teal-500` (**20**, không 22: brief §2 bảng thẻ Tài khoản ⑥ ghi 20 — ô 22 là của A2); câu `<p data-testid="otp-sentence" title={email} className="min-w-0 truncate text-[12px] font-bold text-ink-500">Nhập mã 6 số vừa gửi tới {email}</p>` (R17); "Sửa lại email" `min-h-[44px] flex-1 self-start text-left text-[13px] font-extrabold text-ink-500 underline` — **bỏ `min-h-[36px]`** của `:606`.
- ⑧: giữ `Notice kind="credential"` (quyết định 15 chốt dứt khoát một lần: khung teal đọc rõ hơn artboard), tiêu đề "Mã khôi phục — chụp màn hình lại. Chỉ hiện 1 lần.", sub "Dùng mã này để lấy lại tiến độ trên máy khác." Chip mã giữ `text-[24px]` của `Notice.tsx:64` — design vẽ 22; **`Notice` ngoài `icon?` không được đụng** ở vòng này, nên chênh 2px vào Ruling Task 16.
- ⑨/⑪: `<div data-testid="linked-email" title={email} className="flex h-11 min-w-0 flex-1 items-center truncate rounded-r12 border-2 border-line-200 px-3 text-[13px] font-bold text-ink-900">{email}</div>` + `Button size="adult" variant="outline"`; `signingOut` → nhãn vẫn "Đăng xuất", `disabled`, `opacity-50`, kèm câu `Đang lưu {pending} mục còn lại trước khi đăng xuất…`.
- ⑩: câu `{pending} mục chưa lên máy chủ. Sẽ thử lại khi có mạng.` đặt trong `FieldRow error` dưới ô email chỉ đọc; nút outline "Thử lại" → `onRetrySync`.

- [ ] **Step 4: Run** `vitest run src/components/adult` + lint + typecheck → PASS.
- [ ] **Step 5: Ảnh** — chưa gắn vào màn; ảnh 11 trạng thái đến ở Task 11. Không chụp.
- [ ] **Step 6: Commit** — `feat(adult): AccountCard — the eleven account states, extracted from ParentDashboard`

---

### Task 5: `ProfilePicker` ba mật độ + `ParentQuestion` viết lại

**Files:**
- Modify: `client/src/components/ProfilePicker.tsx`, `client/src/components/ParentQuestion.tsx`
- Test: `client/src/components/ProfilePicker.test.tsx`, `client/src/components/parent-question.test.tsx` (mới — hôm nay `ParentQuestion` chỉ được kiểm gián tiếp qua `ParentGate`/`CloudStart`)

**Interfaces:**
- Consumes: `Profile` (`cloud/profileState`), `distinguishAll` (nội bộ file, **không đụng**), `animate-shake` (Task 1).
- Produces:
  - `ProfilePicker` thêm `density?: 'auto' | 'row' | 'grid' | 'compact'` (mặc định `'auto'` = tự suy từ `profiles.length`), `pendingId?: string | null`, `footer?: boolean`. Ba call-site cũ (`ProfileGate.tsx:169`, `CloudStart.tsx:371`, `ParentDashboard.tsx:675`) **không buộc phải sửa** ở task này.
  - `ParentQuestion` thêm `sub?: string`; `title` mặc định giữ `'Dành cho phụ huynh'`.

- [ ] **Step 1: Failing tests**

```tsx
// ProfilePicker.test.tsx — test cũ 'lists every profile at a 64 px tap floor' phải đổi (mốc 64 bị xoá)
it('2–3 profiles are one row of 96px cells; 4–8 are an 88px grid 2/4 with a scroller and a footer', () => {
  const { rerender } = render(<ProfilePicker profiles={three} onSelect={noop} />)
  expect(screen.getByTestId('picker')).toHaveClass('flex', 'gap-2')
  expect(screen.getAllByRole('button')[0]).toHaveClass('h-24', 'flex-1', 'min-w-0')
  rerender(<ProfilePicker profiles={eight} onSelect={noop} />)
  expect(screen.getByTestId('picker')).toHaveClass('grid', 'grid-cols-2', 'gap-2', 'md:grid-cols-4')
  expect(screen.getByTestId('picker').className).not.toMatch(/\bsm:|\blg:/)
  expect(screen.getAllByRole('button')[0]).toHaveClass('h-[88px]')
  expect(screen.getByTestId('picker-scroll')).toHaveClass('max-h-[380px]', 'overflow-y-auto')
  expect(screen.getByText('8 hồ sơ · cuộn xem thêm')).toHaveClass('text-[12px]', 'text-ink-300')
})
it('density="compact" is CloudStart\'s 72px cell and never shows a footer', () => {
  render(<ProfilePicker profiles={three} density="compact" onSelect={noop} />)
  expect(screen.getAllByRole('button')[0]).toHaveClass('h-[72px]')
  expect(screen.queryByText(/cuộn xem thêm/)).toBeNull()
})
it('a long name wraps to two clamped lines and keeps the full name in the title attribute', () => {
  render(<ProfilePicker profiles={[{ ...p, name: 'Nguyễn Hoàng Bảo Ngọc Anh Thư' }]} onSelect={noop} />)
  expect(screen.getByRole('button')).toHaveAttribute('title', 'Nguyễn Hoàng Bảo Ngọc Anh Thư')
  expect(screen.getByText('Nguyễn Hoàng Bảo Ngọc Anh Thư')).toHaveClass('line-clamp-2', 'text-[14px]', 'leading-[1.2]')
})
it('the active cell is teal with a ✓; a pending cell spins and the rest of the grid dims', () => {
  render(<ProfilePicker profiles={eight} activeId={eight[0].id} pendingId={eight[3].id} onSelect={noop} />)
  expect(screen.getAllByRole('button')[0]).toHaveClass('border-teal-500')
  expect(within(screen.getAllByRole('button')[0]).getByText('✓')).toBeInTheDocument()
  expect(screen.getByTestId('picker')).toHaveClass('opacity-50')
  expect(within(screen.getAllByRole('button')[3]).getByTestId('cell-spinner')).toBeInTheDocument()
  expect(within(screen.getAllByRole('button')[0]).queryByTestId('cell-spinner')).toBeNull()
})
it('no cell is a 64px child target any more', () => {
  render(<ProfilePicker profiles={eight} onSelect={noop} />)
  for (const b of screen.getAllByRole('button')) expect(b.className).not.toMatch(/min-h-\[64px\]/)
})
it('busy still disables every button (Phase 12 behaviour kept)', () => { /* giữ nguyên test cũ */ })
it('the discriminator lines are unchanged', () => { /* giữ nguyên 4 test cũ của distinguishAll */ })

// parent-question.test.tsx
it('is a 32px sum, a 96×44 box and one 44px "Vào" on the right', () => {
  render(<ParentQuestion onPass={noop} sub="Trả lời phép tính để vào Góc phụ huynh." />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('font-display', 'text-[18px]')
  expect(screen.getByText('Trả lời phép tính để vào Góc phụ huynh.')).toHaveClass('text-[13px]', 'text-ink-500')
  expect(screen.getByText(/× \d+ =/)).toHaveClass('font-display', 'text-[32px]')
  expect(screen.getByLabelText('Đáp án')).toHaveClass('h-11', 'w-24', 'rounded-r12', 'border-2', 'text-center')
  const submit = screen.getByRole('button', { name: 'Vào' })
  expect(submit).toHaveClass('min-h-[44px]')
  expect(submit.className).not.toMatch(/min-h-\[56px\]|md:min-h-\[64px\]/)
  expect(submit.parentElement).toHaveClass('justify-end')
})
it('the error gutter is always 18px tall and empty until a wrong answer', () => {
  render(<ParentQuestion onPass={noop} />)
  const gutter = screen.getByTestId('question-error')
  expect(gutter).toHaveClass('min-h-[18px]', 'text-[12px]', 'text-fix-700')
  expect(gutter).toBeEmptyDOMElement()
})
it('a wrong answer changes the question, reddens and shakes the box', () => {
  render(<ParentQuestion onPass={noop} />)
  const before = screen.getByText(/× \d+ =/).textContent
  fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
  expect(screen.getByTestId('question-error')).toHaveTextContent('⛔ Chưa đúng — câu hỏi đã đổi, thử lại nhé.')
  expect(screen.getByLabelText('Đáp án')).toHaveClass('border-fix-700', 'animate-shake')
  expect(screen.getByText(/× \d+ =/).textContent).not.toBe(before)
})
it('an empty submit keeps the question and says so in its own words', () => {
  render(<ParentQuestion onPass={noop} />)
  const before = screen.getByText(/× \d+ =/).textContent
  fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
  expect(screen.getByTestId('question-error')).toHaveTextContent('Nhập kết quả trước nhé')
  expect(screen.getByText(/× \d+ =/).textContent).toBe(before)
})
it('typing clears the error band without moving anything', () => {
  render(<ParentQuestion onPass={noop} />)
  fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
  fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '2' } })
  expect(screen.getByTestId('question-error')).toBeEmptyDOMElement()
  expect(screen.getByLabelText('Đáp án').className).not.toMatch(/animate-shake|border-fix-700/)
})
it('the right answer passes exactly once', () => { /* đọc a×b từ DOM, gõ, submit → onPass 1 lần */ })
```

- [ ] **Step 2: Run** `vitest run src/components/ProfilePicker src/components/parent-question` → FAIL.

- [ ] **Step 3: Implement**

`ProfilePicker.tsx` (R6 / quyết định 12):
```tsx
// Ba mật độ, một component (brief §1.1). `auto` suy từ số hồ sơ: 2–3 là một hàng ô 96, 4–8 là lưới
// 88 có vùng cuộn 380. "1 hồ sơ → không hiện" là quyết định của A1, không của component này.
type Density = 'auto' | 'row' | 'grid' | 'compact'
const pick = (d: Density, n: number): Exclude<Density, 'auto'> => (d !== 'auto' ? d : n <= 3 ? 'row' : 'grid')
const WRAP = { row: 'flex gap-2', grid: 'grid grid-cols-2 gap-2 md:grid-cols-4', compact: 'grid grid-cols-2 gap-2 md:grid-cols-4' }
const CELL = { row: 'h-24 flex-1 min-w-0', grid: 'h-[88px]', compact: 'h-[72px]' }
```
- Ô: `relative flex ${CELL[d]} flex-col items-center justify-center gap-1 rounded-r14 border-2 px-1.5 py-2 active:translate-y-[2px] disabled:opacity-50` + `active ? 'border-teal-500 bg-teal-50' : 'border-line-200 bg-white'` (hairline: xem Global Constraints).
- Emoji `text-[30px]` (`row`) / `text-[26px]` (`grid`) / `text-[22px]` (`compact`), `leading-none`.
- Tên: **bỏ `shortName(p.name)`** — `<span className="line-clamp-2 text-[14px] font-extrabold leading-[1.2] text-ink-900">{p.name}</span>` (`compact`: `truncate text-[13px]`), `title={p.name}` giữ trên `<button>`. Cắt ở tầng dữ liệu là đúng thứ khiến hai "Nguyễn Hoàng Bảo…" đọc giống hệt nhau. (`shortName` vẫn được `ParentDashboard` dùng chỗ khác — không xoá khỏi `profileState`.)
- Dòng phân biệt: `text-[11px] font-bold text-ink-300`; `distinguishAll` **không đụng một dòng nào**.
- `activeId` → `<span aria-hidden className="absolute right-1 top-1 text-[12px] text-teal-600">✓</span>`.
- `pendingId` → lưới `opacity-50`, mọi ô `disabled`, ô đó thay emoji bằng `<span data-testid="cell-spinner" className="h-[22px] w-[22px] animate-[spin_1.2s_linear_infinite] rounded-full border-2 border-teal-line border-t-teal-500" />`.
- `grid`/`compact` bọc `<div data-testid="picker-scroll" className="relative max-h-[380px] overflow-y-auto">` + fade 36 (`after:sticky after:bottom-0 after:mt-auto after:h-9 after:bg-gradient-to-b after:from-transparent after:to-white`); chân `{n} hồ sơ · cuộn xem thêm` khi `footer !== false && profiles.length > 4`. `compact` không có chân.
- **Xoá `sm:grid-cols-3`** (`:83`) và `min-h-[64px]` (`:95`); sửa docblock "Held to the 64 px tap floor" → luật người lớn của quyết định 1.

`ParentQuestion.tsx` (R4 / quyết định 13 và 20) — viết lại thân, **giữ nguyên** `randInt`/`newQuestion` và toàn bộ docblock "cửa yếu có chủ ý":
```tsx
type Props = { onPass: () => void; title?: string; sub?: string }
const [error, setError] = useState<string | null>(null)
const [shake, setShake] = useState(false)
function handleAnswer(e: ChangeEvent<HTMLInputElement>) {
  setValue(e.target.value)
  // Dải lỗi tự tắt khi bắt đầu gõ (brief §2 P1): câu lỗi nói về LẦN GỬI vừa rồi, không về ô nhập.
  if (error) { setError(null); setShake(false) }
}
function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault()
  // Gửi rỗng KHÔNG phải trả lời sai: giữ nguyên câu hỏi, chỉ nhắc. Hôm nay `:42-49` coi rỗng là sai
  // và đổi câu hỏi — phụ huynh chạm nhầm "Vào" phải đọc lại một phép tính mới.
  if (value.trim() === '') { setError('Nhập kết quả trước nhé'); return }
  if (Number(value.trim()) === question.a * question.b) { onPass(); return }
  setError('⛔ Chưa đúng — câu hỏi đã đổi, thử lại nhé.')
  setShake(true)
  setQuestion(newQuestion())
  setValue('')
}
```
JSX: `<h1 className="font-display text-[18px] font-extrabold text-ink-900">{title}</h1>`; `{sub && <p className="text-[13px] font-bold leading-[1.4] text-ink-500">{sub}</p>}`; hàng phép tính `flex items-center gap-3 py-2` gồm `<span className="font-display text-[32px] font-extrabold text-ink-900">{a} × {b} =</span>` + `<input aria-label="Đáp án" inputMode="numeric" onAnimationEnd={() => setShake(false)} className={`h-11 w-24 rounded-r12 border-2 text-center font-display text-[18px] font-extrabold text-ink-900 outline-none ${error ? 'border-fix-700' : 'border-sand-edge'} ${shake ? 'animate-shake' : ''}`} />`; dải lỗi `<p data-testid="question-error" className="min-h-[18px] text-[12px] font-extrabold leading-[1.4] text-fix-700">{error}</p>`; hàng nút `<div className="flex justify-end"><Button type="submit" size="adult">Vào</Button></div>` (**`size="adult"`** — bỏ mặc định `md` 56/64 của `:69`).

- [ ] **Step 4: Run** toàn bộ suite + lint + typecheck → PASS. Test màn (`CloudStart.test.tsx`, `ParentDashboard.test.tsx`) đỏ vì chuỗi/class thì sửa **ở task của màn đó**; ở đây chỉ sửa `ProfilePicker.test.tsx`.
- [ ] **Step 5: Ảnh** `SHOTS=parent-gate,parent-gate-wrong,profile-gate SHOTS_DIR=../current-phase15/shots node shoot.mjs phone` — hai component mới trong khung **cũ**; khung mới đến ở Task 6/7.
- [ ] **Step 6: Commit** — `feat(adult): ProfilePicker densities + pending spinner, ParentQuestion 32/96×44 with a still error gutter`

---

### Task 6: P1 ParentGate trên `GateCard` + Back `mdLabel` + nền blob

**Files:**
- Modify: `client/src/screens/ParentGate.tsx`, `client/src/components/ui/GateCard.tsx` (thêm `GateBlobs`), `docs/design/current/shoot.mjs`
- Test: `client/src/screens/ParentGate.test.tsx` (mới — hôm nay màn này không có file test riêng)

**Interfaces:**
- Consumes: `GateCard` + `GateBlobs`, `ParentQuestion` (`title`, `sub`), `BackButton` (`variant='adult'`, `label`, `mdLabel` — `BackButton.tsx:50-55` đã hỗ trợ `ipad:`), `PageShell`/`PageHeader`/`PageBody center`.
- Produces: không API mới. `isUnlocked`/`clearFlag`/`handleLock`/`handlePass` (`ParentGate.tsx:12-44`) **không đổi một dòng**. `GateBlobs` là export thứ hai của `ui/GateCard.tsx` (ba cổng dùng chung).

- [ ] **Step 1: Failing tests**

```tsx
it('the gate is one 420px left-aligned card centred in the body, with no max-w-md left', () => {
  renderGate()
  const card = screen.getByTestId('gate-card')
  expect(card).toHaveClass('w-[min(420px,calc(100%-32px))]', 'p-5', 'gap-3', 'text-left')
  expect(card.className).not.toMatch(/max-w-md|text-center/)
  expect(screen.getByTestId('page-body')).toHaveClass('justify-center')
})
it('the header is the adult Back with a landscape-only label, and no LessonChip on the right', () => {
  renderGate()
  const back = screen.getByRole('link', { name: 'Về nhà' })
  expect(back).toHaveClass('h-11', 'rounded-r14')
  expect(within(back).getByText('Về bản đồ 🏝️')).toHaveClass('sr-only', 'hidden', 'ipad:inline')
  expect(screen.getByTestId('header-right')).toBeEmptyDOMElement()
})
it('the card carries the title, the sub and the 32px question', () => {
  renderGate()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dành cho phụ huynh')
  expect(screen.getByText('Trả lời phép tính để vào Góc phụ huynh.')).toBeInTheDocument()
  expect(screen.getByText(/× \d+ =/)).toHaveClass('text-[32px]')
})
it('an empty submit stays on the gate; the right answer hands over to the dashboard', () => {
  renderGate()
  fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
  expect(screen.getByTestId('gate-card')).toBeInTheDocument()
  answerCorrectly()
  expect(screen.getByRole('heading', { name: /Góc phụ huynh/ })).toBeInTheDocument()
})
it('the background blobs are decorative and cannot scroll the body', () => {
  renderGate()
  expect(screen.getByTestId('gate-blobs')).toHaveClass('pointer-events-none', 'absolute', 'inset-0', 'overflow-hidden')
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/screens/ParentGate` → FAIL.

- [ ] **Step 3: Implement** — R1/R2 / quyết định 17, 20, 35.

```tsx
return (
  <PageShell className="relative">
    <GateBlobs />
    <PageHeader right={null} back={<BackButton to="/" label="Về nhà" mdLabel="Về bản đồ 🏝️" variant="adult" />} />
    <PageBody center>
      <GateCard>
        <ParentQuestion key={attempt} onPass={handlePass} sub="Trả lời phép tính để vào Góc phụ huynh." />
      </GateCard>
    </PageBody>
  </PageShell>
)
```
- `right={null}`: `PageHeader` mặc định là `LessonChip` (`PageHeader.tsx:47`) — một cổng người lớn không đeo chip bài học của trẻ.
- `GateBlobs` (viết trong `ui/GateCard.tsx`, brief §1.1 hàng "Blob nền"):
```tsx
export function GateBlobs() {
  return (
    <div data-testid="gate-blobs" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -bottom-[110px] -left-[90px] h-[280px] w-[280px] rounded-full bg-sand md:-bottom-[160px] md:-left-[120px] md:h-[420px] md:w-[420px]" />
      <div className="absolute -right-[100px] -top-[120px] hidden h-[360px] w-[360px] rounded-full bg-teal-50 md:block" />
    </div>
  )
}
```
  (`md:` ở đây phủ cả hai frame iPad vì **không** có `ipad:` nào đụng cùng property — đúng quyết định 35 "iPad dọc của ba cổng = iPad ngang". Vẫn phải kiểm bằng ảnh cả hai frame.)
- `PageShell` nhận `className="relative"` (prop đã có, `PageShell.tsx:9`) để blob định vị được.

`shoot.mjs` — thêm ngay sau `parent-gate-wrong` (dòng 366):
```js
  // Vòng 4 §2 P1: "gửi rỗng" — câu riêng, câu hỏi KHÔNG đổi.
  await S('parent-gate-empty', '/parent', async () => {
    await page.getByRole('button', { name: 'Vào' }).click()
    await sleep(300)
  })
```

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=parent-gate,parent-gate-wrong,parent-gate-empty SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame) + `VIEWPORTS=short SHOTS=parent-gate,parent-gate-empty node shoot.mjs`. Bắt buộc: thẻ **căn giữa** ở cả 4 frame (không lệch trái); nhãn Back đọc "Về bản đồ 🏝️" chỉ ở `ipad/`; không frame nào có `-full`.
- [ ] **Step 6: Commit** — `feat(parent-gate): P1 on GateCard, landscape Back label, gate blobs`

---

### Task 7: A1 ProfileGate — toàn màn hình vs overlay z40, `storageBroken`, 1/3/8 hồ sơ

**Files:**
- Modify: `client/src/screens/ProfileGate.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/ProfileGate.test.tsx`

**Interfaces:**
- Consumes: `GateCard` + `GateBlobs`, `ProfilePicker` (`density='auto'`, `pendingId`), `Notice` (`kind='info'`, `adult`, `testId`), `Foxy` (`mood='idle'`, `size='sm'`), `PageShell`/`PageBody center`.
- Produces: **thay đổi logic được phép (3)** — `writeMark(id, at): boolean` (`ProfileGate.tsx:79-81`) trả `false` khi `sessionStorage` ném; `remember()` trả tiếp `boolean`; state `storageBroken` + `pendingId`. `readMark`/`markIsFresh`/`alreadyChosen`/`RE_ASK_AFTER_MS` và **toàn bộ hành vi hỏi lại không đổi**.

- [ ] **Step 1: Failing tests**

```tsx
it('a one-profile device never renders the gate, not even for a frame', () => {
  seedProfiles(1); render(<ProfileGate><App /></ProfileGate>)
  expect(screen.queryByTestId('gate-card')).toBeNull()
})
it('a cold start with 3 profiles is a full screen: card, blobs, no app behind, no Back', () => {
  seedProfiles(3); render(<ProfileGate><div>app</div></ProfileGate>)
  expect(screen.getByTestId('gate-card')).toBeInTheDocument()
  expect(screen.getByTestId('gate-blobs')).toBeInTheDocument()
  expect(screen.queryByText('app')).toBeNull()
  expect(screen.queryByRole('link', { name: /Về/ })).toBeNull()
  expect(screen.getByTestId('picker')).toHaveClass('flex')            // 3 hồ sơ = một hàng ô 96
})
it('8 profiles are the 2/4-column 88px grid inside a 380px scroller with a footer', () => {
  seedProfiles(8); render(<ProfileGate><div>app</div></ProfileGate>)
  expect(screen.getByTestId('picker')).toHaveClass('grid', 'grid-cols-2', 'md:grid-cols-4')
  expect(screen.getByTestId('picker-scroll')).toHaveClass('max-h-[380px]')
  expect(screen.getByText('8 hồ sơ · cuộn xem thêm')).toBeInTheDocument()
})
it('a resume after 5 minutes is an overlay at z-40, under Toast, with the app blurred behind it', () => {
  seedProfiles(3); markChosen(Date.now() - 6 * 60_000)
  render(<ProfileGate><div>app</div></ProfileGate>)
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  const overlay = screen.getByTestId('profile-reask')
  expect(overlay).toHaveClass('fixed', 'inset-0', 'z-40', 'bg-[rgba(74,59,51,.45)]')
  expect(overlay.className).not.toMatch(/z-50/)
  expect(screen.getByTestId('app-behind')).toHaveClass('blur-[2px]', 'opacity-60')
  expect(screen.getByText('app')).toBeInTheDocument()
})
it('tapping the active profile closes at once; another one spins its own cell then reloads', () => {
  seedProfiles(3); render(<ProfileGate><div>app</div></ProfileGate>)
  fireEvent.click(screen.getAllByRole('button')[0])                   // hồ sơ đang dùng
  expect(screen.queryByTestId('gate-card')).toBeNull()
  cleanup(); seedProfiles(3); render(<ProfileGate><div>app</div></ProfileGate>)
  fireEvent.click(screen.getAllByRole('button')[1])
  expect(screen.getByTestId('cell-spinner')).toBeInTheDocument()
  expect(switchProfile).toHaveBeenCalledWith(ids[1])
})
it('a broken sessionStorage adds one 12px info line and does not change the asking behaviour', () => {
  seedProfiles(3); breakSessionStorage()
  render(<ProfileGate><div>app</div></ProfileGate>)
  fireEvent.click(screen.getAllByRole('button')[0])
  const notice = screen.getByTestId('storage-broken')
  expect(notice).toHaveTextContent('Không nhớ được lựa chọn — sẽ hỏi lại lần sau')
  expect(notice).toHaveClass('bg-teal-50')
  expect(screen.queryByTestId('gate-card')).toBeNull()                // vẫn đóng như thường
})
it('the card head is Foxy 44 beside the two lines', () => {
  seedProfiles(3); render(<ProfileGate><div>app</div></ProfileGate>)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ai đang học nào? 👋')
  expect(screen.getByText('Chạm vào tên của con nhé.')).toHaveClass('text-[13px]')
  expect(screen.getByTestId('foxy')).toBeInTheDocument()
})
```
(`breakSessionStorage()` = `vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })` — chỉ cho `sessionStorage`; nhớ `mockRestore` ở `afterEach`.)

- [ ] **Step 2: Run** `vitest run src/screens/ProfileGate` → FAIL.

- [ ] **Step 3: Implement** — R5/R7 / quyết định 18, 19, 35.

```tsx
/** R7 / quyết định 19: một `sessionStorage` không ghi được là chuyện phải NÓI RA, không phải nuốt.
 * Hành vi không đổi (hỏi lại mỗi lần mở vẫn là hướng an toàn — một đứa trẻ ghi vào hồ sơ của anh
 * chị đắt hơn một lần chạm), nhưng phụ huynh đọc được VÌ SAO cổng cứ hiện lại. */
function writeMark(id: string, at: number): boolean {
  try { sessionStorage.setItem(CHOSEN_KEY, JSON.stringify({ id, at })); return true }
  catch { return false }
}
const remember = (id: string): boolean => writeMark(id, Date.now())
```
- `const [storageBroken, setStorageBroken] = useState(false)` + `const [pendingId, setPendingId] = useState<string | null>(null)`; `handleSelect`: `if (!remember(id)) setStorageBroken(true)` **trước** hai nhánh cũ; nhánh "hồ sơ khác" → `setPendingId(id)` rồi `switchProfile(id)` (reload là điểm đến; spinner chỉ sống tới lúc trang đi).
- `goingAway()` (`:129-136`) giữ nguyên — nó chỉ dập lại mark đã có.
- Thẻ dùng chung cho cả hai hình dạng:
```tsx
const card = (
  <GateCard>
    <div className="flex items-center gap-3">
      <Foxy mood="idle" size="sm" className="[&_svg]:h-[42px] [&_svg]:w-11" />
      <div className="flex min-w-0 flex-col">
        <h1 className="font-display text-[18px] font-extrabold text-ink-900">Ai đang học nào? 👋</h1>
        <p className="text-[13px] font-bold text-ink-500">Chạm vào tên của con nhé.</p>
      </div>
    </div>
    {storageBroken && <Notice kind="info" adult testId="storage-broken" title="Không nhớ được lựa chọn — sẽ hỏi lại lần sau" />}
    <ProfilePicker profiles={profiles} activeId={activeProfileId()} pendingId={pendingId} onSelect={handleSelect} />
  </GateCard>
)
```
- ② toàn màn hình (`!chosen`): `<PageShell className="relative"><GateBlobs /><PageBody center>{card}</PageBody></PageShell>` — **không `PageHeader`, không Back** (quyết định 17: cổng chọn hồ sơ không có đường ra).
- ④ overlay: bọc `children` bằng `<div data-testid="app-behind" className={reasking ? 'h-full blur-[2px] opacity-60' : 'h-full'}>{children}</div>`, và
```tsx
<div data-testid="profile-reask" className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(74,59,51,.45)] p-4">
  <div className="shadow-dialog">{card}</div>
</div>
```
  **z-40, không z-50** (`:190` hôm nay). Thang z sau vòng này — ghi vào docblock đầu file: overlay **40** < `Toast.tsx:9` **50** < `Dialog.tsx:83` **60**.

`shoot.mjs` — hai kịch bản mới ngay sau `profile-gate` (dòng 390):
```js
  // Vòng 4 §2 A1 — trường hợp xấu nhất: 8 hồ sơ, 5 tên "Bé" trùng, 1 tên 29 ký tự, 3 kiểu dòng phân
  // biệt (ngày · ngày+giờ · mã). 4 hàng × 88 + 3 × gap 8 = 376 ≤ 380 ⇒ hồ sơ thứ 9 mới cuộn.
  if (!WANT || WANT.includes('profile-gate-8')) {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const D = 24 * 3600e3, now = Date.now()
      const mk = (name, created) => ({ id: crypto.randomUUID(), name, avatar: '🦊', created })
      localStorage.setItem('speakup.profiles', JSON.stringify([
        { id, name: 'Bé', avatar: '🦊', created: now - 10 * D },
        mk('Nguyễn Hoàng Bảo Ngọc Anh Thư', now - 3 * D),
        mk('Bé', now - 2 * D), mk('Bé', now - 2 * D + 3600e3), mk('Bé', now - 1 * D),
        mk('Bé', 0), mk('Sóc', now - 5 * D), mk('Cáo', now - 4 * D),
      ]))
      sessionStorage.removeItem('speakup.profileChosen')
    })
    await S('profile-gate-8', '/')
  }
  // ④ quay lại sau ≥5 phút: mark cũ 6 phút + một `visibilitychange` để `resume()` chạy trên app thật.
  if (!WANT || WANT.includes('profile-gate-reask')) {
    await go(page, '/')
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      sessionStorage.setItem('speakup.profileChosen', JSON.stringify({ id, at: Date.now() - 6 * 60e3 }))
    })
    await go(page, '/')
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await sleep(400)
    await S('profile-gate-reask', null)
  }
```

- [ ] **Step 4: Run** test/lint/typecheck → PASS, **0 act() warning** (`visibilitychange` phải nằm trong `act`).
- [ ] **Step 5: Ảnh** `SHOTS=profile-gate,profile-gate-8,profile-gate-reask SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame) + `VIEWPORTS=short SHOTS=profile-gate-8 node shoot.mjs`. Bắt buộc: `profile-gate-reask` phải thấy **app mờ phía sau** (không phải nền cream đặc); `profile-gate-8` không được có `-full` ở phone (376 ≤ 380 — vùng cuộn của picker tự lo), báo lại `scrollHeight` ở 375×667.
- [ ] **Step 6: Commit** — `feat(profile-gate): full-screen vs z-40 overlay, storage-broken line, 1/3/8 profile densities`

---

### Task 8: A2 CloudStart phần 1 — `GateCard` + `FieldRow` 44 + 14 câu lỗi + gộp 4 lỗi hệ thống

**Files:**
- Modify: `client/src/screens/CloudStart.tsx`
- Test: `client/src/screens/CloudStart.test.tsx`

**Interfaces:**
- Consumes: `GateCard` + `GateBlobs`, `FieldRow` + `FIELD_INPUT`/`FIELD_INPUT_ERROR`/`FIELD_INPUT_CODE`, `ParentQuestion` (`title`, `sub`), `BackButton mdLabel`, `LinkText`, `Button size='adult'`.
- Produces:
  - `describeAuthError(code)` và `describeRecoverError(status)` **giữ nguyên chữ ký và giữ nguyên khoá** (`invalid-email`, `cloud-unconfigured`, `anonymous-session-in-use`, `email-not-linked`, `invalid-token`, network, chung / 400, 401, 403, 404, 409, 429, chung) — **chỉ đổi câu** (rủi ro 7: test bám mã, không bám chuỗi).
  - **Thay đổi logic được phép (2):** hằng `SYSTEM_ERROR = 'Không kết nối được máy chủ — thử lại sau'` thay **4** câu ở `:202`, `:258`, `:334`, `:354`; câu roster ở `:216` **và** `:340` giữ riêng (hai câu, cùng nghĩa "roster không đọc được" — gộp 4, **không** gộp 5/6).
  - `error` mang thêm hành động: state `errorAction: (() => void) | null` để `FieldRow action={{ label: 'Thử lại', onClick }}` gọi lại đúng lần gửi vừa hỏng, **mã không bị tiêu**.

- [ ] **Step 1: Failing tests** — bám **mã**, không bám chuỗi, ở mọi chỗ có thể.

```tsx
it('every auth code maps to the round-4 sentence', () => {
  expect(describeAuthError('invalid-email')).toBe('Email chưa đúng định dạng.')
  expect(describeAuthError('cloud-unconfigured')).toBe('Tính năng tài khoản chưa bật trên bản này.')
  expect(describeAuthError('anonymous-session-in-use')).toBe('Máy này đang có hồ sơ của tài khoản khác — đăng xuất ở Góc phụ huynh trước.')
  expect(describeAuthError('email-not-linked')).toBe('Email này chưa liên kết với Speak Up — thử mã khôi phục.')
  expect(describeAuthError('invalid-token')).toBe('Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.')
  expect(describeAuthError('network error')).toBe('Mất kết nối — kiểm tra mạng rồi thử lại.')
  expect(describeAuthError('whatever')).toBe('Có lỗi xảy ra — thử lại sau ít phút.')
})
it('every recover status maps to the round-4 sentence', () => {
  expect(describeRecoverError(400)).toBe('Mã phải đủ 8 chữ và số.')
  expect(describeRecoverError(401)).toBe('Mã không đúng — kiểm tra lại chữ O và số 0.')
  expect(describeRecoverError(403)).toBe('Mã này thuộc tài khoản khác đang dùng máy này.')
  expect(describeRecoverError(404)).toBe('Không tìm thấy mã — có thể đã được thay mã mới.')
  expect(describeRecoverError(409)).toBe('Mã đã dùng trên máy khác — tạo mã mới ở máy đó.')
  expect(describeRecoverError(429)).toBe('Thử quá nhiều lần — đợi 5 phút rồi thử lại.')
  expect(describeRecoverError(500)).toBe('Không kết nối được máy chủ — thử lại sau.')
})
it('the four system failures share one sentence and a retry that does not burn the code', async () => {
  currentAccessToken.mockResolvedValue(null)          // :334
  await openCodeDoor(); await typeCode('QZQJ7MFC'); await submit()
  expect(screen.getByTestId('field-error')).toHaveTextContent('Không kết nối được máy chủ — thử lại sau')
  expect(screen.getByDisplayValue('QZQJ7MFC')).toBeInTheDocument()   // mã còn nguyên
  currentAccessToken.mockResolvedValue('tok'); fetchMock.mockResolvedValue(okRecover)
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
})
it('the unreadable-roster failures keep their own two sentences — the consequence is different', async () => {
  rosterIsReadable.mockReturnValue(false)
  await openCodeDoor(); await typeCode('QZQJ7MFC'); await submit()
  expect(screen.getByTestId('field-error')).toHaveTextContent('Mã của bạn vẫn còn nguyên')
  expect(screen.getByTestId('field-error')).not.toHaveTextContent('Không kết nối được máy chủ')
})
it('every stage is a 420px GateCard with a 44px field, a label above it and an 18px gutter', async () => {
  await openEmailDoor()
  expect(screen.getByTestId('gate-card')).toHaveClass('w-[min(420px,calc(100%-32px))]', 'p-5')
  const input = screen.getByLabelText('Email của bố mẹ')
  expect(input).toHaveClass('h-11', 'rounded-r12', 'border-2', 'border-sand-edge')
  expect(input.className).not.toMatch(/min-h-\[64px\]|text-base/)
  expect(screen.getByTestId('field-error')).toHaveClass('min-h-[18px]')
  expect(screen.getByText(/Không gửi quảng cáo/)).toHaveClass('text-[11px]')
})
it('the OTP and the recovery code are the 22px tracked boxes', async () => {
  await reachOtp()
  expect(screen.getByLabelText('Mã 6 số')).toHaveClass('text-center', 'font-display', 'text-[22px]', 'tracking-[6px]')
  cleanup(); await openCodeDoor()
  expect(screen.getByLabelText('Mã khôi phục (8 ký tự)')).toHaveClass('text-[22px]', 'tracking-[6px]', 'uppercase')
})
it('the header carries the adult Back with the landscape label, and the gate stage its own sub', async () => {
  renderStart()
  expect(within(screen.getByRole('link', { name: 'Về nhà' })).getByText('Về bản đồ 🏝️')).toHaveClass('ipad:inline')
  fireEvent.click(screen.getByRole('button', { name: 'Tôi có email đã liên kết' }))
  expect(screen.getByText('Câu hỏi dành cho bố mẹ trước khi khôi phục.')).toBeInTheDocument()
})
it('no field or button in this screen is a 64px child control any more', async () => {
  for (const open of [openEmailDoor, openCodeDoor, reachOtp]) {
    cleanup(); await open()
    for (const el of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('textbox')]) {
      expect(el.className).not.toMatch(/min-h-\[64px\]|md:min-h-\[64px\]|md:h-16/)
    }
  }
})
```

- [ ] **Step 2: Run** `vitest run src/screens/CloudStart` → FAIL.

- [ ] **Step 3: Implement** — R1/R2/R9/R10 / quyết định 17, 21 (phần khung), 22, 35.

- Khung màn (thay `:378-382`): `<PageShell className="relative"><GateBlobs /><PageHeader right={null} back={<BackButton to="/" label="Về nhà" mdLabel="Về bản đồ 🏝️" variant="adult" />} /><PageBody center><GateCard> …stage… </GateCard></PageBody></PageShell>`. Bỏ `Card`, `max-w-md`, `text-center`, `gap-5 p-6`.
- Đầu thẻ: `<h1 className="font-display text-[18px] font-extrabold text-ink-900">Đã dùng Speak Up rồi?</h1>` + phụ 13px, riêng stage `gate` đổi phụ thành "Câu hỏi dành cho bố mẹ trước khi khôi phục." (`ParentQuestion sub=` — quyết định 13 đã mở prop).
- 14 câu: chép **nguyên văn** hai bảng brief §2 vào `describeAuthError` (`:51-71`) và `describeRecoverError` (`:73-81`), **giữ đủ 7 nhánh mỗi hàm và giữ nguyên thứ tự nhận dạng** (`invalid-token` vẫn phải đứng trước regex `invalid|expired|not found`).
- Gộp lỗi hệ thống:
```tsx
/** R10 / quyết định 22. Bốn nguồn khác nhau, một hậu quả: chưa nói chuyện được với máy chủ và
 * KHÔNG có gì bị tiêu — `:202` (fetchRemoteProfiles null), `:258` (pull hỏng), `:334` (chưa có
 * token), `:354` (fetch ném). Một câu + một nút "Thử lại" trong dải lỗi là đủ; bốn câu khác nhau
 * cho cùng một hành động chỉ làm phụ huynh đoán xem cái nào là lỗi của họ.
 * KHÔNG gộp `:216` và `:340`: "roster không đọc được" là hậu quả khác hẳn — mã KHÔNG được dùng, và
 * câu phải nói ra điều đó. Gộp 4, không gộp 6. */
const SYSTEM_ERROR = 'Không kết nối được máy chủ — thử lại sau'
```
  Kèm `setErrorAction(() => retryFn)` tại mỗi chỗ đặt `SYSTEM_ERROR` (`afterAuthenticated`, `finishRestore`, `handleRecover`); `backToMenu`/`openDoor`/`handleAnswer` xoá cả `error` lẫn `errorAction`.
- Mọi ô nhập qua `FieldRow` (thay `:422-444`, `:510-527`, `:529-546`):
  - email: `label="Email của bố mẹ"`, `help="Chỉ dùng để gửi mã xác nhận và giữ tiến độ. Không gửi quảng cáo."`, input `FIELD_INPUT` (**44**, bỏ `min-h-[64px] text-base`).
  - OTP: `label="Mã 6 số"`, `help="Mã hết hạn sau 10 phút."`, input `${FIELD_INPUT} ${FIELD_INPUT_CODE}`; hai link dưới: "Sửa lại email" và "Gửi lại mã" (đếm ngược là việc **không làm** vòng này — brief vẽ "(0:42)" nhưng không có bộ đếm nào trong code; ghi Ruling ở Task 16).
  - mã khôi phục: `label="Mã khôi phục (8 ký tự)"`, `help="Mã do máy trước tạo ra trong Góc phụ huynh (chụp màn hình)."`, input `${FIELD_INPUT} ${FIELD_INPUT_CODE} uppercase`.
- `Notice` chỉ còn dùng cho thông báo **cấp màn** — hai dòng `:388-389` bị gỡ ở Task 9 cùng với `retryId`.

- [ ] **Step 4: Run** test/lint/typecheck → PASS. Sửa mọi assert chuỗi cũ trong `CloudStart.test.tsx` sang **mã** ở nơi có thể.
- [ ] **Step 5: Ảnh** `SHOTS=start-menu,start-gate,start-gate-wrong,start-email,start-code SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame). Bắt buộc: thẻ 420 căn giữa cả 3 frame; ô nhập cao 44; dải lỗi **không đẩy** nút xuống khi hiện (so `start-gate` với `start-gate-wrong`).
- [ ] **Step 6: Commit** — `feat(cloud-start): GateCard + FieldRow 44, the fourteen round-4 error sentences, one system error with a retry`

---

### Task 9: A2 CloudStart phần 2 — stage `'result'`, abandon 4 dòng, picker ô 72

**Files:**
- Modify: `client/src/screens/CloudStart.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/CloudStart.test.tsx`

**Interfaces:**
- Consumes: `ProfilePicker density='compact'` (Task 5), `Notice kind='warn' adult`, `Button size='adult'` (`primary`/`ghost`), `LinkText`.
- Produces: **thay đổi logic được phép (1)** — `type Stage = 'menu' | 'gate' | 'email' | 'email-otp' | 'code' | 'abandon' | 'result'` (`:37`); `info`/`retryId` **chỉ** được đọc trong thân stage `'result'` (bỏ hai dòng `:388-389` và khối `:392-396` khỏi đầu thẻ). `afterAuthenticated` đặt `setStage('result')` thay `setStage('menu')` ở hai nhánh `:228-231` (0 hồ sơ) và `finishRestore` `:256-259` (pull hỏng).

- [ ] **Step 1: Failing tests**

```tsx
it('an account with no restorable profile lands on its own result stage, not back at the menu', async () => {
  fetchRemoteProfiles.mockResolvedValue([]); await passOtp()
  expect(screen.getByRole('status')).toHaveTextContent('Tài khoản này chưa có hồ sơ nào để khôi phục')
  expect(screen.getByRole('button', { name: 'Thử tải lại' })).toHaveClass('min-h-[44px]')
  expect(screen.getByRole('button', { name: 'Bắt đầu mới cho bé' })).toHaveClass('bg-coral-500')
  expect(screen.getByRole('button', { name: '← Về menu' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tôi có email đã liên kết' })).toBeNull()
})
it('a failed pull shows its retry inside the result stage, never floating on top of every card', async () => {
  pullProfile.mockResolvedValue(false); await pickOneProfile()
  const card = screen.getByTestId('gate-card')
  expect(within(card).getByRole('button', { name: 'Thử tải lại' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '← Về menu' }))
  expect(screen.getByRole('button', { name: 'Tôi có mã khôi phục' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull()   // không còn nổi trên menu
})
it('abandon prints one of the four sun-tinted copy lines and never the email in the button', async () => {
  await reachAbandon({ profiles: 2, stars: 128, events: 340, mirrored: false })
  expect(screen.getByTestId('abandon-copy')).toHaveClass('rounded-r10', 'bg-sun-50', 'text-[12px]')
  expect(screen.getByTestId('abandon-copy')).toHaveTextContent('2 hồ sơ, 128 sao và 340 lượt luyện trên máy này sẽ bị thay.')
  const go = screen.getByRole('button', { name: 'Vẫn tiếp tục với email này' })
  expect(go).not.toHaveTextContent(EMAIL61)
  expect(screen.getByText(EMAIL61)).toBeInTheDocument()               // email hiện ở dòng copy
  expect(screen.getByRole('button', { name: 'Huỷ' })).toHaveClass('border-dashed')
  expect(screen.getByRole('link', { name: 'Sao lưu trước ở Góc phụ huynh' })).toHaveAttribute('href', '/parent')
})
it('the other three abandon branches keep their own sentence', async () => {
  await reachAbandon({ profiles: 2, stars: 128, events: 340, mirrored: true })
  expect(screen.getByTestId('abandon-copy')).toHaveTextContent('một phần đã lưu lên máy chủ, có thể lấy lại sau')
  cleanup(); await reachAbandon({ profiles: 1, stars: 0, events: 0, mirrored: false })
  expect(screen.getByTestId('abandon-copy')).toHaveTextContent('chưa học gì — thay được ngay')
  cleanup(); await reachAbandon('unchecked')
  expect(screen.getByTestId('abandon-copy')).toHaveTextContent('Không đọc được dữ liệu trên máy này. Vẫn tiếp tục?')
})
it('the profile picker stage uses the 72px compact cells and the busy spinner', async () => {
  await reachPicker(3)
  expect(screen.getByText('Tài khoản này có 3 hồ sơ. Chạm để tải về máy.')).toBeInTheDocument()
  expect(screen.getAllByRole('button')[0]).toHaveClass('h-[72px]')
  fireEvent.click(screen.getAllByRole('button')[1])
  expect(screen.getByTestId('cell-spinner')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run** `vitest run src/screens/CloudStart` → FAIL.

- [ ] **Step 3: Implement** — R8/R11 / quyết định 21, 23.

- `Stage` thêm `'result'`; state mới `resultKind: 'empty' | 'pullFailed'` (suy được từ `info`/`retryId`, nhưng viết thẳng đọc dễ hơn). Thân stage:
```tsx
{stage === 'result' && (
  <div className="flex flex-col gap-3">
    <Notice kind="warn" adult title={info ?? 'Tài khoản này chưa có hồ sơ nào để khôi phục. Bắt đầu mới cho bé hoặc thử email khác.'} />
    {retryId
      ? <Button size="adult" variant="outline" disabled={busy} onClick={() => { void finishRestore(retryId) }}>Thử tải lại</Button>
      : <Button size="adult" variant="outline" disabled={busy} onClick={() => { void afterAuthenticated() }}>Thử tải lại</Button>}
    <Button size="adult" to="/">Bắt đầu mới cho bé</Button>
    <LinkText onClick={backToMenu}>← Về menu</LinkText>
  </div>
)}
```
  `backToMenu` (`:180-186`) thêm `setInfo(null); setRetryId(null)`.
- **Xoá** `:388-389` (hai `Notice` trên đầu mọi thẻ) và `:392-396` (nút "Thử tải lại" nổi). Lỗi **cấp trường** đã về `FieldRow` ở Task 8; lỗi **cấp màn** chỉ còn ở stage `'result'`.
- Abandon (`:449-508`) — giữ nguyên bốn nhánh đã có, đổi khung trình bày:
```tsx
// R11 / quyết định 23. Bốn câu, một khung: 12px trên nền sun r10 padding 8/10. Nhãn nút CỐ ĐỊNH —
// email 61 ký tự trong nhãn `whitespace-nowrap` (`:504` hôm nay) đẩy nút rộng gấp ba màn hình.
<p data-testid="abandon-copy" className="rounded-r10 bg-sun-50 px-2.5 py-2 text-[12px] font-bold leading-[1.45] text-sun-700">{copy}</p>
```
  `copy` = bốn chuỗi brief §2 A2 ⑥ (có số · có số + đã lưu · 0 sao/0 lượt · chưa kiểm tra được), trong đó email in ở dòng copy chứ không ở nhãn nút. Hàng nút: primary "Vẫn tiếp tục với email này" + ghost "Huỷ" (`variant="ghost"` = viền đứt sand, `Button.tsx:17`) + `<LinkText to="/parent">Sao lưu trước ở Góc phụ huynh</LinkText>`.
- Picker (`:361-376`): `<GateCard>` thay `Card max-w-md`, tiêu đề "Chọn hồ sơ của bé" 18px, phụ "Tài khoản này có {n} hồ sơ. Chạm để tải về máy.", `<ProfilePicker density="compact" pendingId={busy ? pickingId : null} … />` (thêm state `pickingId` đặt trong `finishRestore`), link "← Chọn cách khác".

`shoot.mjs` — bốn kịch bản mới, ngay sau `start-code` (dòng 159). Cả bốn **chặn mạng thật** để không gửi email:
```js
  // Vòng 4 §2 A2. Không có Supabase thật trong ảnh: chặn `**/auth/v1/otp*` (200 rỗng) để form đi
  // tiếp tới ô OTP mà không ai nhận được email, và trả lỗi cho lần xác nhận để bắt trạng thái ④.
  const gateAnswer = async () => {
    const q = await page.locator('text=/\\d+ × \\d+/').first().textContent()
    const [a, b] = q.match(/\d+/g).map(Number)
    await page.fill('input', String(a * b)); await page.keyboard.press('Enter')
  }
  const EMAIL61 = 'nguyenhoangbaongocanhthu.phuhuynh.speakup2026@examplemail.com'
  if (!WANT || ['start-otp-error', 'start-abandon', 'start-result-empty'].some(n => WANT.includes(n))) {
    await page.route('**/auth/v1/otp*', r => r.fulfill({ status: 200, body: '{}' }))
    await page.route('**/auth/v1/verify*', r => r.fulfill({ status: 400, body: JSON.stringify({ error_code: 'invalid-token' }) }))
  }
  await S('start-otp-error', '/start', async () => {
    await tapText(page, 'Tôi có email đã liên kết', { exact: false }); await gateAnswer()
    await page.fill('input[type=email]', EMAIL61); await page.keyboard.press('Enter'); await sleep(600)
    await page.fill('input', '4821'); await page.keyboard.press('Enter'); await sleep(600)
  })
  // ⑥ abandon: `signInWithEmail` phải trả `anonymous-session-in-use`, và máy phải CÓ dữ liệu — seed
  // đã lo phần dữ liệu, route lo phần câu trả lời.
  await S('start-abandon', '/start', async () => {
    await page.route('**/auth/v1/otp*', r => r.fulfill({ status: 422, body: JSON.stringify({ error_code: 'anonymous-session-in-use' }) }))
    await tapText(page, 'Tôi có email đã liên kết', { exact: false }); await gateAnswer()
    await page.fill('input[type=email]', EMAIL61); await page.keyboard.press('Enter'); await sleep(900)
  })
  // ⑧ kết quả · 0 hồ sơ: OTP qua được, roster của tài khoản rỗng.
  await S('start-result-empty', '/start', async () => {
    await page.route('**/auth/v1/verify*', r => r.fulfill({ status: 200, body: JSON.stringify(FAKE_SESSION) }))
    await page.route('**/rest/v1/profiles*', r => r.fulfill({ status: 200, body: '[]' }))
    await tapText(page, 'Tôi có email đã liên kết', { exact: false }); await gateAnswer()
    await page.fill('input[type=email]', EMAIL61); await page.keyboard.press('Enter'); await sleep(600)
    await page.fill('input', '482100'); await page.keyboard.press('Enter'); await sleep(900)
  })
  await page.unrouteAll?.()
```
  (`FAKE_SESSION` = một object session tối thiểu; nếu `supabase-js` từ chối nó thì **ghi lại** và bỏ `start-result-empty` như `home-3-banners` của Phase 14 đã làm — một ảnh không chụp được phải được **nêu tên**, không được lặng lẽ biến mất.)

- [ ] **Step 4: Run** test/lint/typecheck → PASS, 0 act() warning.
- [ ] **Step 5: Ảnh** `SHOTS=start-menu,start-gate,start-email,start-otp-error,start-code,start-abandon,start-result-empty SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame) + `VIEWPORTS=short SHOTS=start-abandon node shoot.mjs`. Bắt buộc: **email 61 ký tự không được nằm trong nhãn nút** ở `start-abandon`; không thẻ nào tràn ở 375×667.
- [ ] **Step 6: Commit** — `feat(cloud-start): the 'result' stage, abandon in four sun lines with a fixed button label, 72px picker`

---

### Task 10: P2 Dashboard — vỏ màn: header một hàng, `PanelGrid` 1/2/3 với đủ 10 panel, hàng "Đặt lại" cuối

**Files:**
- Modify: `client/src/screens/ParentDashboard.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/ParentDashboard.test.tsx`

**Interfaces:**
- Consumes: `PageHeader title/sub` (Phase 14, `PageHeader.tsx:15` — **không thêm prop mới**), `PanelGrid`, `Panel` (`title`, `right`, `collapsible`, `col='full'`), `Button size='adult' variant='danger'`.
- Produces: không API mới. Task này **chỉ chuyển chỗ**: mọi `Card px-4 py-3.5 md:p-6` (`:542`, `:702`, `:714`, `:778`, `:848`, `:876`, `:919`, `:953`) và `<div>` + H2 ngoài Card (`:832-834`) thành `Panel` **bên trong một `PanelGrid` duy nhất**; nội dung từng panel giữ nguyên tới Task 11–14.

- [ ] **Step 1: Failing tests**

```tsx
it('the header is one left-aligned row: H1 20/24, the summary line as its sub, a 44px lock button', () => {
  renderDashboard()
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-[22px]', 'md:text-[28px]')  // PageHeader chuẩn
  expect(screen.getByText(/Tuần này: \d+ phút · điểm TB/)).toHaveClass('truncate', 'text-[13px]', 'md:text-[15px]')
  const lock = screen.getByRole('button', { name: 'Khoá lại' })
  expect(lock).toHaveClass('h-11', 'rounded-r12', 'bg-sand', 'text-sand-text')
  expect(lock.className).not.toMatch(/border-teal-line|bg-white/)          // không còn `variant="outline"`
  expect(within(lock).getByText('🔐 Khoá lại')).toHaveClass('hidden', 'md:inline')
})
it('an empty week says so instead of printing zeros', () => {
  renderDashboard({ events: [] })
  expect(screen.getByText('Chưa có buổi luyện nào tuần này')).toBeInTheDocument()
})
it('all ten panels live inside one grid, in phone order, and the grid is 1/2/3', () => {
  renderDashboard()
  const grid = screen.getByTestId('panel-grid')
  expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'ipad:grid-cols-3')
  const titles = within(grid).getAllByRole('heading', { level: 2 }).map(h => h.textContent)
  expect(titles).toEqual([
    'Tài khoản', 'Phút luyện mỗi ngày', 'Điểm trung bình', 'Âm hay sai',
    '⏰ Giới hạn mỗi ngày', 'Bài học', 'Bản ghi gần đây', 'Tiến độ từ xa',
  ])
  expect(screen.queryByTestId('account-card')).toBe(within(grid).getByTestId('account-card'))
})
it('the account panel and the remote panel are full-width; remote is the last panel', () => {
  renderDashboard()
  expect(screen.getByTestId('account-card')).toHaveClass('md:col-span-2', 'ipad:col-span-3')
  const panels = screen.getAllByTestId('panel')
  expect(panels[panels.length - 1]).toHaveTextContent('Tiến độ từ xa')
  expect(panels[panels.length - 1]).toHaveClass('md:col-span-2', 'ipad:col-span-3')
})
it('the reset row is the last thing on the screen: a description left, a danger button right', () => {
  renderDashboard()
  const row = screen.getByTestId('reset-row')
  expect(row).toHaveClass('mt-6', 'flex', 'items-center', 'justify-between', 'gap-3')
  expect(within(row).getByText(/Xoá sao, chuỗi ngày và bản ghi trên máy này/)).toHaveClass('text-[12px]', 'text-ink-300')
  const btn = within(row).getByRole('button', { name: '↺ Đặt lại tiến trình…' })
  expect(btn).toHaveClass('bg-white', 'text-fix-700', 'border-fix-300', 'min-h-[44px]')
  expect(row.compareDocumentPosition(screen.getByTestId('panel-grid')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
})
it('a build with no cloud renders six panels and no account/profile/remote anywhere', () => {
  renderDashboard({ cloud: false })
  expect(screen.queryByTestId('account-card')).toBeNull()
  expect(screen.queryByText('Tiến độ từ xa')).toBeNull()
  expect(screen.queryByText('Hồ sơ')).toBeNull()
  expect(within(screen.getByTestId('panel-grid')).getAllByTestId('panel')).toHaveLength(6)
  expect(screen.getByTestId('panel-grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'ipad:grid-cols-3')
})
it('no control on the screen is a 56/64 child target any more', () => {
  renderDashboard()
  for (const el of [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]) {
    expect(el.className).not.toMatch(/min-h-\[56px\]|min-h-\[64px\]|md:min-h-\[64px\]|md:h-16/)
  }
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/screens/ParentDashboard` → FAIL (nhiều test cũ đỏ theo thứ tự DOM — rủi ro 4; sửa chúng trong chính task này).

- [ ] **Step 3: Implement** — R12/R25/R30/R14 / quyết định 24, 25, 32, 35.

- Header (thay `:520-539`):
```tsx
<PageHeader
  right={
    // `Button` không có variant nền sand và không đẻ thêm một cái chỉ vì một nút (quyết định 25).
    <button type="button" onClick={() => onLock?.()} aria-label="Khoá lại"
      className="flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-r12 bg-sand px-3 font-display text-[13px] font-extrabold text-sand-text">
      <span aria-hidden="true" className="md:hidden">🔐</span>
      <span className="hidden md:inline">🔐 Khoá lại</span>
    </button>
  }
  back={<BackButton to="/" label="Về nhà" mdLabel="Về bản đồ 🏝️" variant="adult" />}
  title="Góc phụ huynh"
  sub={weekMinutes > 0 ? `Tuần này: ${weekMinutes} phút · điểm TB ${avgScoreLabel}/100` : 'Chưa có buổi luyện nào tuần này'}
/>
```
  Dòng tóm tắt `<p>` ở `:537` **bị xoá** (nó chính là `sub` bây giờ — quyết định 25).
- Thân: `<PageBody><div className="flex flex-col"><PanelGrid> …10 panel… </PanelGrid><ResetRow /></div></PageBody>`. Bỏ `max-w-5xl` (`:536`) — `PageShell` đã `max-w-[1080px]` (`PageShell.tsx:13`), đúng quyết định 35 cho iPad ngang 3 cột.
- **Thứ tự DOM = thứ tự phone** (brief §1.2 hàng "Lưới", rủi ro 4): Tài khoản (`col="full"`, chứa cả cột Hồ sơ ở Task 11) → Phút luyện → Điểm TB → Âm hay sai → ⏰ Giới hạn → Bài học (`collapsible`) → Bản ghi gần đây (`collapsible`) → Tiến độ từ xa (`col="full"`, **áp chót**) → rồi hàng Đặt lại **ngoài lưới, cuối cùng**. Hai panel "remote unknown" (`:701-707`) gộp vào panel Tiến độ từ xa ở Task 14 (giữ `data-testid="remote-progress-unknown"`).
- `cloudAvailable === false` → bỏ Tài khoản/Hồ sơ/Tiến độ từ xa, còn **6 panel**, lưới **không đổi** (quyết định 35).
- Hàng Đặt lại (thay `:1016-1029`):
```tsx
<div data-testid="reset-row" className="mt-6 flex items-center justify-between gap-3">
  <p className="text-[12px] font-bold leading-snug text-ink-300">Xoá sao, chuỗi ngày và bản ghi trên máy này (và trên tài khoản nếu đã liên kết).</p>
  <Button size="adult" variant="danger" disabled={resetBusy} onClick={() => { void handleReset() }} className="shrink-0">↺ Đặt lại tiến trình…</Button>
</div>
{resetNotice && <Notice kind="pending" adult testId="reset-notice" title={resetNotice} action={{ label: 'Thử xoá lại', onClick: … }} />}
```
- Sửa hai đoạn comment của quyết định 1: docblock `:47-56` ("vùng chạm 36–48", "the one control still held to the child floor") và `:877-881` — viết lại theo Ruling người lớn, **trong task này**, vì đây là task đầu tiên đụng file.

`shoot.mjs` — `parent-dashboard-empty` (0 event ⇒ biểu đồ + âm sai + bản ghi cùng rỗng) đặt sau `parent-dashboard`:
```js
  if (!WANT || WANT.includes('parent-dashboard-empty')) {
    await go(page, '/')
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      localStorage.setItem(pre + 'activity', '[]')
      localStorage.removeItem(pre + 'stars')
    })
    await S('parent-dashboard-empty', '/parent', openDashboard)
    await seed(page)   // trả lại đứa trẻ 5 ngày cho mọi ảnh sau
  }
```
  và tách helper dùng lại (thay ba khối lặp `:367-371`, `:391-397`):
```js
  const openDashboard = async () => {
    const q = await page.locator('text=/\\d+ × \\d+/').first().textContent()
    const [a, b] = q.match(/\d+/g).map(Number)
    await page.fill('input', String(a * b)); await page.keyboard.press('Enter'); await sleep(1500)
  }
```

- [ ] **Step 4: Run** test/lint/typecheck → PASS. Mọi test cũ query theo thứ tự xuất hiện phải được sửa sang query theo tên panel/`data-testid`, **không** nới lỏng assert.
- [ ] **Step 5: Ảnh** `SHOTS=parent-dashboard,parent-dashboard-profiles,parent-dashboard-empty SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame) + `VIEWPORTS=short SHOTS=parent-dashboard node shoot.mjs`. **Báo lại ba con số `scrollHeight`** và so với mốc: phone ≈1100 (từ 1821), `ipad` ≤834 (từ 1643), `ipadp` ≤1194 (mới). Nếu chưa đạt sau task này thì nói rõ còn thiếu bao nhiêu — Task 12–14 rút tiếp.
- [ ] **Step 6: Commit** — `feat(dashboard): one-row header, PanelGrid 1/2/3 with all ten panels, danger reset row`

---

### Task 11: Dashboard panel A — Tài khoản (`AccountCard`) + cột Hồ sơ

**Files:**
- Modify: `client/src/screens/ParentDashboard.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/ParentDashboard.test.tsx`

**Interfaces:**
- Consumes: `AccountCard` (Task 4 — `state`, `sync`, `hasSession`, `recoveryCode`, 8 handler), `SyncPill` (`hasSession`), `ProfilePicker` (`density='grid'`, `footer={false}`), `Panel col='full'`, `Button size='adult'`.
- Produces: không API mới. `noSessionNotice()` (`:108-120`) **bị xoá** (câu của nó chuyển vào `AccountCard` ②/③); `online()` (`:106`) giữ và được truyền xuống. Trạng thái thẻ suy ra tại chỗ:
```tsx
const accountState: AccountState =
  !authReady ? { kind: 'loading' }
  : !hasSession ? { kind: 'noSession', online: online() }
  : sync.lastError ? { kind: 'syncError', email, pending: sync.pending }
  : linked ? { kind: 'linked', email: email!, signingOut: signOutBusy, pending: sync.pending }
  : linkStage === 'otp' ? { kind: 'otp', email: linkEmailValue, otp: linkOtp, busy: linkBusy, error: linkError ?? undefined }
  : { kind: 'link', email: linkEmailValue, busy: linkBusy, error: linkError ?? undefined }
```

- [ ] **Step 1: Failing tests**

```tsx
it('the account panel is the AccountCard with the 32px pill in its title row', async () => {
  renderDashboard(); await settle()
  const panel = screen.getByTestId('account-card')
  expect(within(panel).getByTestId('account-card-body')).toBeInTheDocument()
  expect(within(panel).getByTestId('sync-status')).toHaveClass('h-8')
})
it('no session drives both the card and the pill from the same fact', async () => {
  currentUserId.mockResolvedValue(null); renderDashboard(); await settle()
  expect(screen.getByTestId('no-session')).toBeInTheDocument()
  expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Chưa kết nối')
})
it('a 61-character email never widens the panel: one ellipsised line, full value in the title', async () => {
  currentEmail.mockResolvedValue(EMAIL61); renderDashboard(); await settle()
  const box = screen.getByTestId('linked-email')
  expect(box).toHaveClass('truncate', 'min-w-0')
  expect(box).toHaveAttribute('title', EMAIL61)
  expect(box.parentElement).toHaveClass('flex', 'min-w-0')
})
it('a sync error becomes state ⑩, not a silent pill', async () => {
  syncStatus.mockReturnValue({ ...SYNCED, pending: 3, lastError: 'boom' }); renderDashboard(); await settle()
  expect(screen.getByText('3 mục chưa lên máy chủ. Sẽ thử lại khi có mạng.')).toBeInTheDocument()
})
it('the profile column is the right half on iPad portrait, with a 2px divider', async () => {
  renderDashboard({ profiles: 8 }); await settle()
  expect(screen.getByTestId('account-columns')).toHaveClass('md:grid', 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', 'md:gap-4')
  expect(screen.getByTestId('profile-column')).toHaveClass('md:border-l-2', 'md:border-line-200', 'md:pl-4')
})
it('a profile row is 40px: name on one ellipsised line, an 11px sub and two 32px buttons', async () => {
  renderDashboard({ profiles: 8 }); await settle()
  const rows = screen.getAllByTestId('profile-row')
  expect(rows).toHaveLength(8)
  expect(rows[0]).toHaveClass('min-h-[40px]', 'border-b', 'border-line-200')
  expect(within(rows[0]).getByText(/Bé/)).toHaveClass('truncate', 'text-[13px]')
  expect(screen.getByRole('button', { name: '+ Thêm hồ sơ' })).toHaveClass('h-8', 'rounded-r10', 'bg-teal-50', 'text-teal-600', 'text-[12px]')
  expect(screen.getByRole('button', { name: 'Đổi tên' })).toHaveClass('h-8', 'underline', 'text-[12px]')
})
it('an unreadable roster still warns instead of pairing a blank name with "+ Thêm hồ sơ"', async () => {
  listProfiles.mockReturnValue([]); renderDashboard(); await settle()
  expect(screen.getByTestId('profile-unreadable')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run** `vitest run src/screens/ParentDashboard` → FAIL.

- [ ] **Step 3: Implement** — R15/R17/R6 / quyết định 10, 26.

- Panel: `<Panel col="full" testId="account-card" title="Tài khoản" right={<SyncPill status={sync} hasSession={hasSession} size="md" onRetry={() => void flush()} />}>` — giữ `data-testid="account-card"` (test cũ `:567` kiểm nó **vắng mặt** khi không có cloud).
- Hai cột trong (brief §1.2, chỉ iPad):
```tsx
<div data-testid="account-columns" className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
  <AccountCard state={accountState} sync={sync} hasSession={hasSession} recoveryCode={recoveryCode} … />
  <div data-testid="profile-column" className="flex min-w-0 flex-col gap-1.5 md:border-l-2 md:border-line-200 md:pl-4">…</div>
</div>
```
- Cột Hồ sơ (thay `:639-695`): tiêu đề `Hồ sơ · {n}` 14px + nút `+ Thêm hồ sơ` `h-8 rounded-r10 bg-teal-50 px-2.5 text-[12px] font-extrabold text-teal-600` (36 < 44 ⇒ **hit band** `relative after:absolute after:-inset-2 after:content-['']`); mỗi hồ sơ một hàng
```tsx
<div data-testid="profile-row" className="flex min-h-[40px] items-center gap-2 border-b border-line-200">
  <span aria-hidden className="text-[20px] leading-none">{p.avatar}</span>
  <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink-900" title={p.name}>{p.name}{p.id === activeId && ' · đang dùng máy này'}</span>
  <button … className="h-8 shrink-0 px-2 text-[12px] font-extrabold text-ink-500 underline relative after:absolute after:-inset-2 after:content-['']">Đổi tên</button>
</div>
```
  — 8 hồ sơ = 320px, vừa cột phải. `ProfilePicker` chỉ còn dùng cho **chuyển hồ sơ** khi `profiles.length > 1` (`:673-677`), truyền `density="grid" footer={false}`; giữ `remote-view-toggle` nguyên chỗ. `profileNotice`/`profile-unreadable` giữ nguyên.
- Xoá `noSessionNotice()` và mọi tham chiếu; `online()` truyền vào `accountState`.

`shoot.mjs` — ba kịch bản, đặt sau `parent-dashboard-empty`; dùng `page.route` để không chạm tài khoản thật:
```js
  // ⑨ đã liên kết, email 61 ký tự: seed một phiên giả + trả lời `/auth/v1/user` bằng chính email đó.
  await S('parent-dashboard-linked', '/parent', async () => {
    await page.route('**/auth/v1/user*', r => r.fulfill({ status: 200, body: JSON.stringify({ id: 'u1', email: EMAIL61, is_anonymous: false }) }))
    await openDashboard()
  })
  // ⑥ OTP trong thẻ: gõ email rồi bấm "Liên kết"; `**/auth/v1/user` (PUT) trả 200 rỗng.
  await S('parent-dashboard-otp', '/parent', async () => {
    await page.route('**/auth/v1/user*', r => r.request().method() === 'PUT' ? r.fulfill({ status: 200, body: '{}' }) : r.continue())
    await openDashboard()
    await page.fill('input[type=email]', EMAIL61)
    await tapText(page, 'Liên kết'); await sleep(700)
  })
  // ⑩ sync lỗi: chặn mọi ghi REST rồi tạo một lần ghi (đổi giới hạn) để flush hỏng.
  await S('parent-dashboard-sync-error', '/parent', async () => {
    await page.route('**/rest/v1/**', r => r.abort())
    await openDashboard()
    await page.getByRole('button', { name: 'Tăng' }).click(); await sleep(1500)
  })
  await page.unrouteAll?.()
```
  (Nếu một trong ba không ép được trạng thái trong dev, **nêu tên nó** ở README như `home-3-banners` — không lặng lẽ bỏ.)

- [ ] **Step 4: Run** test/lint/typecheck → PASS, 0 act() warning.
- [ ] **Step 5: Ảnh** `SHOTS=parent-dashboard,parent-dashboard-linked,parent-dashboard-otp,parent-dashboard-sync-error,parent-dashboard-profiles SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame). Bắt buộc: ở `ipadp/` thẻ Tài khoản **có 2 cột trong**, ở `phone/` là 1 cột; email 61 ký tự **không** làm panel rộng ra ở frame nào.
- [ ] **Step 6: Commit** — `feat(dashboard): account panel on AccountCard, profile column with 40px rows and truncated 61-char email`

---

### Task 12: Dashboard panel B — biểu đồ phút luyện, 4 ô điểm trung bình, chip âm hay sai

**Files:**
- Modify: `client/src/screens/ParentDashboard.tsx`
- Test: `client/src/screens/ParentDashboard.test.tsx`

**Interfaces:**
- Consumes: `MinutesChart` (Task 3 — `days`, `limitMinutes`, `range`, `onRangeChange`, `todayKey`), `Panel`, `EmptyState variant='dashed'`, `averageScoreByKind(events)` (**chữ ký thật là `(events)` trả `Record<ActivityKind, number|null>`** — brief viết `averageScoreByKind('story')` là cách nói tắt), `weakPhonemes(5, events)`, `PHONEME_TIPS`.
- Produces: không API mới. `KIND_LABEL` (`:58`) thêm `story: 'Truyện'`. State mới `chartRange: 7 | 14` khởi tạo bằng đúng phép thử của `recordingsOpen` (`window.matchMedia?.('(min-width: 768px)').matches ? 14 : 7`) — **đọc một lần lúc mount**, cùng lý do `:161-171` đã viết ra. State `openTip: string | null` cho chip âm sai ở phone.

- [ ] **Step 1: Failing tests**

```tsx
it('the chart panel renders MinutesChart with 7 days on a phone and 14 from md up', () => {
  matchMedia(false); renderDashboard()
  expect(screen.getAllByTestId('minute-bar')).toHaveLength(7)
  cleanup(); matchMedia(true); renderDashboard()
  expect(screen.getAllByTestId('minute-bar')).toHaveLength(14)
  fireEvent.click(screen.getByRole('button', { name: '7' }))
  expect(screen.getAllByTestId('minute-bar')).toHaveLength(7)
})
it('an empty log draws the dashed box, never fourteen 2% bars', () => {
  renderDashboard({ events: [] })
  expect(screen.getByTestId('empty-state')).toHaveClass('border-dashed', 'min-h-[120px]')
  expect(screen.queryByTestId('minute-bar')).toBeNull()
})
it('the averages panel has four tiles and Truyện reads "—" because a story event carries no score', () => {
  renderDashboard()
  const panel = screen.getByTestId('averages-panel')
  expect(within(panel).getByTestId('averages-grid')).toHaveClass('grid-cols-4')
  expect(within(panel).getAllByTestId('average-tile')).toHaveLength(4)
  expect(within(panel).getByText('Truyện').nextSibling).toHaveTextContent('—')
  expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent('Điểm trung bình')  // H2 nay Ở TRONG panel
})
it('a weak-sound chip is one nowrap 36px pill, toned by score', () => {
  renderDashboard()
  const chips = screen.getAllByTestId('weak-chip')
  expect(chips[0]).toHaveClass('h-9', 'rounded-r12', 'whitespace-nowrap', 'text-[13px]', 'bg-fix-50', 'text-fix-700')
  expect(chips[0]).toHaveTextContent(/^\/[^/]+\/ · \d+ \(\d+ lần\)$/)
  expect(chips.find(c => c.className.includes('bg-ok-50'))).toBeTruthy()   // 50–70 → sun
})
it('on a phone the chip is a button that opens its tip; the tip is not hidden away', () => {
  matchMedia(false); renderDashboard()
  expect(screen.queryByTestId('weak-tip')).toBeNull()
  fireEvent.click(screen.getAllByTestId('weak-chip')[0])
  expect(screen.getByTestId('weak-tip')).toHaveClass('rounded-r10', 'bg-[#FFF6E0]', 'text-[12px]', 'text-sun-700')
  fireEvent.click(screen.getAllByTestId('weak-chip')[0])
  expect(screen.queryByTestId('weak-tip')).toBeNull()
})
it('from md up the tip of the first chip is shown without asking', () => {
  matchMedia(true); renderDashboard()
  expect(screen.getByTestId('weak-tip')).toBeInTheDocument()
})
it('five weak sounds and a three-line tip still fit the panel without a horizontal scroll', () => {
  renderDashboard({ weak: FIVE })
  expect(screen.getAllByTestId('weak-chip')).toHaveLength(5)
  expect(screen.getByTestId('weak-list')).toHaveClass('flex-wrap', 'gap-1.5')
})
```

- [ ] **Step 2: Run** `vitest run src/screens/ParentDashboard` → FAIL.

- [ ] **Step 3: Implement** — R19/R20/R21/Q17 / quyết định 27, 28, 34.

- Panel biểu đồ (thay `:778-830`): `<Panel title={`Phút luyện · ${chartRange} ngày`} right={<span className="text-[11px] font-bold text-ink-300">TB {avgPerDay}'/ngày</span>}>` + `<MinutesChart days={days} limitMinutes={limitMinutes} range={chartRange} onRangeChange={setChartRange} todayKey={todayKey} />`. Toàn bộ phần vẽ cột/nhãn/đường (`:797-827`) **xoá khỏi màn** — nó đã nằm trong component.
- Panel điểm TB (thay `:832-844`): `<Panel testId="averages-panel" title="Điểm trung bình">` với `<div data-testid="averages-grid" className="grid grid-cols-4 gap-1.5 md:gap-2">` và bốn ô `data-testid="average-tile"` `flex flex-col items-center rounded-r12 bg-cream-50 px-1 py-2 md:px-2 md:py-2.5`: nhãn `text-[10px] text-ink-300 md:text-[11px]`, số `font-display text-[20px] md:text-[24px]`. `KIND_LABEL` thêm `story: 'Truyện'`, mảng thành `['speak', 'word', 'sentence', 'story']`. **H2 vào trong panel** — hôm nay nó nằm ngoài `Card` (`:832-834`).
  - Ghi ngay tại chỗ, một dòng comment: `// Ô "Truyện" luôn "—": StoryQuiz.tsx:90 ghi event không kèm score (kiểm ở Task 3 Step 0). Artboard vẽ đúng như vậy — không hứa một con số không tồn tại.`
- Panel âm sai (thay `:848-874`): chip
```tsx
const CHIP = (avg: number) => (avg < 50 ? 'bg-fix-50 text-fix-700' : 'bg-ok-50 text-ok-700')
<button data-testid="weak-chip" type="button" onClick={() => setOpenTip(t => (t === w.phoneme ? null : w.phoneme))}
  className={`inline-flex h-9 items-center whitespace-nowrap rounded-r12 px-3 font-display text-[13px] font-extrabold ${CHIP(w.avg)}`}>
  /{w.phoneme}/ · {Math.round(w.avg)} ({w.count} lần)
</button>
```
  36 < 44 ⇒ hit band. Tip: `<p data-testid="weak-tip" className="rounded-r10 bg-[#FFF6E0] px-2.5 py-2 text-[12px] font-bold leading-[1.45] text-sun-700">` — hiện khi `openTip === w.phoneme` **hoặc** `i === 0 && isWide` (thay `hidden … md:block` của `:868`, tức phone **có** đường xem tip: quyết định 28).
- Panel rỗng: âm sai và bản ghi giữ `EmptyState adult` thường (chỉ biểu đồ dùng `dashed` — brief chỉ vẽ hộp đứt cho biểu đồ).

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=parent-dashboard,parent-dashboard-empty SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame) + `VIEWPORTS=short SHOTS=parent-dashboard`. Bắt buộc: 14 cột `max-w-[26px]` gap 6 vừa bề rộng panel ở `ipad`/`ipadp`; 5 chip + tip 3 dòng **không** đẩy panel tràn; báo lại ba `scrollHeight` mới.
- [ ] **Step 6: Commit** — `feat(dashboard): MinutesChart panel with a range switch, four average tiles, tappable weak-sound chips`

---

### Task 13: Dashboard panel C — ⏰ Giới hạn (`SegRow` + `Stepper`) và Bài học (`SegRow`, auto làm bậc `dim`)

**Files:**
- Modify: `client/src/screens/ParentDashboard.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/ParentDashboard.test.tsx`

**Interfaces:**
- Consumes: `SegRow` (`segs[].tone = 'on'|'off'|'dim'`), `Stepper` (`value`, `onChange`, `min=5`, `max=60`, `step=5`), `Panel` (`right`, `collapsible`), `getLimitMinutes`/`setLimitMinutes`, `getBand`/`setBandValue`/`setBandAuto`, `LESSON_LENGTHS`/`getLessonLength`/`setLessonLength`, `minutesToday`.
- Produces: không API mới; `progress/band.ts` và `progress/limit.ts` **không đổi một dòng**. `LIMIT_CHIPS` (`:59`) giữ `[15, 20, 30]`; `LENGTH_LABEL` (`:74-78`) đổi ba chuỗi sang `Ngắn ~8'` / `Vừa ~12'` / `Dài ~18'`. `handleLimitChange`/`handleLimitBlur` (`:346-354`) **bị xoá cùng `<input type="number">`**; `handleLimitStep(n)` thay chỗ.

- [ ] **Step 1: Failing tests**

```tsx
it('the limit panel is four segs, the fourth lighting up only for a custom value', () => {
  renderDashboard({ limit: 25 })
  const segs = within(screen.getByTestId('limit-panel')).getAllByTestId('seg')
  expect(segs.map(s => s.textContent)).toEqual(["15'", "20'", "30'", "Tuỳ chỉnh 25'"])
  expect(segs[3]).toHaveAttribute('data-tone', 'on')
  expect(segs.slice(0, 3).every(s => s.dataset.tone === 'off')).toBe(true)
  cleanup(); renderDashboard({ limit: 20 })
  const s2 = within(screen.getByTestId('limit-panel')).getAllByTestId('seg')
  expect(s2[1]).toHaveAttribute('data-tone', 'on')
  expect(s2[3]).toHaveTextContent('Tuỳ chỉnh')            // không có số khi giá trị là preset
  expect(s2[3]).toHaveAttribute('data-tone', 'off')
})
it('the limit panel prints today against the limit in its title row and steps by 5', () => {
  renderDashboard({ limit: 25, minutesToday: 12 })
  expect(screen.getByText("Hôm nay: 12/25'")).toHaveClass('text-[12px]', 'text-teal-600')
  fireEvent.click(screen.getByRole('button', { name: 'Tăng' }))
  expect(setLimitMinutes).toHaveBeenCalledWith(30)
  expect(screen.queryByRole('spinbutton', { hidden: false })).toBeNull()   // không còn ô number thấy được
})
it('the lesson panel is six segs on one row; auto on leaves the current band dim, not lit', () => {
  renderDashboard({ band: { mode: 'auto', value: 2 } })
  const segs = within(screen.getByTestId('lesson-panel')).getAllByTestId('seg').slice(0, 6)
  expect(segs.map(s => s.textContent)).toEqual(['Tự động', '1', '2', '3', '4', '5'])
  expect(segs[0]).toHaveAttribute('data-tone', 'on')
  expect(segs[2]).toHaveAttribute('data-tone', 'dim')
  expect(segs.filter(s => s.dataset.tone === 'on')).toHaveLength(1)
  expect(screen.getByText('Tự động đang chọn → bậc hiện tại ⭐ 2')).toHaveClass('text-[11px]')
})
it('picking a band by hand lights exactly that seg and drops the auto line', () => {
  renderDashboard({ band: { mode: 'manual', value: 3 } })
  const segs = within(screen.getByTestId('lesson-panel')).getAllByTestId('seg').slice(0, 6)
  expect(segs[0]).toHaveAttribute('data-tone', 'off')
  expect(segs[3]).toHaveAttribute('data-tone', 'on')
  expect(screen.queryByText(/Tự động đang chọn/)).toBeNull()
})
it('the length row is renamed and shortened, and the tomorrow line stays', () => {
  renderDashboard()
  expect(screen.getByText('Độ dài nhiệm vụ')).toBeInTheDocument()
  expect(screen.queryByText('Thời lượng')).toBeNull()
  expect(screen.getAllByTestId('seg').map(s => s.textContent)).toEqual(expect.arrayContaining(["Ngắn ~8'", "Vừa ~12'", "Dài ~18'"]))
  expect(screen.getByText('Áp dụng từ bài học ngày mai.')).toBeInTheDocument()
})
it('both panels collapse to a 56px row on a phone and are open from md up', () => {
  matchMedia(false); renderDashboard()
  const row = screen.getByRole('button', { name: /Bài học/ })
  expect(row).toHaveClass('min-h-[56px]', 'md:hidden')
  expect(screen.queryByText('Độ dài nhiệm vụ')).not.toBeVisible()
  fireEvent.click(row)
  expect(screen.getByText('Độ dài nhiệm vụ')).toBeVisible()
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/screens/ParentDashboard` → FAIL.

- [ ] **Step 3: Implement** — R23/R24/Q18 / quyết định 29, 34.

- Panel giới hạn (thay `:919-951`):
```tsx
<Panel testId="limit-panel" title="⏰ Giới hạn mỗi ngày" collapsible
  right={<span className="text-[12px] font-extrabold text-teal-600">Hôm nay: {minutesToday(now, events)}/{limitMinutes}'</span>}>
  <SegRow segs={[
    ...LIMIT_CHIPS.map(n => ({ key: String(n), label: `${n}'`, tone: limitMinutes === n ? 'on' : 'off', onClick: () => handleLimitChip(n) })),
    // R23: seg thứ tư SÁNG khi giá trị nằm ngoài {15,20,30} — hôm nay `:929` không chip nào sáng và
    // phụ huynh đọc màn hình như thể giới hạn của họ không được nhận.
    { key: 'custom', label: isCustom ? `Tuỳ chỉnh ${limitMinutes}'` : 'Tuỳ chỉnh', tone: isCustom ? 'on' : 'off', onClick: () => handleLimitStep(limitMinutes) },
  ]} />
  <div className="flex items-center gap-2"><span className="text-[12px] font-bold text-ink-500">Tuỳ chỉnh</span><Stepper value={limitMinutes} onChange={handleLimitStep} label="Tuỳ chỉnh" /></div>
</Panel>
```
  `handleLimitStep = (n: number) => setLimit(String(setLimitMinutes(n)))`; **xoá** `<input type="number">` (`:939-948`), `handleLimitChange`, `handleLimitBlur` (ô số của iOS che nửa màn ngay dưới nó — quyết định 6).
- Panel bài học (thay `:953-1012`): một `SegRow` 6 seg
```tsx
const auto = band.mode === 'auto'
segs = [
  { key: 'auto', label: 'Tự động', tone: auto ? 'on' : 'off', onClick: handleBandAuto },
  ...BAND_VALUES.map(n => ({
    key: String(n), label: String(n), ariaLabel: `Bậc ${n}`,
    // R24: khi auto bật, bậc hiện tại là KẾT QUẢ chứ không phải lựa chọn — `dim`, không `on`.
    // Hôm nay `:962`/`:979` sáng đồng thời và không ai đọc được ai đang quyết định.
    tone: auto ? (band.value === n ? 'dim' : 'off') : (band.value === n ? 'on' : 'off'),
    onClick: () => handleBandClick(n),
  })),
]
```
  + dòng `{auto && <p className="text-[11px] font-bold text-ink-300">Tự động đang chọn → bậc hiện tại ⭐ {band.value}</p>}`; nhãn "Độ khó" 12px giữ; "Thời lượng" → **"Độ dài nhiệm vụ"**; `LENGTH_LABEL` ba chuỗi rút gọn; chân "Áp dụng từ bài học ngày mai." 11px giữ nguyên (Q18).
- Cả hai panel `collapsible` (phone hàng 56, iPad mở sẵn — `Panel` tự lo, quyết định 29).

`shoot.mjs` — hai kịch bản, sau `parent-dashboard-sync-error`:
```js
  // Giới hạn tuỳ chỉnh 25' (seg 4 sáng) — dữ liệu xấu nhất của brief §Luật ràng buộc.
  await S('parent-dashboard-limit-custom', '/parent', async () => {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      localStorage.setItem((id ? `speakup.${id}.` : 'speakup.') + 'limit', '25')
    })
    await go(page, '/parent'); await openDashboard()
  })
  // Bài học · Tự động: bậc hiện tại phải MỜ, không sáng cùng "Tự động".
  await S('parent-dashboard-band-auto', '/parent', async () => {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      localStorage.setItem((id ? `speakup.${id}.` : 'speakup.') + 'band', JSON.stringify({ value: 2, mode: 'auto' }))
    })
    await go(page, '/parent'); await openDashboard()
  })
```
  (Khoá `limit`/`band` phải khớp `progress/limit.ts` và `progress/band.ts` — đọc `storageKey(...)` trước khi viết, đừng đoán tên khoá.)

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=parent-dashboard,parent-dashboard-limit-custom,parent-dashboard-band-auto SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame) + `VIEWPORTS=short SHOTS=parent-dashboard-limit-custom`. Bắt buộc: 6 seg **một hàng** không tràn ở phone 390 (mỗi seg ≈ 56px); ở `phone/` hai panel là hàng 56 đóng.
- [ ] **Step 6: Commit** — `feat(dashboard): limit SegRow + 36px Stepper, lesson row with a dim auto-band and shorter labels`

---

### Task 14: Dashboard panel D — Bản ghi gần đây (5 + "Xem tất cả 20") và Tiến độ từ xa 7 trạng thái

**Files:**
- Modify: `client/src/screens/ParentDashboard.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/ParentDashboard.test.tsx`

**Interfaces:**
- Consumes: `RecordingRow` (Task 3), `RemoteRow` (Task 3), `RemoteRowSkeleton`, `Panel` (`collapsible`, `col='full'`, `right`), `playBlob`, `fetchRemoteStats`/`RemoteStats`, `useDialog` (nút "Chi tiết").
- Produces: không API mới. State mới: `recordingsExpanded` (mặc định `false`), `playingId: string | null`, `playErrorId: string | null`. `recordingsOpen` (`:172`) **giữ nguyên cách quyết định** (`matchMedia` một lần lúc mount) và trở thành `defaultOpen` của `Panel`.

- [ ] **Step 1: Failing tests**

```tsx
it('20 recordings render five rows plus a "Xem tất cả 20 bản ghi ▾" that expands in place', async () => {
  renderDashboard({ recordings: TWENTY }); await settle()
  expect(screen.getAllByTestId('recording-row')).toHaveLength(5)
  const more = screen.getByRole('button', { name: 'Xem tất cả 20 bản ghi ▾' })
  expect(more).toHaveClass('h-11', 'text-[12px]')
  fireEvent.click(more)
  expect(screen.getAllByTestId('recording-row')).toHaveLength(20)
  expect(screen.queryByRole('dialog')).toBeNull()                       // mở TẠI CHỖ, không dialog
})
it('a playing row swaps its glyph and draws the 3px bar; a failed play says so instead of failing silently', async () => {
  playBlob.mockRejectedValueOnce(new Error('no audio'))
  renderDashboard({ recordings: TWENTY }); await settle()
  fireEvent.click(screen.getAllByRole('button', { name: 'Phát' })[0])
  await screen.findByText('Không phát được')
  expect(screen.getAllByTestId('recording-row')[0]).toHaveClass('bg-fix-50')
  playBlob.mockResolvedValueOnce(undefined)
  fireEvent.click(screen.getAllByRole('button', { name: 'Phát' })[1])
  expect(await screen.findByTestId('recording-progress')).toBeInTheDocument()
})
it('no recordings is the 🎙️ empty state, and the panel is a 56px row on a phone', async () => {
  matchMedia(false); renderDashboard({ recordings: [] }); await settle()
  expect(screen.getByRole('button', { name: /Bản ghi gần đây/ })).toHaveClass('min-h-[56px]')
  expect(screen.getByRole('button', { name: /Bản ghi gần đây/ }).className).not.toMatch(/min-h-\[64px\]/)
  fireEvent.click(screen.getByRole('button', { name: /Bản ghi gần đây/ }))
  expect(screen.getByText('Chưa có bản ghi nào')).toBeInTheDocument()
})
it('remote rows cover all seven states in one panel', async () => {
  renderDashboard({ remote: SEVEN }); await settle()
  const rows = screen.getAllByTestId('remote-row')
  expect(rows).toHaveLength(7)
  expect(within(rows[0]).getByTestId('skeleton')).toBeInTheDocument()                  // đang tải
  expect(within(rows[1]).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument() // lỗi tải
  expect(rows[2]).toHaveTextContent('Chưa có dữ liệu trên máy chủ.')                   // chưa có
  expect(rows[3]).toHaveTextContent(/🔥 4 ngày · 58'\/tuần · Nói 79/)                   // có dữ liệu, MỘT dòng
  expect(rows[4]).toHaveTextContent('· máy này')
  expect(rows[5]).toHaveTextContent(/Cập nhật \d+ ngày trước/)                         // cũ >7 ngày
  expect(rows[6]).toHaveTextContent('bản ghi giọng không đồng bộ')
  expect(screen.getAllByText(/Bản ghi giọng nói của bé không đồng bộ/)).toHaveLength(1) // chú thích MỘT lần
})
it('a stale row is decided by the clock, not by a flag', async () => {
  renderDashboard({ remote: [{ ...ONE, updatedAt: Date.now() - 12 * 24 * 3600e3 }] }); await settle()
  expect(screen.getByTestId('remote-row')).toHaveTextContent('Cập nhật 12 ngày trước')
})
it('"Chi tiết" opens a dialog with the numbers the row could not fit', async () => {
  renderDashboard({ remote: SEVEN }); await settle()
  fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0])
  expect(await screen.findByRole('dialog')).toHaveTextContent('Điểm trung bình')
})
it('a failed remote read still says so instead of reading as "no remote profiles"', async () => {
  fetchRemoteProfiles.mockResolvedValue(null); renderDashboard(); await settle()
  expect(await screen.findByTestId('remote-progress-unknown')).toHaveTextContent('máy chủ chưa trả lời')
})
```

- [ ] **Step 2: Run** `vitest run src/screens/ParentDashboard` → FAIL.

- [ ] **Step 3: Implement** — R22/R18/Q18 / quyết định 30, 31.

- Panel bản ghi (thay `:876-917`): `<Panel testId="recordings-panel" title={`Bản ghi gần đây · ${recordings.length}`} collapsible defaultOpen={recordingsOpen} right={…}>`; danh sách `recordings.slice(0, recordingsExpanded ? recordings.length : 5)` → `RecordingRow`; nút mở
```tsx
{recordings.length > 5 && !recordingsExpanded && (
  <button type="button" onClick={() => setRecordingsExpanded(true)} className="h-11 text-[12px] font-extrabold text-teal-600 underline">
    Xem tất cả {recordings.length} bản ghi ▾
  </button>
)}
```
  Phát:
```tsx
// R22: `.catch(() => {})` (`:902`) nuốt lỗi — phụ huynh bấm, không có gì xảy ra, và không có câu nào
// nói vì sao. Một lần phát hỏng là một hàng đỏ có chữ.
function handlePlay(r: Recording) {
  setPlayErrorId(null); setPlayingId(r.id)
  playBlob(r.blob).then(() => setPlayingId(null)).catch(() => { setPlayingId(null); setPlayErrorId(r.id) })
}
```
  **Xoá** `<details>`/`<summary min-h-[64px]>` (`:882-886`) — `Panel collapsible` thay chỗ, và comment `:877-881` viện dẫn "spec decision 2 / child floor" viết lại theo Ruling người lớn (đã sửa ở Task 10, xác nhận lại ở đây).
- Panel Tiến độ từ xa (gộp `:701-774` thành một panel `col="full"`, **áp chót**): tiêu đề + pill `👁 Đang xem` (`h-8 rounded-r10 bg-teal-50 px-2.5 text-[12px] text-teal-600`) khi `remoteViewOn`; `remoteProfiles.status === 'unknown'` → giữ nguyên câu và `data-testid="remote-progress-unknown"` **bên trong** panel; mỗi hồ sơ một `RemoteRow` với `state` suy ra:
```tsx
const state =
  !loaded ? 'loading'
  : entry === null ? 'error'
  : entry.eventCount === 0 ? 'empty'
  : Date.now() - (entry.updatedAt ?? 0) > 7 * 24 * 3600e3 ? 'stale'   // R18: mốc mới, tính bằng đồng hồ
  : p.id === activeId ? 'thisDevice'
  : 'data'
```
  (Nếu `RemoteStats` **không** có trường thời gian cập nhật — kiểm `cloud/remote.ts:39-53` trước — thì lấy `Math.max(...events.ts)` mà `fetchRemoteStats` đã có, hoặc bỏ nhánh `stale` và **ghi Ruling**; không bịa một mốc.)
  `sub` là **một chuỗi** do màn nén: `🔥 ${streak} ngày · ${weekMinutes}'/tuần · Nói ${a.speak} · Từ ${a.word} · Câu ${a.sentence}${weak.length ? ` · Âm sai /${weak[0].phoneme}/ ${Math.round(weak[0].avg)}` : ''}` — thay ba `<p>` `:753-761`. Tên `thisDevice` = `${p.name} · máy này` (ngắn hơn " · đang dùng trên máy này" của `:737`).
  "Chi tiết" → `dialog.confirm({ title: p.name, body: <bốn dòng số>, confirmLabel: 'Đóng', cancelLabel: 'Đóng' })` — dùng đúng `useDialog` sẵn có, **không** thêm surface mới; chú thích "bản ghi không đồng bộ" giữ **một lần dưới panel** (`:716` đã đúng).

`shoot.mjs` — hai kịch bản, sau `parent-dashboard-band-auto`:
```js
  // 20 bản ghi, câu 61 ký tự: ghi thẳng vào IndexedDB `speakup-recordings` trước khi vào dashboard.
  await S('parent-dashboard-recordings-20', '/parent', async () => {
    await page.evaluate(async () => {
      const db = await new Promise((res, rej) => { const q = indexedDB.open('speakup-recordings', 1); q.onupgradeneeded = () => q.result.createObjectStore('recordings', { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
      const tx = db.transaction('recordings', 'readwrite')
      const text = 'My sister has a baby doll and she plays with it every day.'   // 57–61 ký tự
      for (let i = 0; i < 20; i++) tx.objectStore('recordings').put({ id: `r${i}`, ts: Date.now() - i * 3600e3, text, blob: new Blob(['x']), score: [86, 72, 48][i % 3] })
      await new Promise(r => { tx.oncomplete = r })
    })
    await go(page, '/parent'); await openDashboard()
    await page.getByRole('button', { name: /Xem tất cả 20/ }).click(); await sleep(300)
  })
  // 7 hàng Tiến độ từ xa: stub PostgREST cho `events`/`kv` theo `profile_id` trong query.
  await S('parent-remote-7', '/parent', async () => {
    await page.route('**/rest/v1/profiles*', r => r.fulfill({ status: 200, body: JSON.stringify(SEVEN_PROFILES) }))
    await page.route('**/rest/v1/events*', r => r.fulfill({ status: 200, body: JSON.stringify(rowsFor(r.request().url())) }))
    await page.route('**/rest/v1/kv*', r => r.fulfill({ status: 200, body: '[]' }))
    await go(page, '/parent'); await openDashboard()
    await tapText(page, 'Xem từ xa'); await sleep(900)
  })
  await page.unrouteAll?.()
```
  (`SEVEN_PROFILES`/`rowsFor` viết ngay trong `shoot.mjs`; nếu `fetchRemoteStats` không đi qua PostgREST như dự đoán thì **đọc lại `cloud/remote.ts` và sửa pattern route**, đừng bỏ ảnh.)

- [ ] **Step 4: Run** test/lint/typecheck → PASS, 0 act() warning (mọi `playBlob` promise phải được `await` trong `act`).
- [ ] **Step 5: Ảnh** `SHOTS=parent-dashboard,parent-dashboard-recordings-20,parent-remote-7 SHOTS_DIR=../current-phase15/shots node shoot.mjs` (3 frame) + `VIEWPORTS=short SHOTS=parent-dashboard-recordings-20`. Bắt buộc: câu 61 ký tự **một dòng ellipsis** ở mọi frame; 20 hàng mở ra vẫn cuộn **trong panel**, không đẩy `PageBody` tràn ngang.
- [ ] **Step 6: Commit** — `feat(dashboard): five recordings with an in-place "all 20", playback errors, seven remote states`

---

### Task 15: Năm dialog — chỉ đổi chuỗi ở call-site

**Files:**
- Modify: `client/src/screens/ParentDashboard.tsx`
- Test: `client/src/screens/ParentDashboard.test.tsx`

**Interfaces:**
- Consumes: `useDialog` (`confirm`/`destructive`/`prompt`) — **không đụng** `DialogProvider`/`useDialog`; `Dialog placeholder?` (Task 1).
- Produces: không API mới. Bốn call-site `:391`, `:475`, `:490`, `:509` đổi chuỗi; call-site xoá tách làm **hai tiêu đề**.

- [ ] **Step 1: Failing tests**

```tsx
it('the two delete dialogs have two different titles and two different button labels', async () => {
  renderDashboard({ linked: false }); await settle()
  fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('Xoá tiến trình trên máy này?')
  expect(screen.getByRole('dialog')).toHaveTextContent('Tài khoản chưa liên kết nên không có bản lưu nào khác.')
  expect(screen.getByRole('button', { name: 'Xoá trên máy này' })).toHaveClass('bg-fix-700')
  cleanup(); renderDashboard({ linked: true }); await settle()
  fireEvent.click(screen.getByRole('button', { name: '↺ Đặt lại tiến trình…' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('Xoá toàn bộ tiến trình của bé?')
  expect(screen.getByRole('dialog')).toHaveTextContent('kể cả bằng mã khôi phục')
  expect(screen.getByRole('button', { name: 'Xoá tất cả' })).toBeInTheDocument()
})
it('the sign-out dialog names the unsent items and its button is coral, not red', async () => {
  renderDashboard({ linked: true, pending: 3 }); await settle()
  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
  const d = await screen.findByRole('dialog')
  expect(d).toHaveTextContent('Đăng xuất tài khoản?')
  expect(d).toHaveTextContent('3 mục chưa đồng bộ sẽ được gửi trước.')
  expect(within(d).getByRole('button', { name: 'Đăng xuất' })).toHaveClass('bg-coral-500')
})
it('add-profile is "mới", has the example placeholder and the 0/40 counter', async () => {
  renderDashboard(); await settle()
  fireEvent.click(screen.getByRole('button', { name: '+ Thêm hồ sơ' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('Thêm hồ sơ mới')
  expect(screen.getByLabelText('Tên của bé')).toHaveAttribute('placeholder', 'Ví dụ: Bé Su')
  expect(screen.getByText('0/40')).toBeInTheDocument()
})
it('rename follows the same pattern and keeps the current name as its initial value', async () => {
  renderDashboard({ profiles: [{ id: 'p1', name: 'Bé Su', avatar: '🦊', created: 1 }] }); await settle()
  fireEvent.click(screen.getByRole('button', { name: 'Đổi tên' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('Đổi tên hồ sơ')
  expect(screen.getByLabelText('Tên của bé')).toHaveValue('Bé Su')
  expect(screen.getByLabelText('Tên của bé')).toHaveAttribute('placeholder', 'Ví dụ: Bé Su')
})
it('every dialog still runs its work inside onConfirm/onSubmit (Phase 12 busy contract kept)', async () => {
  /* giữ nguyên các test busy/disabled hiện có của `handleReset`/`handleSignOut` */
})
```

- [ ] **Step 2: Run** `vitest run src/screens/ParentDashboard src/components/ui/dialog` → FAIL.

- [ ] **Step 3: Implement** — R27 / quyết định 33 và 35 (ruling "đổi tên theo mẫu Thêm hồ sơ mới").

```tsx
// R27 / quyết định 33: HAI tiêu đề, không một tiêu đề hai thân. Hôm nay `:392` hỏi "Xoá toàn bộ
// tiến trình của bé?" cả khi không có bản lưu nào khác để xoá — câu hỏi to hơn việc thật.
const unlinked = !(cloudAvailable && activeId && linked)
await dialog.destructive({
  title: unlinked ? 'Xoá tiến trình trên máy này?' : 'Xoá toàn bộ tiến trình của bé?',
  body: unlinked
    ? 'Sao, chuỗi ngày và bản ghi trên máy này sẽ mất. Tài khoản chưa liên kết nên không có bản lưu nào khác.'
    : 'Xoá trên máy này VÀ trên tài khoản đã liên kết. Không khôi phục được — kể cả bằng mã khôi phục.',
  confirmLabel: unlinked ? 'Xoá trên máy này' : 'Xoá tất cả',
  onConfirm: async () => { /* nguyên xi khối hiện có :395-420 */ },
})
```
```tsx
await dialog.confirm({
  title: 'Đăng xuất tài khoản?',
  body: `Bé vẫn học được. Tiến độ mới sẽ chỉ lưu trên máy này cho tới khi liên kết lại.${sync.pending > 0 ? ` ${sync.pending} mục chưa đồng bộ sẽ được gửi trước.` : ''}`,
  confirmLabel: 'Đăng xuất',
  onConfirm: async () => { /* nguyên xi :479-484 */ },
})
```
```tsx
const name = await dialog.prompt({ title: 'Thêm hồ sơ mới', label: 'Tên của bé', placeholder: 'Ví dụ: Bé Su', maxLength: NAME_MAX })
// …
const name = await dialog.prompt({ title: 'Đổi tên hồ sơ', label: 'Tên của bé', placeholder: 'Ví dụ: Bé Su', initial: current.name, maxLength: NAME_MAX })
```
Không đụng gì khác: `Dialog` đã đúng từng con số của design (brief §0.5), và `onConfirm`/`onSubmit`/busy guard của Phase 12 giữ nguyên.

- [ ] **Step 4: Run** toàn bộ suite + lint + typecheck → PASS.
- [ ] **Step 5: Ảnh** — dialog không có kịch bản chụp riêng (hai nhãn nút được chứng minh bằng test + hàng checklist iPad ở Task 16). Không chụp.
- [ ] **Step 6: Commit** — `feat(dashboard): two delete dialogs, a sign-out that counts unsent items, prompt placeholders`

---

### Task 16: Kiểm chứng — ảnh 4 frame, ba mốc cuộn, README, checklist, trạng thái spec

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-09-04-phase15-parent-zone-design.md` (dòng trạng thái cuối), `docs/design/round-2026-09/README.md` ("Bước tiếp"), `docs/design/current/README.md` (mục Phase 15 + bảng lệnh), `docs/design/current/shoot.mjs` (kịch bản còn thiếu, `IPADP_ONLY`)

- [ ] **Step 1: Chạy đủ** — dev server nền, rồi từ `docs/design/current/`:
  `SHOTS_DIR=../current-phase15/shots node shoot.mjs` (cả 3 frame, không lọc `SHOTS`) và
  `VIEWPORTS=short SHOTS=parent-gate,parent-gate-empty,profile-gate-8,start-abandon,parent-dashboard,parent-dashboard-recordings-20 SHOTS_DIR=../current-phase15/shots node shoot.mjs`.
  Rồi `node sheet.mjs` cho sheet trước/sau (`current-phase14/shots` → `current-phase15/shots`).
  Xác nhận `IPADP_ONLY` (`shoot.mjs:28`) có `parent-dashboard` (đã có) và **bản `-full` của `ipadp/parent-dashboard` được sinh ra hoặc không cần sinh** — nếu không còn tràn thì đó chính là mốc đã đạt, ghi rõ.
- [ ] **Step 2: Ba mốc + mọi dòng `overflow`.** Liệt kê từng dòng `overflow` của cả hai lần chạy và **chứng minh ba mốc của spec §Luật ràng buộc**: `phone/parent-dashboard-full.png` 1821 → **≈1100**, `ipad/parent-dashboard-full.png` 1643 → **≤834** (biến mất), `ipadp/parent-dashboard-full.png` → **≤1194** (biến mất). Mọi `-full.png` **còn lại** trong 4 màn của vòng này phải được nêu tên kèm lý do (dự kiến: `parent-dashboard-recordings-20` khi mở 20 hàng, `profile-gate-8` ở 375×667).
- [ ] **Step 3: README** — thêm mục `## Phase 15 — Khu người lớn (vòng 4)` ngay sau `## Phase 14`, gồm:
  - Mở đầu: nhánh `phase15-parent-zone`, ngày, spec + brief, "vòng 4 gom **bốn màn người lớn** về một ngôn ngữ; không đụng màn trẻ em".
  - Khung mới: `GateCard`/`GateBlobs` + `components/adult/` (`Panel`, `PanelGrid`, `FieldRow`, `SegRow`, `Stepper`, `MinutesChart`, `RecordingRow`, `RemoteRow`, `AccountCard`) + bảy component sửa — kèm câu "mặc định của cả bảy không đổi, 33 màn ngoài nhóm render y hệt".
  - **Bảng theo màn** (4 hàng: A1, P1, A2, P2) — cột "What changed", cùng dạng bảng "The nine screens" của Phase 13.
  - Bảng "Mốc `-full.png` đã hạ" (before/after, số px lấy từ Step 2).
  - Bảng "11 trạng thái thẻ Tài khoản" và "7 trạng thái Tiến độ từ xa" — mỗi hàng ghi cách ép được trạng thái đó (test hay kịch bản `shoot.mjs`), để lần sau ai cũng dựng lại được.
  - `### Sai lệch so với brief (Ruling)` — điền từ `.superpowers/sdd/2026-09-04-phase15-parent-zone/progress.md`. Các mục **đã biết trước, phải có mặt**: (a) **Ruling người lớn** "hộp thấy 28–36, vùng chạm ≥44, không 56/64" — đảo chiều doc comment `ParentDashboard.tsx:47-56` và `:877-881`; (b) **Ruling T3-1** thay đổi thứ tư (`Recording.score`) — hoặc bản ghi "đã bỏ cột điểm"; (c) `#D9CBB4` và `#FFF6E0` là hai hex **không có token**, được phép; (d) brief ghi nhầm `#F1E7D4` là `line-200` — dùng `line-200` (`#EFE2CC`) cho hairline; (e) fade đáy `Panel` dùng `to-white` chứ không `to-cream-50` như brief; (f) chip mã khôi phục giữ 24px của `Notice` (design vẽ 22) vì `Notice` chỉ được thêm `icon?`; (g) **"Gửi lại mã (0:42)"** không có bộ đếm — nút không đếm ngược ở vòng này; (h) `averageScoreByKind` có chữ ký `(events)`, không `('story')`, và ô "Truyện" luôn "—" vì `StoryQuiz.tsx:90` không ghi `score`; (i) ảnh nào không ép được trạng thái trong dev (kiểu `home-3-banners` của Phase 14) phải nêu tên ở đây.
  - `### Checklist iPad (6 hàng)` — **đánh số tiếp từ 91**:

| # | Step | Expected result | Result |
|---|------|------------------|--------|
| 92 (chạm 44) | Mở A1/A2/P1/P2 trên iPad, chạm **bằng ngón** vào pill sync, "+ Thêm hồ sơ", "Đổi tên", ▶ bản ghi, −/+ giới hạn, "Chi tiết"/"Thử lại" | Mọi control bắt được ngón tay ngay lần chạm đầu, dù hộp thấy chỉ 28/32/36 | ⏳ pending |
| 93 (thẻ cổng căn giữa) | P1 và A2 ở cả 4 frame (kể cả 375×667) | Thẻ 420 **căn giữa** dọc và ngang, không lệch trái, không tràn | ⏳ pending |
| 94 (lưới 1/2/3) | P2 ở phone · iPad dọc · iPad ngang | Đúng 1/2/3 cột, thẻ Tài khoản **có 2 cột trong** ở iPad dọc, Tiến độ từ xa full-width áp chót, "Đặt lại" cuối | ⏳ pending |
| 95 (11 trạng thái) | Ép từng nhánh thẻ Tài khoản theo bảng README | Cả 11 trạng thái vẽ đúng và **không nhảy chiều cao** (150 giữ nguyên) | ⏳ pending |
| 96 (`SyncPill` 7) | Máy đã cấu hình cloud nhưng chưa có phiên; rồi máy **chưa** cấu hình cloud | Máy 1 hiện "⚡ Chưa kết nối"; máy 2 **không hiện pill nào** | ⏳ pending |
| 97 (hai dialog xoá) | Bấm "↺ Đặt lại tiến trình…" khi chưa liên kết, rồi khi đã liên kết | Hai tiêu đề khác nhau và hai nhãn nút khác nhau ("Xoá trên máy này" / "Xoá tất cả") | ⏳ pending |

- [ ] **Step 4: Dòng trạng thái spec** — thay dòng cuối `docs/superpowers/specs/2026-09-04-phase15-parent-zone-design.md` bằng: đã triển khai, ngày, nhánh, số task, trỏ về `README.md §Phase 15`.
- [ ] **Step 5: `docs/design/round-2026-09/README.md`** — "Bước tiếp": Phase 15 đã xong (nhánh, tasks, spec, README §Phase 15) ⇒ **cả bốn vòng của redesign 2026-09 đã triển khai**. Ghi tiếp: hai việc còn treo (xoá alias `xl2/xl3/xl4` + `components/Stars.tsx` — nay đã tới "Phase 15" như ghi chú deprecate hứa; tách `useCountdown`/`useTeachCollapse`) và các mục "Việc để lại" mới của vòng này.
- [ ] **Step 6: `docs/design/current/README.md`** — thêm mục "## Phase 15 (2026-09-04)": 15 kịch bản mới (`profile-gate-8`, `profile-gate-reask`, `parent-gate-empty`, `start-otp-error`, `start-abandon`, `start-result-empty`, `parent-dashboard-empty`, `-linked`, `-otp`, `-sync-error`, `-limit-custom`, `-band-auto`, `-recordings-20`, `parent-remote-7`, và `start-code` mở rộng), `SHOTS_DIR=../current-phase15/shots`, và danh sách kịch bản **phải stub mạng** (kèm cảnh báo: không kịch bản nào được gửi email thật).
- [ ] **Step 7:** `pnpm --filter client test && pnpm --filter client lint && pnpm --filter client typecheck && pnpm --filter client build` → tất cả xanh, **0 act() warning**.
- [ ] **Step 8: Commit** — `docs: phase 15 parent zone — screenshots, per-screen table, account-state matrix and checklist`

---

## Self-review

**Spec coverage — 35 quyết định → task:**

| # | Quyết định | Task |
|---|---|---|
| 1 | Ruling người lớn 28–36/hit ≥44, xoá 10 chỗ 56/64, thang chữ | Global Constraints + 5 (`ProfilePicker`/`ParentQuestion`), 8 (`CloudStart`), 10–14 (dashboard, gồm sửa comment `:47-56` và `:877-881`), ghi Ruling ở 16 |
| 2 | `GateCard` 420/r20/p20 căn trái | 2 (dùng ở 6, 7, 8, 9) |
| 3 | `Panel` r16, tiêu đề 13/14, hàng gập 56, vùng cuộn + fade 40 | 2 (dùng ở 10–14) |
| 4 | `PanelGrid` 1/2/3 + `col='full'`, một cây DOM | 2 (dùng ở 10) |
| 5 | `FieldRow` label 12 / input 44 / lỗi 18 giữ chỗ / help 11 / `action` | 2 (dùng ở 8, 4/11) |
| 6 | `SegRow` 3 tone + `Stepper` 36-trong-44, bỏ input number | 2 (dùng ở 13) |
| 7 | `MinutesChart` 4 màu, 3 nhãn, nút 7/14, `max(4,…)` | 3 (dùng ở 12) |
| 8 | `RecordingRow` 44 + ▶36 + điểm màu băng (**kiểm `score` trước**) | 3 Step 0 + 3 (dùng ở 14) |
| 9 | `RemoteRow` 56, một dòng phụ nén, nút hàng 36 | 3 (dùng ở 14) |
| 10 | `AccountCard` 11 trạng thái, tách ③, thêm ⑩⑪, spinner ⑤ | 4 (nối dây ở 11) |
| 11 | `Button variant='danger'` là variant thật | 1 (dùng ở 10) |
| 12 | `ProfilePicker` 3 mật độ, `pendingId`, `line-clamp-2`, bỏ `sm:` | 5 (dùng ở 7, 9, 11) |
| 13 | `ParentQuestion` 32/96×44/44, lỗi giữ chỗ + tự tắt + rung | 5 (dùng ở 6, 8) |
| 14 | `SyncPill` 7 trạng thái, gate `hasSession`, `size` | 1 (nối `hasSession` ở 11) |
| 15 | `Notice icon?` · `EmptyState dashed` · skeleton 150 · giữ `credential` | 1 (dùng ở 4, 12) |
| 16 | `Dialog` chỉ thêm `placeholder?` | 1 (dùng ở 15) |
| 17 | Khung chung 3 cổng, Back `mdLabel`, A1 không Back | 6 (P1), 7 (A1), 8 (A2) |
| 18 | A1 hai hình dạng + thang z 40 < 50 < 60 | 7 |
| 19 | A1 sáu trạng thái + `storageBroken` (`writeMark` trả boolean) | 7 |
| 20 | P1 ba trạng thái (sạch/sai/gửi rỗng) | 5 (logic) + 6 (màn, ảnh) |
| 21 | A2 tám stage, thêm `'result'`, ô 44 qua `FieldRow` | 8 (khung + ô) + 9 (stage `'result'`) |
| 22 | A2 14 câu lỗi + gộp 4 lỗi hệ thống (giữ câu roster) | 8 |
| 23 | A2 abandon 4 dòng copy + nhãn nút cố định | 9 |
| 24 | Lưới 1/2/3 với đủ 10 panel, Tiến độ từ xa áp chót | 10 |
| 25 | Header một hàng `title/sub` + nút 🔐 tự vẽ | 10 |
| 26 | Panel Tài khoản + cột Hồ sơ, email 61 truncate ở 3 chỗ | 11 |
| 27 | Biểu đồ phút luyện (14/7, nút đổi, 3 nhãn, 4 màu, empty đứt) | 12 (component ở 3) |
| 28 | Điểm TB 4 ô (`story` luôn "—") + chip âm sai bấm được ở phone | 12 (kiểm dữ liệu ở 3 Step 0) |
| 29 | Giới hạn `SegRow`+`Stepper`; Bài học 6 seg, auto → bậc `dim`; hai panel gập | 13 |
| 30 | Bản ghi 5 + "Xem tất cả 20" tại chỗ, ❚❚ + thanh 3px, lỗi phát, hàng 56 | 14 |
| 31 | Tiến độ từ xa 7 trạng thái, ">7 ngày", "Chi tiết" mở `Dialog` | 14 |
| 32 | Hàng "Đặt lại tiến trình" cuối cùng, `variant='danger'` | 10 |
| 33 | Năm dialog — chỉ đổi chuỗi ở call-site | 15 |
| 34 | Q17 (14/7 đã đúng, thiếu phần trình bày) · Q18 (giữ bản ghi, 4 ô, ô phút, dòng "ngày mai") | 12 (Q17), 13 (ô phút + dòng ngày mai), 14 (giữ bản ghi ở phone) |
| 35 | Năm ruling: iPad ngang 3 cột 1080 · dialog đổi tên · `cloudAvailable === false` = 6 panel · cổng iPad dọc = iPad ngang · A1 1/3 hồ sơ; `short:` không thêm luật | 10 (3 cột + 6 panel), 15 (đổi tên), 6 + 8 (cổng iPad dọc), 7 (1/3 hồ sơ), 16 (`short:` chỉ kiểm chứng) |

**Không quyết định nào bị bỏ.** Tất cả 35 đều có task, và mỗi task đụng ≤6 file nguồn (Task 1 chạm 8 file nhưng 6 trong số đó là sửa 1–3 dòng mỗi file; Task 10–14 chia `ParentDashboard.tsx` theo cụm panel đúng để không có task nào viết lại cả file một lượt).

**Placeholder scan.** Kế hoạch cho **chuỗi class và hành vi**, không cho JSX đầy đủ của từng màn — brief §1/§2 giữ số theo phần tử, file Phase 12/13/14 giữ mã xung quanh. Bảy chỗ **cố ý** để trống và đã nêu tên tại chỗ, phải điền lúc triển khai: (a) nhánh Ruling của `Recording.score` (Task 3 Step 0) quyết định trước khi viết dòng code đầu tiên; (b) `FAKE_SESSION` và `SEVEN_PROFILES`/`rowsFor` của `shoot.mjs` phải khớp hình dạng thật của `supabase-js`/PostgREST — đọc `cloud/remote.ts` và `cloud/auth.ts` rồi mới viết; (c) tên khoá `localStorage` của `limit`/`band` đọc từ `progress/storageKeys.ts`, không đoán; (d) trường thời gian cập nhật cho nhánh `stale` của `RemoteRow` — nếu `RemoteStats` không có thì dùng `max(events.ts)` hoặc bỏ nhánh **kèm Ruling**; (e) mọi số `scrollHeight` trong bảng README đến từ lần chạy thật ở Task 16; (f) khối `Ruling:` của README điền từ ledger; (g) ảnh nào không ép được trạng thái trong dev phải được **nêu tên** ở README, không im lặng bỏ. Ba chuỗi copy là **đề xuất** (design không ghi) và phải vào Ruling: sub rỗng của dashboard ("Chưa có buổi luyện nào tuần này"), câu ② của thẻ Tài khoản khi rút gọn, và tiêu đề/nhãn dialog **đổi tên** (theo mẫu "Thêm hồ sơ mới").

**Type consistency.** Tên prop dùng ở Task 1–5 và ở mọi task màn là một: `hasSession`/`size` (`SyncPill`), `icon` (`Notice`), `variant='dashed'` (`EmptyState`), `variant='danger'` (`Button`), `placeholder` (`PromptOptions` + `Dialog`), `title`/`right`/`collapsible`/`defaultOpen`/`col`/`scroll`/`testId` (`Panel`), `label`/`input`/`error`/`help`/`action`/`htmlFor` (`FieldRow`), `segs[].{key,label,tone,onClick,ariaLabel}` (`SegRow`), `value`/`onChange`/`min`/`max`/`step`/`label` (`Stepper`), `days`/`limitMinutes`/`range`/`onRangeChange`/`todayKey` (`MinutesChart`), `ts`/`text`/`score`/`playing`/`error`/`onPlay` (`RecordingRow`), `name`/`sub`/`state`/`onAction` (`RemoteRow`), `state`/`sync`/`hasSession`/`recoveryCode` + 8 handler (`AccountCard`), `density`/`pendingId`/`footer` (`ProfilePicker`), `sub` (`ParentQuestion`). Kiểu **không** đổi và được nhắc lại ở đúng task đụng tới: `SyncStatus` (Task 1, 11), `Band`/`BandState` (Task 13), `LessonLength` (Task 13), `RemoteStats` (Task 14), `Profile` (Task 5, 7, 11), `DialogRequest['confirm'|'destructive']` (Task 15). Kiểu duy nhất được nới là `Stage` của `CloudStart` (thêm `'result'`, Task 9) và — **chỉ khi Ruling T3-1 được ghi** — `Recording` (thêm `score?: number`, Task 3); cả hai đều là thay đổi cộng thêm, không phá call-site nào đang có.
