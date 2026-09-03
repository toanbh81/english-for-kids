import type { ReactNode } from 'react'

type Split = { teach: ReactNode; act: ReactNode; collapsed?: { emoji: string; label: string; onExpand: () => void } }

/** The scrolling region. `center` centres short content; `split` is the speaking layout —
 * landscape: teach `flex:1` | act 440; portrait: teach `flex:1` over act 300 (brief §1).
 * `split.collapsed` swaps the teach column for a tap-to-expand strip on a phone / iPad
 * portrait. The strip itself is `ipad:hidden` (landscape never collapses), but PageBody has no
 * way to keep an ipad-only copy of `split.teach` in the DOM without it also leaking into a
 * phone/portrait render — Testing Library's text queries aren't CSS-aware, so a `hidden
 * ipad:flex` wrapper here would make "the strip replaces the teach column" unverifiable. The
 * caller is expected to stop passing `collapsed` once it detects landscape, matching the brief's
 * "landscape never collapses" (see task-2-report.md's concerns). `actGrow` lets the act column
 * fill the remaining height on portrait once the teach column has shrunk to that strip. */
export function PageBody({ center, split, actGrow, className = '', children }: { center?: boolean; split?: Split; actGrow?: boolean; className?: string; children?: ReactNode }) {
  if (split) {
    return (
      <div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:mt-4 ipad:flex-row ipad:gap-6 ipad:overflow-visible ${className}`}>
        {split.collapsed ? (
          <button
            type="button"
            onClick={split.collapsed.onExpand}
            aria-label="mở lại phần dạy"
            className="flex h-8 w-full shrink-0 items-center gap-2 px-1 text-left text-[15px] text-[#D9C9AE] md:h-16 md:rounded-r18 md:bg-white md:px-4 md:shadow-card-xs ipad:hidden"
          >
            <span aria-hidden="true" className="text-[15px] md:text-[28px]">{split.collapsed.emoji}</span>
            <span className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold text-[#D9C9AE] md:text-[18px] md:text-sand-text">{split.collapsed.label}</span>
            <span className="shrink-0 text-[12px] font-extrabold text-ink-300 md:text-[13px]">▾ mở</span>
          </button>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center ipad:min-h-0 ipad:overflow-y-auto">{split.teach}</div>
        )}
        <div className={`flex flex-col items-center justify-center md:flex-row md:gap-10 ${actGrow ? 'md:flex-1 md:min-h-0' : 'md:h-[300px] md:shrink-0'} ipad:h-auto ipad:max-h-full ipad:w-[440px] ipad:shrink-0 ipad:min-h-0 ipad:flex-col ipad:gap-4 ipad:overflow-y-auto`}>{split.act}</div>
      </div>
    )
  }
  return (
    <div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col overflow-y-auto md:mt-4 ${center ? 'justify-center' : ''} ${className}`}>
      {children}
    </div>
  )
}
