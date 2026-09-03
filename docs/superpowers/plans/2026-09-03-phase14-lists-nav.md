# Phase 14 — Danh sách và điều hướng (vòng 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mười bảy màn danh sách/điều hướng (C6 WordList, C1 StoryList, C8 SentenceList, C5 WordTopics, A10 LevelSelect, A11 SoundLevel, A12 PairLevel, A13 StarLevel, A14 VoiceLevel, B2 SoundWordList, A3 Home, A6 DailyMission, A7 MissionComplete, A8 TopicHub, A9 LevelStairs, C2 StoryPlayer, C3 StoryQuiz) chạy trên **một khung danh sách chung** (`ListGrid` / `Tile` / `ListRow` / `StickyGroup`) và **một header một hàng căn trái có dòng phụ**, ở phone 390×844, iPad dọc 834×1194 và iPad ngang 1194×834 (+ 375×667 cho C6 và A9) — thay 7 lưới tự viết và `CARD_LINK`, sửa 6 điểm điều hướng (banner Home "+N", copy "Về bản đồ", CTA ghim TopicHub/LevelStairs, header StoryPlayer lên trên tranh, quiz 0/3, DailyMission rỗng), và **hạ 10 mốc `-full.png`** mà `shoot.mjs` đang ghi.

**Architecture:** Khung dùng chung hạ trước (Task 1: `PageHeader.title/sub/align/onBand`, `PageBody.fade/gap`, `Button size='sm'`, `EmptyState size='hero'`, `Chip tone='coralSolid'`, `Stars` mốc 13/14 — **mặc định của cả sáu không đổi một pixel** cho 33 màn cũ; Task 2: thư mục mới `components/ui/list/`). Rồi từng họ màn viết lại thân, giữ nguyên hook/dữ liệu/`data-testid` (Task 3–7 = 10 màn danh sách, kết thúc bằng việc xoá `cardLink.ts`; Task 8–13 = điều hướng/Home/nhiệm vụ/đảo/bậc; Task 14–15 = truyện). Task 16 chụp đủ 3 frame, ghi README và checklist.

**Tech Stack:** React 19, react-router-dom, Tailwind 3 (variant `ipad` — đã compile `@media (…) { &:is(&) }` nên **outrank `md:`** — và `short`), Vitest + Testing Library (jsdom, `globals: true`), oxlint, tsc. Ảnh: `docs/design/current/shoot.mjs` + `sheet.mjs` (`SHOTS`, `SHOTS_DIR`, `VIEWPORTS`, probe overflow đọc `[data-testid="page-body"]`), dev server `pnpm --filter client exec vite --mode nossl --port 5174 --strictPort`.

**Spec:** `docs/superpowers/specs/2026-09-03-phase14-lists-nav-design.md` (29 quyết định).
**Số đo & copy:** `docs/design/2026-09-03-round3-lists-nav-brief.md` (§1 bảng khung theo frame, §2 mười ba màn, §3 Q11–Q14/Q19, §4 R1–R32, §6 việc mới). Brief thắng về **số đo**, spec thắng về **quyết định**.

## Global Constraints

Luật ràng buộc của spec, nguyên văn + cụ thể hoá:

- **Số đo nguyên văn từ brief §1–§2**; token/bóng/radius Phase 12 và mọi thứ Phase 13 vừa chốt giữ nguyên — **không hex nào mới**. Token có sẵn: `shadow-card-sm` = `0 5px 0 #EFE2CC`, `shadow-card-xs` = `0 4px 0 #EFE2CC`, `sand` `#F3EADA` / `sand-edge` `#E2D5C0` / `sand-text` `#A79781`, `sun-50` `#FFF1C9` / `sun-700` `#9A6B00`, `star` `#FFB020` / `star-empty` `#E2D5C0`, `cream-50` `#FFF7EA`, `teal-line` `#C4E8E1`. **Chưa có token** (viết arbitrary): `0 6px 0 #EFE2CC`, `0 5px 0 #E2D5C0`, `0 5px 0 #EFDDA8`, `#F6EFE2` (mục "xong"), `#C08457` (IPA), `#EAD9BE` (đường mòn).
- **Ba frame kiểm chứng:** 390×844, 834×1194, 1194×834 (+375×667 cho C6 và A9); chụp vào `docs/design/current-phase14/shots/`.
- **Không `lg:` ở bất kỳ màn nào bị đụng.** Mọi `lg:` gặp phải trong file đang sửa phải bị xoá (không đổi thành `ipad:` một cách máy móc — đọc brief xem cột nào đúng).
- **`ipad:` outrank `md:`** (Phase 13) ⇒ mọi `md:` viết cho **iPad dọc** trong vòng này (Task 9 Home, Task 10 DailyMission, Task 13 LevelStairs) **phải kiểm cả hai frame iPad** bằng ảnh, không chỉ bằng test class. Ngược lại, một rule chỉ dành cho iPad ngang phải viết `ipad:`, và nếu nó đụng cùng property với một `md:` thì `ipad:` sẽ thắng — đó là hành vi mong muốn.
- **Không `ipad:!`** (không `!important` trên variant `ipad`) — Phase 13 đã chốt: `:is(&)` là cơ chế duy nhất để `ipad:` thắng `md:`.
- **Giữ mọi `data-testid` đang có** (`page-body`, `header-right`, `island-header`, `story-title`, `story-art`, `scene-progress`, `step-*`, `island-*`, `group-*`, `stars`, `star-filled`, `star-empty`, `empty-state`, `progress-fill`…). Test cũ dựa vào chúng.
- **Không đụng chữ ký** của `useSpeakingAttempt`, `createScorer`, `progress/missionNav`, `progress/store` (`setStars(id, stars: 1 | 2 | 3)` **giữ nguyên kiểu** — quiz 0 sao đơn giản là không gọi). Không đụng 9 màn luyện nói (trừ B2 chỉ hạ cỡ ô ở Task 7).
- **Tests/lint/typecheck/build xanh, 0 act() warning.** Lệnh: `pnpm --filter client test`, `lint`, `typecheck`, `build` (trên shell người dùng: `pnpm.cmd`). Cảnh báo lint đã biết của `LessonChip` vẫn được chấp nhận.
- **Không bỏ qua hook secret**: mỗi commit chạy `bash scripts/check-secrets.sh staged`; không bao giờ `--no-verify`, không bao giờ in `.env`.
- **Chạy mọi lệnh từ gốc repo** `D:/ToanBH/SourceCode/english-speaking`. Một commit cho mỗi task. Nhánh mới từ `main`.
- **Ảnh mỗi task:** từ `docs/design/current/`, dev server chạy nền:
  `SHOTS=<ids> SHOTS_DIR=../current-phase14/shots node shoot.mjs <phone|ipad|ipadp>`; báo lại mọi dòng `overflow`.

---

### Task 1: `PageHeader` `title`/`sub`/`align`/`onBand`; `PageBody` `fade`/`gap`; `Button sm`; `EmptyState hero`; `Chip coralSolid`; `Stars` 13/14

**Files:**
- Modify: `client/src/components/ui/page/PageHeader.tsx`, `client/src/components/ui/page/PageBody.tsx`, `client/src/components/ui/Button.tsx`, `client/src/components/ui/EmptyState.tsx`, `client/src/components/ui/Chip.tsx`, `client/src/components/ui/Stars.tsx`
- Test: `client/src/components/ui/page/page.test.tsx`, `client/src/components/ui/ui.test.tsx`

**Interfaces:**
- Consumes: `Foxy` (`components/Foxy`, `mood: FoxyMood`, `size: 'sm'|'md'|'lg'`) cho `EmptyState size='hero'`.
- Produces:
  - `PageHeader` thêm `title?: ReactNode`, `sub?: ReactNode`, `align?: 'center' | 'start'`, `onBand?: boolean`. **`align` mặc định là `'start'` khi có `title`, `'center'` khi không** — 33 call-site cũ chỉ truyền `children` nên không đổi một class nào.
  - `PageBody` thêm `fade?: boolean`, `gap?: 8 | 10 | 12` (mặc định `undefined` = không thêm class nào).
  - `ButtonSize` thêm `'sm'`.
  - `EmptyState` thêm `size?: 'md' | 'hero'` (mặc định `'md'`); `emoji` thành `emoji?: string`.
  - `ChipTone` thêm `'coralSolid'`.
  - `StarSize` thành `'xs' | '13' | '14' | 'sm' | 'md' | 'lg'`.

- [ ] **Step 1: Failing tests**

```tsx
// page.test.tsx
it('header keeps the Phase 12/13 centred layout byte-for-byte when no title is given', () => {
  wrap(<PageShell><PageHeader back={<BackButton to="/" label="Về nhà" />}><span>chip</span></PageHeader><PageBody>x</PageBody></PageShell>)
  expect(screen.getByRole('banner')).toHaveClass('grid', 'h-14', 'grid-cols-[56px_1fr_56px]', 'gap-2', 'md:h-16', 'md:gap-3')
  expect(screen.getByText('chip').parentElement?.parentElement)
    .toHaveClass('items-center', 'justify-self-center', 'gap-[3px]', 'md:flex-row', 'md:gap-2.5')
})
it('title/sub render a left-aligned one-row header', () => {
  wrap(<PageShell><PageHeader back={<BackButton to="/words" label="Từ vựng" />} title="📚 Ôn tập hôm nay" sub="64 từ · chạm để ôn" /><PageBody>x</PageBody></PageShell>)
  expect(screen.getByRole('banner')).toHaveClass('gap-2.5', 'md:gap-3.5')
  const h1 = screen.getByRole('heading', { level: 1 })
  expect(h1).toHaveClass('truncate', 'font-display', 'text-[22px]', 'leading-[1.1]', 'md:text-[28px]')
  expect(screen.getByText('64 từ · chạm để ôn')).toHaveClass('truncate', 'text-[13px]', 'font-bold', 'text-ink-500', 'md:text-[15px]')
  expect(h1.parentElement?.parentElement).toHaveClass('min-w-0', 'flex-1', 'justify-self-stretch', 'text-left')
})
it('onBand makes the header transparent and turns the back disc white-on-teal', () => {
  wrap(<PageShell><PageHeader onBand back={<BackButton to="/" label="Về nhà" />} title="Động vật" /><PageBody>x</PageBody></PageShell>)
  expect(screen.getByRole('banner')).toHaveClass('bg-transparent')
  expect(screen.getByRole('link', { name: 'Về nhà' }).parentElement)
    .toHaveClass('[&>a]:bg-white/[.92]', '[&>a]:text-teal-600')
})
it('PageBody fade and gap are opt-in and absent by default', () => {
  const { rerender } = wrap(<PageShell><PageBody>x</PageBody></PageShell>)
  expect(screen.getByTestId('page-body')).toHaveClass('mt-2.5', 'flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-y-auto', 'md:mt-4')
  expect(screen.getByTestId('page-body').className).not.toMatch(/after:|gap-/)
  rerender(<PageShell><PageBody fade gap={10}>x</PageBody></PageShell>)
  expect(screen.getByTestId('page-body')).toHaveClass('gap-2.5', 'after:sticky', 'after:bottom-0', 'after:h-[50px]', 'after:to-cream-50')
})
// ui.test.tsx
it('Button size sm is the 48px mission CTA', () => {
  render(<Button size="sm">Chơi lại 🎉</Button>)
  expect(screen.getByRole('button')).toHaveClass('min-h-[48px]', 'px-4', 'text-[17px]', 'rounded-r16', 'whitespace-nowrap')
})
it('EmptyState hero swaps the emoji for a 120px Foxy and grows the type', () => {
  render(<EmptyState size="hero" title="Hôm nay chưa có nhiệm vụ" sub="Bé có thể luyện tự do ở bất kỳ đảo nào — hoặc leo các bậc luyện nói." />)
  const box = screen.getByTestId('empty-state')
  expect(box).toHaveClass('flex-1', 'justify-center', 'gap-3', 'bg-transparent')
  expect(screen.getByTestId('foxy')).toBeInTheDocument()
  expect(screen.getByText('Hôm nay chưa có nhiệm vụ')).toHaveClass('text-[22px]')
  expect(screen.getByText(/luyện tự do/)).toHaveClass('text-[14px]')
})
it('Chip coralSolid is solid coral with white text', () => {
  render(<Chip tone="coralSolid">12 từ hôm nay</Chip>)
  expect(screen.getByText('12 từ hôm nay')).toHaveClass('bg-coral-500', 'text-white')
})
it('Stars gains the 13 and 14 marks without moving the old four', () => {
  const { rerender } = render(<Stars value={2} size="13" />)
  expect(screen.getByTestId('stars')).toHaveClass('text-[13px]', 'tracking-[2px]')
  rerender(<Stars value={2} size="14" />); expect(screen.getByTestId('stars')).toHaveClass('text-[14px]')
  rerender(<Stars value={2} size="xs" />); expect(screen.getByTestId('stars')).toHaveClass('text-[12px]')
  rerender(<Stars value={2} />); expect(screen.getByTestId('stars')).toHaveClass('text-[28px]')
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/components/ui` → FAIL.

- [ ] **Step 3: Implement**

`PageHeader.tsx` — cả `align`, `gap` và ô giữa đều rẽ nhánh; **nhánh mặc định phải là chuỗi class y hệt hôm nay**:
```tsx
export function PageHeader({ back, right, engine, dimmed, title, sub, align, onBand, children }: {
  back: ReactNode; right?: ReactNode; engine?: 'azure' | 'webspeech' | null; dimmed?: boolean
  title?: ReactNode; sub?: ReactNode; align?: 'center' | 'start'; onBand?: boolean; children?: ReactNode
}) {
  const dim = dimmed ? 'opacity-40 pointer-events-none' : ''
  const start = (align ?? (title !== undefined ? 'start' : 'center')) === 'start'
  // brief §1: header căn trái dùng gap 10/14; header căn giữa giữ 8/12 của Phase 12.
  const gap = start ? 'gap-2.5 md:gap-3.5' : 'gap-2 md:gap-3'
  // R19 / quyết định 5: ngoại lệ CÓ TÊN với luật "header luôn trên cream" — chỉ TopicHub dùng.
  const band = onBand ? 'bg-transparent [&>div:first-child>a]:bg-white/[.92] [&>div:first-child>a]:text-teal-600' : ''
  return (
    <header className={`grid h-14 grid-cols-[56px_1fr_56px] items-center ${gap} md:h-16 md:grid-cols-[64px_1fr_minmax(64px,auto)] ${band}`}>
      <div className={`justify-self-start ${onBand ? '[&>a]:bg-white/[.92] [&>a]:text-teal-600' : ''} ${dim}`}>{back}</div>
      <div className={start
        ? 'flex min-w-0 flex-1 items-center justify-self-stretch gap-2.5 text-left'
        : 'flex min-w-0 flex-col items-center justify-self-center gap-[3px] md:flex-row md:gap-2.5'}>
        {title !== undefined ? (
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate font-display text-[22px] font-extrabold leading-[1.1] text-ink-900 md:text-[28px]">{title}</h1>
            {sub !== undefined && <p className="truncate text-[13px] font-bold text-ink-500 md:text-[15px]">{sub}</p>}
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">{children}</div>
        )}
        <EngineBadge engine={engine} />
      </div>
      <div data-testid="header-right" className={`flex justify-self-end ${dim}`}>{right === undefined ? <LessonChip /> : right}</div>
    </header>
  )
}
```
(Hai chỗ viết `[&>a]` cho `onBand`: một trên `<header>` để test đọc được, một trên ô Back để rule thật sự áp — giữ cả hai, chúng không xung đột. `dimmed`/`engine`/`right` đi đúng đường cũ.)

