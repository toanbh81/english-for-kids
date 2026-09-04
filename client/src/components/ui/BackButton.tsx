import { Link } from 'react-router-dom'

export type BackVariant = 'child' | 'adult' | 'onArt'

// Brief §2.12. The child circle is 56 with a 64 hit band on a phone (the `after:` pseudo-element
// is the invisible 4 px ring) and a true 64 from md; the adult pill is 44 with its label visible;
// the on-art disc sits on a story picture at 48 with a 64 hit.
const VARIANT: Record<BackVariant, string> = {
  child: "h-14 w-14 rounded-full text-[22px] shadow-card-xs md:h-16 md:w-16 md:text-[24px] md:shadow-card-sm relative after:absolute after:-inset-1 after:content-[''] md:after:hidden",
  adult: 'h-11 gap-1.5 whitespace-nowrap rounded-r14 pl-2.5 pr-3.5 text-[14px] font-extrabold text-ink-500 shadow-[0_3px_0_#EFE2CC]',
  onArt: "h-12 w-12 rounded-full bg-white/[.94] text-[20px] relative after:absolute after:-inset-2 after:content-['']",
}

/** 56/64/44/48 px "←", the exact circle or pill picked by `variant` (brief §2.12). The visible
 * glyph is decorative for `child`/`onArt`, so the destination is named for screen readers instead
 * — by `aria-label`, or by `mdLabel` when the destination is called something else on iPad landscape.
 *
 * **`mdLabel`** is `HomeLabel`'s rule for a control whose label is never visible (the prop name
 * predates the round-3 breakpoint move and stays as-is). An `aria-label` is one string and cannot
 * follow a breakpoint, so a button that says "Về bản đồ" to a screen reader kept promising the
 * island map off iPad landscape, where spec decision 3 says Home is not a map. Two `sr-only` spans
 * can follow it: `hidden` takes the wrong one out of the accessibility tree at each width, exactly
 * as `HomeLabel` does for a visible one, and the `aria-label` steps aside so the element's own
 * content is what names it.
 *
 * **The adult variant's own label is never hidden**, so `mdLabel` there swaps the VISIBLE text
 * instead (same `hidden`/`ipad:` pair, no `sr-only` — round-4 fix wave 1's `ParentGate` is the
 * first caller to combine `variant='adult'` with `mdLabel`). This is content, not `aria-label`,
 * on purpose (round-4 fix wave 2, reverting wave 1's static `aria-label`): a real browser correctly
 * drops a `display:none` descendant from the accessible-name computation, so exactly one of the two
 * spans is ever in the name at a time, and that name IS the visible label — "Về nhà" off iPad
 * landscape, "Về bản đồ 🏝️" on it. A static `aria-label` pinned the name to `label` regardless of
 * breakpoint, which reads correctly in isolation but is wrong the moment it's checked against what
 * a sighted user sees on iPad landscape: a screen-reader or voice-control user would be told a name
 * that does not match the pill's own printed text, which is a worse defect than the one it avoided.
 * jsdom loads no stylesheet, so `getByRole('link', { name })` there cannot resolve which of the two
 * spans is "hidden" and reports both concatenated — a limitation of the test environment, not of
 * the real component; the tests query the two spans directly instead, the same way `HomeLabel`'s
 * own test does for this identical pattern.
 */
export function BackButton({ to, label = 'Quay lại', mdLabel, variant = 'child', state, className = '' }: {
  to: string
  /** The accessible name. Off iPad landscape when `mdLabel` is given; at every width otherwise. */
  label?: string
  /** The accessible name on iPad landscape, when it differs from `label`. */
  mdLabel?: string
  variant?: BackVariant
  /** Router state to carry along, e.g. `MISSION_STATE` — a screen inside a lesson step that hands
   * the flag on forward (`Button`'s own `state`) has to hand it on backward too, or the hop back
   * drops the child out of the mission it is trying to return to. */
  state?: unknown
  className?: string
}) {
  const visibleLabel = variant === 'adult'
  const adultSwap = visibleLabel && mdLabel !== undefined
  return (
    <Link
      to={to}
      state={state}
      // Only the truly icon-only case (no visible label anywhere, no `mdLabel` pair to fall back
      // on) needs a static name here; every other case — including `adultSwap` — names itself from
      // its own (visible or sr-only) content below.
      aria-label={mdLabel === undefined && !visibleLabel ? label : undefined}
      // `shrink-0`: it lives in flex headers next to content that can be much wider than the
      // viewport (a long level's progress dots), and a squeezed circle drops below the
      // 64 px tap-target floor exactly where a small finger needs it most.
      className={`inline-flex shrink-0 items-center justify-center bg-white font-display text-ink-300 active:translate-y-[2px] ${VARIANT[variant]} ${className}`}
    >
      <span aria-hidden="true" className={visibleLabel ? 'text-[18px]' : undefined}>←</span>
      {visibleLabel && mdLabel === undefined && <span>{label}</span>}
      {adultSwap && (
        <>
          <span className="ipad:hidden">{label}</span>
          <span className="hidden ipad:inline">{mdLabel}</span>
        </>
      )}
      {!visibleLabel && mdLabel !== undefined && (
        <>
          <span className="sr-only ipad:hidden">{label}</span>
          <span className="sr-only hidden ipad:inline">{mdLabel}</span>
        </>
      )}
    </Link>
  )
}
