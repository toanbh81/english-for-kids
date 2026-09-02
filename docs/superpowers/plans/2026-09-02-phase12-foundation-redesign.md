# Phase 12 — Nền tảng redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every one of the 33 screens sits in one shared page frame (header · scrolling body · sibling footer) and draws its buttons, mic, results, errors, empties, notices, dialogs and sync state from one component sheet, at phone 390×844, iPad portrait 834×1194 and iPad landscape 1194×834 — without yet redrawing any screen's own body (that is Phase 13–15).

**Architecture:** New primitives live in `client/src/components/ui/` (frame, notices, dialog, stars, toast) and `client/src/components/speak/` (mic, countdown, result card, error line). Screens are migrated to `PageShell` in four batches; while a batch is pending, the old global `LessonChip` keeps rendering for screens that do not yet mount a `PageHeader` (a mount counter decides). Speaking logic changes (`locked`, `fallbackReason`, 3 s not-ready timer, typed errors) go into `useSpeakingAttempt` / `createScorer` once and every speaking screen inherits them.

**Tech Stack:** React 19, react-router-dom, Tailwind 3 (plugin variant `ipad`), Vitest + Testing Library (jsdom, `globals: true`, setup `client/src/test-setup.ts`), oxlint, tsc. Screenshots via `docs/design/current/shoot.mjs` (playwright-core + system Edge, dev server `client-http` on :5174 from `.claude/launch.json`).

**Spec:** `docs/superpowers/specs/2026-09-02-phase12-foundation-redesign-design.md` (20 decisions + binding rules).
**Numbers & copy:** `docs/design/2026-09-02-round1-foundation-brief.md` (§1 frame, §2 components, §3 Q answers). The brief wins on measurements, the spec wins on decisions.

## Global Constraints
- Branch `phase12-foundation`. One commit per task. `bash scripts/check-secrets.sh staged` runs in the pre-commit hook — never `--no-verify`.
- Breakpoints (spec decision 6): unprefixed = phone (<768) · `md:` = iPad portrait / tablet (≥768) · `ipad:` = iPad landscape (existing plugin variant). No new screens in `tailwind.config.ts`.
- Sizes are the brief's, verbatim: Button phone 56 / md 64 / lg 72 / adult 44; Back 56(hit 64) / 64 / 44 / onArt 48; mic 124→150 phone, 150→190 md+; word chip 40; toast 2400 ms, max-width 360, 2 lines.
- Tap targets: child ≥64 (visible may be 56 with a transparent hit extension), adult 44. No horizontal scroll from 320 px.
- Vietnamese child copy exactly as the brief tables; adult copy in Dialog/Notice as brief §2.7–2.8.
- Keep every existing `data-testid` (`star-filled`, `star-empty`, `score-bar`, `prosody-chip`, `toast`, `streak-dot`, `data-today`, `group-*`, `sync-status`, `remote-*`, `profile-*`, `reset-notice`, `no-session`, `account-card`).
- After every UI task: `pnpm test`, `pnpm lint`, `pnpm typecheck` green, 0 `act()` warnings; screenshots of the touched screens at the three frames (`SHOTS=<names> node docs/design/current/shoot.mjs <phone|ipad|ipadp>` with the dev server running), saved under `docs/design/current-phase12/`.
- Commands are run from the repo root with `pnpm --filter client <script>`; on the user's Windows shell use `pnpm.cmd`.

---

### Task 1: Tokens + Button sizes + LinkText

**Files:**
- Modify: `client/tailwind.config.ts` (colors, borderRadius, boxShadow, keyframes/animation)
- Modify: `client/src/components/ui/Button.tsx`
- Create: `client/src/components/ui/LinkText.tsx`
- Modify: `client/src/components/ui/index.ts`
- Test: `client/src/components/ui/ui.test.tsx` (extend the existing `describe('Button')`), `client/src/components/ui/LinkText.test.tsx`

**Interfaces:**
- Produces: `ButtonSize = 'md' | 'lg' | 'adult'` (phone/iPad handled by breakpoint inside `md`/`lg`), `ButtonVariant` unchanged; Tailwind tokens `text-star`, `text-star-empty`, `bg-track`, `bg-bar-low`, `ring-today`, `border-teal-line`, `bg-peach-50`, `rounded-r10 … rounded-r28`, `shadow-chunky-*` (5 px), `shadow-edge-outline`, `animate-pulse-coral`; `<LinkText to|onClick>`.

- [ ] **Step 1: Write the failing tests**

Append to `client/src/components/ui/ui.test.tsx` inside `describe('Button')`:

```tsx
  it('md is 56 on a phone and 64 from md, with the design radius and 5px edge', () => {
    render(<Button>Bắt đầu ▸</Button>)
    const b = screen.getByRole('button')
    expect(b).toHaveClass('min-h-[56px]', 'md:min-h-[64px]', 'rounded-r18', 'md:rounded-r20', 'text-[18px]', 'md:text-[22px]', 'shadow-chunky-coral')
    expect(b).not.toHaveClass('rounded-xl3')
  })

  it('lg is 64 on a phone and 72 from md', () => {
    render(<Button size="lg">Về trang chủ</Button>)
    expect(screen.getByRole('button')).toHaveClass('min-h-[64px]', 'md:min-h-[72px]', 'rounded-r20', 'md:rounded-r24', 'md:text-[26px]')
  })

  it('adult is 44 at every width', () => {
    render(<Button size="adult">Lưu</Button>)
    const b = screen.getByRole('button')
    expect(b).toHaveClass('min-h-[44px]', 'rounded-r12', 'text-[14px]')
    expect(b.className).not.toMatch(/md:min-h/)
  })

  it('outline has the teal edge and disabled flattens the shadow', () => {
    render(<Button variant="outline" disabled>Nghe lại</Button>)
    expect(screen.getByRole('button')).toHaveClass('border-teal-line', 'shadow-edge-outline', 'disabled:opacity-45', 'disabled:shadow-none')
  })

  it('pulse uses the coral ring animation', () => {
    render(<Button pulse>Bắt đầu ▸</Button>)
    expect(screen.getByRole('button')).toHaveClass('animate-pulse-coral')
  })
```

Create `client/src/components/ui/LinkText.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LinkText } from './LinkText'

describe('LinkText', () => {
  it('is a 44px underlined text link, not a button', () => {
    render(<MemoryRouter><LinkText to="/">Bắt đầu mới cho bé</LinkText></MemoryRouter>)
    const a = screen.getByRole('link', { name: 'Bắt đầu mới cho bé' })
    expect(a).toHaveClass('min-h-[44px]', 'underline', 'text-[15px]')
    expect(a.className).not.toMatch(/bg-|shadow-/)
  })

  it('renders a button when given onClick instead of to', () => {
    render(<LinkText onClick={() => {}}>Sửa lại email</LinkText>)
    expect(screen.getByRole('button', { name: 'Sửa lại email' })).toHaveClass('min-h-[44px]')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter client exec vitest run src/components/ui`
Expected: FAIL — `rounded-r18` etc. missing; `LinkText` module not found.

- [ ] **Step 3: Add the tokens**

In `client/tailwind.config.ts` `theme.extend`:

```ts
      colors: {
        // …existing entries unchanged, then:
        star: { DEFAULT: '#FFB020', empty: '#E2D5C0' },   // replaces `star: '#FFC533'`
        track: '#F1E7D4',
        'bar-low': '#FF9A8A',
        today: '#FFE9A8',
        'teal-line': '#C4E8E1',
        peach: { 400: '#FF9A62', 50: '#FFF1E6' },
        sand: { DEFAULT: '#F3EADA', text: '#A79781', edge: '#E2D5C0' },
      },
      borderRadius: {
        xl2: '20px', xl3: '28px', xl4: '34px',   // kept until Phase 15
        r10: '10px', r12: '12px', r14: '14px', r16: '16px', r18: '18px',
        r20: '20px', r22: '22px', r24: '24px', r28: '28px',
      },
      boxShadow: {
        card: '0 8px 0 #EFE2CC',
        'card-sm': '0 5px 0 #EFE2CC',
        'card-xs': '0 4px 0 #EFE2CC',
        'chunky-coral': '0 5px 0 #E05A3A',
        'chunky-teal': '0 5px 0 #1FA396',
        'chunky-sun': '0 4px 0 #EFDDA8',
        'chunky-line': '0 5px 0 #EFE2CC',
        'edge-outline': '0 5px 0 #C4E8E1',
        'mic': '0 8px 0 #E05A3A, 0 0 0 10px #FFE3D7',
        'toast': '0 8px 24px rgba(43,35,32,.25)',
        'dialog': '0 16px 40px rgba(43,35,32,.3)',
      },
```

Add keyframes/animations (keep existing ones):

```ts
        'pulse-coral': {
          '0%, 100%': { boxShadow: '0 5px 0 #E05A3A, 0 0 0 0 rgba(255,122,89,.55)' },
          '60%': { boxShadow: '0 5px 0 #E05A3A, 0 0 0 14px rgba(255,122,89,0)' },
        },
        halo: { '0%': { transform: 'scale(1)', opacity: '.55' }, '100%': { transform: 'scale(1.35)', opacity: '0' } },
        spin: { to: { transform: 'rotate(360deg)' } },
        shimmer: { '0%': { backgroundPosition: '-200px 0' }, '100%': { backgroundPosition: '200px 0' } },
        level: { '0%, 100%': { transform: 'scaleY(.4)' }, '50%': { transform: 'scaleY(1)' } },
```
```ts
        'pulse-coral': 'pulse-coral 1.6s ease-out infinite',
        halo: 'halo 1.4s ease-out infinite',
        spin: 'spin 3s linear infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        level: 'level .8s ease-in-out infinite',
```

`text-star` used to be `#FFC533`; grep for `text-star` and `bg-star` call sites (`grep -rn "\-star\b" client/src --include=*.tsx`) and switch any that meant the pill yellow to `sun-400`.

- [ ] **Step 4: Rewrite `Button`**

Replace `VARIANT` and `SIZE` in `client/src/components/ui/Button.tsx`:

```tsx
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
/** `md` and `lg` are responsive (brief §1: phone 56, iPad 64; lg one step up). `adult` is the
 * parent area's fixed 44 (brief §2.1). */
export type ButtonSize = 'md' | 'lg' | 'adult'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-coral-500 text-white shadow-chunky-coral active:shadow-none',
  secondary: 'bg-teal-500 text-white shadow-chunky-teal active:shadow-none',
  outline: 'bg-white text-teal-600 border-[3px] border-teal-line shadow-edge-outline active:shadow-none',
  ghost: 'bg-transparent text-ink-500 border-[3px] border-dashed border-sand-edge',
}

// The phone button is 56 tall but its tap target is 64: an invisible 4 px band above and below,
// drawn by the pseudo-element, catches the finger without changing the layout (brief §2.1).
const HIT = "relative after:absolute after:-top-1 after:-bottom-1 after:left-0 after:right-0 after:content-['']"

const SIZE: Record<ButtonSize, string> = {
  md: `min-h-[56px] px-5 text-[18px] rounded-r18 md:min-h-[64px] md:px-7 md:text-[22px] md:rounded-r20 ${HIT} md:after:hidden`,
  lg: `min-h-[64px] px-7 text-[22px] rounded-r20 md:min-h-[72px] md:px-9 md:text-[26px] md:rounded-r24`,
  adult: 'min-h-[44px] px-4 text-[14px] rounded-r12',
}
```

And the class list:

```tsx
  const classes = [
    'inline-flex items-center justify-center gap-2 font-display font-extrabold whitespace-nowrap',
    'transition-transform active:translate-y-[2px] disabled:opacity-45 disabled:shadow-none disabled:active:translate-y-0',
    SIZE[size],
    VARIANT[variant],
    pulse && variant === 'primary' ? 'animate-pulse-coral' : '',
    className,
  ].filter(Boolean).join(' ')
```

- [ ] **Step 5: Create `LinkText`**

```tsx
// client/src/components/ui/LinkText.tsx
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** A text link that looks like one (brief §2.1): 14–15 px underlined, no background, no edge,
 * but still a 44 px tap target. Use it for every "secondary" action that used to be a 64 px
 * ghost button — "Bắt đầu mới cho bé", "Sửa lại email", "← Chọn cách khác". */
export function LinkText({ to, state, onClick, className = '', children }: {
  to?: string
  state?: unknown
  onClick?: () => void
  className?: string
  children: ReactNode
}) {
  const classes = `inline-flex min-h-[44px] items-center px-2 text-[15px] font-bold text-teal-600 underline underline-offset-2 active:opacity-70 ${className}`
  if (to !== undefined) return <Link to={to} state={state} className={classes}>{children}</Link>
  return <button type="button" onClick={onClick} className={classes}>{children}</button>
}
```

Export from `index.ts`: `export { LinkText } from './LinkText'`.

- [ ] **Step 6: Run the tests, fix the callers that broke**

Run: `pnpm --filter client test`
Expected: the new tests pass; existing tests asserting `min-h-[64px]` on a default `Button` (e.g. `ui.test.tsx` "forwards clicks", `ParentDashboard.test.tsx`, `CloudStart.test.tsx`) fail. Update those assertions to `min-h-[56px]`/`md:min-h-[64px]` — do not delete them. Then `pnpm --filter client lint && pnpm --filter client typecheck`.

- [ ] **Step 7: Screenshot and commit**

Run the dev server (`client-http`), then `SHOTS=home,mission-done,parent-dashboard node docs/design/current/shoot.mjs phone` and the same for `ipad`; copy the PNGs to `docs/design/current-phase12/`.

```bash
git add client/tailwind.config.ts client/src/components/ui
git commit -m "feat(ui): design tokens, responsive Button sizes, LinkText"
```

---

### Task 2: Stars (merged) + BackButton (3 sizes + on-art)

**Files:**
- Create: `client/src/components/ui/Stars.tsx`
- Modify: `client/src/components/ui/StarRow.tsx` → thin re-export; `client/src/components/Stars.tsx` → thin re-export
- Modify: `client/src/components/ui/BackButton.tsx`
- Modify: `client/src/components/ui/index.ts`
- Test: `client/src/components/ui/ui.test.tsx` (`describe('Stars')`, extend `describe('BackButton')`)