`PageBody.tsx` (nhánh **không** `split`) — thêm hai class có điều kiện, không đổi gì khác:
```tsx
const GAP = { 8: 'gap-2', 10: 'gap-2.5', 12: 'gap-3' } as const
// R11: fade 50px của vùng cuộn khi màn KHÔNG có PageFooter (footer đã tự vẽ fade 40 của nó).
// `sticky bottom-0` + margin âm: pseudo-element là một flex item, dính đáy khung cuộn thay vì
// dính cuối nội dung, nên nó phủ đúng 50px cuối của viewport ở mọi vị trí cuộn.
const FADE = "after:pointer-events-none after:sticky after:bottom-0 after:-mt-[50px] after:block after:h-[50px] after:shrink-0 after:bg-gradient-to-b after:from-transparent after:to-cream-50 after:content-['']"
// …
<div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col overflow-y-auto md:mt-4 ${gap ? GAP[gap] : ''} ${fade ? FADE : ''} ${center ? 'justify-center' : ''} ${className}`}>
```

`Button.tsx`: `export type ButtonSize = 'sm' | 'md' | 'lg' | 'adult'`, thêm
`sm: 'min-h-[48px] px-4 text-[17px] rounded-r16'` (chuỗi base đã có `whitespace-nowrap`, không thêm `HIT` — 48 đã trên sàn 44 và thẻ MissionCard không có chỗ cho dải 4px).

`EmptyState.tsx`: `emoji?: string`, `size?: 'md' | 'hero'`.
```tsx
const HERO = 'min-h-0 flex-1 justify-center gap-3 bg-transparent p-0'
// hero: Foxy 120×116 bob thay glyph; tiêu đề 22; phụ 14 (brief §2 A6 rỗng)
{size === 'hero'
  ? <Foxy mood="idle" size="lg" className="animate-bob [&_svg]:h-[116px] [&_svg]:w-[120px]" />
  : emoji && <span aria-hidden="true" className={`leading-none ${adult ? 'text-[24px]' : 'text-[34px]'}`}>{emoji}</span>}
```
tiêu đề `size === 'hero' ? 'text-[22px]' : (adult ? 'text-[14px]' : 'text-[16px]')`; phụ `size === 'hero' ? 'text-[14px]' : 'text-[12px]'`.

`Chip.tsx`: `coralSolid: 'bg-coral-500 text-white'`.

`Stars.tsx`:
```tsx
export type StarSize = 'xs' | '13' | '14' | 'sm' | 'md' | 'lg'
const SIZE: Record<StarSize, string> = { xs: 'text-[12px]', '13': 'text-[13px]', '14': 'text-[14px]', sm: 'text-[16px]', md: 'text-[28px]', lg: 'text-[44px]' }
```
(Chọn dứt khoát một lần, R31: **thêm mốc**, không đổi thang sang số — bốn tên cũ giữ nguyên nên 20+ call-site không phải sửa; `StarRow` re-export `StarSize` từ `Stars` nên tự có hai mốc mới.)

- [ ] **Step 4: Run** hai file test trên, rồi toàn bộ suite + lint + typecheck → PASS. Không được có snapshot/class nào của 33 màn cũ đổi.
- [ ] **Step 5: Ảnh** — không có (chưa màn nào dùng). Chạy `SHOTS=home,mission,words SHOTS_DIR=../current-phase14/shots node shoot.mjs phone` một lần làm **ảnh gốc so sánh** (chứng minh mặc định không đổi).
- [ ] **Step 6: Commit** — `feat(ui): header title/sub/align/onBand, body fade/gap, Button sm, EmptyState hero, Chip coralSolid, Stars 13/14`

---

### Task 2: `components/ui/list/` — `ListGrid`, `Tile`, `ListRow`, `StickyGroup`

**Files:**
- Create: `client/src/components/ui/list/ListGrid.tsx`, `client/src/components/ui/list/Tile.tsx`, `client/src/components/ui/list/ListRow.tsx`, `client/src/components/ui/list/StickyGroup.tsx`, `client/src/components/ui/list/index.ts`
- Modify: `client/src/components/ui/index.ts` (thêm `export * from './list'`)
- Test: `client/src/components/ui/list/list.test.tsx`

**Interfaces:**
- Consumes: `Chip` (`tone`, `size`, `className`), `Stars` (`value`, `size`), `Link` từ `react-router-dom`.
- Produces:
  - `<ListGrid size?: 'sm' | 'lg' (mặc định 'sm') className? children />` — `data-testid="list-grid"`.
  - `<Tile to size?: 'sm'|'lg' variant?: 'open'|'locked'|'accent' emoji? ipa? title? titleSize?: 15|17 sub? subTone?: 'ink'|'sand' chip?: { tone?: ChipTone; label: ReactNode } stars?: 0|1|2|3 ariaLabel? state? className? />` — `data-testid="tile"`. Ít nhất một trong `emoji`/`ipa`/`title` phải có.
  - `<ListRow to h: 64 | 96 title sub? disc?: { emoji: string; bg: string } stars?: 0|1|2|3 chevron?: boolean ariaLabel? state? className? />` — `data-testid="list-row"`.
  - `<StickyGroup emoji name count? pad?: 'tile' | 'row' (mặc định 'tile') children />` — `data-testid="sticky-group"` trên `<h2>`.

- [ ] **Step 1: Failing tests** (`list.test.tsx`, bọc trong `<MemoryRouter>`) — mỗi giá trị class của brief §1 có một assert:

```tsx
it('ListGrid sm is 3/5/6 columns, lg is 2/3/4, gap 8 phone / 12 iPad, no lg:', () => {
  const { rerender } = render(<MemoryRouter><ListGrid><i /></ListGrid></MemoryRouter>)
  expect(screen.getByTestId('list-grid')).toHaveClass('grid', 'grid-cols-3', 'gap-2', 'md:grid-cols-5', 'md:gap-3', 'ipad:grid-cols-6')
  rerender(<MemoryRouter><ListGrid size="lg"><i /></ListGrid></MemoryRouter>)
  expect(screen.getByTestId('list-grid')).toHaveClass('grid-cols-2', 'md:grid-cols-3', 'ipad:grid-cols-4')
  expect(screen.getByTestId('list-grid').className).not.toMatch(/\blg:/)
})
it('Tile sm: 110/136, emoji 40/56, word 15/19, chip 11, stars 13', () => {
  render(<MemoryRouter><Tile to="/x" emoji="🐘" title="elephant" chip={{ tone: 'sun', label: '🔓' }} stars={2} /></MemoryRouter>)
  const tile = screen.getByTestId('tile')
  expect(tile).toHaveClass('h-[110px]', 'gap-[5px]', 'rounded-r18', 'bg-white', 'shadow-card-sm', 'px-1.5', 'py-2', 'md:h-[136px]')
  expect(screen.getByText('🐘')).toHaveClass('text-[40px]', 'md:text-[56px]')
  expect(screen.getByText('elephant')).toHaveClass('font-display', 'text-[15px]', 'leading-[1.1]', 'md:text-[19px]')
  expect(screen.getByText('🔓')).toHaveClass('rounded-[9px]', 'px-2', 'py-0.5', 'text-[11px]', 'md:text-[13px]')
  expect(screen.getByTestId('stars')).toHaveClass('text-[13px]')
})
it('Tile lg: 128/160, title 17/20 two-line clamp, titleSize 15 for A14', () => {
  const { rerender } = render(<MemoryRouter><Tile to="/x" size="lg" title="I have a red ball." sub="Con có quả bóng đỏ." subTone="sand" /></MemoryRouter>)
  expect(screen.getByTestId('tile')).toHaveClass('h-[128px]', 'px-2', 'py-2.5', 'md:h-[160px]')
  expect(screen.getByText('I have a red ball.')).toHaveClass('text-[17px]', 'line-clamp-2', 'leading-[1.2]', 'md:text-[20px]')
  expect(screen.getByText('Con có quả bóng đỏ.')).toHaveClass('text-[12px]', 'text-sand-text', 'md:text-[15px]')
  rerender(<MemoryRouter><Tile to="/x" size="lg" titleSize={15} title="Wow!" /></MemoryRouter>)
  expect(screen.getByText('Wow!')).toHaveClass('text-[15px]', 'md:text-[19px]')
})
it('Tile ipa renders the 36px #C08457 glyph and an ink sub', () => {
  render(<MemoryRouter><Tile to="/x" ipa="/θ/" sub="three" /></MemoryRouter>)
  expect(screen.getByText('/θ/')).toHaveClass('font-display', 'text-[36px]', 'text-[#C08457]', 'md:text-[45px]')
  expect(screen.getByText('three')).toHaveClass('text-[14px]', 'text-ink-500', 'md:text-[17px]')
})
it('Tile locked and accent variants', () => {
  const { rerender } = render(<MemoryRouter><Tile to="/x" variant="locked" emoji="🔒" title="Đồ chơi" chip={{ label: 'Chưa mở khoá' }} /></MemoryRouter>)
  expect(screen.getByTestId('tile')).toHaveClass('bg-sand', 'opacity-85', 'shadow-[0_5px_0_#E2D5C0]')
  expect(screen.getByText('Đồ chơi')).toHaveClass('text-sand-text')
  rerender(<MemoryRouter><Tile to="/words/review" variant="accent" emoji="📚" title="Ôn tập" chip={{ tone: 'coralSolid', label: '12 từ hôm nay' }} /></MemoryRouter>)
  expect(screen.getByTestId('tile')).toHaveClass('bg-sun-50', 'shadow-[0_5px_0_#EFDDA8]')
  expect(screen.getByText('12 từ hôm nay')).toHaveClass('bg-coral-500', 'text-white')
})
it('ListRow 64 truncates one line and pins 13px stars right', () => {
  render(<MemoryRouter><ListRow to="/sentence/s1" h={64} title="Chị của con có một con búp bê em bé." stars={1} /></MemoryRouter>)
  expect(screen.getByTestId('list-row')).toHaveClass('min-h-[64px]', 'rounded-r16', 'px-3.5', 'gap-2.5', 'shadow-card-xs')
  expect(screen.getByText(/búp bê/)).toHaveClass('truncate', 'font-display', 'text-[16px]', 'md:text-[19px]')
  expect(screen.getByTestId('stars')).toHaveClass('text-[13px]')
})
it('ListRow 96 draws the 64px disc, name, sub, stars and chevron', () => {
  render(<MemoryRouter><ListRow to="/story/little-fox" h={96} disc={{ emoji: '🦊', bg: 'bg-[#FFE7D2]' }} title="The Little Fox" sub="Chú cáo nhỏ · 4 cảnh" stars={3} chevron /></MemoryRouter>)
  expect(screen.getByTestId('list-row')).toHaveClass('min-h-[96px]', 'rounded-r20', 'px-4', 'gap-3.5', 'shadow-[0_6px_0_#EFE2CC]')
  expect(screen.getByText('🦊')).toHaveClass('h-16', 'w-16', 'rounded-r18', 'text-[38px]', 'bg-[#FFE7D2]')
  expect(screen.getByText('The Little Fox')).toHaveClass('text-[19px]', 'md:text-[23px]')
  expect(screen.getByText('Chú cáo nhỏ · 4 cảnh')).toHaveClass('text-[13px]', 'text-ink-500', 'md:text-[15px]')
  expect(screen.getByText('▸')).toHaveClass('text-[22px]', 'text-ink-300')
})
it('StickyGroup pins its H2 to the top of the scroller, with an optional count tail', () => {
  const { rerender } = render(<StickyGroup emoji="🐘" name="Động vật" count="8 từ"><i /></StickyGroup>)
  const h2 = screen.getByTestId('sticky-group')
  expect(h2).toHaveClass('sticky', 'top-0', 'z-10', 'bg-cream-50', 'text-[15px]', 'px-0.5', 'py-1', 'md:text-[17px]')
  expect(screen.getByText('· 8 từ')).toHaveClass('text-[12px]', 'text-ink-300', 'md:text-[13px]')
  rerender(<StickyGroup emoji="👨‍👩‍👧" name="Gia đình" pad="row"><i /></StickyGroup>)
  expect(screen.getByTestId('sticky-group')).toHaveClass('px-0.5', 'pb-0.5', 'pt-1.5')
  expect(screen.queryByText(/^·/)).toBeNull()
})
```

- [ ] **Step 2: Run** `pnpm --filter client exec vitest run src/components/ui/list` → FAIL.

- [ ] **Step 3: Implement** — bốn file, mỗi giá trị lấy từ brief §1 và quyết định 15 (iPad dọc = phone ×1.25 với 5/3 cột; iPad ngang = iPad dọc với 6/4 cột).

```tsx
// ListGrid.tsx — R1/R4. Hàng lẻ căn trái tự nhiên vì track là `1fr` và ô không stretch ngang.
const SIZE = {
  sm: 'grid-cols-3 gap-2 md:grid-cols-5 md:gap-3 ipad:grid-cols-6',
  lg: 'grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 ipad:grid-cols-4',
} as const
export function ListGrid({ size = 'sm', className = '', children }: { size?: keyof typeof SIZE; className?: string; children: ReactNode }) {
  return <div data-testid="list-grid" className={`grid ${SIZE[size]} ${className}`}>{children}</div>
}
```

```tsx
// Tile.tsx — R1/R5/R10. `titleSize` chỉ có nghĩa với size='lg' (A14 dùng 15).
const BOX = { sm: 'h-[110px] gap-[5px] px-1.5 py-2 md:h-[136px]', lg: 'h-[128px] gap-[5px] px-2 py-2.5 md:h-[160px]' }
const SURFACE = {
  open: 'bg-white shadow-card-sm',
  locked: 'bg-sand opacity-85 shadow-[0_5px_0_#E2D5C0]',
  accent: 'bg-sun-50 shadow-[0_5px_0_#EFDDA8]',
}
const TITLE = {
  sm: 'font-display text-[15px] font-extrabold leading-[1.1] md:text-[19px]',
  17: 'font-display text-[17px] font-extrabold leading-[1.2] line-clamp-2 md:text-[20px]',
  15: 'font-display text-[15px] font-extrabold leading-[1.2] line-clamp-2 md:text-[19px]',
}
const SUB = { ink: 'text-[14px] font-bold text-ink-500 md:text-[17px]', sand: 'text-[12px] font-bold text-sand-text md:text-[15px]' }
```
Thân: `<Link to={to} state={state} aria-label={ariaLabel} data-testid="tile" className={'flex flex-col items-center justify-center rounded-r18 text-center transition-transform active:translate-y-[2px] ' + BOX[size] + ' ' + SURFACE[variant] + ' ' + className}>` rồi lần lượt:
`emoji` → `<span aria-hidden="true" className={size === 'sm' ? 'text-[40px] leading-none md:text-[56px]' : 'text-[28px] leading-none md:text-[34px]'}>`;
`ipa` → `<span className="font-display text-[36px] font-extrabold leading-none text-[#C08457] md:text-[45px]">` (36 × 1.25 theo quyết định 15);
`title` → `<span className={TITLE[size === 'sm' ? 'sm' : (titleSize ?? 17)] + (variant === 'locked' ? ' text-sand-text' : ' text-ink-900')}>`;
`sub` → `<span className={SUB[subTone ?? 'ink']}>`;
`chip` → `<Chip tone={chip.tone ?? 'neutral'} size="sm" className="rounded-[9px] px-2 py-0.5 text-[11px] leading-tight md:text-[13px]">{chip.label}</Chip>`;
`stars !== undefined` → `<Stars value={stars} size="13" className="md:text-[14px]" />`.

```tsx
// ListRow.tsx — R8/R9. 96 cho truyện, 64 cho câu; không có 72 (quyết định 29).
const H = {
  64: 'min-h-[64px] gap-2.5 rounded-r16 px-3.5 shadow-card-xs',
  96: 'min-h-[96px] gap-3.5 rounded-r20 px-4 shadow-[0_6px_0_#EFE2CC]',
}
```
Thân: `<Link … data-testid="list-row" className={'flex w-full items-center bg-white transition-transform active:translate-y-[2px] ' + H[h] + ' ' + className}>`;
`disc` → `<span aria-hidden="true" className={'flex h-16 w-16 shrink-0 items-center justify-center rounded-r18 text-[38px] leading-none ' + disc.bg}>`;
khối chữ `<span className="flex min-w-0 flex-1 flex-col">`: `title` `truncate font-display text-[16px] font-extrabold text-ink-900 md:text-[19px]` khi `h===64`, `truncate font-display text-[19px] font-extrabold text-ink-900 md:text-[23px]` khi `h===96`; `sub` `truncate text-[13px] font-bold text-ink-500 md:text-[15px]`;
`stars` → `<Stars value={stars} size="13" className="ml-auto shrink-0 md:text-[14px]" />`;
`chevron` → `<span aria-hidden="true" className="shrink-0 font-display text-[22px] leading-none text-ink-300">▸</span>`.

```tsx
// StickyGroup.tsx — R6. Nền = nền trang, nếu không chữ dưới sẽ hiện xuyên qua khi cuộn.
const PAD = { tile: 'px-0.5 py-1', row: 'px-0.5 pb-0.5 pt-1.5' }
export function StickyGroup({ emoji, name, count, pad = 'tile', children }: { emoji: string; name: string; count?: ReactNode; pad?: 'tile' | 'row'; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 md:gap-3">
      <h2 data-testid="sticky-group" className={`sticky top-0 z-10 flex items-center gap-2 bg-cream-50 font-display text-[15px] font-extrabold text-ink-500 md:text-[17px] ${PAD[pad]}`}>
        <span aria-hidden="true">{emoji}</span>
        <span className="truncate">{name}</span>
        {count !== undefined && <span className="shrink-0 font-sans text-[12px] font-bold text-ink-300 md:text-[13px]">· {count}</span>}
      </h2>
      {children}
    </section>
  )
}
```

`list/index.ts` re-export cả bốn + type; `ui/index.ts` thêm `export * from './list'` (giữ nguyên `export { CARD_LINK }` đến Task 7).

- [ ] **Step 4: Run** `vitest run src/components/ui` + lint + typecheck → PASS.
- [ ] **Step 5: Commit** — `feat(ui): ListGrid, Tile, ListRow, StickyGroup — the shared list frame`

---

### Task 3: C6 WordList (màn tham chiếu) + `shoot.mjs` `words-review` seed 64 ô

**Files:**
- Modify: `client/src/screens/WordList.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/WordList.test.tsx`

**Interfaces:**
- Consumes: `PageHeader title/sub`, `PageBody fade gap`, `ListGrid size='sm'`, `Tile` (`emoji`, `title`, `chip`), `StickyGroup`, `findTopic`/`findWord`/`TOPICS` từ `content/words`, `getBox`/`dueWords` từ `progress/leitner`.
- Produces: không có API mới. Route và `data-testid` không đổi.

- [ ] **Step 1: Failing tests**

```tsx
it('a topic list is a 3-column small-tile grid with a counted subtitle and no lg:', () => {
  renderList('food')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('🍎 Đồ ăn')
  expect(screen.getByText('8 từ · chạm để học')).toBeInTheDocument()
  expect(screen.getByTestId('list-grid')).toHaveClass('grid-cols-3', 'md:grid-cols-5', 'ipad:grid-cols-6')
  expect(screen.getAllByTestId('tile')).toHaveLength(8)
  expect(screen.getByTestId('page-body')).toHaveClass('gap-2.5', 'after:sticky')
  expect(screen.queryAllByTestId('sticky-group')).toHaveLength(0)
})
it('a word tile shows emoji, word and the lock chip, never stars', () => {
  promote('food-apple'); renderList('food')
  const tile = screen.getByRole('link', { name: /apple/ })
  expect(tile).toHaveClass('h-[110px]', 'md:h-[136px]')
  expect(screen.getAllByText('🔓')).toHaveLength(1)
  expect(screen.getAllByText('🔒')).toHaveLength(7)
  expect(screen.queryByTestId('stars')).toBeNull()
})
it('the review deck groups due words by topic in TOPICS order, with sticky H2s', () => {
  promote('food-apple'); promote('animals-elephant'); promote('animals-giraffe')
  renderList('review')
  expect(screen.getByText('64 từ · chạm để ôn')).toBeUndefined // thay bằng số thật:
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('📚 Ôn tập hôm nay')
  expect(screen.getByText('3 từ · chạm để ôn')).toBeInTheDocument()
  const groups = screen.getAllByTestId('sticky-group')
  expect(groups.map(h => h.textContent)).toEqual(['🐘Động vật· 2 từ', '🍎Đồ ăn· 1 từ'])
  expect(groups[0]).toHaveClass('sticky', 'top-0', 'bg-cream-50')
})
it('the empty state exists only on the review deck', () => {
  renderList('review')
  expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  cleanup(); renderList('food')
  expect(screen.queryByTestId('empty-state')).toBeNull()
})
it('back and not-found are unchanged', () => { /* giữ nguyên 2 test cũ */ })
```
(Ba dòng `promote()` cần `due <= now`; `promote` đặt `due` sang mai ⇒ trong test phải ghi thẳng `localStorage` key `speakup.leitner` với `due: Date.now() - 1000`, hoặc gọi `promote(id, Date.now() - 2 * 24 * 3600e3)`. Dùng cách thứ hai — `promote` nhận `now`.)

- [ ] **Step 2: Run** `vitest run src/screens/WordList` → FAIL.

- [ ] **Step 3: Implement**

Header: `<PageHeader back={…giữ nguyên…} title={isReview ? '📚 Ôn tập hôm nay' : `${t!.emoji} ${t!.title}`} sub={`${words.length} từ · ${isReview ? 'chạm để ôn' : 'chạm để học'}`} />`. Ô phải để mặc định (`LessonChip`, quyết định 8 — **không** truyền `right={null}`).

Thân: `<PageBody fade gap={10}>`.
- Không review: một `<ListGrid size="sm">` phẳng.
- Review (R6): gom trước khi vẽ, theo thứ tự `TOPICS` của `content/words`:
```tsx
const grouped = TOPICS
  .map(t => ({ t, words: words.filter(w => w.topic === t.id) }))
  .filter(g => g.words.length > 0)
