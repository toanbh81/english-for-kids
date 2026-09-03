import type { ReactNode } from 'react'

type Split = { teach: ReactNode; act: ReactNode; collapsed?: { emoji: string; label: string; onExpand: () => void } }

/** The scrolling region. `center` centres short content; `split` is the speaking layout —
 * landscape: teach `flex:1` | act 440; portrait: teach `flex:1` over act 300 (brief §1).
 * `split.collapsed` swaps the teach column for a tap-to-expand strip on a phone / iPad
 * portrait. The strip and the teach column both render whenever `collapsed` is set — the strip
 * is `ipad:hidden`, the teach column is `hidden ipad:flex` — so a real iPad in landscape always
 * shows the full teach column via CSS alone ("landscape never collapses"); screens have no way
 * to detect the compound `ipad` media variant in JS, so PageBody is the only place this
 * guarantee can live. `actGrow` lets the act column fill the remaining height on portrait once
 * the teach column has shrunk to that strip.
 *
 * The act column's 300px on portrait (`actGrow` off) is a floor, not a fixed box: once it can
 * wrap (an error banner forcing its own line, say — Task 5 fix round 1), its content can need
 * more than 300px, and a hard `h-[300px]` just let the extra spill silently past the box's own
 * bottom edge. `min-h-[300px]` lets it grow instead; the teach column above it is the one that
 * gives up the difference at `md`/`ipad` (it is `flex-1 min-h-0` there, so it shrinks first) —
 * below `md` neither column shrinks at all, see the fix-round-2 note below.
 *
 * A shrunk-but-still-centred teach column has its own failure mode: `justify-center` on a flex
 * container whose content no longer fits centres it symmetrically, which pushes the *top* of the
 * content above the box's own top edge — content nothing below page-body's scroll start can ever
 * reach. Centring with `my-auto` on the content instead of `justify-center` on the container
 * fixes that: auto margins consume any slack the same way `justify-center` does when the content
 * fits, but collapse to 0 the moment it doesn't, so the overflow — if any — is always the bottom
 * ("safe centering"; no `justify-content: safe center` here since it isn't Chromium-stable yet).
 *
 * Fix round 2 (Task 7): on a phone, NEITHER split column may shrink below its own content at all.
 * `flex-1`/no-`shrink-0` let both the teach and the act column compress past their content's real
 * height — `min-h-0` (unprefixed, i.e. also live on a phone) is what let the teach column do it,
 * and the act column had no `shrink-0` of its own to resist the same squeeze — and once a column
 * is squeezed narrower than its content, the "safe centering" `my-auto` trick above only keeps the
 * *overflow* at the bottom; it does nothing to stop that overflow from visually landing on top of
 * the *other* column, because a shrunk flex item's rendered content isn't clipped by its own box.
 * The fix is architectural, not cosmetic: below `md` nothing shrinks and page-body's own
 * `overflow-y-auto` is what handles content that doesn't fit (real page scroll, not squeezed
 * boxes) — `flex-[1_0_auto]` on teach (grow into any leftover space, floor at content height) and
 * `shrink-0` on act. `md:`/`ipad:` still shrink each column with its own internal scroll, exactly
 * as before — that pairing (a fixed-height act column, a teach column that gives way and scrolls)
 * only ever made sense once there was room for two side-by-side or stacked-with-space columns. */
export function PageBody({ center, split, actGrow, className = '', children }: { center?: boolean; split?: Split; actGrow?: boolean; className?: string; children?: ReactNode }) {
  if (split) {
    return (
      <div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:mt-4 ipad:flex-row ipad:gap-6 ipad:overflow-visible ${className}`}>
        {split.collapsed ? (
          <>
            <button
              type="button"
              onClick={split.collapsed.onExpand}
              aria-label="mở lại phần dạy"
              className="flex h-8 w-full shrink-0 items-center gap-2 px-1 text-left text-[15px] text-[#D9C9AE] md:h-16 md:rounded-r18 md:bg-white md:px-4 md:shadow-card-xs ipad:hidden"
            >
              <span aria-hidden="true" className="text-[15px] md:text-[28px]">{split.collapsed.emoji}</span>
              <span className="min-w-0 flex-1 truncate font-display font-extrabold md:text-[18px] md:text-sand-text">{split.collapsed.label}</span>
              <span className="shrink-0 text-[12px] font-extrabold text-ink-300 md:text-[13px]">▾ mở</span>
            </button>
            <div className="hidden ipad:flex ipad:min-h-0 ipad:flex-1 ipad:flex-col ipad:items-center ipad:overflow-y-auto">
              <div className="my-auto flex w-full flex-col items-center">{split.teach}</div>
            </div>
          </>
        ) : (
          <div className="flex flex-[1_0_auto] flex-col items-center md:min-h-0 md:flex-1 md:overflow-y-auto ipad:min-h-0 ipad:overflow-y-auto">
            <div className="my-auto flex w-full flex-col items-center">{split.teach}</div>
          </div>
        )}
        <div className={`flex shrink-0 flex-col items-center justify-center md:flex-row md:flex-wrap md:gap-10 ${actGrow ? 'md:flex-1 md:min-h-0' : 'md:min-h-[300px] md:shrink-0'} ipad:h-auto ipad:max-h-full ipad:w-[440px] ipad:shrink-0 ipad:min-h-0 ipad:flex-col ipad:flex-nowrap ipad:gap-4 ipad:overflow-y-auto`}>{split.act}</div>
      </div>
    )
  }
  return (
    <div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col overflow-y-auto md:mt-4 ${center ? 'justify-center' : ''} ${className}`}>
      {children}
    </div>
  )
}
