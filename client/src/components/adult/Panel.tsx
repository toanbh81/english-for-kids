import { useState, type ReactNode } from 'react'

// R13 / quyết định 3: KHÔNG đè `Card` (`rounded-xl3` = 28) — Panel là r16, hai vai trò khác nhau
// (rủi ro 6).
const BOX = 'flex flex-col gap-2 rounded-r16 bg-white px-3.5 py-3 shadow-card-xs md:gap-2.5 md:px-4 md:py-3.5'
const TITLE = 'font-display text-[13px] font-extrabold text-ink-900 md:text-[14px]'
// Fade đáy 40 của vùng cuộn. Brief ghi gradient tới `#FFF7EA` (nền TRANG); panel nền TRẮNG, nên
// dùng `to-white` — vệt kem trên nền trắng là một đường kẻ nhìn thấy được.
// M9: no `after:mt-auto`/`after:shrink-0` — the scroller is `display:block`, so an auto margin and
// a flex shrink token do nothing at all. `sticky bottom-0` is what pins the fade.
const SCROLL = "min-h-0 flex-1 overflow-y-auto after:pointer-events-none after:sticky after:bottom-0 after:block after:h-10 after:bg-gradient-to-b after:from-transparent after:to-white after:content-['']"

/**
 * The parent-dashboard panel frame (brief §1.2 P2): white r16 card, `col='full'` spans the whole
 * grid row, `collapsible` folds to a 56px phone-only summary row (open from `md` up — no
 * `matchMedia` here, `defaultOpen` stays the call site's own decision, see `ParentDashboard.tsx:172`),
 * and `scroll` gives its body the fading scroller used by long lists.
 */
export function Panel({
  title,
  right,
  collapsible = false,
  defaultOpen = false,
  col,
  scroll = false,
  testId = 'panel',
  className = '',
  children,
}: {
  title: string
  right?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  col?: 'full'
  scroll?: boolean
  testId?: string
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  // I1: `[column-span:all]` at `ipad:`, where `PanelGrid` is a multi-column block rather than a
  // grid — same meaning ("this panel owns the full width"), the mechanism the container needs.
  const colClass = col === 'full' ? 'md:col-span-2 ipad:[column-span:all]' : ''

  return (
    <div data-testid={testId} className={`${BOX} ${colClass} ${className}`}>
      {collapsible
        ? (
          <>
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex min-h-[56px] items-center justify-between gap-2 text-left md:hidden">
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <h2 className={TITLE}>{title}</h2>
                {right}
              </span>
              <span className="text-[14px] text-ink-300">{open ? '▾' : '▸'}</span>
            </button>
            <div className="hidden items-center justify-between gap-2 md:flex">
              <h2 className={TITLE}>{title}</h2>
              {right}
            </div>
          </>
        )
        : (
          <div className="flex items-center justify-between gap-2">
            <h2 className={TITLE}>{title}</h2>
            {right}
          </div>
        )}
      {/* M11 — `scroll` used to SHORT-CIRCUIT `collapsible`: a panel given both rendered its body
        * on a phone even while folded. The fold decides visibility; the scroller lives inside it. */}
      {collapsible
        ? (
          <div className={open ? '' : 'hidden md:block'}>
            {scroll ? <div data-testid="panel-scroll" className={SCROLL}>{children}</div> : children}
          </div>
        )
        : scroll
          ? <div data-testid="panel-scroll" className={SCROLL}>{children}</div>
          : children}
    </div>
  )
}