```
rồi mỗi nhóm `<StickyGroup key={t.id} emoji={t.emoji} name={t.title} count={`${g.words.length} từ`}><ListGrid size="sm">…</ListGrid></StickyGroup>`, bọc trong `<div className="flex flex-col gap-3 md:gap-4">`.
- Ô: `<Tile key={w.id} to={`/words/${topic}/${w.id}`} ariaLabel={w.word} emoji={w.emoji} title={w.word} chip={{ tone: unlocked ? 'sun' : 'neutral', label: unlocked ? '🔓' : '🔒' }} />` — **không `stars`** (quyết định 9: màn này vẽ chip khoá; sao là của A10).
- `EmptyState` chỉ ở nhánh review, giữ nguyên copy + `cta` hiện có.

`shoot.mjs` — thêm ngay **sau** `words-review-empty` (dòng 215), có `WANT` gate để một lần chạy đầy đủ không tốn 9 lần điều hướng thừa:
```js
  // Task 3: trường hợp xấu nhất của cả khung danh sách — 64 ô ôn tập, 8 nhóm H2 dính. Id từ được
  // thu từ chính app (href của 8 màn chủ đề) thay vì hard-code, để danh sách không mục ruỗng khi
  // content đổi.
  async function seedReviewDeck() {
    await go(page, '/words')
    const topics = await page.$$eval('a[href^="/words/"]', as => as
      .map(a => a.getAttribute('href').split('/')[2]).filter(t => t && t !== 'review'))
    const ids = []
    for (const t of topics) {
      await go(page, `/words/${t}`)
      ids.push(...await page.$$eval(`a[href^="/words/${t}/"]`, as => as.map(a => a.getAttribute('href').split('/')[3])))
    }
    await page.evaluate(ids => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      const due = Date.now() - 24 * 3600e3
      localStorage.setItem(pre + 'leitner', JSON.stringify(Object.fromEntries(ids.map(w => [w, { box: 1, due }]))))
    }, ids)
    return ids.length
  }
  if (!WANT || WANT.includes('words-review')) {
    const n = await seedReviewDeck()
    log(`   words-review: seeded ${n} due words`)
    await S('words-review', '/words/review')
    // Trả trạng thái về seed chuẩn: deck ôn tập rỗng là tiền đề của mọi ảnh sau nó.
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      localStorage.removeItem((id ? `speakup.${id}.` : 'speakup.') + 'leitner')
    })
  }
```

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=words-animals,words-review SHOTS_DIR=../current-phase14/shots node shoot.mjs` (cả 3 frame) + `VIEWPORTS=short SHOTS=words-review node shoot.mjs`. **`phone/words-animals-full.png` phải biến mất**; `words-review` được phép có `-full` (64 ô ≈ 3050px là thiết kế), báo lại con số `scrollHeight` ở cả 4 frame và xác nhận ô ở 375 vẫn ≥ emoji 40 + 2 dòng (quyết định 28).
- [ ] **Step 6: Commit** — `feat(words): C6 list frame, review grouped by topic, 64-tile shoot case`

---

### Task 4: C1 StoryList (hàng 96 + Foxy lấp chỗ) và C8 SentenceList (hàng 64, H2 dính, 2 cột iPad)

**Files:**
- Modify: `client/src/screens/StoryList.tsx`, `client/src/screens/SentenceList.tsx`
- Test: `client/src/screens/StoryList.test.tsx`, `client/src/screens/SentenceList.test.tsx`

**Interfaces:**
- Consumes: `ListRow` (`h=96` / `h=64`), `Tile size='sm'`, `StickyGroup pad='row'`, `PageHeader title/sub`, `PageBody fade gap`, `Foxy` (`mood='idle'`, class `animate-bob`), `STORIES`, `SENTENCES`, `TOPICS`/`findTopic` (`content/topics`), `getStars`, `topicUnlocked`.
- Produces: không có API mới. `ROW` (hằng cũ trong `SentenceList.tsx`) bị xoá.

- [ ] **Step 1: Failing tests**

```tsx
// StoryList.test.tsx
it('phone: three 96px rows with a coloured disc, then Foxy filling the slack', () => {
  render(<MemoryRouter><StoryList /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('🎧 Nghe kể chuyện')
  expect(screen.getByText('3 truyện · nghe rồi làm quiz')).toBeInTheDocument()
  const rows = screen.getAllByTestId('list-row')
  expect(rows).toHaveLength(3)
  expect(rows[0]).toHaveClass('min-h-[96px]', 'rounded-r20', 'shadow-[0_6px_0_#EFE2CC]')
  expect(rows[0]).toHaveAttribute('href', '/story/little-fox')
  expect(screen.getByText('🦊')).toHaveClass('bg-[#FFE7D2]')
  expect(screen.getByTestId('story-filler')).toHaveClass('flex-1', 'md:hidden')
  expect(screen.getByTestId('foxy')).toBeInTheDocument()
})
it('iPad: three centred small tiles instead of rows, never stretched', () => {
  render(<MemoryRouter><StoryList /></MemoryRouter>)
  expect(screen.getByTestId('story-tiles')).toHaveClass('hidden', 'md:grid', 'md:grid-cols-[repeat(3,200px)]', 'md:justify-center', 'md:gap-3')
  expect(screen.getAllByTestId('tile')).toHaveLength(3)
  expect(screen.getByTestId('list-row').parentElement).toHaveClass('md:hidden')
})
it('the right header cell keeps its default LessonChip slot', () => {
  render(<MemoryRouter><StoryList /></MemoryRouter>)
  expect(screen.getByTestId('header-right')).toBeInTheDocument()
})

// SentenceList.test.tsx
it('unfiltered: sticky topic groups of 64px truncating rows, two columns on iPad', () => {
  render(…'/sentences'…)
  expect(screen.getByText(/^32 câu · \d+ chủ đề$/)).toBeInTheDocument()
  expect(screen.getByTestId('sentence-groups')).toHaveClass('md:grid', 'md:grid-cols-2', 'md:items-start', 'md:gap-3')
  const h2 = screen.getAllByTestId('sticky-group')[0]
  expect(h2).toHaveClass('sticky', 'top-0', 'z-10', 'bg-cream-50', 'pt-1.5')
  expect(h2.textContent).not.toMatch(/·/)          // C8: không có đuôi đếm
  const row = screen.getAllByTestId('list-row')[0]
  expect(row).toHaveClass('min-h-[64px]', 'rounded-r16', 'shadow-card-xs')
  expect(row.querySelector('.truncate')).toHaveClass('text-[16px]')
  expect(screen.getAllByTestId('stars')[0]).toHaveClass('text-[13px]')
})
it('a valid ?topic= filter drops the H2s and names the topic in the subtitle', () => {
  render(…'/sentences?topic=family'…)
  expect(screen.queryAllByTestId('sticky-group')).toHaveLength(0)
  expect(screen.getByText('4 câu · Gia đình')).toBeInTheDocument()
  expect(screen.getAllByTestId('list-row')[0]).toHaveAttribute('href', '/sentence/s12?topic=family')
})
it('an unknown ?topic= is no filter at all', () => {
  render(…'/sentences?topic=nope'…)
  expect(screen.getAllByTestId('sticky-group').length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`StoryList.tsx`:
```tsx
// brief §2 C1: nền đĩa theo truyện. Chưa có token cho ba hex nền — chúng là màu của truyện,
// không phải vai trò trong hệ thống.
const DISC: Record<string, string> = { 'little-fox': 'bg-[#FFE7D2]', 'at-the-zoo': 'bg-sun-50', 'my-breakfast': 'bg-teal-50' }
```
Header: `title="🎧 Nghe kể chuyện"`, `sub={`${STORIES.length} truyện · nghe rồi làm quiz`}`, back `to="/" label="Về nhà"` (giữ).
Thân `<PageBody fade gap={8}>`:
- `<div className="flex flex-col gap-2 md:hidden">` → `ListRow h={96} disc={{ emoji: s.emoji, bg: DISC[s.id] ?? 'bg-cream-50' }} title={s.title} sub={`${s.titleVi} · ${s.scenes.length} cảnh`} stars={getStars(`story:${s.id}`)} chevron ariaLabel={s.title}`.
- `<div data-testid="story-filler" className="flex flex-1 flex-col items-center justify-center gap-2 md:hidden">` → `<Foxy mood="idle" size="md" className="animate-bob [&_svg]:h-[93px] [&_svg]:w-[96px]" />` + `<p className="text-[14px] font-bold text-ink-500">Nghe truyện xong thì làm quiz nhé! 🦊</p>` (design chỉ ghi chú "Foxy lấp chỗ trống", không cho câu chữ dành cho trẻ → câu này là copy đề xuất, ghi vào Ruling ở Task 16).
- `<div data-testid="story-tiles" className="hidden md:grid md:grid-cols-[repeat(3,200px)] md:justify-center md:gap-3">` → `Tile size="sm"` emoji/title/stars. **Không dùng `ListGrid`** ở đây: 3 truyện trên track 5/6 cột sẽ nằm dạt trái; brief §2 C1 nói rõ "3 cột **căn giữa**, không kéo rộng" — cùng ngoại lệ B2 đã mang từ Phase 13.

`SentenceList.tsx`: xoá hằng `ROW`; header `title="🧱 Ghép câu"`, `sub={topic ? `${list.length} câu · ${topic.name}` : `${SENTENCES.length} câu · ${shown.length} chủ đề`}`; thân `<PageBody fade gap={8}><div data-testid="sentence-groups" className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start md:gap-3">`; mỗi chủ đề: khi lọc thì render thẳng danh sách hàng, khi không thì bọc `StickyGroup pad="row" emoji={t.emoji} name={t.name}` (không `count`). Hàng: `ListRow h={64} title={s.vi} stars={getStars(`sentence:${s.id}`)} to={topic ? `/sentence/${s.id}?topic=${topic.id}` : `/sentence/${s.id}`}` (giữ nguyên luật `?topic=` truyền tiếp của Phase 12). Back giữ nguyên.

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=stories,sentences,sentences-topic` × 3 frame (`stories` và `sentences-topic` đã có sẵn trong `shoot.mjs`, không thêm entry). **`phone/sentences-full.png`, `ipad/sentences-full.png`, `ipadp/sentences-full.png` phải biến mất hoặc tụt về ≈2400/1200px**; `stories` không được có `-full` ở frame nào.
- [ ] **Step 6: Commit** — `feat(lists): C1 story rows with Foxy filler, C8 sticky 64px sentence rows`

---

### Task 5: C5 WordTopics + A10 LevelSelect + A11 SoundLevel (ô nhỏ)

**Files:**
- Modify: `client/src/screens/WordTopics.tsx`, `client/src/screens/LevelSelect.tsx`, `client/src/screens/SoundLevel.tsx`
- Test: `client/src/screens/WordTopics.test.tsx`, `client/src/screens/LevelSelect.test.tsx`, `client/src/screens/SoundLevel.test.tsx`

**Interfaces:**
- Consumes: `ListGrid size='sm'`, `Tile` (`variant='accent'`, `chip.tone='coralSolid'`, `ipa`, `sub`, `stars`), `PageHeader title/sub`, `PageBody fade gap`, `dueWords`/`getBox`, `LEVELS`, `SOUNDS`, `soundStars`.
- Produces: hằng `STAIRS_LINK` trong `LevelSelect.tsx` bị **xoá**; nhánh chuyển hướng `sound-zoo → SoundLevel` và `NotFound` giữ nguyên.

- [ ] **Step 1: Failing tests**

```tsx
// WordTopics.test.tsx
it('the review tile is the accent tile with a solid-coral count chip', () => {
  renderTopics()
  const tile = screen.getByRole('link', { name: /Ôn tập/ })
  expect(tile).toHaveClass('bg-sun-50', 'shadow-[0_5px_0_#EFDDA8]')
  expect(screen.getByText('0 từ hôm nay')).toBeUndefined  // 0 từ đổi copy:
  expect(screen.getByText('Chưa có từ ôn')).toHaveClass('bg-cream-50', 'text-ink-500')
  expect(tile).toHaveAttribute('href', '/words/review')   // vẫn bấm được
})
it('with due words the chip is coralSolid', () => {
  promote('food-apple', Date.now() - 2 * 24 * 3600e3); renderTopics()
  expect(screen.getByText('1 từ hôm nay')).toHaveClass('bg-coral-500', 'text-white')
})
it('a topic tile carries a "n/8 mở" sun chip and the subtitle moved into the header', () => {
  renderTopics()
  expect(screen.getByText(/^\d+ chủ đề đã mở · chạm để học$/)).toBeInTheDocument()
  expect(screen.queryByText('Chạm thẻ để lật — nói đúng để mở khoá!')).toBeNull()
  expect(screen.getAllByText('0/8 mở')[0]).toHaveClass('text-[11px]', 'md:text-[13px]')
  expect(screen.getByTestId('list-grid')).toHaveClass('grid-cols-3', 'md:grid-cols-5', 'ipad:grid-cols-6')
})