**Interfaces:**
- Produces: `<Stars value size='sm'|'md'|'lg' animate className>` (16 / 28 / 44 px); `<BackButton to label mdLabel variant='child'|'adult'|'onArt' className>`.
- Consumes: tokens from Task 1 (`text-star`, `text-star-empty`, `shadow-card-xs`).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('Stars', () => {
  it('sizes sm/md/lg are 16/28/44 with the star token colours', () => {
    const { rerender } = render(<Stars value={2} size="sm" />)
    expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
    expect(screen.getAllByTestId('star-empty')).toHaveLength(1)
    expect(screen.getByTestId('stars')).toHaveClass('text-[16px]', 'tracking-[2px]')
    expect(screen.getAllByTestId('star-filled')[0]).toHaveClass('text-star')
    expect(screen.getAllByTestId('star-empty')[0]).toHaveClass('text-star-empty')
    rerender(<Stars value={3} size="lg" animate />)
    expect(screen.getByTestId('stars')).toHaveClass('text-[44px]')
    expect(screen.getAllByTestId('star-filled')[2]).toHaveStyle({ animationDelay: '0.36s' })
  })
})

describe('BackButton', () => {
  it('child variant is 56 with a 64 hit band on a phone and 64 from md', () => {
    router(<BackButton to="/" label="Về nhà" />)
    const a = screen.getByRole('link', { name: 'Về nhà' })
    expect(a).toHaveClass('h-14', 'w-14', 'md:h-16', 'md:w-16', 'after:-inset-1')
    expect(a.className).not.toMatch(/66px/)
  })
  it('adult variant is 44 with a visible label', () => {
    router(<BackButton to="/" label="Về nhà" variant="adult" />)
    const a = screen.getByRole('link', { name: 'Về nhà' })
    expect(a).toHaveClass('h-11', 'rounded-r14')
    expect(a).toHaveTextContent('Về nhà')
  })
  it('onArt variant is 48 on a translucent white disc', () => {
    router(<BackButton to="/stories" label="Truyện" variant="onArt" />)
    expect(screen.getByRole('link')).toHaveClass('h-12', 'w-12', 'bg-white/[.94]', 'after:-inset-2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter client exec vitest run src/components/ui`
Expected: FAIL (`Stars` not exported from ui; `variant` prop ignored).

- [ ] **Step 3: Create `ui/Stars.tsx` and turn the two old components into aliases**

```tsx
// client/src/components/ui/Stars.tsx
export type StarSize = 'sm' | 'md' | 'lg'
const SIZE: Record<StarSize, string> = { sm: 'text-[16px]', md: 'text-[28px]', lg: 'text-[44px]' }

/** The one star row of the app (brief §2.11): sm 16 / md 28 / lg 44, filled `#FFB020`, empty
 * `#E2D5C0`, and `animate` drops the filled ones in 0.18 s apart — only when a result is new. */
export function Stars({ value, size = 'md', animate, className = '' }: {
  value: 0 | 1 | 2 | 3
  size?: StarSize
  animate?: boolean
  className?: string
}) {
  return (
    <div data-testid="stars" className={`inline-flex leading-none tracking-[2px] ${SIZE[size]} ${className}`}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          data-testid={i <= value ? 'star-filled' : 'star-empty'}
          className={`${i <= value ? 'text-star' : 'text-star-empty'} ${animate && i <= value ? 'animate-star-drop' : ''}`}
          style={animate && i <= value ? { animationDelay: `${((i - 1) * 0.18).toFixed(2)}s` } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  )
}
```

`client/src/components/ui/StarRow.tsx` becomes:

```tsx
export { Stars as StarRow } from './Stars'
export type { StarSize } from './Stars'
```

`client/src/components/Stars.tsx` becomes (old `md` = big result stars → new `lg`; old `sm` → new `md`):

```tsx
import { Stars as UiStars } from './ui/Stars'
export type StarsSize = 'md' | 'sm'
/** @deprecated Phase 12 alias; use `ui/Stars`. Removed in Phase 15. */
export function Stars({ value, animate, size = 'md' }: { value: 0 | 1 | 2 | 3; animate?: boolean; size?: StarsSize }) {
  return <UiStars value={value} animate={animate} size={size === 'md' ? 'lg' : 'md'} />
}
```

Note the old `animationDelay` was `0.22s`/`0.15s`; existing tests asserting those values (`star-components.test.tsx`, `components.test.tsx`) must be updated to `0.18s`.

- [ ] **Step 4: Rewrite `BackButton`**

```tsx
import { Link } from 'react-router-dom'

export type BackVariant = 'child' | 'adult' | 'onArt'

// Brief §2.12. The child circle is 56 with a 64 hit band on a phone (the `after:` pseudo-element
// is the invisible 4 px ring) and a true 64 from md; the adult pill is 44 with its label visible;
// the on-art disc sits on a story picture at 48 with a 64 hit.
const VARIANT: Record<BackVariant, string> = {
  child: "h-14 w-14 rounded-full text-[22px] shadow-card-xs md:h-16 md:w-16 md:text-[24px] md:shadow-card-sm relative after:absolute after:-inset-1 after:content-[''] md:after:hidden",
  adult: 'h-11 gap-1.5 rounded-r14 pl-2.5 pr-3.5 text-[14px] font-extrabold text-ink-500 shadow-[0_3px_0_#EFE2CC]',
  onArt: "h-12 w-12 rounded-full bg-white/[.94] text-[20px] relative after:absolute after:-inset-2 after:content-['']",
}

export function BackButton({ to, label = 'Quay lại', mdLabel, variant = 'child', className = '' }: {
  to: string
  label?: string
  mdLabel?: string
  variant?: BackVariant
  className?: string
}) {
  const visibleLabel = variant === 'adult'
  return (
    <Link
      to={to}
      aria-label={mdLabel === undefined && !visibleLabel ? label : undefined}
      className={`inline-flex shrink-0 items-center justify-center bg-white font-display text-ink-300 active:translate-y-[2px] ${VARIANT[variant]} ${className}`}
    >
      <span aria-hidden={!visibleLabel || undefined} className={visibleLabel ? 'text-[18px]' : undefined}>←</span>
      {visibleLabel && <span>{label}</span>}
      {mdLabel !== undefined && (
        <>
          <span className="sr-only md:hidden">{label}</span>
          <span className="sr-only hidden md:inline">{mdLabel}</span>
        </>
      )}
    </Link>
  )
}
```

Remove every `max-md:h-16 max-md:w-16 max-md:text-2xl` override on `BackButton` call sites (`grep -rn "BackButton" client/src/screens | grep max-md`): TopicHub, LevelStairs, StoryPlayer. StoryPlayer's back becomes `variant="onArt"`; ParentDashboard's `← Về nhà` link becomes `<BackButton to="/" label="Về nhà" variant="adult" />` in Task 8.

- [ ] **Step 5: Run all tests, lint, typecheck**

Run: `pnpm --filter client test && pnpm --filter client lint && pnpm --filter client typecheck`
Expected: PASS after updating the delay/size assertions named in Step 3.

- [ ] **Step 6: Screenshot and commit**

`SHOTS=levels,stories,story-player,quiz-result,parent-dashboard` at phone + ipad → `docs/design/current-phase12/`.

```bash
git add client/src/components
git commit -m "feat(ui): one Stars component and BackButton in three sizes"
```

---

### Task 3: Toast (2.4 s, safe-top, 360, two lines)

**Files:**
- Modify: `client/src/components/ui/Toast.tsx`, `client/src/components/ui/useToast.ts`
- Test: `client/src/components/ui/ui.test.tsx` (`describe('Toast')`)

- [ ] **Step 1: Write the failing tests**

```tsx
describe('Toast', () => {
  it('sits under the safe-area top, capped at 360 and two lines', () => {
    render(<Toast message="Đã lưu câu: Chị của con có một con búp bê em bé." />)
    const t = screen.getByTestId('toast')
    expect(t).toHaveClass('w-[min(360px,calc(100%-32px))]', 'line-clamp-2', 'rounded-r16', 'shadow-toast')
    expect(t.className).toMatch(/top-\[max\(1rem,calc\(env\(safe-area-inset-top\)/)
    expect(t).not.toHaveClass('top-6', 'rounded-full')
  })
  it('hides after 2.4 s', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast())
    act(() => result.current.show('x'))
    act(() => { vi.advanceTimersByTime(2399) })
    expect(result.current.message).toBe('x')
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.message).toBeNull()
    vi.useRealTimers()
  })
})
```

(`renderHook` comes from `@testing-library/react`; the existing file already imports `act`.)

- [ ] **Step 2: Run to verify failure** — `pnpm --filter client exec vitest run src/components/ui` → FAIL on classes and on the 1.4 s timer.

- [ ] **Step 3: Implement**

```tsx
// Toast.tsx
export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      data-testid="toast"
      className="fixed left-1/2 top-[max(1rem,calc(env(safe-area-inset-top)_+_8px))] z-50 w-[min(360px,calc(100%-32px))] -translate-x-1/2 rounded-r16 bg-[#2B2320] px-[18px] py-3 text-center font-sans text-[15px] font-extrabold leading-[1.35] text-cream-50 shadow-toast line-clamp-2 md:top-4"
    >
      {message}
    </div>
  )
}
```

In `useToast.ts` set `const TOAST_MS = 2400` and update its comment ("brief §1: 2.4 s").

- [ ] **Step 4: Run tests** → PASS. Existing tests that assert the toast disappears after 1400 ms (`grep -rn "1400\|1500" client/src --include=*.test.tsx`) move to 2400.

- [ ] **Step 5: Commit** — `git commit -am "feat(ui): toast under the safe area, 2.4 s, two lines"`

---

### Task 4: PageShell / PageHeader / PageBody / PageFooter + EngineBadge + LessonChip in the header

**Files:**
- Create: `client/src/components/ui/page/PageShell.tsx`, `PageHeader.tsx`, `PageBody.tsx`, `PageFooter.tsx`, `headerRegistry.ts`, `EngineBadge.tsx`, `index.ts`
- Modify: `client/src/components/LessonChip.tsx` (extract `useLessonChipStatus`, add `variant="header"`, global fallback reads the registry), `client/src/components/ui/index.ts`
- Test: `client/src/components/ui/page/page.test.tsx`, extend `client/src/components/LessonChip.test.tsx`

**Interfaces:**
- Produces:
  - `<PageShell gutter?='16'|'20'|'24' className>` — the `<main>`; children are `PageHeader`, `PageBody`, `PageFooter` in that order.
  - `<PageHeader back={<BackButton…/>} right?={node} engine?={'azure'|'webspeech'|null}>{center}</PageHeader>` — `right` defaults to `<LessonChip variant="header" />`.
  - `<PageBody center? split?>` — plain scrolling column; with `split`, children must be `{ teach: node, act: node }` (object, not array) and the body lays out landscape 2 columns / portrait 2 tiers.
  - `<PageFooter>` — sibling CTA row; caller passes 1–2 `Button`s (first `flex-1`, primary `flex-[1.35]` via `className`).
  - `useLessonChipStatus(pathname, inMission): { doneCount, total } | null`.
  - `headerRegistry`: `registerHeader(): () => void`, `useHeaderMounted(): boolean`.

- [ ] **Step 1: Write the failing tests**

```tsx
// client/src/components/ui/page/page.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PageShell, PageHeader, PageBody, PageFooter } from './index'
import { BackButton } from '../BackButton'
import { Button } from '../Button'
import { LessonChip } from '../../LessonChip'

const wrap = (ui: React.ReactNode) => render(<MemoryRouter initialEntries={['/practice/wp-cat']}>{ui}</MemoryRouter>)

describe('PageShell', () => {
  it('is a viewport-high flex column with the frame gutters and safe-area padding', () => {
    wrap(<PageShell><PageBody>x</PageBody></PageShell>)
    const main = screen.getByRole('main')
    expect(main).toHaveClass('flex', 'h-full', 'flex-col', 'overflow-hidden', 'px-4', 'md:px-6')
    expect(main.className).toMatch(/env\(safe-area-inset-top\)/)
    expect(main.firstElementChild).toHaveClass('max-w-[1080px]', 'flex-1', 'min-h-0')
  })

  it('header is a 3-column grid whose right cell is as wide as the back button', () => {
    wrap(<PageShell><PageHeader back={<BackButton to="/" label="Về nhà" />}>giữa</PageHeader><PageBody>x</PageBody></PageShell>)
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('grid', 'h-14', 'md:h-16', 'grid-cols-[56px_1fr_56px]', 'md:grid-cols-[64px_1fr_minmax(64px,auto)]')
    expect(screen.getByText('giữa').parentElement).toHaveClass('justify-self-center')
  })

  it('shows the engine badge under the centre on a phone and beside it from md', () => {
    wrap(<PageShell><PageHeader back={<BackButton to="/" />} engine="webspeech">Từ mới 1/3</PageHeader><PageBody>x</PageBody></PageShell>)
    const badge = screen.getByTestId('engine-badge')
    expect(badge).toHaveTextContent('chế độ đơn giản')
    expect(badge).toHaveClass('text-[11px]', 'md:text-[12px]', 'md:rounded-r10', 'md:bg-sand')
  })

  it('body is the only scroller; footer is a sibling with the fade', () => {
    wrap(<PageShell><PageBody>x</PageBody><PageFooter><Button>Tiếp theo →</Button></PageFooter></PageShell>)
    expect(screen.getByTestId('page-body')).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto')
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveClass('flex', 'gap-2.5', 'md:gap-3', 'before:h-10', 'md:mx-auto', 'md:max-w-[572px]', 'ipad:max-w-none')
    expect(footer.className).not.toMatch(/sticky|fixed/)
  })

  it('split body lays teach/act as two columns on ipad and two tiers below', () => {
    wrap(<PageShell><PageBody split={{ teach: <p>dạy</p>, act: <p>làm</p> }} /></PageShell>)
    const body = screen.getByTestId('page-body')
    expect(body).toHaveClass('ipad:flex-row', 'ipad:gap-6')
    expect(screen.getByText('làm').parentElement).toHaveClass('md:h-[300px]', 'md:shrink-0', 'ipad:h-auto', 'ipad:w-[440px]', 'ipad:shrink-0')
  })
})

describe('LessonChip in the header', () => {
  it('renders the header variant in the right cell and the global one steps aside', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null)
    wrap(<><LessonChip /><PageShell><PageHeader back={<BackButton to="/" />}>x</PageHeader><PageBody>y</PageBody></PageShell></>)
    // With no lesson the chip renders nothing either way, but the header cell still exists:
    expect(screen.getByTestId('header-right')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
```

Extend `LessonChip.test.tsx` with a case that seeds today's lesson the way the existing tests do, mounts `<LessonChip variant="header" />` on an item route, and asserts the chip has `h-14 w-14 rounded-r18 md:h-12 md:px-4 md:rounded-r16` and no `fixed`; and one that mounts the global `<LessonChip />` after `registerHeader()` was called and asserts it renders `null`.

- [ ] **Step 2: Run to verify failure** — `pnpm --filter client exec vitest run src/components/ui/page src/components/LessonChip.test.tsx` → FAIL (modules missing).

- [ ] **Step 3: Implement the registry and the frame**

```ts
// headerRegistry.ts — the global LessonChip keeps rendering for screens not yet on PageShell.
import { useSyncExternalStore } from 'react'
let mounted = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
export function registerHeader(): () => void {
  mounted++; emit()
  return () => { mounted--; emit() }
}
export function useHeaderMounted(): boolean {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l) }, () => mounted > 0, () => false)
}
```

```tsx
// PageShell.tsx
import type { ReactNode } from 'react'
import { PAGE_SHELL } from '../pageShell'

const GUTTER = { '16': 'px-4', '20': 'px-5', '24': 'px-6' } as const

/** Brief §1: the one frame. Phone gutter 16 (a screen may ask for 20), iPad 24; body is the only
 * scroller, so the shell itself never scrolls (`overflow-hidden`). Vertical padding is the
 * safe-area shell: phone 47+8 / 34+10, iPad 20/24. */
export function PageShell({ gutter = '16', className = '', children }: { gutter?: keyof typeof GUTTER; className?: string; children: ReactNode }) {
  return (
    <main className={`flex h-full flex-col overflow-hidden bg-cream-50 ${GUTTER[gutter]} md:px-6 [--page-pad-top:1.25rem] [--page-pad-bottom:1.25rem] md:[--page-pad-bottom:1.5rem] ${PAGE_SHELL} ${className}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 flex-col">{children}</div>
    </main>
  )
}
```

Change `PAGE_SHELL` in `pageShell.ts` to `+ 8px` on top (brief: 55 = 47 + 8); bottom stays `+ 10px`.

```tsx
// EngineBadge.tsx
export function EngineBadge({ engine }: { engine: 'azure' | 'webspeech' | null | undefined }) {
  if (engine !== 'webspeech') return null
  return (
    <span data-testid="engine-badge" className="text-[11px] font-extrabold text-ink-300 md:rounded-r10 md:bg-sand md:px-2.5 md:py-1.5 md:text-[12px] md:text-sand-text">
      ◌ chế độ đơn giản
    </span>
  )
}
```

```tsx
// PageHeader.tsx
import { useEffect, type ReactNode } from 'react'
import { LessonChip } from '../../LessonChip'
import { EngineBadge } from './EngineBadge'
import { registerHeader } from './headerRegistry'

export function PageHeader({ back, right, engine, children }: { back: ReactNode; right?: ReactNode; engine?: 'azure' | 'webspeech' | null; children?: ReactNode }) {
  useEffect(() => registerHeader(), [])
  return (
    <header className="grid h-14 grid-cols-[56px_1fr_56px] items-center gap-2 md:h-16 md:grid-cols-[64px_1fr_minmax(64px,auto)] md:gap-3">
      <div className="justify-self-start">{back}</div>
      <div className="flex min-w-0 flex-col items-center justify-self-center gap-[3px] md:flex-row md:gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">{children}</div>
        <EngineBadge engine={engine} />
      </div>
      <div data-testid="header-right" className="flex justify-self-end">{right === undefined ? <LessonChip variant="header" /> : right}</div>
    </header>
  )
}
```

```tsx
// PageBody.tsx
import type { ReactNode } from 'react'

type Split = { teach: ReactNode; act: ReactNode }
/** The scrolling region. `center` centres short content; `split` is the speaking layout —
 * landscape: teach `flex:1` | act 440; portrait: teach `flex:1` over act 300 (brief §1). */
export function PageBody({ center, split, className = '', children }: { center?: boolean; split?: Split; className?: string; children?: ReactNode }) {
  if (split) {
    return (
      <div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:mt-4 ipad:flex-row ipad:gap-6 ipad:overflow-visible ${className}`}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">{split.teach}</div>
        <div className="flex flex-col items-center justify-center md:h-[300px] md:shrink-0 ipad:h-auto ipad:w-[440px] ipad:shrink-0 ipad:gap-4">{split.act}</div>
      </div>
    )
  }
  return (
    <div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col overflow-y-auto md:mt-4 ${center ? 'justify-center' : ''} ${className}`}>
      {children}
    </div>
  )
}
```

```tsx
// PageFooter.tsx
import type { ReactNode } from 'react'
/** Sibling of the body, never sticky (spec decision 7). The 40 px fade is a pseudo-element so
 * the body's last row is readable through it. On iPad portrait the row is centred at 572. */
export function PageFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <footer className={`relative flex w-full gap-2.5 pt-2.5 before:pointer-events-none before:absolute before:-top-10 before:left-[-16px] before:right-[-16px] before:h-10 before:bg-gradient-to-b before:from-transparent before:to-cream-50 before:content-[''] md:mx-auto md:max-w-[572px] md:gap-3 md:before:left-[-24px] md:before:right-[-24px] ipad:mx-0 ipad:max-w-none ${className}`}>
      {children}
    </footer>
  )
}
```

`index.ts` re-exports the four + `EngineBadge`; add `export * from './page'` to `components/ui/index.ts`.

- [ ] **Step 4: LessonChip — extract the status hook, add the header variant, make the global one yield**

In `LessonChip.tsx`:

```tsx
export function useLessonChipStatus(pathname: string, inMission: boolean) {
  const [lesson] = useState(() => lessonStatus(Date.now(), getActivity()))
  const hidden = lesson.done || isRedundant(pathname, inMission, lesson.items)
    || !lesson.items.some(item => onItemRoute(pathname, item.route))
  return hidden ? null : { doneCount: lesson.doneCount, total: lesson.total }
}

const HEADER_BOX = 'inline-flex h-14 w-14 flex-col items-center justify-center rounded-r18 bg-sun-50 font-display font-extrabold leading-none text-sun-700 shadow-chunky-sun active:translate-y-[2px] md:h-12 md:w-auto md:flex-row md:gap-2 md:rounded-r16 md:px-4 md:text-[16px]'

export function LessonChip({ variant = 'global' }: { variant?: 'global' | 'header' } = {}) {
  const { pathname, state } = useLocation()
  const headerMounted = useHeaderMounted()
  const inMission = (state as { mission?: unknown } | null)?.mission === true
  if (isExcluded(pathname)) return null
  // Phase 12 transition: a screen that mounts PageHeader draws its own chip in the header cell,
  // so the global one steps aside; screens not yet migrated still get the floating chip.
  if (variant === 'global' && headerMounted) return null
  return <LessonChipInner key={pathname} pathname={pathname} inMission={inMission} variant={variant} />
}
```

`LessonChipInner` takes `variant`, calls `useLessonChipStatus`, and renders `HEADER_BOX` for `header` (🌞 18px + `{done}/{total}` 13px, md: single text run "🌞 Nhiệm vụ {done}/{total}") or the existing `CHIP_BOX` for `global`. Keep the three-span pattern and its comment.

- [ ] **Step 5: Run tests, lint, typecheck** → PASS (LessonChip's existing tests still pass because the global variant is unchanged when no header is mounted).

- [ ] **Step 6: Commit** — `git add client/src/components && git commit -m "feat(ui): PageShell frame with header, scrolling body and sibling footer"`

---

### Task 5: Migrate batch A — navigation & list screens to PageShell

**Files:**
- Modify: `client/src/screens/Home.tsx`, `DailyMission.tsx`, `MissionComplete.tsx`, `TopicHub.tsx`, `LevelStairs.tsx`, `LevelSelect.tsx`, `SoundLevel.tsx`, `PairLevel.tsx`, `StarLevel.tsx`, `VoiceLevel.tsx`, `StoryList.tsx`, `WordTopics.tsx`, `WordList.tsx`, `SentenceList.tsx`, `SoundWordList.tsx` (+ their tests)

**Interfaces:**
- Consumes: `PageShell`, `PageHeader`, `PageBody`, `PageFooter`, `BackButton`, `Button`, `HomeLabel` (Task 4, 2, 1).

- [ ] **Step 1: Write the failing test for the batch**

Add to each screen's test file one assertion of the shape (example `StoryList.test.tsx`):

```tsx
it('sits in the shared page frame', () => {
  render(<MemoryRouter><StoryList /></MemoryRouter>)
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})
```

For `DailyMission` also assert the CTA is inside `screen.getByRole('contentinfo')` and that no element has class `sticky`. For `Home` assert the banner cell (`header-right`) holds the parent button on a phone: pass `right={<Link to="/parent" …>}` there because Home is excluded from the chip.

- [ ] **Step 2: Run to verify failure** — `pnpm --filter client exec vitest run src/screens/StoryList.test.tsx` → FAIL (no `main`/`banner` with those classes).

- [ ] **Step 3: Migrate — the pattern, shown on `StoryList.tsx`**

Before (current):

```tsx
<main className={`h-full overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
    <BackButton to="/" label="Về nhà" className="self-start" />
    <h1 className="font-display text-[40px] …">🎧 Nghe kể chuyện</h1>
    <div className="grid grid-cols-3 gap-6">…</div>
  </div>
</main>
```

After:

```tsx
<PageShell>
  <PageHeader back={<BackButton to="/" label="Về nhà" />}>
    <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">🎧 Nghe kể chuyện</h1>
  </PageHeader>
  <PageBody>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">…cards unchanged…</div>
  </PageBody>
</PageShell>
```

Rules for the batch (the body content of each screen is otherwise left as is — Phase 13 redraws it):
- H1 moves into the header centre at `text-[22px] md:text-[32px]`; a subtitle line, if any, becomes the first child of the body.
- Any `grid-cols-3`/`grid-cols-4` with no phone rule becomes `grid-cols-2 md:grid-cols-3` / `grid-cols-2 md:grid-cols-4` (the 57 px cell in the inventory).
- `DailyMission`: the sticky foot (`sticky bottom-0 -mx-4 … gradient`) becomes `<PageFooter>` holding Foxy + the CTA; drop `CTA_BUTTON` in favour of `<Button size="lg" className="flex-[1.35]" to=… state=…>`. `MissionComplete`: the `Về trang chủ` button moves to `PageFooter`; the body is `center`.
- `Home`: keep the map/grid untouched inside `PageBody`; the greeting row becomes the header centre (Foxy + bubble), `right={parentButton}`; the three banners stay in the body for now (Task 11 replaces them).
- `TopicHub`: the teal band stays in the body (phase 13 decides); back → `variant="child"` with no `max-md:` override. `LevelStairs`: the phone pinned CTA becomes `PageFooter`; drop `max-md:overflow-hidden` on the root (the body scrolls now).
- `LevelSelect`'s bare `<p>Không tìm thấy</p>` stays for now (Task 10 replaces it).

- [ ] **Step 4: Run tests, lint, typecheck** → PASS. Update assertions that looked for `max-w-5xl` / the old `<main>` classes.

- [ ] **Step 5: Screenshot and commit**

`SHOTS=home,mission,mission-done,topic-animals,levels,level-word-pop,level-sound-zoo,level-pairs,level-stars,level-voice,stories,words,words-animals,sentences,sound-list` at all three frames → `docs/design/current-phase12/`. Confirm in the phone `mission.png` that the CTA is inside the footer and that `levels` now scrolls instead of clipping.

```bash
git add client/src/screens
git commit -m "feat(shell): navigation and list screens on PageShell"
```

---

### Task 6: MicButton (4 states, responsive) + LevelBars + Countdown

**Files:**
- Create: `client/src/components/speak/MicButton.tsx`, `LevelBars.tsx`, `Countdown.tsx`, `index.ts`
- Modify: `client/src/components/MicButton.tsx` → re-export from `speak/MicButton`
- Test: `client/src/components/speak/speak.test.tsx`

**Interfaces:**
- Produces: `<MicButton state='idle'|'recording'|'processing'|'disabled'|'locked' level onPress secondsLeft?>` (renders button + halos + level bars + caption/countdown as one block); `<Countdown seconds>`; `<LevelBars level>`.
- Consumes: `shadow-mic`, `animate-halo`, `animate-spin`, `animate-level`, `bg-peach-50` (Task 1).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react'
import { MicButton, Countdown, LevelBars } from './index'

describe('MicButton', () => {
  it('idle is 124 on a phone and 150 from md, with the mic shadow', () => {
    render(<MicButton state="idle" level={0} onPress={() => {}} />)
    const b = screen.getByRole('button', { name: 'Bấm để nói' })
    expect(b).toHaveClass('h-[124px]', 'w-[124px]', 'md:h-[150px]', 'md:w-[150px]', 'shadow-mic')
    expect(screen.getByText('Chạm để nói nào!')).toBeInTheDocument()
  })
  it('recording grows to 150/190, shows two halos, level bars and the countdown instead of the caption', () => {
    render(<MicButton state="recording" level={0.5} onPress={() => {}} secondsLeft={13} />)
    const b = screen.getByRole('button', { name: 'Dừng' })
    expect(b).toHaveClass('h-[150px]', 'md:h-[190px]')
    expect(screen.getAllByTestId('mic-halo')).toHaveLength(2)
    expect(screen.getAllByTestId('level-bar')).toHaveLength(7)
    expect(screen.getByTestId('countdown')).toHaveTextContent('13')
    expect(screen.queryByText('Chạm để nói nào!')).toBeNull()
  })
  it('disabled shows the dashed spinner and the preparing caption; processing the hourglass', () => {
    const { rerender } = render(<MicButton state="disabled" level={0} onPress={() => {}} />)
    expect(screen.getByTestId('mic-spinner')).toHaveClass('animate-spin', 'border-dashed')
    expect(screen.getByText('Đang chuẩn bị máy chấm…')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    rerender(<MicButton state="processing" level={0} onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Đang chấm…' })).toHaveTextContent('⏳')
    expect(screen.getByText('Foxy đang chấm…')).toBeInTheDocument()
  })
  it('locked is disabled with the moon caption', () => {
    render(<MicButton state="locked" level={0} onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Hôm nay đã hết giờ' })).toBeDisabled()
  })
})

describe('Countdown', () => {
  it('is a 96px disc; two digits tighten the letter-spacing', () => {
    const { rerender } = render(<Countdown seconds={6} />)
    expect(screen.getByTestId('countdown')).toHaveClass('h-24', 'w-24', 'text-[44px]', 'bg-peach-50')
    rerender(<Countdown seconds={13} />)
    expect(screen.getByTestId('countdown')).toHaveClass('tracking-[-2px]')
  })
})

describe('LevelBars', () => {
  it('scales its seven bars with the level', () => {
    render(<LevelBars level={1} />)
    const bars = screen.getAllByTestId('level-bar')
    expect(bars[2]).toHaveStyle({ height: '28px' })
  })
})
```

- [ ] **Step 2: Run to verify failure** → module not found.

- [ ] **Step 3: Implement**

```tsx
// LevelBars.tsx — brief §2.2: 7 bars 6×(10–28) under the recording mic, driven by the input level.
const BASE = [10, 18, 28, 22, 14, 24, 12]
export function LevelBars({ level }: { level: number }) {
  const k = 0.4 + 0.6 * Math.max(0, Math.min(1, level))
  return (
    <div aria-hidden="true" className="flex h-7 items-center gap-[5px]">
      {BASE.map((h, i) => (
        <div key={i} data-testid="level-bar" className="w-1.5 rounded-[3px] bg-coral-500 transition-[height] duration-100" style={{ height: `${Math.round(h * k)}px` }} />
      ))}
    </div>
  )
}
```

```tsx
// Countdown.tsx
export function Countdown({ seconds }: { seconds: number }) {
  return (
    <div data-testid="countdown" aria-live="polite" className={`flex h-24 w-24 items-center justify-center rounded-full bg-peach-50 font-display text-[44px] font-extrabold leading-none text-coral-text ${seconds >= 10 ? 'tracking-[-2px]' : ''}`}>
      {seconds}
    </div>
  )
}
```

```tsx
// MicButton.tsx
import { Countdown } from './Countdown'
import { LevelBars } from './LevelBars'

export type MicState = 'idle' | 'recording' | 'processing' | 'disabled' | 'locked'
type Props = { state: MicState; level: number; onPress: () => void; secondsLeft?: number }

const LABEL: Record<MicState, string> = { idle: 'Bấm để nói', recording: 'Dừng', processing: 'Đang chấm…', disabled: 'Bấm để nói', locked: 'Hôm nay đã hết giờ' }
const CAPTION: Record<MicState, string | null> = { idle: 'Chạm để nói nào!', recording: null, processing: 'Foxy đang chấm…', disabled: 'Đang chuẩn bị máy chấm…', locked: 'Mai gặp lại nhé 🌙' }

/** Brief §2.2. The block reserves 214 px (190 + 24 for the bars) at md so the mic grows in place
 * without moving the CTA; on a phone the recording mic is 150 inside halos that reach 190. */
export function MicButton({ state, level, onPress, secondsLeft }: Props) {
  const rec = state === 'recording'
  const off = state === 'disabled' || state === 'processing' || state === 'locked'
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-[174px] w-[174px] items-center justify-center md:h-[214px] md:w-[214px]">
        {rec && [0, 0.7].map(d => (
          <span key={d} data-testid="mic-halo" aria-hidden="true" className="absolute h-[150px] w-[150px] rounded-full bg-coral-50 animate-halo md:h-[190px] md:w-[190px]" style={{ animationDelay: `${d}s` }} />
        ))}
        {state === 'disabled' && <span data-testid="mic-spinner" aria-hidden="true" className="absolute h-[144px] w-[144px] rounded-full border-[6px] border-dashed border-[#FFB899] animate-spin md:h-[172px] md:w-[172px]" />}
        <button
          aria-label={LABEL[state]}
          disabled={off}
          onClick={onPress}
          className={[
            'relative z-[1] flex items-center justify-center rounded-full bg-coral-500 text-white shadow-mic transition-transform active:translate-y-[3px]',
            'disabled:active:translate-y-0',
            state === 'disabled' ? 'opacity-50' : state === 'processing' ? 'opacity-70' : state === 'locked' ? 'opacity-40' : '',
            rec ? 'h-[150px] w-[150px] text-[60px] md:h-[190px] md:w-[190px] md:text-[76px]' : 'h-[124px] w-[124px] text-[50px] md:h-[150px] md:w-[150px] md:text-[60px]',
          ].join(' ')}
        >
          <span aria-hidden="true" className="leading-none transition-transform" style={rec ? { transform: `scale(${1 + level * 0.18})` } : undefined}>
            {state === 'processing' ? '⏳' : state === 'locked' ? '🌙' : rec ? '■' : '🎤'}
          </span>
        </button>
      </div>
      {rec && <LevelBars level={level} />}
      {rec && secondsLeft !== undefined ? <Countdown seconds={secondsLeft} /> : CAPTION[state] && <p className="text-[15px] font-bold text-ink-500">{CAPTION[state]}</p>}
    </div>
  )
}
```

`client/src/components/MicButton.tsx` becomes `export { MicButton } from './speak/MicButton'` (callers still pass `state/level/onPress`; `secondsLeft` is wired in Task 9).

- [ ] **Step 4: Run tests, lint, typecheck** → PASS (existing screen tests that asserted `h-[150px]` on the idle mic move to `h-[124px]`/`md:h-[150px]`).

- [ ] **Step 5: Commit** — `git add client/src/components && git commit -m "feat(speak): MicButton with four states, level bars and countdown"`

---

### Task 7: Speaking logic — typed errors, locked, fallback reason, not-ready timer

**Files:**
- Modify: `client/src/scoring/createScorer.ts`, `client/src/speaking/useSpeakingAttempt.ts`
- Create: `client/src/speaking/speakError.ts`
- Test: `client/src/speaking/useSpeakingAttempt.test.ts` (extend if present, else create), `client/src/scoring/createScorer.test.ts`

**Interfaces:**
- Produces: `type SpeakErrorKind = 'mic' | 'noSpeech' | 'unsupported' | 'fallback' | 'limit' | 'notReady'`; `type SpeakError = { kind: SpeakErrorKind; detail?: string }`; `SPEAK_ERROR_COPY: Record<SpeakErrorKind, { icon; title; sub; action }>`; `SpeakingAttempt.error: SpeakError | null`; `SpeakingAttempt.micState` gains `'locked'`; `SpeakingAttempt.dismissError(): void`; `createScorer(): Promise<{ scorer, engine, fallbackReason?: 'offline' | 'token' }>`.

- [ ] **Step 1: Write the failing tests**

```ts
// speakError copy is data; test the hook's decisions.
import { act, renderHook } from '@testing-library/react'
import { useSpeakingAttempt } from './useSpeakingAttempt'

vi.mock('../scoring/createScorer', () => ({ createScorer: vi.fn() }))
vi.mock('../audio/recorder', () => ({ useRecorder: () => ({ state: 'idle', level: 0, start: vi.fn(), stop: vi.fn() }) }))
import { createScorer } from '../scoring/createScorer'

describe('useSpeakingAttempt errors', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('reports notReady when the scorer takes longer than 3 s', async () => {
    vi.mocked(createScorer).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.error).toEqual({ kind: 'notReady' })
  })

  it('reports fallback once per session when Azure was not available', async () => {
    vi.mocked(createScorer).mockResolvedValue({ scorer: { score: vi.fn() } as never, engine: 'webspeech', fallbackReason: 'token' })
    const first = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))
    await act(async () => { await Promise.resolve() })
    expect(first.result.current.error).toEqual({ kind: 'fallback', detail: 'token' })
    act(() => first.result.current.dismissError())
    const second = renderHook(() => useSpeakingAttempt({ targetText: 'dog' }))
    await act(async () => { await Promise.resolve() })
    expect(second.result.current.error).toBeNull()
  })

  it('locks the mic when today is over the daily limit', async () => {
    const pre = 'speakup.'
    const now = Date.now()
    const events = Array.from({ length: 25 }, (_, i) => ({ ts: now - 25 * 60e3 + i * 60e3, kind: 'speak', id: `x${i}`, score: 80 }))
    localStorage.setItem(pre + 'activity', JSON.stringify(events))
    localStorage.setItem(pre + 'limit', JSON.stringify({ minutes: 20 }))
    vi.mocked(createScorer).mockResolvedValue({ scorer: { score: vi.fn() } as never, engine: 'azure' })
    const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))
    await act(async () => { await Promise.resolve() })
    expect(result.current.micState).toBe('locked')
    expect(result.current.error).toEqual({ kind: 'limit' })
  })
})
```

(Check the real limit storage shape in `client/src/progress/limit.ts` and use `setLimitMinutes(20)` from it instead of a raw key if the key differs.)

```ts
// createScorer.test.ts
vi.mock('./azureScorer', () => ({ AzureScorer: class {}, fetchToken: vi.fn() }))
import { fetchToken } from './azureScorer'
import { createScorer } from './createScorer'

it('names the reason it fell back', async () => {
  vi.mocked(fetchToken).mockRejectedValue(new Error('500'))
  const b = await createScorer()
  expect(b.engine).toBe('webspeech')
  expect(b.fallbackReason).toBe('token')
})
it('reports offline without retrying', async () => {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
  const b = await createScorer()
  expect(b.fallbackReason).toBe('offline')
  expect(fetchToken).not.toHaveBeenCalled()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter client exec vitest run src/speaking src/scoring/createScorer.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`speakError.ts`:

```ts
export type SpeakErrorKind = 'mic' | 'noSpeech' | 'unsupported' | 'fallback' | 'limit' | 'notReady'
export type SpeakError = { kind: SpeakErrorKind; detail?: string }

/** Brief §2.5 — the child's line, the parent's line, the button. */
export const SPEAK_ERROR_COPY: Record<SpeakErrorKind, { icon: string; title: string; sub: string; action: string }> = {
  mic: { icon: '🎤', title: 'Bé cho phép dùng mic nhé!', sub: 'mic bị từ chối / không có thiết bị', action: 'Mở cài đặt' },
  noSpeech: { icon: '👂', title: 'Không nghe rõ, bé thử lại nhé!', sub: 'NoMatch · timeout 15s · payload lỗi', action: 'Thử lại' },
  unsupported: { icon: '🌐', title: 'Trình duyệt này chưa nghe được', sub: 'không có nhận dạng giọng nói', action: 'Mở Chrome' },
  fallback: { icon: '📡', title: 'Mất kết nối — dùng chế độ đơn giản', sub: 'offline / máy chấm hỏng / quota 429', action: 'Tiếp tục' },
  limit: { icon: '🌙', title: 'Hôm nay bé học đủ rồi! Mai gặp lại nhé', sub: 'hết giới hạn phút/ngày · mic khoá', action: 'Về nhà' },
  notReady: { icon: '👂', title: 'Máy chấm chưa sẵn', sub: 'máy chấm chưa trả lời sau 3 giây', action: 'Thử lại' },
}
```

`createScorer.ts`: return `{ …, fallbackReason: 'offline' }` when `!navigator.onLine`, `{ …, fallbackReason: 'token' }` after the two failed attempts.

`useSpeakingAttempt.ts`:
- `error` state becomes `SpeakError | null`; replace the three `setError('…')` strings with `{ kind: 'mic' }`, `{ kind: 'unsupported' }`, `{ kind: 'noSpeech', detail: String(e) }`.
- `locked`: at the top of the reset effect, `const locked = minutesToday(Date.now(), getActivity()) >= getLimitMinutes()` (imports from `../progress/activity` and `../progress/limit`); store in state; when locked set `error = { kind: 'limit' }` and skip `createScorer`. `micState` returns `'locked'` first.
- `notReady`: in the same effect, `const t = window.setTimeout(() => { if (!scorerRef.current) setError({ kind: 'notReady' }) }, 3000)`; clear it in cleanup and when a scorer is adopted.
- `fallback`: after `adoptScorer(bundle)` on the initial create, if `bundle.fallbackReason && !sessionStorage.getItem('speakup.fallbackNoticed')` then `setError({ kind: 'fallback', detail: bundle.fallbackReason })`. `dismissError()` clears the error and, if it was `fallback`, sets `sessionStorage.setItem('speakup.fallbackNoticed', '1')`.
- Export `dismissError` on the returned object; `reset()` also clears the error as before.

- [ ] **Step 4: Fix the compile errors in the eight screens** that render `a.error` as text: for this task replace `{a.error && <p …>{a.error}</p>}` with `{a.error && <p …>{SPEAK_ERROR_COPY[a.error.kind].title}</p>}` (the real `SpeakError` component arrives in Task 8). Run `pnpm --filter client typecheck` until clean.

- [ ] **Step 5: Run all tests, lint** → PASS (screen tests that asserted the old strings still pass: the titles are the same sentences).

- [ ] **Step 6: Commit** — `git add client/src && git commit -m "feat(speak): typed speaking errors, daily-limit lock, visible engine fallback, 3s not-ready"`

---

### Task 8: WordChip + ResultCard + SpeakError; ScoreBars 2×2; ScoredWords non-interactive

**Files:**
- Create: `client/src/components/speak/WordChip.tsx`, `ResultCard.tsx`, `SpeakError.tsx`
- Modify: `client/src/components/ScoredWords.tsx` (renders `WordChip`, drops `onWordTap`), `client/src/components/ScoreBars.tsx` (always 2×2, new colours), `client/src/components/HintCard.tsx` (compact only), `client/src/components/speak/index.ts`
- Test: `client/src/components/speak/speak.test.tsx` (extend), update `components.test.tsx` for ScoredWords/ScoreBars

**Interfaces:**
- Produces:
  - `<WordChip word tone='good'|'ok'|'fix'|'unknown'>`
  - `<ResultCard stars praise score sub? prosody?={ score|null, engine } words?={ {word,tone}[] } bars?={ result } hint?={ {word,phoneme?,tip} } canReplay onReplay? onSample? onRetry primary={ label, onClick|to, state? } animate?>`
  - `<SpeakError error onAction onDismiss>`; `ScoredWords` keeps its name and `words` prop.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('WordChip / ScoredWords', () => {
  it('is a 40px non-interactive chip with the tone glyph', () => {
    render(<ScoredWords words={[{ word: 'cat', tone: 'good' }, { word: 'dog', tone: 'fix' }]} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    const chip = screen.getByText(/cat/).closest('[data-testid="word-chip"]')!
    expect(chip).toHaveClass('h-10', 'rounded-r12', 'text-[15px]', 'border-[3px]', 'bg-good-50', 'border-good-300')
    expect(chip).toHaveTextContent('✓ cat')
  })
  it('unknown tone is the white question chip', () => {
    render(<WordChip word="/θ/" tone="unknown" />)
    expect(screen.getByTestId('word-chip')).toHaveTextContent('? /θ/')
    expect(screen.getByTestId('word-chip')).toHaveClass('bg-white', 'border-sand-edge')
  })
})

describe('ScoreBars', () => {
  it('is always a 2×2 grid with the three fill colours', () => {
    render(<ScoreBars result={{ accuracy: 88, fluency: 60, completeness: 40, prosody: null } as never} />)
    expect(screen.getByTestId('score-bars')).toHaveClass('grid-cols-2')
    expect(screen.getByTestId('score-bars').className).not.toMatch(/md:flex/)
    const bars = screen.getAllByTestId('score-bar')
    expect(bars[0]).toHaveClass('bg-good-300'); expect(bars[1]).toHaveClass('bg-sun-400'); expect(bars[2]).toHaveClass('bg-bar-low')
    expect(bars[3]).toHaveAttribute('data-value', 'none')
  })
})

describe('ResultCard', () => {
  const base = { stars: 3 as const, praise: 'Đọc có hồn quá! 🎉', score: 86, sub: '2 từ cần sửa', onRetry: () => {}, primary: { label: 'Tiếp theo →', onClick: () => {} } }
  it('lays the six rows in order and hides the hint at 2+ stars', () => {
    render(<MemoryRouter><ResultCard {...base} words={[{ word: 'I', tone: 'good' }]} bars={{ accuracy: 88, fluency: 81, completeness: 100, prosody: 84 } as never} hint={{ word: 'friend', tip: 'x' }} canReplay onReplay={() => {}} onSample={() => {}} /></MemoryRouter>)
    const ids = Array.from(screen.getByTestId('result-card').children).map(c => c.getAttribute('data-row'))
    expect(ids).toEqual(['head', 'words', 'bars', 'listen', 'cta'])
    expect(screen.getByRole('button', { name: '🎧 Nghe mình' })).toBeInTheDocument()
  })
  it('shows the hint below 2 stars and drops "Nghe mình" without a blob', () => {
    render(<MemoryRouter><ResultCard {...base} stars={1} praise="Thử lại nào!" hint={{ word: 'friend', tip: 'x' }} canReplay={false} onSample={() => {}} /></MemoryRouter>)
    expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '🎧 Nghe mình' })).toBeNull()
    expect(screen.getByRole('button', { name: '🔊 Nghe mẫu' })).toHaveClass('flex-1')
  })
  it('prosody pill reads the engine', () => {
    render(<MemoryRouter><ResultCard {...base} prosody={{ score: null, engine: 'webspeech' }} /></MemoryRouter>)
    expect(screen.getByTestId('prosody-chip')).toHaveTextContent('— ngữ điệu')
  })
})

describe('SpeakError', () => {
  it('renders the copy for the kind and forwards the action', () => {
    const onAction = vi.fn()
    render(<SpeakError error={{ kind: 'limit' }} onAction={onAction} onDismiss={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Hôm nay bé học đủ rồi! Mai gặp lại nhé')
    fireEvent.click(screen.getByRole('button', { name: 'Về nhà' }))
    expect(onAction).toHaveBeenCalledWith('limit')
  })
})
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

```tsx
// WordChip.tsx — brief §2.4 ②: 40 px, never a button (spec decision 3).
export type WordTone = 'good' | 'ok' | 'fix' | 'unknown'
const TONE: Record<WordTone, { cls: string; glyph: string; label: string }> = {
  good: { cls: 'bg-good-50 text-good-700 border-good-300', glyph: '✓', label: 'đúng' },
  ok: { cls: 'bg-ok-50 text-ok-700 border-ok-300', glyph: '～', label: 'tạm được' },
  fix: { cls: 'bg-fix-50 text-fix-700 border-fix-300', glyph: '✗', label: 'cần sửa' },
  unknown: { cls: 'bg-white text-ink-500 border-sand-edge', glyph: '?', label: 'chưa chấm được' },
}
export function WordChip({ word, tone }: { word: string; tone: WordTone }) {
  const t = TONE[tone]
  return (
    <span data-testid="word-chip" aria-label={`${word} ${t.label}`} className={`inline-flex h-10 items-center rounded-r12 border-[3px] px-3 font-display text-[15px] font-extrabold ${t.cls}`}>
      <span aria-hidden="true">{t.glyph} </span>{word}
    </span>
  )
}
```

`ScoredWords.tsx`: `export function ScoredWords({ words }: { words: { word: string; tone: 'good' | 'ok' | 'fix' }[] })` → `<div className="flex flex-wrap justify-center gap-1.5">{words.map((w, i) => <WordChip key={i} word={w.word} tone={w.tone} />)}</div>`. Remove `onWordTap` and its call in `PracticeCard.tsx`.

`ScoreBars.tsx`: root `data-testid="score-bars"` with `grid w-full grid-cols-2 gap-x-3.5 gap-y-2`; each bar: label row `flex justify-between text-[12px] font-extrabold` (label `text-ink-500`, value `text-ink-900`, `—` when null); track `h-2.5 rounded-r10 bg-track`; fill class by value: `>=80 → 'bg-good-300'`, `>=55 → 'bg-sun-400'`, else `'bg-bar-low'`; keep `data-testid="score-bar"`, `data-value`, `aria-label`.

`HintCard.tsx`: single compact variant per brief §2.4 ④ — `flex items-center gap-2.5 rounded-r16 border-[3px] border-[#FFDF9E] bg-[#FFF6E0] px-3 py-[9px]`, 👅 `text-[24px]`, text `text-[13px] font-bold text-sun-700` reading `Sửa từ này: {word}{phoneme ? ` (âm "${phoneme}")` : ''} — {tip}`.

```tsx
// ResultCard.tsx
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Stars } from '../ui/Stars'
import { ScoreBars } from '../ScoreBars'
import { ScoredWords } from '../ScoredWords'
import { HintCard } from '../HintCard'
import type { PronunciationResult } from '../../scoring/types'
import type { WordTone } from './WordChip'

type Primary = { label: string; onClick?: () => void; to?: string; state?: unknown }
export type ResultCardProps = {
  stars: 0 | 1 | 2 | 3
  praise: string
  score?: number
  sub?: string
  prosody?: { score: number | null; engine: 'azure' | 'webspeech' | null }
  words?: { word: string; tone: Exclude<WordTone, 'unknown'> }[]
  bars?: PronunciationResult
  hint?: { word: string; phoneme?: string; tip: string }
  canReplay: boolean
  onReplay?: () => void
  onSample?: () => void
  onRetry: () => void
  /** Omitted while PracticeCard's retry gate is closed (<3★ and <3 attempts): the CTA row then holds "↻ Thử lại" alone. */
  primary?: Primary
  animate?: boolean
  /** Extra rows a screen slots between the head and the words (SoundPractice's SoundChip). */
  extra?: React.ReactNode
}

function ProsodyPill({ score, engine }: NonNullable<ResultCardProps['prosody']>) {
  const none = score === null || engine === 'webspeech'
  const tone = none ? 'none' : score >= 80 ? 'good' : score >= 60 ? 'ok' : 'fix'
  const cls = { good: 'bg-good-50 text-good-700', ok: 'bg-ok-50 text-ok-700', fix: 'bg-fix-50 text-fix-700', none: 'bg-sand text-sand-text' }[tone]
  return <span data-testid="prosody-chip" data-tone={tone} className={`flex h-8 shrink-0 items-center rounded-r10 px-2.5 text-[12px] font-extrabold ${cls}`}>{none ? '— ngữ điệu' : `🎭 Ngữ điệu ${score >= 80 ? 'tốt' : score >= 60 ? 'khá' : 'chưa tốt'}`}</span>
}

/** Brief §2.4 — the one result read-out. Rows ①–⑥ in a fixed order; ① and ⑥ are pinned on a
 * phone while ②–⑤ scroll (the `min-h-0 overflow-y-auto` middle). */
export function ResultCard(p: ResultCardProps) {
  const listen = (p.canReplay && p.onReplay) || p.onSample
  return (
    <div data-testid="result-card" className="flex w-full max-w-[440px] flex-col gap-3 rounded-r22 bg-cream-50 p-4">
      <div data-row="head" className="flex items-center gap-3 rounded-r18 bg-white px-3.5 py-3 shadow-card-sm">
        <Stars value={p.stars} size="md" animate={p.animate} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[18px] font-extrabold leading-tight text-ink-900">{p.praise}</div>
          {(p.score !== undefined || p.sub) && <div className="text-[12px] font-bold text-ink-500">{p.score !== undefined ? `Điểm: ${Math.round(p.score)}` : ''}{p.score !== undefined && p.sub ? ' · ' : ''}{p.sub ?? ''}</div>}
        </div>
        {p.prosody && <ProsodyPill {...p.prosody} />}
      </div>
      {p.extra && <div data-row="extra">{p.extra}</div>}
      {p.words && <div data-row="words" className="min-h-0 overflow-y-auto"><ScoredWords words={p.words} /></div>}
      {p.bars && <div data-row="bars"><ScoreBars result={p.bars} /></div>}
      {p.hint && p.stars < 2 && <div data-row="hint"><HintCard hint={p.hint} /></div>}
      {listen && (
        <div data-row="listen" className="flex gap-2">
          {p.canReplay && p.onReplay && <button type="button" onClick={p.onReplay} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-r14 border-[3px] border-teal-line bg-white font-display text-[15px] font-extrabold text-teal-600">🎧 Nghe mình</button>}
          {p.onSample && <button type="button" onClick={p.onSample} className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-r14 border-[3px] border-teal-line bg-white font-display text-[15px] font-extrabold text-teal-600">🔊 Nghe mẫu</button>}
        </div>
      )}
      <div data-row="cta" className="flex gap-2.5">
        <Button variant="outline" className="flex-1" onClick={p.onRetry}>↻ Thử lại</Button>
        {p.primary && (p.primary.to !== undefined
          ? <Button className="flex-[1.35]" to={p.primary.to} state={p.primary.state}>{p.primary.label}</Button>
          : <Button className="flex-[1.35]" onClick={p.primary.onClick}>{p.primary.label}</Button>)}
      </div>
    </div>
  )
}
```

```tsx
// SpeakError.tsx — brief §2.5
import { SPEAK_ERROR_COPY, type SpeakError as SpeakErrorValue, type SpeakErrorKind } from '../../speaking/speakError'
export function SpeakError({ error, onAction, onDismiss }: { error: SpeakErrorValue; onAction: (kind: SpeakErrorKind) => void; onDismiss: () => void }) {
  const c = SPEAK_ERROR_COPY[error.kind]
  return (
    <div role="alert" className="flex w-full max-w-[440px] items-center gap-3 rounded-r16 border-[3px] border-fix-300 bg-fix-50 py-2 pl-3.5 pr-2 min-h-[56px]">
      <span aria-hidden="true" className="text-[22px] leading-none">{c.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[15px] font-extrabold leading-tight text-fix-700">{c.title}</div>
        <div className="text-[12px] font-bold text-ink-500">{error.detail ? `${c.sub} · ${error.detail}` : c.sub}</div>
      </div>
      <button type="button" onClick={() => { onAction(error.kind); onDismiss() }} className="h-10 shrink-0 rounded-r12 bg-white px-3.5 font-display text-[14px] font-extrabold text-fix-700">{c.action}</button>
    </div>
  )
}
```

`ProsodyChip.tsx` stays for VoicePractice until Task 9 removes its use; then delete it and its test.

- [ ] **Step 4: Run tests, lint, typecheck** → PASS (update `components.test.tsx` assertions on ScoredWords buttons / ScoreBars `md:flex`).

- [ ] **Step 5: Commit** — `git add client/src/components && git commit -m "feat(speak): ResultCard, WordChip, SpeakError; ScoreBars 2x2"`

---

### Task 9: Wire the speaking screens (batch B) onto PageShell + ResultCard + SpeakError + MicButton countdown

**Files:**
- Modify: `client/src/screens/PracticeCard.tsx`, `SoundPractice.tsx`, `PairPractice.tsx`, `StarPractice.tsx`, `VoicePractice.tsx`, `StoryRetell.tsx`, `WordCard.tsx`, `SentenceBuilder.tsx` (+ tests); delete `client/src/components/ProsodyChip.tsx` (+ test) once unused; delete the four copies of `CTA_PHONE`, `CTA_IPAD`, `SAMPLE_CHIP` duplicates.

**Interfaces:**
- Consumes: `PageShell/PageHeader/PageBody(split)/PageFooter`, `ResultCard`, `SpeakError`, `MicButton(secondsLeft)`, `useSpeakingAttempt().dismissError`, `SPEAK_ERROR_COPY`.

- [ ] **Step 1: Write the failing tests (one per screen, same shape)**

Example for `VoicePractice.test.tsx` (the existing tests already mock `useSpeakingAttempt`; extend the result-state case):

```tsx
it('renders the result through ResultCard inside the split body and the error through SpeakError', () => {
  mockAttempt({ result: azureResult14Words, error: null, lastBlob: new Blob() })
  render(<MemoryRouter initialEntries={['/voice/sv1']}><Routes><Route path="/voice/:id" element={<VoicePractice />} /></Routes></MemoryRouter>)
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('ipad:flex-row')
  const card = screen.getByTestId('result-card')
  expect(card.querySelectorAll('[data-testid="word-chip"]')).toHaveLength(14)
  expect(screen.getByTestId('prosody-chip')).toBeInTheDocument()
  expect(screen.queryByText('Ngữ điệu 84')).toBeNull()      // old ProsodyChip gone
  mockAttempt({ result: null, error: { kind: 'mic' }, lastBlob: null })
  render(<MemoryRouter initialEntries={['/voice/sv1']}><Routes><Route path="/voice/:id" element={<VoicePractice />} /></Routes></MemoryRouter>)
  expect(screen.getByRole('alert')).toHaveTextContent('Bé cho phép dùng mic nhé!')
})
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Migrate — pattern shown on `VoicePractice.tsx`**

```tsx
const a = useSpeakingAttempt({ targetText: passage.text, autoStopMs: AUTO_STOP_MS, resetKey: id, onResult })
const navigate = useNavigate()
const onErrorAction = (kind: SpeakErrorKind) => {
  if (kind === 'limit') navigate('/')
  else if (kind === 'noSpeech' || kind === 'notReady') a.reset()
  // 'mic' / 'unsupported' / 'fallback': dismissing is the action for now (spec decision 11)
}

return (
  <PageShell gutter="20">
    <PageHeader back={<BackButton to={backTo} label={backLabel} />} engine={a.engine}>
      <Chip tone="coral">{mission ? mission.noun : `Đoạn ${index + 1}/${STORY_VOICE.length}`}</Chip>
    </PageHeader>
    <PageBody split={{
      teach: (
        <div className={`flex w-full flex-col items-center gap-3 ${result ? 'max-md:hidden' : ''}`}>
          {/* mood · Passage · gloss · 🔊 Nghe mẫu · tips card — unchanged markup */}
        </div>
      ),
      act: result ? (
        <ResultCard
          stars={earned} praise={message} score={result.overall} sub={subLine(feedback)}
          prosody={{ score: prosody, engine: a.engine }}
          words={feedback.words} bars={result} hint={feedback.hint}
          canReplay={!!a.lastBlob} onReplay={() => playBlob(a.lastBlob!)} onSample={playSample}
          onRetry={() => a.reset()}
          primary={mission ? { label: mission.label, onClick: mission.go } : next ? { label: 'Tiếp theo →', to: `/voice/${next.id}` } : { label: 'Hoàn thành 🎉', to: '/level/story-voice' }}
          animate={earned === 3}
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          {!recording && <p className="text-[15px] font-bold text-ink-500">Đọc cả đoạn thật có hồn nhé!</p>}
          {a.error && <SpeakError error={a.error} onAction={onErrorAction} onDismiss={a.dismissError} />}
          <MicButton state={a.micState} level={a.level} onPress={a.onMic} secondsLeft={recording ? secondsLeft : undefined} />
        </div>
      ),
    }} />
  </PageShell>
)
```

Per-screen mapping for the `ResultCard` props:

| Screen | `praise` | `score` / `sub` | `prosody` | `words` | `bars` | `hint` | `extra` | primary |
|---|---|---|---|---|---|---|---|---|
| PracticeCard | `feedback.message` (+ streak override) | `result.overall` / — | — | 1 chip | result | feedback.hint | — | gate unchanged: retry-only until 3★ or 3 attempts → pass `primary` only when advance allowed; ResultCard renders the CTA row with the outline alone when `primary` is `undefined` (make `primary` optional) |
| SoundPractice | 3/2/1 messages | `result.overall` as "Từ {word} · N điểm" in `sub` | — | — | — | tip when tone ≠ good | `<WordChip word={`/${ipa}/`} tone={tone ?? 'unknown'} />` + unscored sentence | next word / `/sound/:ph` |
| PairPractice | `feedback.message` | `result.overall` | — | 2 chips | — | feedback.hint | — | next pair / level |
| StarPractice | `starMessage` | `result.overall` / `rhythmLine` | — | ≤6 chips | result | feedback.hint | — | next / level |
| VoicePractice | as above | | `{prosody, engine}` | ≤14 | result | hint | — | next / level |
| StoryRetell | 3 retell messages | `result.overall` | — | — | — | — | — | mission / `/mission` / `/stories` |
| WordCard | none shown before → use "Tuyệt vời!" ladder from `toFeedback` | `result.overall` / "🔓 Mở khoá!" as `sub` when unlocked | — | 1 chip | — | hint on retry | — | `mission.label` / next word |
| SentenceBuilder | `feedback.message` | `result.overall` | — | ≤6 | result | hint | — | mission / next |

Other rules for the batch:
- Every screen: header centre = its counter chip (+ dots where they existed) + `engine`; the old `min-w-[66px]` gutter and badge text are deleted.
- `secondsLeft` comes from each screen's existing countdown state; delete the duplicated `useEffect` timers only if a screen no longer needs the number for anything else (it does — keep the state, pass it down).
- `SoundPractice`: the `processing` mic no longer re-shows the word tier — gate the teach content on `!result && !recording && a.micState !== 'processing'`.
- `WordCard`'s two sticky rows and `SentenceBuilder`'s `mt-auto` rows become `PageFooter` (guess-step "Tiếp theo →") or the `ResultCard` CTA row; nothing sticky remains (`grep -rn "sticky" client/src/screens` returns nothing).
- The not-found `<p>` on each screen stays until Task 10.

- [ ] **Step 4: Run tests, lint, typecheck** → PASS. Delete `ProsodyChip.tsx` + test, the `CTA_PHONE`/`CTA_IPAD`/`SAMPLE_CHIP` constants (the sample button becomes `<Button variant="outline">🔊 Nghe mẫu</Button>`).

- [ ] **Step 5: Screenshot and commit**

`SHOTS=practice-idle,sound-practice-idle,pair-listen,star-idle,voice-idle,retell-idle,word-card-front,sentence-correct` at all three frames. Record in the task report: at 1194×834 the idle screens fit 834 and the act column is 440 wide (measure `[data-testid=page-body] > :last-child` width).

```bash
git add client/src
git commit -m "feat(speak): speaking screens on PageShell with ResultCard and SpeakError"
```

---

### Task 10: NotFound + EmptyState, wired

**Files:**
- Create: `client/src/components/ui/NotFound.tsx`, `EmptyState.tsx`
- Modify: `PracticeCard.tsx`, `SoundWordList.tsx`, `SoundPractice.tsx`, `PairPractice.tsx`, `StarPractice.tsx`, `VoicePractice.tsx`, `LevelSelect.tsx`, `WordList.tsx`, `WordCard.tsx`, `SentenceBuilder.tsx`, `StoryPlayer.tsx`, `StoryQuiz.tsx`, `StoryRetell.tsx` (not-found); `WordList.tsx` (review empty), `ParentDashboard.tsx` (recordings, weak phonemes, chart), `DailyMission.tsx` (empty lesson) (+ tests)
- Test: `client/src/components/ui/ui.test.tsx`

**Interfaces:**
- Produces: `<NotFound what='thẻ'|'âm'|'cặp từ'|'câu'|'đoạn'|'truyện'|'đảo'|'chủ đề'|'bậc' to?='/'>` (renders its own `PageShell`); `<EmptyState emoji title sub cta?={label,to} adult?>`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('NotFound', () => {
  it('names the thing, shows surprised Foxy and a way home', () => {
    router(<NotFound what="cặp từ" />)
    expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy cặp từ này 🦊')
    expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/')
    expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'surprised')
  })
})
describe('EmptyState', () => {
  it('centres emoji, title, sub and an optional outline CTA', () => {
    router(<EmptyState emoji="📚" title="Chưa có từ cần ôn hôm nay" sub="Học thêm từ mới, mai quay lại ôn nhé!" cta={{ label: 'Từ mới hôm nay →', to: '/words' }} />)
    expect(screen.getByTestId('empty-state')).toHaveClass('min-h-[150px]', 'rounded-r18', 'bg-cream-50')
    expect(screen.getByRole('link', { name: 'Từ mới hôm nay →' })).toHaveClass('min-h-[44px]')
  })
  it('adult variant is smaller', () => {
    render(<EmptyState adult emoji="🎙️" title="Chưa có bản ghi nào" sub="Bản ghi xuất hiện sau khi bé luyện nói." />)
    expect(screen.getByText('Chưa có bản ghi nào')).toHaveClass('text-[14px]')
  })
})
```

(`Foxy` must expose `data-testid="foxy" data-mood={mood}` on its root — add it if missing.)

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

```tsx
// NotFound.tsx — brief §2.6
import { Foxy } from '../Foxy'
import { Button } from './Button'
import { PageShell, PageBody } from './page'
export function NotFound({ what, to = '/' }: { what: string; to?: string }) {
  return (
    <PageShell>
      <PageBody center className="items-center gap-3 text-center">
        <div className="h-[93px] w-[96px]"><Foxy mood="surprised" size="md" /></div>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900">Ơ, không tìm thấy {what} này 🦊</h1>
        <p className="text-[14px] font-bold text-ink-500">Có thể đường dẫn bị lỗi. Về nhà rồi chọn lại nhé.</p>
        <Button variant="secondary" to={to} className="mt-1.5">← Về trang chủ</Button>
      </PageBody>
    </PageShell>
  )
}
```

```tsx
// EmptyState.tsx — brief §2.6
import { Link } from 'react-router-dom'
export function EmptyState({ emoji, title, sub, cta, adult, className = '' }: { emoji: string; title: string; sub: string; cta?: { label: string; to: string }; adult?: boolean; className?: string }) {
  return (
    <div data-testid="empty-state" className={`flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-r18 bg-cream-50 p-4 text-center ${className}`}>
      <span aria-hidden="true" className={`leading-none ${adult ? 'text-[24px]' : 'text-[34px]'}`}>{emoji}</span>
      <div className={`font-display font-extrabold leading-tight text-ink-900 ${adult ? 'text-[14px]' : 'text-[16px]'}`}>{title}</div>
      <div className="text-[12px] font-bold leading-snug text-ink-500">{sub}</div>
      {cta && <Link to={cta.to} className="mt-1 inline-flex min-h-[44px] items-center rounded-r14 border-[3px] border-teal-line bg-white px-4 font-display text-[14px] font-extrabold text-teal-600">{cta.label}</Link>}
    </div>
  )
}
```

Wire: each `return <p>Không tìm thấy …</p>` → `return <NotFound what="…" to={…} />` (thẻ / âm / cặp từ / câu / đoạn / bậc / chủ đề / từ; story screens: `what="truyện"`, `to="/stories"`). Empties: WordList review → 📚 with CTA `/words`; Dashboard recordings → 🎙️ adult; weak phonemes → 🔤 adult; chart (no events at all) → 📈 adult in place of the bars; DailyMission with 0 groups → 🌞 with CTA "Luyện tự do →" to `/`.

- [ ] **Step 4: Run tests, lint, typecheck** → PASS (screen tests asserting the bare "Không tìm thấy" text move to the new heading).

- [ ] **Step 5: Commit** — `git add client/src && git commit -m "feat(ui): NotFound and EmptyState replace bare paragraphs"`

---

### Task 11: Notice + NoticeStack, wired into Home, Dashboard, CloudStart

**Files:**
- Create: `client/src/components/ui/Notice.tsx`, `NoticeStack.tsx`
- Modify: `Home.tsx` (3 banners), `ParentDashboard.tsx` (no-session, recovery code, profile-unreadable, profile-notice, reset-notice), `CloudStart.tsx` (info/error strips) (+ tests)
- Test: `client/src/components/ui/ui.test.tsx`

**Interfaces:**
- Produces: `<Notice kind='info'|'warn'|'error'|'success'|'credential'|'pending' title sub? action?={label,onClick} onClose? code? testId?>`; `<NoticeStack items={NoticeProps[]}>` (priority error > warn > pending > credential > success > info; renders 2, then a `+N thông báo` line).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('Notice', () => {
  it('colours by kind and shows action/close', () => {
    const onClose = vi.fn()
    render(<Notice kind="warn" title="Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!" sub="Giới hạn 20 phút/ngày" onClose={onClose} />)
    const n = screen.getByRole('status')
    expect(n).toHaveClass('bg-sun-50', 'border-[#FFDF9E]', 'text-sun-700', 'rounded-r16', 'border-[3px]')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalled()
  })
  it('credential kind shows the code and a copy button', () => {
    render(<Notice kind="credential" title="Mã khôi phục — chụp màn hình lại nhé" sub="Chỉ hiện 1 lần." code="QZQJ7MFC" />)
    expect(screen.getByText('QZQJ7MFC')).toHaveClass('tracking-[4px]', 'text-[24px]')
    expect(screen.getByRole('button', { name: 'Chép mã' })).toBeInTheDocument()
  })
})
describe('NoticeStack', () => {
  it('orders by priority and folds the third', () => {
    render(<NoticeStack items={[{ kind: 'info', title: 'A' }, { kind: 'error', title: 'B' }, { kind: 'warn', title: 'C' }]} />)
    const titles = screen.getAllByRole('status').map(n => n.textContent)
    expect(titles[0]).toContain('B'); expect(titles[1]).toContain('C')
    expect(screen.getByText('+1 thông báo')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

```tsx
// Notice.tsx — brief §2.7
export type NoticeKind = 'info' | 'warn' | 'error' | 'success' | 'credential' | 'pending'
const KIND: Record<NoticeKind, { cls: string; icon: string }> = {
  info: { cls: 'bg-teal-50 border-teal-line text-teal-600', icon: 'ℹ️' },
  warn: { cls: 'bg-sun-50 border-[#FFDF9E] text-sun-700', icon: '⚠️' },
  error: { cls: 'bg-fix-50 border-fix-300 text-fix-700', icon: '⛔' },
  success: { cls: 'bg-good-50 border-good-300 text-good-700', icon: '✅' },
  credential: { cls: 'bg-white border-teal-500 text-ink-900', icon: '🔑' },
  pending: { cls: 'bg-sand border-sand-edge text-[#6B5B4D]', icon: '⏳' },
}
export type NoticeProps = { kind: NoticeKind; title: string; sub?: string; action?: { label: string; onClick: () => void }; onClose?: () => void; code?: string; testId?: string }
export function Notice({ kind, title, sub, action, onClose, code, testId }: NoticeProps) {
  const k = KIND[kind]
  return (
    <div role="status" data-testid={testId} className={`flex items-start gap-3 rounded-r16 border-[3px] py-2.5 pl-3.5 pr-2.5 ${k.cls}`}>
      <span aria-hidden="true" className="mt-px text-[20px] leading-none">{k.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-extrabold leading-snug">{title}</div>
        {sub && <div className="mt-0.5 text-[12px] font-bold leading-snug opacity-85 [overflow-wrap:anywhere]">{sub}</div>}
        {code && (
          <div className="mt-2 flex items-center gap-2.5">
            <div className="rounded-r10 bg-white px-3 py-1.5 font-display text-[24px] font-extrabold tracking-[4px]">{code}</div>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(code) }} className="h-10 rounded-r12 bg-teal-500 px-3.5 text-[13px] font-extrabold text-white">Chép mã</button>
          </div>
        )}
      </div>
      {action && <button type="button" onClick={action.onClick} className="h-10 shrink-0 rounded-r12 bg-white/70 px-3 text-[13px] font-extrabold">{action.label}</button>}
      {onClose && <button type="button" aria-label="Đóng" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-r12 text-[18px] opacity-60">✕</button>}
    </div>
  )
}
```

```tsx
// NoticeStack.tsx
const PRIORITY: Record<NoticeKind, number> = { error: 0, warn: 1, pending: 2, credential: 3, success: 4, info: 5 }
export function NoticeStack({ items, max = 2, className = '' }: { items: NoticeProps[]; max?: number; className?: string }) {
  const sorted = [...items].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
  const shown = sorted.slice(0, max)
  const rest = sorted.length - shown.length
  if (!sorted.length) return null
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {shown.map((n, i) => <Notice key={i} {...n} />)}
      {rest > 0 && <div className="text-center text-[12px] font-bold text-ink-300">+{rest} thông báo</div>}
    </div>
  )
}
```

Wire: Home builds `items` from `overLimit` (warn, no close), milestone (info: "Liên kết email để giữ tiến độ của bé", action → `/parent`, onClose = dismiss), A2HS (info, action "Cách làm" opens the existing how-to, onClose) → `<NoticeStack items={…} />` at the top of the body. Dashboard: `no-session` → warn (testId `no-session`), recovery code → credential (`code`), profile-unreadable → warn (testId `profile-unreadable`), profile-notice → error (testId `profile-notice`), reset-notice → pending with action "Thử xoá lại" (testId `reset-notice`). CloudStart: info strip → `kind="info"`, error strip → `kind="error"` (keep `role="alert"` semantics by passing `testId` and asserting text).

- [ ] **Step 4: Run tests, lint, typecheck** → PASS (Dashboard/Home tests locate the same testIds/text).

- [ ] **Step 5: Screenshot and commit** — `SHOTS=home-over-limit,home-ios-a2hs,parent-dashboard,start-menu` phone + ipad.

```bash
git add client/src && git commit -m "feat(ui): Notice and NoticeStack replace the yellow banners"
```

---

### Task 12: Dialog + useDialog; replace the four native dialogs; name clamp + shortName

**Files:**
- Create: `client/src/components/ui/Dialog.tsx`, `DialogProvider.tsx`, `useDialog.ts`
- Modify: `client/src/main.tsx` (wrap in `DialogProvider` inside the router), `client/src/screens/ParentDashboard.tsx` (reset, sign-out, add, rename), `client/src/cloud/profileState.ts` (`NAME_MAX = 40`, clamp in `addProfile`/`renameProfile`, export `shortName`), `ProfilePicker.tsx`, `Home.tsx`, `ParentDashboard.tsx` (use `shortName`)
- Test: `client/src/components/ui/dialog.test.tsx`, `client/src/cloud/profileState.test.ts` (extend), `ParentDashboard.test.tsx` (replace `window.confirm` spies)

**Interfaces:**
- Produces: `useDialog(): { confirm(o: DialogOptions): Promise<boolean>; destructive(o): Promise<boolean>; prompt(o: PromptOptions): Promise<string | null> }` where `DialogOptions = { title; body; confirmLabel; cancelLabel? }`, `PromptOptions = { title; label; initial?; maxLength?; confirmLabel? }`; `shortName(name: string): string` (last two words); `NAME_MAX = 40`.

- [ ] **Step 1: Write the failing tests**

```tsx
// dialog.test.tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DialogProvider } from './DialogProvider'
import { useDialog } from './useDialog'

function Harness({ onDone }: { onDone: (v: unknown) => void }) {
  const d = useDialog()
  return <>
    <button onClick={() => void d.destructive({ title: 'Xoá toàn bộ tiến trình của bé?', body: 'Không khôi phục được.', confirmLabel: 'Xoá tiến trình' }).then(onDone)}>del</button>
    <button onClick={() => void d.prompt({ title: 'Đổi tên hồ sơ', label: 'Tên của bé', initial: 'Bé', maxLength: 40 }).then(onDone)}>ren</button>
  </>
}

it('destructive dialog resolves true on the red button and false on cancel', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('del'))
  const dlg = screen.getByRole('dialog')
  expect(dlg).toHaveClass('w-[min(420px,calc(100%-32px))]', 'rounded-r20')
  expect(screen.getByRole('button', { name: 'Xoá tiến trình' })).toHaveClass('bg-fix-700', 'min-h-[44px]')
  fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith(false)
})

it('prompt clamps to maxLength, shows the counter and resolves the text', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('ren'))
  const input = screen.getByLabelText('Tên của bé')
  fireEvent.change(input, { target: { value: 'Nguyễn Hoàng Bảo Ngọc Anh Thư' } })
  expect(screen.getByText('29/40')).toBeInTheDocument()
  expect(screen.getByText(/dưới dạng "Anh Thư"/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith('Nguyễn Hoàng Bảo Ngọc Anh Thư')
})
```

```ts
// profileState.test.ts additions
it('clamps a profile name to 40 characters and shortens to the last two words', () => {
  expect(shortName('Nguyễn Hoàng Bảo Ngọc Anh Thư')).toBe('Anh Thư')
  expect(shortName('Bé')).toBe('Bé')
  const p = addProfile('x'.repeat(50))
  expect(p?.name).toHaveLength(40)
})
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

```tsx
// Dialog.tsx — brief §2.8 (adult UI: 44 px buttons, no Foxy)
import { useEffect, useRef, useState } from 'react'
export type DialogRequest =
  | { kind: 'confirm' | 'destructive'; title: string; body: string; confirmLabel: string; cancelLabel?: string; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; label: string; initial?: string; maxLength?: number; confirmLabel?: string; resolve: (v: string | null) => void }

export function Dialog({ req, busy }: { req: DialogRequest; busy: boolean }) {
  const [value, setValue] = useState(req.kind === 'prompt' ? (req.initial ?? '') : '')
  const first = useRef<HTMLElement>(null)
  useEffect(() => { first.current?.focus() }, [])
  const max = req.kind === 'prompt' ? (req.maxLength ?? 40) : 0
  const short = value.trim().split(/\s+/).slice(-2).join(' ')
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(74,59,51,.45)] p-4" onClick={() => { if (!busy) req.kind === 'prompt' ? req.resolve(null) : req.resolve(false) }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={e => e.stopPropagation()} className="flex w-[min(420px,calc(100%-32px))] flex-col gap-3 rounded-r20 bg-white p-5 shadow-dialog">
        <h2 id="dlg-title" className="font-display text-[18px] font-extrabold leading-tight text-ink-900">{req.title}</h2>
        {req.kind !== 'prompt' && <p className="text-[13px] font-bold leading-relaxed text-ink-500">{req.body}</p>}
        {req.kind === 'prompt' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-extrabold text-ink-500">{req.label}</span>
            <input ref={first as never} value={value} maxLength={max} onChange={e => setValue(e.target.value.slice(0, max))} className="h-11 rounded-r12 border-2 border-teal-500 px-3 text-[15px] font-bold text-ink-900 outline-none" />
            <span className="flex justify-between text-[11px] font-bold text-ink-300"><span>{short && short !== value.trim() ? `Hiện trong app dưới dạng "${short}" nếu quá dài` : ''}</span><span>{value.length}/{max}</span></span>
          </label>
        )}
        <div className="mt-1 flex justify-end gap-2.5">
          <button type="button" disabled={busy} onClick={() => req.kind === 'prompt' ? req.resolve(null) : req.resolve(false)} className="min-h-[44px] rounded-r12 border-2 border-sand-edge px-4 text-[14px] font-extrabold text-ink-500">{req.kind === 'prompt' ? 'Huỷ' : (req.cancelLabel ?? 'Huỷ')}</button>
          {req.kind === 'prompt'
            ? <button type="button" disabled={busy || !value.trim()} onClick={() => req.resolve(value.trim())} className="min-h-[44px] rounded-r12 bg-teal-500 px-4 text-[14px] font-extrabold text-white">{req.confirmLabel ?? 'Lưu'}</button>
            : <button type="button" disabled={busy} onClick={() => req.resolve(true)} className={`min-h-[44px] rounded-r12 px-4 text-[14px] font-extrabold text-white ${req.kind === 'destructive' ? 'bg-fix-700' : 'bg-coral-500'}`}>{busy ? '…' : req.confirmLabel}</button>}
        </div>
      </div>
    </div>
  )
}
```

`DialogProvider.tsx` holds `useState<DialogRequest | null>` + `busy`, exposes `{ confirm, destructive, prompt, setBusy }` via context (each returns a Promise whose `resolve` also clears the request), renders `<Dialog>` when set. `useDialog.ts` reads the context and throws if absent. Wrap `<App />` in `main.tsx`.

`profileState.ts`:

```ts
export const NAME_MAX = 40
export const shortName = (name: string) => name.trim().split(/\s+/).slice(-2).join(' ')
// addProfile / renameProfile: name = (name ?? '').trim().slice(0, NAME_MAX) || DEFAULT_PROFILE_NAME
```

`ParentDashboard.tsx`: `const dialog = useDialog()`; `handleReset` → `await dialog.destructive({ title: 'Xoá toàn bộ tiến trình của bé?', body: cloudAvailable && activeId ? 'Sao, chuỗi ngày và bản ghi trên máy này sẽ mất. Bản lưu trên tài khoản cũng bị xoá. Không khôi phục được.' : 'Sao, chuỗi ngày và bản ghi trên máy này sẽ mất. Không khôi phục được.', confirmLabel: 'Xoá tiến trình' })`, set `busy` while awaiting `clearRecordings`/`resetRemoteProgress`; sign-out → `dialog.confirm({ title: 'Đăng xuất khỏi tài khoản này?', body: 'Bé vẫn học được, tiến độ sẽ không đồng bộ.', confirmLabel: 'Đăng xuất' })`; add → `dialog.prompt({ title: 'Thêm hồ sơ', label: 'Tên của bé', maxLength: NAME_MAX })`; rename → `dialog.prompt({ title: 'Đổi tên hồ sơ', label: 'Tên của bé', initial: current.name, maxLength: NAME_MAX })`. Display names through `shortName` in ProfilePicker tiles, Home greeting and the dashboard profile row (full name in `title`).

- [ ] **Step 4: Run tests, lint, typecheck** → PASS (ParentDashboard tests replace `vi.spyOn(window, 'confirm')` with clicking the dialog's button).

- [ ] **Step 5: Commit** — `git add client/src && git commit -m "feat(ui): real dialogs replace window.confirm/prompt; profile names capped at 40"`

---

### Task 13: Skeleton + SyncPill, wired into the dashboard

**Files:**
- Create: `client/src/components/ui/Skeleton.tsx`, `SyncPill.tsx`
- Modify: `client/src/cloud/sync.ts` (export `flushNow(): Promise<void>` if no equivalent exists — wrap the module's existing flush function; export `lastSyncedAt` in `SyncStatus` if not already), `ParentDashboard.tsx` (+ test)
- Test: `client/src/components/ui/ui.test.tsx`

**Interfaces:**
- Produces: `<Skeleton className>` (one shimmer block), `<AccountCardSkeleton>` (168), `<RemoteRowSkeleton>` (72); `<SyncPill status={SyncStatus} onRetry>`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('SyncPill', () => {
  const base = { state: 'synced', pending: 0, syncing: false, lastError: null, lastSyncedAt: null } as const
  it('maps the seven states to copy and colour', () => {
    const { rerender } = render(<SyncPill status={{ ...base }} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('✓ Đã đồng bộ')
    rerender(<SyncPill status={{ ...base, state: 'pending', pending: 500 }} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('● Chưa đồng bộ 500 mục')
    rerender(<SyncPill status={{ ...base, syncing: true }} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Đang đồng bộ…')
    rerender(<SyncPill status={{ ...base, lastError: 'x' }} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Không đồng bộ được')
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
    rerender(<SyncPill status={{ ...base, lastSyncedAt: new Date(2026, 8, 2, 9, 41).getTime() }} onRetry={() => {}} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Đồng bộ lúc 09:41')
    rerender(<SyncPill status={{ ...base, state: 'off' }} onRetry={() => {}} />)
    expect(screen.queryByTestId('sync-status')).toBeNull()
  })
})
describe('Skeleton', () => {
  it('account skeleton keeps the card height', () => {
    render(<AccountCardSkeleton />)
    expect(screen.getByTestId('skeleton-account')).toHaveClass('h-[168px]')
    expect(screen.getAllByTestId('skeleton')[0]).toHaveClass('animate-shimmer')
  })
})
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

```tsx
// Skeleton.tsx — brief §2.9
export function Skeleton({ className = '' }: { className?: string }) {
  return <div data-testid="skeleton" aria-hidden="true" className={`rounded-lg bg-[linear-gradient(90deg,#F3EADA_25%,#FFF7EA_50%,#F3EADA_75%)] bg-[length:400px_100%] animate-shimmer ${className}`} />
}
export function AccountCardSkeleton() {
  return (
    <div data-testid="skeleton-account" className="flex h-[168px] flex-col gap-2.5 rounded-r16 bg-white p-3.5">
      <div className="flex justify-between"><Skeleton className="h-4 w-[120px]" /><Skeleton className="h-4 w-20" /></div>
      <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-[70%]" />
      <div className="mt-auto flex gap-2.5"><Skeleton className="h-11 flex-1 rounded-r12" /><Skeleton className="h-11 w-[90px] rounded-r12" /></div>
    </div>
  )
}
export function RemoteRowSkeleton() {
  return (
    <div className="flex h-[72px] items-center gap-3 rounded-r16 bg-white p-3.5">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3.5 w-[160px]" /><Skeleton className="h-3 w-[70%]" /></div>
    </div>
  )
}
```

```tsx
// SyncPill.tsx — brief §2.10. Precedence: off → error → syncing → offline → pending → last synced → synced.
import type { SyncStatus } from '../../cloud/sync'
export function SyncPill({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  if (status.state === 'off') return null
  const hhmm = (t: number) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const v = status.lastError ? { cls: 'bg-fix-50 text-fix-700', ic: '⚠', t: 'Không đồng bộ được', retry: true }
    : status.syncing ? { cls: 'bg-teal-50 text-teal-600', ic: '◌', t: 'Đang đồng bộ…', spin: true }
    : status.state === 'offline' ? { cls: 'bg-sand text-ink-500', ic: '⚡', t: 'Ngoại tuyến' }
    : status.state === 'pending' ? { cls: 'bg-sun-50 text-sun-700', ic: '●', t: `Chưa đồng bộ ${status.pending} mục` }
    : status.lastSyncedAt ? { cls: 'bg-sand text-ink-500', ic: '🕘', t: `Đồng bộ lúc ${hhmm(status.lastSyncedAt)}` }
    : { cls: 'bg-good-50 text-good-700', ic: '✓', t: 'Đã đồng bộ' }
  return (
    <span className="flex items-center gap-2">
      <span data-testid="sync-status" className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-r10 px-2.5 text-[12px] font-extrabold ${v.cls}`}>
        <span aria-hidden="true" className={'spin' in v && v.spin ? 'inline-block animate-[spin_1.2s_linear_infinite]' : ''}>{v.ic}</span>{v.t}
      </span>
      {'retry' in v && v.retry && <button type="button" onClick={onRetry} className="h-8 rounded-r10 border-2 border-sand-edge px-2.5 text-[12px] font-extrabold text-ink-500">Thử lại</button>}
    </span>
  )
}
```

Confirm `SyncStatus` in `cloud/sync.ts` already carries `syncing`, `lastError`, `lastSyncedAt` (inventory P2.1 says it does); add `export async function flushNow()` that calls the module's existing flush routine (find it with `grep -n "async function flush\|function flush" client/src/cloud/sync.ts`) and is a no-op when cloud is off. In `ParentDashboard`: replace the sync `<span>` with `<SyncPill status={sync} onRetry={() => void flushNow()} />`; render `<AccountCardSkeleton />` while `!authReady`; render `<RemoteRowSkeleton />` for a remote row whose stats have not loaded.

- [ ] **Step 4: Run tests, lint, typecheck** → PASS (dashboard tests that read `sync-status` text keep passing — the strings for pending/synced/offline are unchanged apart from the icon prefix; update those assertions to `toHaveTextContent(/Đã đồng bộ/)`).

- [ ] **Step 5: Commit** — `git add client/src && git commit -m "feat(ui): skeletons and a seven-state sync pill on the dashboard"`

---

### Task 14: StreakPanel + WeekDots + longestStreak

**Files:**
- Create: `client/src/components/ui/WeekDots.tsx`, `client/src/components/StreakPanel.tsx`
- Modify: `client/src/progress/activity.ts` (`longestStreak`), `client/src/components/StreakWeek.tsx` (uses `WeekDots`, opens the panel on tap), `client/src/screens/MissionComplete.tsx` (adds `WeekDots`) (+ tests)
- Test: `client/src/progress/activity.test.ts` (extend), `client/src/components/habit-components.test.tsx` (extend)

**Interfaces:**
- Produces: `longestStreak(events?, lessonLookup?): number`; `<WeekDots dots={weekDots()} minutes?={number[]} size=34>` (keeps `data-testid="streak-dot"` and `data-today`); `<StreakPanel open onClose streak longest weekMinutes stars dots minutes>` (bottom sheet below `ipad:`, popover from `ipad:`).

- [ ] **Step 1: Write the failing tests**

```ts
it('longestStreak finds the longest run of completed days', () => {
  const done = new Set(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-10', '2026-08-11'])
  // build events so completedDays() yields exactly `done` — reuse the helper the existing streak tests use
  expect(longestStreak(eventsFor(done), lookupFor(done))).toBe(3)
})
```

```tsx
it('WeekDots draws seven 34px dots, marks today and dims the future', () => {
  render(<WeekDots dots={[{ done: true, today: false, future: false }, …7 entries with index 4 today, 5–6 future]} minutes={[14, 18, 9, 16, 0, 0, 0]} />)
  const dots = screen.getAllByTestId('streak-dot')
  expect(dots).toHaveLength(7)
  expect(dots[0]).toHaveClass('h-[34px]', 'bg-sun-400')
  expect(dots[4]).toHaveAttribute('data-today', 'true')
  expect(dots[4]).toHaveClass('ring-[4px]', 'ring-today')
  expect(dots[6]).toHaveClass('opacity-45')
  expect(screen.getByText("14'")).toBeInTheDocument()
})
it('tapping the streak strip opens the panel with the three numbers', () => {
  render(<MemoryRouter><StreakWeek dots={sevenDots} streak={4} longest={9} weekMinutes={57} stars={128} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: /Tuần này/ }))
  const sheet = screen.getByRole('dialog', { name: 'Tuần này của con 🔥' })
  expect(sheet).toHaveTextContent('4 ngày'); expect(sheet).toHaveTextContent('9 ngày'); expect(sheet).toHaveTextContent("57'")
  expect(sheet).toHaveClass('rounded-t-r28', 'ipad:rounded-r22')
  fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})
```

(Read `weekDots()`'s actual return shape in `activity.ts` and adapt the fixture; `StreakWeek`'s current props are `dots` and `streak` — extend, do not rename.)

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

```ts
// activity.ts
export function longestStreak(events = getActivity(), lessonLookup: LessonLookup = lessonForDay): number {
  const days = [...completedDays(events, lessonLookup)].sort()
  let best = 0, run = 0, prev: number | null = null
  for (const d of days) {
    const t = new Date(d + 'T00:00:00').getTime()
    run = prev !== null && Math.round((t - prev) / DAY_MS) === 1 ? run + 1 : 1
    best = Math.max(best, run); prev = t
  }
  return best
}
```

```tsx
// WeekDots.tsx — brief §3 Q3: 34 px dots, ⭐ when done, dashed when not, ring today, future dimmed.
const LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
export function WeekDots({ dots, minutes }: { dots: { done: boolean; today: boolean; future: boolean }[]; minutes?: number[] }) {
  return (
    <div className="flex justify-between">
      {dots.map((d, i) => (
        <div key={i} className="flex w-11 flex-col items-center gap-1.5">
          <span className="text-[11px] font-extrabold text-ink-300">{LABELS[i]}</span>
          <span data-testid="streak-dot" data-today={d.today ? 'true' : undefined}
            className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px] ${d.done ? 'bg-sun-400' : 'border-2 border-dashed border-[#D9CBB4] bg-sand'} ${d.today ? 'ring-[4px] ring-today' : ''} ${d.future ? 'opacity-45' : ''}`}>
            {d.done ? '⭐' : ''}
          </span>
          {minutes && <span className={`whitespace-nowrap text-[12px] font-extrabold ${d.done ? 'text-teal-600' : d.today ? 'text-coral-text' : 'text-ink-300'}`}>{d.done ? `${minutes[i]}'` : d.today ? 'hôm nay' : '—'}</span>}
        </div>
      ))}
    </div>
  )
}
```

`StreakPanel.tsx`: a `role="dialog" aria-label="Tuần này của con 🔥"` box — below `ipad:` a bottom sheet (`fixed inset-x-0 bottom-0 z-[55] rounded-t-r28 bg-white px-4 pb-11 pt-2.5` under a scrim, 44×5 handle), from `ipad:` a popover (`ipad:absolute ipad:inset-auto ipad:top-full ipad:mt-2 ipad:w-[360px] ipad:rounded-r22 ipad:shadow-dialog`) anchored to the strip (the strip becomes `relative`). Content: title 20px + pill `⭐ {stars}`, `<WeekDots minutes>`, three tiles (`Chuỗi hiện tại` teal, `Dài nhất`, `Tuần này`) at 20px, `<Button variant="outline" onClick={onClose} className="w-full">Đóng</Button>`. Streak 0 → title line "0 ngày · bắt đầu hôm nay nhé!".

`StreakWeek.tsx`: root becomes a `<button aria-label="Tuần này của con">` (min 64×44) showing the compact strip as today; tap toggles `<StreakPanel>`. Home passes `longest={longestStreak(events)}`, `weekMinutes`, `stars`. `MissionComplete` inserts `<WeekDots dots={weekDots(now, events)} />` between the star pill and the streak line.

- [ ] **Step 4: Run tests, lint, typecheck** → PASS (keep `data-testid="streak-dot"` + `data-today` — Home tests rely on them).

- [ ] **Step 5: Screenshot and commit** — `SHOTS=home,mission-done` phone + ipad (+ a manual shot with the panel open, added to `shoot.mjs` as `home-streak-panel`: click `getByRole('button', {name:/Tuần này/})`).

```bash
git add client/src docs/design/current/shoot.mjs
git commit -m "feat(habit): streak panel, 34px week dots, longest streak"
```

---

### Task 15: Migrate batches C (story / word / sentence remainder) and P (parent area) to PageShell; remove the global LessonChip fallback

**Files:**
- Modify: `client/src/screens/StoryPlayer.tsx`, `StoryQuiz.tsx`, `WordTopics.tsx` (if not in batch A), `CloudStart.tsx`, `ProfileGate.tsx`, `ParentGate.tsx`, `ParentDashboard.tsx`, `AppErrorBoundary.tsx` (+ tests); `client/src/App.tsx` (remove `<LessonChip />`), `client/src/components/LessonChip.tsx` (drop the `global` variant and `headerRegistry` usage), `client/src/components/ui/page/headerRegistry.ts` (delete), `PageHeader.tsx` (drop `registerHeader`)

- [ ] **Step 1: Write the failing test** — in `App.test.tsx` (create if absent): render `<App />` on `/practice/wp-cat` with a seeded lesson and assert exactly one element matches `getByRole('link', { name: /Nhiệm vụ/ })` and it is inside `screen.getByRole('banner')`; render on `/` and assert none. Also assert `grep -rn "min-w-\[66px\]" client/src` is empty via a test-time `import.meta.glob` is not possible — do it as a Step-4 shell check instead.

- [ ] **Step 2: Run to verify failure** → FAIL (two chips: header + global, or none in banner).

- [ ] **Step 3: Migrate**
- `StoryPlayer`: `PageShell gutter="16"`; header centre = `Chip` "Cảnh {n}/{m}" + `SceneDots` (md); back `variant="onArt"` stays on the picture (the header's back cell renders the same link — pick one: keep it in the header, remove it from the picture; the scene chip moves off the picture into the header, which is what ends the LessonChip collision); footer = `Tiếp tục ▸ / Bỏ qua ▸`.
- `StoryQuiz`: header = `BackButton` (child) + `Chip` "Câu n/3"; replace the local `BACK_LINK`; result screen: body `center`, footer holds the primary; the two secondary buttons go in the body as `outline`.
- `CloudStart`, `ProfileGate`, `ParentGate`: `PageShell` + `PageBody center`; card unchanged; secondary text actions become `<LinkText>`; buttons `size="adult"` in CloudStart/ParentGate (adult doors), `ProfileGate` keeps child sizes.
- `ParentDashboard`: `PageShell gutter="24"` (phone 18 → nearest token 16 is fine per brief §1 "1 gutter ngang"); header = `<BackButton variant="adult" label="Về nhà" to="/" />`, centre H1 "Góc phụ huynh", `right={<Button size="adult" variant="outline" onClick={onLock}>🔐 Khoá lại</Button>}`; every `<Button>` in the dashboard gets `size="adult"`; the `max-md:` overrides on buttons are deleted; the `+ Thêm hồ sơ` / `Đổi tên` / `Xem từ xa` 36 px controls become `size="adult"` (44).
- `AppErrorBoundary`: `PageShell` + `PageBody center` + `Button size="lg"` in `PageFooter`.
- Remove `<LessonChip />` from `App.tsx`; delete the `global` branch and the registry.

- [ ] **Step 4: Verify nothing old remains**

Run: `grep -rn "min-w-\[66px\]\|sticky\|CTA_PHONE\|CTA_IPAD\|SAMPLE_CHIP\|window\.confirm\|window\.prompt\|rounded-xl3\|rounded-xl4" client/src --include=*.tsx`
Expected: no matches except `Card.tsx` (`rounded-xl3` for cards is allowed until Phase 15) — list any others in the report and fix them.

Then `pnpm --filter client test && pnpm --filter client lint && pnpm --filter client typecheck && pnpm --filter client build`.

- [ ] **Step 5: Commit** — `git add client/src && git commit -m "feat(shell): every screen on PageShell; LessonChip lives in the header"`

---

### Task 16: Verification pass — screenshots, README, checklist rows

**Files:**
- Modify: `README.md` (new "Phase 12 — Nền tảng redesign" section + iPad/iPhone checklist rows), `docs/superpowers/specs/2026-09-02-phase12-foundation-redesign-design.md` (status line at the top), `docs/design/round-2026-09/README.md` (status column), `docs/design/current/shoot.mjs` (add `home-streak-panel`, `voice-result` if a fixture route exists — otherwise leave)
- Create: `docs/design/current-phase12/sheets/` via `sheet.mjs` (parametrise `SHOTS` dir with an env var `SHOTS_DIR`)

- [ ] **Step 1: Run the full screenshot set at the three frames**

```bash
# dev server via .claude/launch.json (client-http), then from docs/design/current:
SHOTS_DIR=../current-phase12/shots node shoot.mjs && SHOTS_DIR=../current-phase12/shots node sheet.mjs
```

(Add the `SHOTS_DIR` env read to both scripts: `const OUT = path.resolve(process.env.SHOTS_DIR ?? 'shots')`.)

- [ ] **Step 2: Measure the six screens that overflowed** and fill the table below into the README section, from `shoot.mjs`'s "overflow" log lines (before values from `docs/design/current/README.md`):

| Screen | frame | before | after |
|---|---|---|---|
| `/star/ss1` result | 1194×834 | 959 | |
| `/voice/sv1` result | 1194×834 | 1140 | |
| `/mission` (5 groups) | 1194×834 | 1189 | |
| `/parent` | 390×844 / 834×1194 | 1745 / 1733 | |
| `/words/review` (64) | 390×844 | — | |
| `/sentences` | 390×844 | 2192 | |

The result rows need a scored state; use the phone/iPad result screenshots produced by the screen tests' fixture if the executor adds a `?fixture=result` dev-only query (optional — if not added, record "not measured, see test geometry" and measure `result-card` height in a jsdom-free Playwright run by injecting the fixture through `localStorage`).

- [ ] **Step 3: README section** — mirror the Phase 10 section's shape: what changed globally (frame, sizes, chip in header, typed errors, dialogs), the before/after table, the deliberate iPad changes (5 px edge, radius 20/24, word chip 40, mic prefix), the transition mechanism that was removed in Task 15, and the checklist rows: (1) iPhone: mic 124 idle → 150 recording, halos reach the frame edge; (2) tap the streak strip → sheet with 3 numbers, swipe down closes; (3) Dashboard → Đặt lại tiến trình → dialog, cancel, confirm; (4) practice a card after the daily limit → 🌙 error, mic locked, "Về nhà" CTA; (5) airplane mode → 📡 notice once, then simple-engine badge only.

- [ ] **Step 4: Spec status line** — prepend `**Implemented <date> on branch phase12-foundation (tasks 1–16).**` plus any accepted deviations.

- [ ] **Step 5: Commit** — `git add README.md docs && git commit -m "docs: phase 12 foundation — before/after screenshots and checklist"`

---

## Self-review (done while writing)

- **Spec coverage:** decisions 1–2 → Task 1; 3 → Task 8; 4–5 → Task 1; 6 → Tasks 4/5/9 (breakpoint use); 7 → Tasks 4/5/9/15; 8 → Tasks 4/15; 9–10, 12 → Task 7; 11 → Task 9 (`onErrorAction` dismiss) — the text-only how-to notice is a `Notice` from Task 11, wire it in Task 15 if time allows, otherwise dismissing is the documented behaviour; 13 → Task 12; 14 → Task 14; 15 → Task 3; 16 → Task 13; 17–19 → Task 8; 20 → Task 10. Scope items: tokens (1), primitives (1–3), frame + migration (4, 5, 9, 15), speak components (6–9), state components (10–14), verification (16).
- **Placeholders:** none; every step has code or an exact command. The one open judgement is Task 16 Step 2's result-state measurement, which is explicitly optional with a fallback.
- **Type consistency:** `SpeakError`/`SpeakErrorKind`/`SPEAK_ERROR_COPY` (Task 7) are what Tasks 8–9 import; `ResultCard` props in Task 8 match the Task 9 mapping (`primary` made optional in Task 9's PracticeCard row — apply that to the Task 8 type: `primary?: Primary`); `MicButton` `state` union includes `'locked'` (Task 6) which `useSpeakingAttempt.micState` returns (Task 7); `Stars` size names `sm|md|lg` (Task 2) are what `ResultCard` uses (`md`); `registerHeader`/`useHeaderMounted` (Task 4) are deleted in Task 15 together with their only consumers.