// LevelSelect.test.tsx
it('back goes to the stairs and the "Xem các bậc" pill is gone', () => {
  renderLevel('word-pop')
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
  expect(screen.queryByText('🗣️ Xem các bậc')).toBeNull()
})
it('12 small tiles with emoji + word + stars, no lg:', () => {
  renderLevel('word-pop')
  expect(screen.getByText('Chạm vào một thẻ để luyện nói nhé!')).toBeInTheDocument()
  expect(screen.getAllByTestId('tile')).toHaveLength(12)
  expect(screen.getByTestId('list-grid').className).not.toMatch(/\blg:/)
  expect(screen.getAllByTestId('stars')[0]).toHaveClass('text-[13px]')
})

// SoundLevel.test.tsx
it('9 IPA tiles: 36px #C08457 glyph, example word 14px, stars', () => {
  renderSounds()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tập âm 🦁')
  expect(screen.getByText('Mỗi ô là một âm — luyện đến khi cả 3 từ đều xanh!')).toBeInTheDocument()
  expect(screen.getAllByTestId('tile')).toHaveLength(9)
  expect(screen.getByText('/θ/')).toHaveClass('text-[36px]', 'text-[#C08457]')
  expect(screen.getByText('three')).toHaveClass('text-[14px]', 'text-ink-500')
  expect(screen.queryByText('min-h-[168px]')).toBeNull()
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`WordTopics.tsx`: header `title="Từ mới hôm nay 🧩"`, `sub={`${topics.length} chủ đề đã mở · chạm để học`}`; xoá dòng `<p>` giữa thân; `<PageBody fade gap={10}><ListGrid size="sm">`; ô đầu
`<Tile to="/words/review" variant="accent" emoji="📚" title="Ôn tập" ariaLabel="Ôn tập hôm nay" chip={dueCount > 0 ? { tone: 'coralSolid', label: `${dueCount} từ hôm nay` } : { tone: 'neutral', label: 'Chưa có từ ôn' }} />`;
ô chủ đề `<Tile to={`/words/${t.id}`} emoji={t.emoji} title={t.title} chip={{ tone: 'sun', label: `${unlocked}/${t.words.length} mở` }} />`. Chủ đề khoá **vắng mặt** như hôm nay (quyết định 12) — không dựng nhánh ô khoá.

`LevelSelect.tsx`: xoá `STAIRS_LINK` + `<Link to="/levels">` + `<p>`; back `<BackButton to="/levels" label="Các bậc" />` (bỏ `mdLabel`, đây là 1 trong 6 call-site của R14 và nó biến mất luôn); header `title={level.title}` `sub="Chạm vào một thẻ để luyện nói nhé!"`; thân `<PageBody fade gap={10}><ListGrid size="sm">` với `Tile emoji={c.emoji} title={c.text} stars={getStars(c.id)} to={`/practice/${c.id}`}`.

`SoundLevel.tsx`: header `title="Tập âm 🦁"` `sub="Mỗi ô là một âm — luyện đến khi cả 3 từ đều xanh!"`; thân `<PageBody fade gap={10}><ListGrid size="sm">` với `Tile ipa={`/${s.ipa}/`} sub={s.example} stars={soundStars(s.ph)} ariaLabel={`Âm ${s.ipa}, ví dụ ${s.example}`} to={`/sound/${s.ph}`}` — bỏ `min-h-[168px]`.

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=words,level-word-pop,level-sound-zoo` × 3 frame. **`phone/words-full.png`, `phone/level-word-pop-full.png`, `phone/level-sound-zoo-full.png` phải biến mất.**
- [ ] **Step 6: Commit** — `feat(lists): C5 topics, A10 word cards, A11 sound tiles on the shared grid`

---

### Task 6: A12 PairLevel + A13 StarLevel + A14 VoiceLevel (ô lớn)

**Files:**
- Modify: `client/src/screens/PairLevel.tsx`, `client/src/screens/StarLevel.tsx`, `client/src/screens/VoiceLevel.tsx`
- Test: `client/src/screens/PairLevel.test.tsx`, `client/src/screens/StarLevel.test.tsx`, `client/src/screens/VoiceLevel.test.tsx`

**Interfaces:**
- Consumes: `ListGrid size='lg'`, `Tile size='lg'` (`titleSize`, `sub`, `subTone`, `chip`, `stars`), `PageHeader title/sub`, `PageBody fade gap`, `PAIRS`, `SENTENCE_STARS`, `STORY_VOICE`, `getStars`.
- Produces: không có API mới; `firstSentence` trong `VoiceLevel.tsx` giữ nguyên.

- [ ] **Step 1: Failing tests**

```tsx
// PairLevel.test.tsx
it('8 large tiles, one line per pair, teal contrast chip, no lg:', () => {
  renderPairs()
  expect(screen.getByText('Nghe rồi chọn từ đúng — tai tinh, miệng chuẩn!')).toBeInTheDocument()
  expect(screen.getByTestId('list-grid')).toHaveClass('grid-cols-2', 'md:grid-cols-3', 'ipad:grid-cols-4')
  expect(screen.getByTestId('list-grid').className).not.toMatch(/\blg:/)
  const tiles = screen.getAllByTestId('tile')
  expect(tiles).toHaveLength(8)
  expect(tiles[0]).toHaveClass('h-[128px]', 'md:h-[160px]')
  expect(screen.getByText('🚢 ship · 🐑 sheep')).toHaveClass('text-[17px]', 'md:text-[20px]')
  expect(screen.getByText('ɪ / iː')).toHaveClass('bg-teal-50', 'text-[11px]')
})
// StarLevel.test.tsx
it('10 large tiles: EN sentence clamped to 2 lines over a 12px sand meaning', () => {
  renderStars()
  expect(screen.getAllByTestId('tile')).toHaveLength(10)
  const t = screen.getAllByTestId('tile')[0]
  expect(t.querySelector('.line-clamp-2')).toHaveClass('text-[17px]', 'leading-[1.2]')
  expect(screen.getByText(SENTENCE_STARS[0].vi)).toHaveClass('text-[12px]', 'text-sand-text')
})
// VoiceLevel.test.tsx
it('8 large tiles: 28px mood emoji, coral mood chip, 15px first sentence clamped', () => {
  renderVoice()
  expect(screen.getAllByTestId('tile')).toHaveLength(8)
  expect(screen.getByText(STORY_VOICE[0].emoji)).toHaveClass('text-[28px]', 'md:text-[34px]')
  expect(screen.getByText(STORY_VOICE[0].moodVi)).toHaveClass('bg-coral-50', 'text-[11px]')
  expect(screen.getByText(/^I can't believe/)).toHaveClass('text-[15px]', 'line-clamp-2', 'md:text-[19px]')
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — cả ba: back giữ `<BackButton to="/levels" label="Các bậc" />`, tiêu đề lên `title`, dòng `<p>` giữa thân lên `sub` (R3), thân `<PageBody fade gap={10}><ListGrid size="lg">`, xoá mọi `lg:` và `CARD_LINK`.
- A12: `<Tile size="lg" title={`${p.a.emoji} ${p.a.word} · ${p.b.emoji} ${p.b.word}`} chip={{ tone: 'teal', label: p.contrast }} stars={getStars(`pair:${p.id}`)} ariaLabel={`Cặp ${p.a.word} và ${p.b.word}`} to={`/pair/${p.id}`} />` — một dòng 17px, `line-clamp-2` của `TITLE[17]` là van an toàn.
- A13: `<Tile size="lg" title={s.text} sub={s.vi} subTone="sand" stars={getStars(`sstar:${s.id}`)} ariaLabel={`Câu ${i + 1}: ${s.text}`} to={`/star/${s.id}`} />`.
- A14: `<Tile size="lg" titleSize={15} emoji={v.emoji} chip={{ tone: 'coral', label: v.moodVi }} title={firstSentence(v.text)} stars={getStars(`voice:${v.id}`)} ariaLabel={`Đoạn ${i + 1}: ${v.moodVi}`} to={`/voice/${v.id}`} />`.

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=level-pairs,level-stars,level-voice` × 3 frame. **`phone/level-pairs-full.png`, `phone/level-stars-full.png`, `phone/level-voice-full.png`, `ipad/level-stars-full.png`, `ipad/level-voice-full.png` phải biến mất.**
- [ ] **Step 6: Commit** — `feat(levels): A12/A13/A14 on the large-tile grid`

---

### Task 7: B2 SoundWordList hạ cỡ ô, và xoá `cardLink.ts`

**Files:**
- Modify: `client/src/screens/SoundWordList.tsx`, `client/src/components/ui/index.ts`
- Delete: `client/src/components/ui/cardLink.ts`
- Test: `client/src/screens/SoundWordList.test.tsx`

**Interfaces:**
- Consumes: `Tile size='sm'` (với `className` giữ ô iPad 200×180 của Phase 13), `Stars size='13'`.
- Produces: `CARD_LINK` **không còn tồn tại** — `grep -rn "CARD_LINK\|cardLink" client/src` phải trả 0 dòng.

- [ ] **Step 1: Failing tests**

```tsx
it('the three word tiles are the standard small tile, 110 on a phone', () => {
  renderSoundList('th')
  const tiles = screen.getAllByTestId('tile')
  expect(tiles).toHaveLength(3)
  expect(tiles[0]).toHaveClass('h-[110px]', 'md:h-[180px]', 'md:w-[200px]')
  expect(screen.getByText('three')).toHaveClass('text-[15px]', 'md:text-[19px]')
  expect(screen.getAllByTestId('stars')[0]).toHaveClass('text-[13px]')
})
it('the centre header keeps its Phase 13 chip, not a title/sub header', () => {
  renderSoundList('th')
  expect(screen.getByText('Âm 1/9')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
})
it('SoundTier and the Foxy prompt are untouched', () => {
  renderSoundList('th')
  expect(screen.getByText('Chọn một từ để luyện nhé!')).toBeInTheDocument()
  expect(screen.getByText('Luyện đủ 3 từ để xanh cả âm!')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — trong `SoundWordList.tsx` đổi `<Link className="… min-h-[120px] … md:w-[200px] md:min-h-[180px]">` thành
`<Tile key={c.id} to={`/sound/${ph}/${c.id}`} state={mission ? MISSION_STATE : undefined} ariaLabel={`Từ ${c.text}`} emoji={c.emoji} title={c.text} sub={c.ipa} subTone="sand" stars={getStars(`sword:${c.id}`)} className="md:h-[180px] md:w-[200px]" />`
(`sub` `subTone="sand"` cho IPA 12px; ô giữ track `md:grid-cols-[repeat(3,200px)] md:justify-center` của Phase 13 — quyết định 14 chỉ đổi **cỡ**, không đổi header và không đổi lưới căn giữa). Chip "Âm n/9" ở ô giữa header **không đổi**.
Rồi xoá `client/src/components/ui/cardLink.ts` và dòng `export { CARD_LINK } from './cardLink'` trong `ui/index.ts`; chạy `grep -rn "CARD_LINK\|cardLink" client/src` → rỗng.

- [ ] **Step 4: Run** toàn bộ test + lint + typecheck + `pnpm --filter client build` → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=sound-list` × 3 frame.
- [ ] **Step 6: Commit** — `refactor(ui): B2 tiles on the standard size, delete CARD_LINK`

---

### Task 8: `HomeLabel`/`BackButton.mdLabel` `md:` → `ipad:`; `NoticeStack` dòng "+N" thành nút mở `Dialog`

**Files:**
- Modify: `client/src/components/ui/HomeLabel.tsx`, `client/src/components/ui/BackButton.tsx`, `client/src/components/ui/NoticeStack.tsx`
- Test: `client/src/components/ui/ui.test.tsx`, `client/src/screens/DailyMission.test.tsx`, `client/src/screens/MissionComplete.test.tsx`, `client/src/screens/LevelStairs.test.tsx`, `client/src/screens/StoryQuiz.test.tsx` (chỉ nếu assert dựa vào tiền tố `md:`)

**Interfaces:**
- Consumes: `DialogContext` (`client/src/components/ui/DialogContext.ts`) — dùng `useContext` trực tiếp, **không** `useDialog()` (hàm đó `throw` khi không có provider, và `NoticeStack` đang được render trần trong `ui.test.tsx`).
- Produces: `HomeLabel` và `BackButton.mdLabel` đổi mốc sang `ipad:` (tên prop `mdLabel` **giữ nguyên** — spec gọi nó bằng tên đó). `NoticeStack` không đổi chữ ký (`items`, `max = 2`, `className`, `adult`); dòng "+N" trở thành `<button>`.

- [ ] **Step 1: Failing tests**

```tsx
// ui.test.tsx
it('HomeLabel promises the map only on iPad landscape', () => {
  render(<HomeLabel />)
  expect(screen.getByText('Về trang chủ 🏠')).toHaveClass('ipad:hidden')
  expect(screen.getByText('Về bản đồ 🏝️')).toHaveClass('hidden', 'ipad:inline')
})
it('BackButton mdLabel follows the same breakpoint', () => {
  render(<MemoryRouter><BackButton to="/" label="Về trang chủ" mdLabel="Về bản đồ" /></MemoryRouter>)
  expect(screen.getByText('Về trang chủ')).toHaveClass('sr-only', 'ipad:hidden')
  expect(screen.getByText('Về bản đồ')).toHaveClass('sr-only', 'hidden', 'ipad:inline')
})
it('the "+N" row is a 44px button naming the first hidden banner, and opens a dialog listing the rest', async () => {
  render(<DialogProvider><NoticeStack items={[
    { kind: 'warn', title: 'Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!' },
    { kind: 'info', title: 'Liên kết email để giữ tiến độ của bé' },
    { kind: 'info', title: 'Thêm Speak Up vào Màn hình chính' },
  ]} /></DialogProvider>)
  const more = screen.getByRole('button', { name: '+1 thông báo (Thêm vào Màn hình chính) ▸' })
  expect(more).toHaveClass('min-h-[44px]', 'text-[12px]', 'font-extrabold', 'text-ink-500')
  fireEvent.click(more)
  expect(await screen.findByRole('dialog')).toHaveTextContent('Thêm Speak Up vào Màn hình chính')
})
it('no "+N" row at or under max, and the priority order is unchanged', () => {
  render(<NoticeStack items={[{ kind: 'info', title: 'a' }, { kind: 'error', title: 'b' }]} />)
  expect(screen.queryByRole('button', { name: /thông báo/ })).toBeNull()
  expect(screen.getAllByRole('status')[0]).toHaveTextContent('b')
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`HomeLabel.tsx`: `md:hidden` → `ipad:hidden`; `hidden md:inline` → `hidden ipad:inline`. Cập nhật khối chú thích: mốc bây giờ là "Home là bản đồ thật" (iPad **ngang**), không phải "≥768".
`BackButton.tsx`: hai `<span className="sr-only md:hidden">` / `sr-only hidden md:inline` → `ipad:hidden` / `hidden ipad:inline`; sửa docblock tương ứng.
Năm call-site còn lại sau Task 5 (`LevelSelect` đã bỏ `mdLabel`): `DailyMission.tsx:112` (`mdLabel`), `DailyMission.tsx:193` (`HomeLabel`), `MissionComplete.tsx:58`, `LevelStairs.tsx:113`, `StoryQuiz.tsx:110`. Không file nào cần sửa — chúng chỉ dùng component. Trong jsdom **cả hai span đều nằm trong cây** (không có CSS), nên mọi assert `getByRole('link', { name })` hiện có vẫn xanh; nếu một test nào đó assert chuỗi class `md:` thì đổi sang `ipad:`.

`NoticeStack.tsx`:
```tsx
const dialog = useContext(DialogContext)
const hidden = sorted.slice(max)
// …
{hidden.length > 0 && (
  <button
    type="button"
    onClick={() => { void dialog?.confirm({
      title: 'Thông báo khác',
      body: hidden.map(n => `• ${n.title}`).join('\n'),
      confirmLabel: 'Đã hiểu',
      cancelLabel: 'Đóng',
    }) }}
    className="min-h-[44px] text-center text-[12px] font-extrabold text-ink-500"
  >
    +{hidden.length} thông báo ({hidden[0].title}) ▸
  </button>
)}
```
(`Dialog` của Phase 12 luôn vẽ hai nút; đó là chi phí của việc dùng lại nó thay vì đẻ một bottom-sheet mới — ghi Ruling ở Task 16. `dialog?.` để component vẫn render được ngoài `DialogProvider`; app thật luôn có provider ở `main.tsx:35`.)

- [ ] **Step 4: Run** toàn bộ test + lint + typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=mission,mission-done,levels` × 3 frame (kiểm nhãn "Về trang chủ 🏠" ở **iPad dọc** và "Về bản đồ 🏝️" chỉ ở iPad ngang).
- [ ] **Step 6: Commit** — `feat(nav): map wording only on iPad landscape; NoticeStack "+N" opens a dialog`

---

### Task 9: A3 Home — lưới đảo 3 cột ở iPad dọc, Speak Lab là ô thứ 9, cụm streak lên header

**Files:**
- Modify: `client/src/screens/Home.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/Home.test.tsx`

**Interfaces:**
- Consumes: `PageHeader right`, `StreakWeek`, `MissionCard`, `Chip`, `StarRow`.
- Produces: không có API mới. `ISLAND_BOX` đổi `h-32 md:h-40` → `h-[110px] md:h-[150px]`.

- [ ] **Step 1: Failing tests**

```tsx
it('iPad portrait lays the islands out three to a row with equal rows', () => {
  renderHome()
  expect(screen.getByTestId('island-animals').parentElement?.parentElement)
    .toHaveClass('grid-cols-2', 'md:grid-cols-3', 'md:auto-rows-fr', 'ipad:block')
})
it('phone islands drop to 110 so two rows survive two banners', () => {
  renderHome()
  expect(screen.getByTestId('island-animals')).toHaveClass('h-[110px]', 'md:h-[150px]')
})
it('Speak Lab is the ninth grid cell from md up and the parent button leaves the foot row', () => {
  renderHome()
  const lab = screen.getByRole('link', { name: '🗣️ Các bậc luyện nói' })
  expect(lab.parentElement).toHaveClass('md:h-[150px]', 'ipad:absolute')
  expect(screen.getByTestId('home-foot')).toHaveClass('md:contents', 'ipad:contents')
  expect(screen.getByTestId('home-foot-parent')).toHaveClass('md:hidden')
})
it('streak, star total and the parent button move into the header from md up', () => {
  renderHome()
  const right = screen.getByTestId('header-right')
  expect(right).toHaveTextContent('⭐')
  expect(within(right).getByRole('button', { name: 'Tuần này của con' })).toBeInTheDocument()
  expect(within(right).getByRole('link', { name: 'Phụ huynh' })).toBeInTheDocument()
  expect(screen.getByTestId('home-streak-row')).toHaveClass('md:hidden')
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

- `ISLAND_BOX`: `'flex h-[110px] flex-col … md:h-[150px]'` (brief §2 A3: phone 110 "thấp hơn 128 cũ để lưới thấy 2 hàng dù có 2 banner"; iPad dọc 150). Các rule `ipad:` giữ nguyên.
- Lưới: `className="relative grid grid-cols-2 gap-2.5 md:grid-cols-3 md:auto-rows-fr md:gap-3 ipad:block ipad:aspect-[1194/834] ipad:max-h-[calc(100vh-260px)]"`.
- Hàng chân: `<div data-testid="home-foot" className="col-span-2 flex items-stretch gap-2.5 md:contents ipad:contents">`; hộp Speak Lab `<div className="flex flex-1 md:h-[150px] md:flex-none ipad:absolute ipad:bottom-6 ipad:left-1/2 ipad:flex-none ipad:-translate-x-1/2 ipad:justify-center">` và `<Link … className="… md:h-full md:rounded-r22 md:text-[19px] ipad:w-auto">`; link khôi phục thêm `data-testid="home-foot-restore"`.
- Nút phụ huynh: trong `PageHeader right` từ `md:` lên **và** ở iPad ngang (vì `md:` cũng khớp ở 1194); ở phone nó ở đâu hôm nay thì giữ nguyên — cụ thể `right={<div className="flex items-center gap-2 max-md:contents md:gap-3">{headerCluster}</div>}` với `headerCluster` = `<div className="hidden items-center gap-2 md:flex">…StreakWeek…⭐ pill…</div>` + `parentButton`. Hàng streak trong thân nhận `data-testid="home-streak-row"` + `md:hidden`; `parentButton` cũ trong hàng chân trở thành `data-testid="home-foot-parent"` + `md:hidden` (từ `md:` lên nó nằm trong header).
- **`ipad:` outrank `md:`**: mọi rule mới ở trên viết bằng `md:` sẽ áp cả ở iPad ngang. Cụ thể `md:grid-cols-3` bị `ipad:block` vô hiệu (khác property), `md:h-[150px]` bị `ipad:h-auto` của `ISLAND_BOX` đè — **đúng ý**. Nhưng cụm header thì đổi thật cả hai frame: đó là quyết định 16 ("từ `md:` lên"), và bản đồ được thêm ~60px chiều cao thân. **Bắt buộc kiểm bằng ảnh `ipad/home` ở Step 5.**

`shoot.mjs` — thêm `home-3-banners` ngay sau `home-over-limit` (dòng 258), trong ngữ cảnh UA iOS để banner A2HS xuất hiện cùng banner hết giờ:
```js
  // Task 9: Home nhiều banner. Dev build không có env Supabase nên banner "mốc email" không thể
  // bật headless — ảnh này là frame 2 banner (⚠️ hết giờ + ℹ️ A2HS). Dòng "+N" của NoticeStack
  // được chứng minh bằng unit test (Task 8) và bằng hàng checklist iPad thật ở Task 16.
  if (vpName === 'phone' && (!WANT || WANT.includes('home-3-banners'))) {
    const ios2 = await browser.newContext({ ...vp, reducedMotion: 'reduce', locale: 'vi-VN',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
    const p3 = await ios2.newPage()
    await seed(p3, { overLimit: true })
    await go(p3, '/')
    await shot(p3, dir, 'home-3-banners')
    log('✓ phone/home-3-banners')
    await ios2.close()
  }
```

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=home,home-fresh,home-over-limit,home-3-banners` × 3 frame. Bắt buộc báo: `ipadp/home` thấy đủ **3 hàng × 3 ô** (8 đảo + Speak Lab) trong 1194 kể cả khi có MissionCard; `ipad/home` (bản đồ) **không đổi bố cục** ngoài việc cụm streak/⭐ chuyển lên header; `phone/home*-full.png` giảm so với `current-phase13`.
- [ ] **Step 6: Commit** — `feat(home): 3-column island grid on iPad portrait, Speak Lab as the 9th tile, header cluster`

---

### Task 10: `MissionCard` 300×128 + trạng thái `empty`; A6 DailyMission rỗng và iPad ngang

**Files:**
- Modify: `client/src/components/MissionCard.tsx`, `client/src/screens/DailyMission.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/components/components.test.tsx` (khối `MissionCard`), `client/src/screens/DailyMission.test.tsx`

**Interfaces:**
- Consumes: `Button size='sm'` và `size='lg'`, `EmptyState size='hero'`, `PageFooter`, `PageHeader right/sub`, `ProgressBar`, `Foxy`, `Chip`.
- Produces: `MissionProgress` **giữ nguyên kiểu** (`{ doneCount; total; done }`); trạng thái `empty` suy ra trong component bằng `total === 0`, không thêm field.

- [ ] **Step 1: Failing tests**

```tsx
// components.test.tsx
it('MissionCard is a fixed 300×128 card with a 48px nowrap CTA, four states', () => {
  const { rerender } = render(<MemoryRouter><MissionCard status={{ doneCount: 3, total: 11, done: false }} /></MemoryRouter>)
  const card = screen.getByTestId('mission-card')
  expect(card).toHaveClass('h-[128px]', 'w-full', 'max-w-[300px]', 'rounded-r22', 'px-4', 'py-3.5', 'shadow-[0_6px_0_#EFE2CC]', 'border-2', 'border-[#F1E7D4]')
  expect(screen.getByText('3/11')).toHaveClass('text-teal-600')
  expect(screen.getByRole('link', { name: 'Tiếp tục ▸' })).toHaveClass('min-h-[48px]', 'rounded-r16', 'text-[17px]', 'whitespace-nowrap')
  rerender(<MemoryRouter><MissionCard status={{ doneCount: 0, total: 11, done: false }} /></MemoryRouter>)
  expect(screen.getByText('0/11')).toHaveClass('text-ink-500')
  expect(screen.getByRole('link', { name: 'Bắt đầu ▸' })).toHaveClass('bg-coral-500')
  rerender(<MemoryRouter><MissionCard status={{ doneCount: 11, total: 11, done: true }} /></MemoryRouter>)
  expect(screen.getByText('✓ 11/11')).toHaveClass('text-good-700')
  expect(screen.getByRole('link', { name: 'Chơi lại 🎉' })).toHaveClass('bg-teal-500')
  expect(screen.queryByText('Hoàn thành! 🎉')).toBeNull()
  rerender(<MemoryRouter><MissionCard status={{ doneCount: 0, total: 0, done: false }} /></MemoryRouter>)
  expect(screen.getByText('—')).toHaveClass('text-ink-300')
  expect(screen.getByRole('link', { name: 'Luyện tự do →' })).toHaveClass('border-teal-line')
})
// DailyMission.test.tsx
it('an empty lesson shows the hero empty state and two 56px footer buttons', () => {
  renderMission({ items: [] })
  expect(screen.getByTestId('empty-state')).toHaveClass('flex-1')
  expect(screen.queryByRole('link', { name: 'Luyện tự do →' })?.className).toContain('min-h-[56px]')
  expect(screen.getByRole('link', { name: 'Về trang chủ 🏠Về bản đồ 🏝️' })).toHaveClass('border-teal-line')
  expect(screen.getByText(/^Bậc ⭐ \d+/)).toBeInTheDocument()   // dòng phụ của header khi rỗng
})
it('the subtitle and the two chips move into the header', () => {
  renderMission()
  expect(screen.getByText('5 bước nhỏ — 15 phút thôi!')).toBe(screen.getByRole('banner').querySelector('p'))
  const right = screen.getByTestId('header-right')
  expect(within(right).getByText(/^Bậc ⭐/)).toHaveClass('hidden', 'md:inline-flex')
  expect(within(right).getByText('1/5 nhóm xong')).toBeInTheDocument()
})
it('iPad group cards are 240 tall, count-first captions and minute chips', () => {
  renderMission()
  expect(screen.getByTestId('group-listen')).toHaveClass('ipad:h-[240px]')
  expect(screen.getByText('2/5 ·')).toBeInTheDocument()
  expect(screen.getByText("≈ 5'")).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Tiếp tục/ })).toHaveClass('ipad:w-[480px]')
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`MissionCard.tsx` (brief §2 A4):
```tsx
const empty = total === 0
const pct = total > 0 ? (doneCount / total) * 100 : 0
const count = empty ? '—' : done ? `✓ ${doneCount}/${total}` : `${doneCount}/${total}`
const countTone = empty ? 'text-ink-300' : done ? 'text-good-700' : doneCount === 0 ? 'text-ink-500' : 'text-teal-600'
```
Khung: `data-testid="mission-card"` `flex h-[128px] w-full max-w-[300px] flex-col justify-center gap-2 rounded-r22 border-2 border-[#F1E7D4] bg-white px-4 py-3.5 shadow-[0_6px_0_#EFE2CC]`.
Tiêu đề 16px (`font-display text-[16px] font-extrabold text-ink-900`), đếm 15px + `countTone`.
Bar: `<ProgressBar value={pct} className={`h-[11px] ${done ? '[&>div]:bg-good-300' : ''}`} />` (không mở rộng `ProgressTone` — spec không liệt kê).
Xoá hẳn dòng "Hoàn thành! 🎉".
CTA: `<Button size="sm" to={empty ? '/' : '/mission'} variant={empty ? 'outline' : done ? 'secondary' : 'primary'} className="w-full">{empty ? 'Luyện tự do →' : done ? 'Chơi lại 🎉' : doneCount === 0 ? 'Bắt đầu ▸' : 'Tiếp tục ▸'}</Button>`.

`DailyMission.tsx`:
- Header: `title="Nhiệm vụ hôm nay 🌞"`, `sub={groups.length === 0 ? `Bậc ⭐ ${band}` : '5 bước nhỏ — 15 phút thôi!'}`; `right={<div className="hidden items-center gap-2 md:flex"><Chip tone="sun" className="hidden md:inline-flex text-[15px] rounded-r12 px-3.5 py-2">Bậc ⭐ {band}</Chip><Chip tone="teal" className="text-[15px] rounded-r12 px-3.5 py-2">{doneGroups}/{groups.length} nhóm xong</Chip></div>}` (`doneGroups = groups.filter(g => g.done).length`). Trên phone `right` là hộp rỗng — `LessonChip` vốn tự ẩn ở `/mission`, nên không truyền `right={null}` (quyết định 8).
- Xoá `<p>` và hàng 2 chip trong thân.
- Rỗng: `<EmptyState size="hero" title="Hôm nay chưa có nhiệm vụ" sub="Bé có thể luyện tự do ở bất kỳ đảo nào — hoặc leo các bậc luyện nói." />` (bỏ `cta`), và `PageFooter` render 2 nút khi rỗng: `<Button to="/" className="flex-1">Luyện tự do →</Button>` + `<Button to="/" variant="outline" className="flex-1"><HomeLabel /></Button>` (Foxy ẩn ở nhánh này).
- `GROUP_CARD` thêm `ipad:h-[240px]` (thay `md:h-auto` cho iPad ngang; `md:h-auto` giữ cho iPad dọc — `ipad:` outrank nên viết cả hai là an toàn).
- Dòng phụ trong thẻ: `{group.doneCount}/{group.items.length} · {isCurrent ? <span className="text-teal-600">bắt đầu ở đây!</span> : `bước ${i + 1}`}` — bỏ khối đếm riêng, giữ `data-testid` `group-*`.
- Chip phút: `≈ {kind.minutes(...)}'`.
- Footer CTA: thêm `ipad:w-[480px]`; Foxy `ipad:[&_svg]:h-[77px] ipad:[&_svg]:w-[80px]`.

`shoot.mjs` — `mission-empty` (ngay sau `mission-done`, dòng 166): ghi thẳng bản ghi lesson rỗng của hôm nay rồi chụp, sau đó xoá key để `mission` sau này không bị ảnh hưởng:
```js
  await S('mission-empty', '/mission', null, false, async () => {}) // xem cách gọi bên dưới
```
Cụ thể, thêm một khối riêng (không dùng `S`'s `route` vì phải seed trước khi điều hướng):
```js
  // Task 10: nhiệm vụ rỗng. `getLesson` chỉ sinh mới khi chưa có bản ghi của ngày hôm nay, nên ghi
  // sẵn một bản ghi hợp lệ với items rỗng là cách duy nhất bắt được trạng thái này headless.
  if (!WANT || WANT.includes('mission-empty')) {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      const d = new Date()
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      localStorage.setItem(`${pre}lesson.${day}`, JSON.stringify({ v: 1, day, created: Date.now(), band: 2, items: [] }))
    })
    await S('mission-empty', '/mission')
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      for (const k of Object.keys(localStorage)) if (k.startsWith(pre + 'lesson.')) localStorage.removeItem(k)
    })
  }
```

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=home,mission,mission-empty` × 3 frame. **`ipad/mission-full.png` (1189px, Phase 12) phải biến mất**: 5 nhóm 240 + footer phải vừa 834.
- [ ] **Step 6: Commit** — `feat(mission): fixed 300×128 card with an empty state, hero empty mission, iPad landscape layout`

---

### Task 11: A7 MissionComplete — nhánh 0 sao và nhánh streak 0

**Files:**
- Modify: `client/src/screens/MissionComplete.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/MissionComplete.test.tsx`

**Interfaces:**
- Consumes: `Foxy` (`mood='happy'` khi 0 sao, `'cheer'` khi ≥1), `Confetti`, `WeekDots`, `Button size='lg'`, `HomeLabel`.
- Produces: không có API mới.

- [ ] **Step 1: Failing tests**

```tsx
it('0 stars: happy Foxy, no confetti, a white card instead of the +n pill, a two-line H1', () => {
  renderDone({ starsToday: 0 })
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'happy')
  expect(screen.queryByTestId('confetti')).toBeNull()
  expect(screen.queryByText('+0 ⭐')).toBeNull()
  expect(screen.getByText('Mai làm lại để lấy ⭐ nhé')).toHaveClass('rounded-r18', 'bg-white', 'text-[18px]', 'text-ink-500', 'shadow-card-sm')
  const h1 = screen.getByRole('heading', { level: 1 })
  expect(h1).toHaveTextContent('Xong nhiệm vụ rồi! 🦊Con đã rất cố gắng.')
})
it('≥1 star keeps the Phase 12 celebration exactly', () => {
  renderDone({ starsToday: 2 })
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(screen.getByText('+2 ⭐')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nhiệm vụ hoàn thành! 🎉')
})
it('a zero streak gets its own line', () => {
  renderDone({ starsToday: 0, streak: 0 })
  expect(screen.getByText('🔥 Bắt đầu chuỗi mới từ hôm nay!')).toBeInTheDocument()
  expect(screen.queryByText(/Chuỗi 0 ngày/)).toBeNull()
})
it('the whole column still fits 667 without scrolling (no fixed heights added)', () => {
  renderDone({ starsToday: 0, streak: 0 })
  expect(screen.getByTestId('page-body')).toHaveClass('justify-center')
})
```
(`Foxy` chưa chắc có `data-mood`/`data-testid`; nếu chưa thì thêm `data-testid="foxy" data-mood={mood}` vào `Foxy.tsx` **trong Task 1** — Phase 13 đã assert `screen.getByTestId('foxy')` nên nhiều khả năng đã có; kiểm trước khi viết test.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — thêm `const zero = starsToday === 0` và `const s = streak(now, events)`:
- `{!zero && <Confetti />}`
- `<Foxy mood={zero ? 'happy' : 'cheer'} … />` — 0 sao dùng cỡ 150×144 (`[&_svg]:h-[144px] [&_svg]:w-[150px]`), giữ `animate-bob`.
- H1: `zero ? <>Xong nhiệm vụ rồi! 🦊<br />Con đã rất cố gắng.</> : 'Nhiệm vụ hoàn thành! 🎉'`.
- Pill: `zero ? <div className="rounded-r18 bg-white px-[26px] py-3 text-[18px] font-bold text-ink-500 shadow-card-sm">Mai làm lại để lấy ⭐ nhé</div> : <div className="…pill hiện tại…">+{starsToday} ⭐</div>`.
- Dòng streak: `s === 0 ? '🔥 Bắt đầu chuỗi mới từ hôm nay!' : `🔥 Chuỗi ${s} ngày liên tiếp — giỏi lắm!``.
- `WeekDots` giữ nguyên (34px là mặc định), CTA giữ nguyên.

`shoot.mjs` — thêm `mission-done-zero` ngay sau `mission-done`: seed lại activity chỉ với sự kiện hôm nay **dưới ngưỡng 60** và không có ngày liên tiếp nào:
```js
  if (!WANT || WANT.includes('mission-done-zero')) {
    await page.evaluate(() => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      const now = Date.now()
      localStorage.setItem(pre + 'activity', JSON.stringify(
        [0, 1, 2].map(i => ({ ts: now - (i + 1) * 60e3, kind: 'word', id: `z${i}`, score: 40 })),
      ))
    })
    await S('mission-done-zero', '/mission/done')
    await seed(page)  // trả lại đứa trẻ 5 ngày luyện cho mọi ảnh sau
  }
```

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=mission-done,mission-done-zero` × 3 frame + `VIEWPORTS=short SHOTS=mission-done-zero`. Bắt buộc: **không `-full` ở 375×667** (0 sao + streak 0 là trường hợp xấu nhất của màn này).
- [ ] **Step 6: Commit** — `feat(mission): 0-star and 0-streak branches on the celebration screen`

---

### Task 12: A8 TopicHub — header trong dải teal, chip sao đảo, CTA ghim, hàng truyện trống

**Files:**
- Modify: `client/src/screens/TopicHub.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/TopicHub.test.tsx`

**Interfaces:**
- Consumes: `PageHeader onBand` (Task 1), `PageFooter`, `Button`, `Chip`, `Stars size='13'`, `STORIES`, `SENTENCES`, `topicStars`, `unlockedWords`, `lessonStatus`.
- Produces: hàm nội bộ `nextItem(...)` trả về `{ label: string; to: string; replay: boolean }` — "mục dở đầu tiên" theo thứ tự Từ mới → Ghép câu → Truyện; đủ 3★ hết → `replay: true`.

- [ ] **Step 1: Failing tests**

```tsx
it('the header sits inside the teal band, centred on the island-star chip', () => {
  renderHub('animals')
  expect(screen.getByRole('banner')).toHaveClass('bg-transparent')
  expect(screen.getByText(/^⭐ \d+\/\d+ sao đảo$/)).toHaveClass('bg-white/[.92]', 'text-teal-600', 'rounded-r12', 'text-[15px]')
  expect(screen.getByTestId('island-header')).toHaveClass('bg-teal-500')
  expect(screen.getByText('Động vật')).toHaveClass('text-[28px]', 'text-white')
})
it('the star chip denominator is 3 × the number of scored sections', () => {
  renderHub('animals'); expect(screen.getByText(/sao đảo$/)).toHaveTextContent('/9 sao đảo')   // có truyện
  cleanup(); renderHub('weather'); expect(screen.getByText(/sao đảo$/)).toHaveTextContent('/6 sao đảo')
})
it('counts move into the row titles and the sentence row shows stars', () => {
  renderHub('animals')
  expect(screen.getByText('Từ mới').nextSibling).toHaveTextContent('3/8')
  expect(screen.queryByText(/câu có sao$/)).toBeNull()
  expect(within(screen.getByRole('link', { name: /Ghép câu/ })).getByTestId('stars')).toHaveClass('text-[13px]')
})
it('an island with no story greys the row out and names how many other islands have one', () => {
  renderHub('weather')
  const row = screen.getByText('Truyện').closest('div')
  expect(row).toHaveClass('bg-[#F6EFE2]', 'opacity-80')
  expect(within(row).getByText('🎧')).toHaveClass('grayscale')
  expect(screen.getByText('Đảo này chưa có truyện — nghe truyện ở 3 đảo khác nhé')).toHaveClass('text-[12px]')
  expect(screen.getByText('Sắp có 📖')).toBeInTheDocument()
  expect(row.tagName).toBe('DIV')     // không bấm được
})
it('the pinned CTA points at the first unfinished section, or offers a replay when all are 3★', () => {
  renderHub('animals')
  expect(screen.getByRole('link', { name: 'Học tiếp: Từ mới 3/8 ▸' })).toHaveAttribute('href', '/words/animals')
  cleanup(); renderHub('animals', { allThreeStars: true })
  expect(screen.getByRole('link', { name: /^Luyện lại: / })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

- `PageHeader onBand back={<BackButton to="/" label="Về nhà" />}` với ô giữa = `<Chip tone="teal" className="rounded-r12 bg-white/[.92] px-3.5 py-[7px] text-[15px] text-teal-600">⭐ {topicStars(topic.id)} … </Chip>`. Số: `n = topicStars + (starred > 0 ? … )` — theo ghi chú brief, `m = 3 × số mục có sao` (2 khi đảo không truyện, 3 khi có) và `n` là tổng sao thực tế của các mục đó: `n = topicStars(topic.id) + sentenceStars + storyStars` với `sentenceStars = max(getStars('sentence:*'))`… **Chốt công thức**: `sections = [topicStars(topic.id), bestOf(sentences, 'sentence:'), ...stories.map(s => getStars('story:'+s.id))]`, `m = 3 * sections.length`, `n = sum(sections)`. Ghi công thức này vào comment để test đọc được.
- Dải teal: giữ `data-testid="island-header"` nhưng **bỏ `md:hidden`** và cho nó bắt đầu từ đỉnh `PageShell` (nền của cả header + khối tên): chuyển nó ra ngoài `PageBody`, thành phần tử `absolute inset-x-[-16px] top-[-…] h-[236px] rounded-b-[40px] bg-teal-500 -z-10` trong `PageShell className="relative"`. Chiều cao 236 đo theo cách brief đo — giữ công thức `calc(180px + max(1.5rem, env(safe-area-inset-top)+9px))` đang có, chỉ đổi `rounded-b-[44px_44px_40px_40px]` → radius `44 44 40 40` theo brief.
- Khối tên trong thân: đĩa 84×84 trắng `shadow-[0_6px_0_#1FA396]` emoji 42, tên `font-display text-[28px] font-extrabold text-white`, dòng `text-[13px] text-[#D3F1EC]` "Đảo số {n} · ★★☆ · Luyện thêm nhé!".
- Ba hàng: đếm vào **trong tiêu đề** (`Từ mới <span className="text-teal-600">3/8</span>`), hàng câu đổi dòng đếm phụ thành `<Stars value={…} size="13" />`, hàng truyện trống thêm `filter grayscale` trên emoji + dòng 12px với `n = new Set(STORIES.map(s => s.topic)).size` (không hard-code) + chip "Sắp có 📖", vẫn là `<div>`.
- `PageFooter` mới: `<Button to={next.to} className="w-full">{next.replay ? 'Luyện lại' : 'Học tiếp'}: {next.label} ▸</Button>`.

`shoot.mjs` — thêm `topic-no-story` (`/topic/weather`). Weather là đảo thứ 5 và `OPEN_FROM_START = 4`, nên seed mặc định để nó **khoá**; phải mở bằng cách nạp Leitner cho đủ `UNLOCK_AT = 6` từ của `family` (đảo thứ 4). Id từ thu từ chính app như Task 3, và `due` đặt ở **tương lai** để không làm bẩn deck ôn tập:
```js
  if (!WANT || WANT.includes('topic-no-story')) {
    await go(page, '/words/family')
    const fam = await page.$$eval('a[href^="/words/family/"]', as => as.map(a => a.getAttribute('href').split('/')[3]))
    await page.evaluate(ids => {
      const id = localStorage.getItem('speakup.profile')
      const pre = id ? `speakup.${id}.` : 'speakup.'
      const due = Date.now() + 7 * 24 * 3600e3
      const m = JSON.parse(localStorage.getItem(pre + 'leitner') ?? '{}')
      for (const w of ids.slice(0, 6)) m[w] = { box: 1, due }
      localStorage.setItem(pre + 'leitner', JSON.stringify(m))
    }, fam)
    await S('topic-no-story', '/topic/weather')
  }
```
(Đặt sau `topic-locked`. Nếu ảnh ra `LockedTopic` thì nâng `slice(0, 6)` — đó là dấu hiệu `UNLOCK_AT` đã đổi.)

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=topic-animals,topic-locked,topic-no-story` × 3 frame. Bắt buộc: header **nằm trong** dải teal ở cả 3 frame; 4 hàng + khối tên 236 + CTA 56 vừa 844 trên phone (không `-full`).
- [ ] **Step 6: Commit** — `feat(topic): banded header, island-star chip, pinned "Học tiếp" CTA, empty-story row`

---

### Task 13: A9 LevelStairs — % trên iPad ngang, CTA mọi frame, zigzag ở iPad dọc, vùng cuộn trên phone

**Files:**
- Modify: `client/src/screens/LevelStairs.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/LevelStairs.test.tsx`

**Interfaces:**
- Consumes: `PageHeader title/sub`, `PageFooter`, `Button`, `Stars size='13'`, `Foxy`.
- Produces: `STEPS` mất field `lift` (5 `ipad:mt-*` bị xoá); vị trí ô iPad ngang tính bằng `style={{ left: `${10 + i * 20}%`, top: `${70 - i * 17.5}%` }}`.

- [ ] **Step 1: Failing tests**

```tsx
it('one title at every frame, subtitle in the header, no "Speak Lab" branch', () => {
  renderStairs()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Các bậc luyện nói 🗣️')
  expect(screen.queryByText('Speak Lab 🗣️')).toBeNull()
  expect(screen.getByText('Leo từng bậc — mỗi bậc một trò mới!')).toBe(screen.getByRole('banner').querySelector('p'))
})
it('the CTA is no longer phone-only', () => {
  renderStairs()
  expect(screen.getByRole('contentinfo')).not.toHaveClass('md:hidden')
  expect(screen.getByRole('link', { name: /^Luyện bậc/ })).toHaveClass('ipad:w-[420px]', 'ipad:mx-auto')
})
it('landscape positions the five tiles by percentage, not by magic margins', () => {
  renderStairs()
  const step = screen.getByTestId('step-sound-zoo')
  expect(step.className).not.toMatch(/ipad:mt-/)
  expect(step).toHaveStyle({ left: '10%', top: '70%' })
  expect(screen.getByTestId('step-story-voice')).toHaveStyle({ left: '90%', top: '0%' })
  expect(step).toHaveClass('ipad:absolute', 'ipad:h-[176px]', 'ipad:w-[176px]')
})
it('iPad portrait reuses the phone zigzag at 300×96 — no md: grid', () => {
  renderStairs()
  expect(screen.getByTestId('stairs-region').className).not.toMatch(/md:grid/)
  expect(screen.getByTestId('step-word-pop').querySelector('a')).toHaveClass('md:h-[96px]', 'md:w-[300px]')
})
it('phone: the stair region is its own scroller, space-between, and scrolls to the bottom on mount', () => {
  renderStairs()
  const region = screen.getByTestId('stairs-region')
  expect(region).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto', 'justify-between')
  expect(region.scrollTop).toBe(region.scrollHeight - region.clientHeight)
  expect(screen.getByTestId('step-word-pop').querySelector('a')).toHaveClass('h-[84px]', 'w-[236px]', 'short:h-[72px]')
  expect(screen.getByTestId('foxy').parentElement).toHaveClass('h-[56px]', 'w-[58px]')
  expect(screen.getByText('ĐANG HỌC')).toHaveClass('text-[12px]')
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

- Header: một `title="Các bậc luyện nói 🗣️"` cho cả 3 frame (bỏ hai span `md:hidden`/`hidden md:inline`), `sub="Leo từng bậc — mỗi bậc một trò mới!"`, back `<BackButton to="/" label="Về trang chủ" mdLabel="Về bản đồ" />` (đã đổi mốc ở Task 8).
- `STEPS`: bỏ `lift`.
- Vùng bậc: `<div data-testid="stairs-region" ref={regionRef} className="relative flex min-h-0 flex-1 flex-col-reverse justify-between gap-2 overflow-y-auto py-1.5 md:mt-4 ipad:block ipad:overflow-visible">` — **xoá toàn bộ layout `md:` grid** (`md:grid md:grid-cols-2 md:items-end …` và `ipad:grid-cols-5 ipad:items-start`).
- `useEffect(() => { const el = regionRef.current; if (el) el.scrollTop = el.scrollHeight }, [])` — bậc 1 (đáy) thấy trước.
- Ô: `TILE` = `flex h-[84px] w-[236px] max-w-full flex-row items-center gap-2.5 rounded-r20 px-3.5 max-md:min-w-0 short:h-[72px] md:h-[96px] md:w-[300px] ipad:h-[176px] ipad:w-[176px] ipad:flex-col ipad:justify-center ipad:gap-1.5 ipad:rounded-r26 ipad:p-3`. Emoji `text-[30px] ipad:text-[52px]`, tên `text-[16px] ipad:text-[19px]`, `<Stars size="13" className="ipad:text-[14px]" />`, tag `text-[12px] text-ink-300 ipad:min-h-[14px]` (bỏ `md:hidden` — iPad dọc dùng zigzag phone nên tag phải còn).
- Bọc mỗi bậc: `<div data-testid={`step-${step.key}`} style={vpIsLandscape ? undefined : undefined} …>` — vị trí luôn được đặt qua `style`, chỉ có hiệu lực khi `ipad:absolute` bật:
  `style={{ left: `${10 + i * 20}%`, top: `${70 - i * 17.5}%` }}` và class `… ipad:absolute ipad:-translate-x-1/2` (đưa tâm ô về mốc %). Foxy hiện tại: `ipad:h-[77px] ipad:w-[80px] ipad:-mb-1.5` phía trên ô; phone `h-[56px] w-[58px] -ml-1.5` bên cạnh.
- SVG đường mòn: giữ bản phone `viewBox 0 0 350 560` (`ipad:hidden`), thêm bản iPad ngang `viewBox="0 0 1080 600"` `preserveAspectRatio="none"` `stroke-width 10` `dasharray "2 22"` `hidden ipad:block`, path nối 5 tâm ở cùng hệ %.
- Footer: bỏ `className="md:hidden"`; `Button` thêm `ipad:mx-auto ipad:w-[420px] ipad:h-[64px] ipad:text-[20px] ipad:rounded-r20`.
- Xoá blob `md:block` nếu nó chồng lên zigzag ở iPad dọc (kiểm bằng ảnh `ipadp/levels`).

`shoot.mjs`: thêm `'levels'` vào `IPADP_ONLY` (dòng 28) — nó đã có sẵn ở đó, xác nhận và giữ; nếu thiếu thì thêm.

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=levels` × 3 frame + `VIEWPORTS=short SHOTS=levels`. **`ipad/levels-full.png` (1496px, Phase 12) phải biến mất**; ở 375×667 5 ô 72 + Foxy + CTA phải vừa hoặc cuộn trong vùng bậc chứ không tràn `PageBody`.
- [ ] **Step 6: Commit** — `feat(stairs): percentage layout on landscape, CTA at every frame, phone scroll region`

---

### Task 14: C2 StoryPlayer — header trên tranh, dòng gợi ý, trạng thái audio thành `Notice`, `retry()`, `PlayerControls`, `Karaoke` hit 44

**Files:**
- Modify: `client/src/screens/StoryPlayer.tsx`, `client/src/story/useStoryPlayer.ts`, `client/src/components/PlayerControls.tsx`, `client/src/components/Karaoke.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/StoryPlayer.test.tsx`, `client/src/story/useStoryPlayer.test.tsx`, `client/src/components/story-components.test.tsx`

**Interfaces:**
- Consumes: `Notice` (`kind='info'|'error'`, `action={{ label: 'Thử lại', onClick }}`), `Chip`, `PageHeader` (ô giữa = cột 2 dòng), `PageFooter`.
- Produces:
  - `useStoryPlayer` trả thêm `retry(): void` — nạp lại `audio.src` của cảnh hiện tại và thử `play()` lại (bump `loadTokenRef`, `metadataReadyRef=false`, `playResolvedRef=false`, `audio.load()`, rồi `beginPlayback(tMs === NOT_STARTED ? 0 : tMs)`); **không** đổi bất kỳ field nào đang có.
  - `useStoryPlayer` khởi tạo `subtitles` = `window.innerHeight >= 700` đọc **một lần lúc mount** (`useState(() => …)`), quyết định 28.
  - `Karaoke`: hit 44×44 (`min-h-[44px] px-1.5 py-2`, wrapper `gap-x-1 gap-y-0.5`, bỏ `min-w-[64px]`).
  - `PlayerControls`: ⏮⏭ `rounded-full`, chip tốc độ `h-10 w-11` → `h-10 w-11` giữ 44×40 (`w-11` = 44, `h-10` = 40) + `rounded-[11px]`, nhãn `🇻🇳 Phụ đề`.

- [ ] **Step 1: Failing tests**

```tsx
// useStoryPlayer.test.tsx
it('retry() reloads the scene audio and plays again', () => { /* audio.load gọi thêm 1 lần, play() gọi lại */ })
it('subtitles default off under a 700px viewport, on at or above', () => {
  window.innerHeight = 667
  const { result } = renderHook(() => useStoryPlayer(story)); expect(result.current.subtitles).toBe(false)
  window.innerHeight = 844
  expect(renderHook(() => useStoryPlayer(story)).result.current.subtitles).toBe(true)
})
// story-components.test.tsx
it('a karaoke word is a 44px target, not 64', () => {
  render(<Karaoke words={[{ w: 'The' }]} activeIndex={0} onWordTap={() => {}} />)
  const w = screen.getByRole('button', { name: 'The' })
  expect(w).toHaveClass('min-h-[44px]', 'px-1.5', 'py-2')
  expect(w.className).not.toMatch(/min-w-\[64px\]/)
  expect(w.parentElement).toHaveClass('gap-x-1')
})
it('PlayerControls: round step buttons, 44×40 speed chips, the flag label', () => {
  renderControls()
  expect(screen.getByRole('button', { name: 'Cảnh trước' })).toHaveClass('rounded-full', 'h-[64px]', 'w-[64px]')
  expect(screen.getByText('🐢')).toHaveClass('h-10', 'w-11', 'rounded-[11px]')
  expect(screen.getByText('🇻🇳 Phụ đề')).toBeInTheDocument()
  expect(screen.queryByText('Phụ đề Việt')).toBeNull()
})
// StoryPlayer.test.tsx
it('the header carries the scene chip over the story name, above the picture', () => {
  renderPlayer()
  const banner = screen.getByRole('banner')
  expect(within(banner).getByText('Cảnh 1/4')).toBeInTheDocument()
  expect(within(banner).getByText('🦊 The Little Fox')).toHaveClass('text-[11px]', 'text-ink-300')
  expect(screen.queryByTestId('story-title')).toBeNull()
  expect(banner.compareDocumentPosition(screen.getByTestId('story-art')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
it('the tap hint is one line above the karaoke at every frame, never a pill on the art', () => {
  renderPlayer()
  const hint = screen.getByText('👆 Chạm 1 từ để nghe lại')
  expect(hint).toHaveClass('text-[13px]', 'text-teal-600', 'short:hidden')
  expect(hint.className).not.toMatch(/md:hidden/)
  expect(within(screen.getByTestId('story-art')).queryByText(/Chạm/)).toBeNull()
})
it('the two audio states are 44px Notices, the error one with a retry action', () => {
  renderPlayer({ hasTimings: false })
  expect(screen.getByRole('status')).toHaveTextContent('Chưa có giọng đọc — chữ chạy theo nhịp ước lượng')
  cleanup(); renderPlayer({ hasTimings: true, hasAudio: false, playing: true })
  const err = screen.getByRole('status')
  expect(err).toHaveClass('bg-fix-50', 'border-fix-300')
  expect(err).toHaveTextContent('🔇 Không phát được giọng đọc')
  fireEvent.click(within(err).getByRole('button', { name: 'Thử lại' }))
  expect(retry).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`useStoryPlayer.ts`:
```ts
const [subtitles, setSubtitles] = useState(() => {
  // R29 / quyết định 28: đọc MỘT LẦN lúc mount, không nghe resize — xoay máy giữa chừng không được
  // tự tắt phụ đề dưới tay đứa trẻ.
  try { return window.innerHeight >= 700 } catch { return true }
})
```
```ts
/** R23: nút "Thử lại" của dòng lỗi. Nạp lại src của cảnh hiện tại và chơi lại từ vị trí đang đứng —
 * cùng đường đi mà effect đổi cảnh dùng, chỉ khác là nó không đổi `sceneIndex`. */
function retry() {
  const audio = audioElRef.current
  if (!audio || !audioActiveRef.current) { beginPlayback(tMs === NOT_STARTED ? 0 : tMs); return }
  const token = ++loadTokenRef.current
  metadataReadyRef.current = false
  playResolvedRef.current = false
  hasAudioRef.current = false
  setHasAudio(false)
  audio.pause()
  audio.src = scene.audio
  audio.load()
  audio.playbackRate = rateRef.current
  beginPlayback(tMs === NOT_STARTED ? 0 : tMs)
  void token
}
```
và thêm `retry` vào `StoryPlayer` type + object trả về.

`Karaoke.tsx`: nút → `min-h-[44px] inline-flex items-center justify-center px-1.5 py-2 …` (bỏ `min-h-[64px] min-w-[64px] px-2`); wrapper `gap-x-2` → `gap-x-1 gap-y-0.5`. Cập nhật docblock: **ngoại lệ có tên** với sàn 64 của trẻ (Q11) — từ karaoke là mục tiêu phụ; sàn 64 vẫn áp cho play/mic/CTA/ô đáp án.

`PlayerControls.tsx`: `STEP` `rounded-2xl` → `rounded-full`; `SPEED_CHIP` `h-10 w-11 … rounded-[14px]` → `h-10 w-11 … rounded-[11px]` (44×40 đúng brief, chỉ radius sai); `label="Phụ đề Việt"` → `label="🇻🇳 Phụ đề"` và bỏ prop `emoji="🇻🇳"` nếu nó nhân đôi cờ; xoá khối chú thích "Q12 chưa chốt" ở dòng 73–76 (Q12 = **bỏ hẳn** nhạc nền, code vốn không có → không việc gì phải làm).

`StoryPlayer.tsx`:
- Header: ô giữa thành cột 2 dòng — `<div className="flex flex-col items-center"><Chip tone="teal" className="rounded-r12 px-3.5 py-[7px] text-[15px]">Cảnh {i+1}/{n}</Chip><span className="text-[11px] font-bold text-ink-300">{story.emoji} {story.title}</span></div>` + giữ `SceneDots` `hidden md:inline-flex`.
- Xoá khối `data-testid="story-title"` trong thân (tên truyện đã lên header).
- Xoá pill absolute trên tranh (dòng 71–73); dòng gợi ý bỏ `md:hidden`, giữ `short:hidden`.
- Hai dòng trạng thái audio → `Notice`:
```tsx
{!p.hasTimings ? (
  <Notice kind="info" title="Chưa có giọng đọc — chữ chạy theo nhịp ước lượng" />
) : !p.hasAudio && p.playing ? (
  <Notice kind="error" title="🔇 Không phát được giọng đọc" action={{ label: 'Thử lại', onClick: p.retry }} />
) : null}
```
đặt **giữa thanh tiến trình và karaoke**, thay chỗ dòng "👆 Chạm 1 từ" (khi có Notice thì ẩn dòng gợi ý).
- Footer giữ nguyên 3 nhánh (Q13: giữ CTA đáy).

`shoot.mjs`: thêm `story-player-no-audio` — cảnh của `little-fox` trong dev không có mp3 thật, nên chỉ cần bấm ▶ rồi chờ `hasAudio` không bật:
```js
  await S('story-player-no-audio', '/story/little-fox', async () => {
    await page.getByRole('button', { name: 'Phát' }).click()
    await sleep(1500)
  })
```
(đặt ngay sau `story-player-playing`.)

- [ ] **Step 4: Run** test/lint/typecheck → PASS, 0 act() warning (`retry()` gọi `setState` — bọc `fireEvent` là đủ).
- [ ] **Step 5: Ảnh** `SHOTS=story-player,story-player-playing,story-player-no-audio,story-player-ended` × 3 frame + `VIEWPORTS=short SHOTS=story-player`. Bắt buộc: header **không đè** tranh ở frame nào; karaoke 9 từ của cảnh dài nhất **2 dòng** trong 358 trên phone.
- [ ] **Step 6: Commit** — `feat(player): header above the art, Notice audio states with retry, 44px karaoke hits`

---

### Task 15: C3 StoryQuiz — thẻ đáp án hàng ngang/4:3, nhánh ảnh, kết quả 0/3

**Files:**
- Modify: `client/src/screens/StoryQuiz.tsx`, `docs/design/current/shoot.mjs`
- Test: `client/src/screens/StoryQuiz.test.tsx`

**Interfaces:**
- Consumes: `Stars size='lg'` (44), `LinkText`, `Foxy mood='idle'`, `Button`, `HomeLabel`, `RETURN_LABEL`/`MISSION_ROUTE`, `setStars`, `logActivity`.
- Produces: `result` đổi kiểu thành `{ stars: 0 | 1 | 2 | 3; correctCount: number }`. **`setStars` giữ nguyên chữ ký `(id, 1 | 2 | 3)`** — 0 sao đơn giản là không gọi; `logActivity` vẫn gọi. `QuizOption` thêm `image?: string` (nhánh mở sẵn, dữ liệu chưa có).

- [ ] **Step 1: Failing tests**

```tsx
it('answer cards are a phone row and a 4:3 iPad card', () => {
  renderQuiz()
  const card = screen.getAllByRole('button', { name: /fox|cat|apple/ })[0]
  expect(card).toHaveClass('flex-row', 'max-md:min-h-[96px]', 'md:flex-col', 'md:aspect-[4/3]', 'md:max-w-[300px]', 'md:flex-1')
  expect(card.className).not.toMatch(/md:h-\[270px\]|md:w-\[250px\]/)
  expect(within(card).getByText('🦊')).toHaveClass('text-[56px]', 'md:text-[96px]')
  expect(within(card).getByText('fox')).toHaveClass('text-[20px]')
})
it('an option with an image renders a 16:9 picture instead of the emoji', () => {
  renderQuiz({ options: [{ label: 'fox', emoji: '🦊', image: '/art/fox.png' }, …] })
  expect(screen.getByRole('img', { name: 'fox' })).toHaveClass('aspect-[16/9]', 'object-cover')
})
it('0 correct: 0 stars, idle Foxy, no setStars call, activity still logged', () => {
  renderQuiz(); answerWrongThenRight(3)
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'idle')
  expect(screen.getAllByTestId('star-empty')).toHaveLength(3)
  expect(screen.getByTestId('stars')).toHaveClass('text-[44px]')
  expect(screen.getByText('Bé trả lời đúng 0/3')).toBeInTheDocument()
  expect(screen.getByText('Không sao! Nghe lại truyện một lần rồi thử lại nhé.')).toBeInTheDocument()
  expect(setStars).not.toHaveBeenCalled()
  expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: 'story', id: 'little-fox' }))
})
it('0 correct changes the primary CTA and demotes the third action to a 44px link', () => {
  renderQuiz(); answerWrongThenRight(3)
  expect(screen.getByRole('link', { name: '🎧 Nghe lại truyện' })).toHaveClass('bg-coral-500', 'min-h-[56px]')
  expect(screen.getByRole('link', { name: 'Làm quiz lại' })).toHaveClass('border-teal-line')
  const third = screen.getByRole('link', { name: /Về nhiệm vụ|Về trang chủ/ })
  expect(third).toHaveClass('min-h-[44px]', 'underline')
  expect(third.className).not.toMatch(/min-h-\[64px\]/)
})
it('3 correct keeps the Phase 12 result exactly', () => {
  renderQuiz(); answerAllRight()
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByRole('link', { name: 'Kể lại câu chuyện →' })).toBeInTheDocument()
  expect(setStars).toHaveBeenCalledWith('story:little-fox', 3)
})
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

- Thang sao: `const stars: 0 | 1 | 2 | 3 = nextFirstTryCorrect as 0 | 1 | 2 | 3` (đúng n câu = n sao, 0 → 0). Lưu: `if (!savedRef.current) { savedRef.current = true; if (stars > 0) setStars(`story:${id}`, stars); logActivity({ ts: Date.now(), kind: 'story', id }) }` — R27, `progress/store` **không đổi**.
- Kết quả: `Foxy mood={stars === 3 ? 'cheer' : stars === 2 ? 'happy' : 'idle'}` với `size="lg"` và `[&_svg]:h-[126px] [&_svg]:w-[130px]` khi `stars === 0`; `<StarRow value={stars} size="lg" animate={stars === 3} />`; khi `stars === 0` thêm dòng phụ 14px "Không sao! Nghe lại truyện một lần rồi thử lại nhé."
- Ba hành động khi `stars === 0`: primary 56 `to={`/story/${id}`}` "🎧 Nghe lại truyện", outline 56 `to={`/story/${id}/quiz`}` "Làm quiz lại" (remount bằng `key`/`replace` — dùng `<Button to={…} onClick={() => window.location.reload()}>` là sai; thay bằng nút reset state cục bộ: `onClick` đặt lại `qIndex/selected/feedback/hasWrong/firstTryCorrect/result/savedRef`), rồi `<LinkText to={inMission ? MISSION_ROUTE : '/'}>{inMission ? RETURN_LABEL : <HomeLabel />}</LinkText>`. Khi `stars > 0` giữ đúng bố cục Phase 12 (footer "Kể lại câu chuyện →").
- Thẻ đáp án: `relative flex w-full max-w-full flex-1 flex-row items-center justify-center gap-3 rounded-r22 bg-white px-4 transition-shadow active:translate-y-[2px] max-md:min-h-[96px] md:aspect-[4/3] md:max-w-[300px] md:flex-1 md:flex-col md:gap-2 md:px-0 md:rounded-r28` (bỏ `md:h-[270px] md:w-[250px] md:flex-initial`); emoji `text-[56px] md:text-[96px]`; nhãn `text-[20px] md:text-xl`; container `md:flex-row md:flex-nowrap md:gap-5`.
- Nhánh ảnh (Q14, dữ liệu chưa có): `opt.image ? <img src={opt.image} alt={opt.label} className="aspect-[16/9] w-full rounded-r16 object-cover" /> : <span aria-hidden="true" className="…emoji…">{opt.emoji}</span>` — bố cục không đổi. Thêm `image?: string` vào `QuizOption` trong `content/stories/types.ts`.

`shoot.mjs` — `quiz-result-zero` ngay sau `quiz-result` (sai không tự chuyển, nên chọn sai rồi chọn đúng ba lần là đủ, không cần fixture):
```js
  await S('quiz-result-zero', '/story/little-fox/quiz', async () => {
    for (const [wrong, right] of [['cat', 'fox'], ['bird', 'apple'], ['fox', 'bird']]) {
      await tapText(page, wrong); await sleep(250)
      await tapText(page, right); await sleep(1200)
    }
  })
```
(Cặp sai/đúng phải khớp dữ liệu thật của `little-fox.json` — đọc file và điều chỉnh; điều kiện là mỗi câu chọn **sai trước**, đúng sau.)

- [ ] **Step 4: Run** test/lint/typecheck → PASS.
- [ ] **Step 5: Ảnh** `SHOTS=quiz-idle,quiz-wrong,quiz-correct,quiz-result,quiz-result-zero` × 3 frame + `VIEWPORTS=short SHOTS=quiz-result-zero`. Bắt buộc: 2 nút 56 + link 44 + Foxy 130 + sao 44 **vừa 844 và 667 không tràn**.
- [ ] **Step 6: Commit** — `feat(quiz): row/4:3 answer cards, image branch, 0-star result without a store write`

---

### Task 16: Kiểm chứng — ảnh 3 frame, README, checklist, trạng thái spec

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-09-03-phase14-lists-nav-design.md` (dòng trạng thái cuối), `docs/design/round-2026-09/README.md` ("Bước tiếp"), `docs/design/current/README.md` (nếu bảng màn/lệnh đổi), `docs/design/current/shoot.mjs` (route còn thiếu)

- [ ] **Step 1: Chạy đủ** — dev server nền, rồi từ `docs/design/current/`:
  `SHOTS_DIR=../current-phase14/shots node shoot.mjs` (cả 3 frame, không lọc `SHOTS`) và
  `VIEWPORTS=short SHOTS=words-review,levels,quiz-result-zero,mission-done-zero,story-player SHOTS_DIR=../current-phase14/shots node shoot.mjs`.
  Rồi `node sheet.mjs` cho sheet trước/sau (`current-phase13/shots` → `current-phase14/shots`).
- [ ] **Step 2: Liệt kê mọi dòng `overflow`** của cả hai lần chạy, và **chứng minh 10 mốc của spec §Kiểm chứng đã biến mất**: `phone/words-animals-full.png`, `phone/words-full.png`, `phone/sentences-full.png`, `phone/level-word-pop-full.png`, `phone/level-sound-zoo-full.png`, `phone/level-pairs-full.png`, `phone/level-stars-full.png`, `phone/level-voice-full.png`, `ipad/sentences-full.png`, `ipadp/sentences-full.png`. Thêm hai mốc Phase 12: `ipad/mission-full.png`, `ipad/levels-full.png`. Mọi `-full.png` **còn lại** phải được nêu tên kèm lý do (dự kiến: `words-review` 64 ô, `parent-dashboard` — Phase 15).
- [ ] **Step 3: README** — thêm mục `## Phase 14 — Danh sách và điều hướng (vòng 3)` ngay sau `## Phase 13`, gồm:
  - Mở đầu: nhánh, ngày, spec + brief, "vòng 3 dựng **khung danh sách** và sửa **điều hướng**; không đụng 9 màn luyện nói".
  - Khung mới: `ListGrid`/`Tile`/`ListRow`/`StickyGroup`, `PageHeader title/sub/align/onBand`, `PageBody fade/gap`, `Button sm`, `EmptyState hero`, `Chip coralSolid`, `Stars` 13/14 — kèm câu "mặc định của cả sáu không đổi, 33 màn cũ render y hệt".
  - **Bảng theo màn** (17 hàng: C6, C1, C8, C5, A10, A11, A12, A13, A14, B2, A3, A6, A7, A8, A9, C2, C3) — cột "What changed", cùng dạng bảng "The nine screens" của Phase 13.
  - Bảng "Mốc `-full.png` đã hạ" (before/after, số px lấy từ Step 2).
  - `### Sai lệch so với brief (Ruling)` — **danh sách trống có tiêu đề**, điền từ các dòng `Ruling:` trong `.superpowers/sdd/2026-09-03-phase14-lists-nav/progress.md`. Các mục đã biết trước, phải có mặt: (a) `PageHeader.onBand` là ngoại lệ **có tên** đầu tiên với luật Phase 12 "header luôn trên cream"; (b) `Karaoke` hit 44 là ngoại lệ **có tên** với sàn 64 của trẻ (Q11); (c) dòng "+N" mở `Dialog` của Phase 12 nên vẫn có 2 nút thay vì một bottom-sheet riêng; (d) `home-3-banners` chỉ chụp được **2** banner vì dev build không có env Supabase; (e) copy lấp chỗ trống của C1 và dòng phụ của C6/C8/C5/A6-rỗng là **đề xuất** (design không ghi); (f) `Stars` thêm mốc `'13'`/`'14'` thay vì đổi cả thang sang số; (g) `progress/store.setStars` **không** đổi kiểu — quiz 0 sao không gọi.
  - `### Checklist iPad (6 hàng)`: ① số cột lưới đúng theo từng frame (3/5/6 và 2/3/4) · ② H2 nhóm dính khi cuộn C6 review và C8 · ③ nút "+N thông báo" ở Home mở sheet liệt kê phần còn lại · ④ header TopicHub nằm **trong** dải teal ở cả 3 frame · ⑤ header StoryPlayer **trên** tranh, không đè · ⑥ quiz 0/3 hiện 0★ và **không** lưu sao (kiểm `speakup.*.stars` sau khi làm sai hết).
- [ ] **Step 4: Dòng trạng thái spec** — thay dòng cuối `docs/superpowers/specs/2026-09-03-phase14-lists-nav-design.md` bằng: đã triển khai, ngày, nhánh, số task, trỏ về `README.md §Phase 14`.
- [ ] **Step 5: `docs/design/round-2026-09/README.md`** — "Bước tiếp": Phase 14 đã xong (nhánh, tasks, spec, README §Phase 14); tiếp theo là **Phase 15 (vòng 4 — khu người lớn, từ `Speak Up Parent Zone.dc.html`)**, và ghi kèm hai việc còn treo: xoá `xl2/xl3/xl4` + `components/Stars.tsx` (alias deprecated "Removed in Phase 15") và tách `useCountdown`/`useTeachCollapse` (vẫn hoãn).
- [ ] **Step 6:** `pnpm --filter client test && pnpm --filter client lint && pnpm --filter client typecheck && pnpm --filter client build` → tất cả xanh, 0 act() warning.
- [ ] **Step 7: Commit** — `docs: phase 14 lists and nav — screenshots, per-screen table and checklist`

---

## Self-review

**Spec coverage — 29 quyết định → task:**

| # | Quyết định | Task |
|---|---|---|
| 1 | `ListGrid` `sm`/`lg`, không `lg:` | 2 (dùng ở 3–7) |
| 2 | `Tile` sm/lg/locked/accent, chip/stars | 2 (xoá `CARD_LINK` ở 7) |
| 3 | `ListRow` 64/96 | 2 (dùng ở 4) |
| 4 | `StickyGroup` H2 dính | 2 (dùng ở 3, 4) |
| 5 | `PageHeader` `title`/`sub`/`align`/`onBand` | 1 (`onBand` dùng ở 12) |
| 6 | `PageBody` `fade`/`gap` | 1 (dùng ở 3–7) |
| 7 | `Button sm` · `EmptyState hero` · `Chip coralSolid` · `Stars` 13/14 | 1 (dùng ở 10, 10, 5, 2–6) |
| 8 | Ô phải header là quy ước, không prop mới | 1 (ghi vào docblock) + áp ở 3–7, 10 |
| 9 | C6 WordList + nhóm review + empty chỉ ở review | 3 |
| 10 | C1 StoryList hàng 96 + Foxy lấp chỗ | 4 |
| 11 | C8 SentenceList hàng 64 + H2 dính + 2 cột iPad | 4 |
| 12 | C5 WordTopics ô Ôn tập accent + chip | 5 |
| 13 | A10–A14 giữ 5 file mỏng, thân chung, Back `/levels`, bỏ pill A10 | 5 (A10, A11) + 6 (A12–A14) |
| 14 | B2 chỉ hạ cỡ ô, header giữ `Chip` | 7 |
| 15 | Suy iPad cho màn không có artboard (5/3 và 6/4, ×1.25) | 2 (mã hoá vào `ListGrid`/`Tile`/`ListRow`), kiểm ảnh ở 3–7 |
| 16 | Home iPad dọc: lưới 3 cột, ô 9 = Speak Lab, cụm lên header, đảo phone 110 | 9 |
| 17 | Banner Home: `NoticeStack` "+N" nêu tên + `Dialog` | 8 (ảnh ở 9) |
| 18 | `MissionCard` 300×128, CTA 48, trạng thái `empty` | 10 |
| 19 | DailyMission rỗng (hero + 2 nút) và iPad ngang | 10 |
| 20 | MissionComplete 0 sao + streak 0 | 11 |
| 21 | TopicHub dải/chip/CTA ghim/hàng truyện trống | 12 |
| 22 | LevelStairs % + CTA iPad + zigzag iPad dọc + vùng cuộn phone | 13 |
| 23 | Copy "Về bản đồ": `md:` → `ipad:` ở `HomeLabel`/`BackButton.mdLabel` | 8 (một call-site biến mất ở 5) |
| 24 | StoryPlayer header/hint/`Notice`+`retry()`/`PlayerControls`/Q12/Q13 | 14 |
| 25 | `Karaoke` hit 44 (ngoại lệ có tên) | 14 |
| 26 | StoryQuiz thẻ đáp án + nhánh `opt.image` | 15 |
| 27 | StoryQuiz 0/3, `setStars` không đổi kiểu | 15 |
| 28 | `short:` — A9 `short:h-[72px]`, phụ đề theo chiều cao, C6 chỉ kiểm chứng | 13 (A9), 14 (phụ đề), 3 (C6 `VIEWPORTS=short`) |
| 29 | Hàng 96 cho truyện / 64 cho câu (không 72); `?topic=` lạ; empty C1/C5; loading giữ Phase 12 | 2 (chốt 96/64), 4 (`?topic=` lạ), 5 (C5 không empty), 16 (ghi lại) |

**Không quyết định nào bị bỏ.** Tất cả 29 đều có task.

**Placeholder scan.** Kế hoạch cho chuỗi class và hành vi, không cho JSX đầy đủ của từng màn — brief §1/§2 giữ số theo phần tử và file Phase 12/13 giữ mã xung quanh; người triển khai chép từ cả hai, đúng như Phase 13 đã làm. Bốn chỗ **cố ý** để trống và phải điền lúc triển khai, đã nêu tên tại chỗ: (a) cặp sai/đúng của `quiz-result-zero` phải đọc từ `little-fox.json`; (b) số `slice(0, 6)` khi mở đảo `weather` phụ thuộc `UNLOCK_AT`; (c) khối `Ruling:` của README điền từ ledger; (d) mọi số `scrollHeight` trong bảng README đến từ lần chạy thật ở Task 16. Ba chuỗi copy là **đề xuất** (design không ghi): dòng lấp chỗ trống của C1, phụ đề "n từ · chạm để học" của C6-chủ đề, và phụ đề rỗng "Bậc ⭐ n" của A6 — cả ba phải vào Ruling.

**Type consistency.** Tên prop dùng ở Task 1–2 và ở mọi task màn là một: `title`/`sub`/`align`/`onBand` (`PageHeader`), `fade`/`gap` (`PageBody`), `size`/`variant`/`emoji`/`ipa`/`title`/`titleSize`/`sub`/`subTone`/`chip`/`stars`/`ariaLabel` (`Tile`), `h`/`disc`/`title`/`sub`/`stars`/`chevron` (`ListRow`), `emoji`/`name`/`count`/`pad` (`StickyGroup`), `size='sm'` (`Button`), `size='hero'` (`EmptyState`), `tone='coralSolid'` (`Chip`), `size='13'|'14'` (`Stars`), `retry()` (`useStoryPlayer`). Ba kiểu **không** đổi và được nhắc lại ở đúng task đụng tới chúng: `setStars(id, 1 | 2 | 3)` (Task 15), `MissionProgress` (Task 10), `BackButton.mdLabel` giữ tên dù đổi mốc (Task 8). Kiểu duy nhất được nới là `result.stars` của `StoryQuiz` (`1|2|3` → `0|1|2|3`, Task 15) và `EmptyState.emoji` (bắt buộc → tuỳ chọn, Task 1) — cả hai đều nội bộ một file/một component.
