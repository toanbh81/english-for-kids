import { Link } from 'react-router-dom'

/** 66 px round white "←". The visible glyph is decorative, so the destination is named
 * for screen readers instead — by `aria-label`, or by `mdLabel` when the destination is called
 * something else on a phone.
 *
 * **`mdLabel`** is `HomeLabel`'s rule for a control whose label is never visible. An `aria-label`
 * is one string and cannot follow a breakpoint, so a button that says "Về bản đồ" to a screen
 * reader kept promising the island map on a phone, where spec decision 1 has just removed it. Two
 * `sr-only` spans can follow it: `hidden` takes the wrong one out of the accessibility tree at each
 * width, exactly as `HomeLabel` does for a visible one, and the `aria-label` steps aside so the
 * element's own content is what names it.
 */
export function BackButton({ to, label = 'Quay lại', mdLabel, className = '' }: {
  to: string
  /** The accessible name. Below the tablet breakpoint when `mdLabel` is given; at every width otherwise. */
  label?: string
  /** The accessible name from the tablet breakpoint up, when it differs from `label`. */
  mdLabel?: string
  className?: string
}) {
  return (
    <Link
      to={to}
      aria-label={mdLabel === undefined ? label : undefined}
      // `shrink-0`: it lives in flex headers next to content that can be much wider than the
      // viewport (a long level's progress dots), and a squeezed 66 px circle drops below the
      // 64 px tap-target floor exactly where a small finger needs it most.
      className={`inline-flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full bg-white text-3xl text-ink-900 shadow-card-sm active:translate-y-[2px] ${className}`}
    >
      <span aria-hidden="true">←</span>
      {mdLabel !== undefined && (
        <>
          <span className="sr-only md:hidden">{label}</span>
          <span className="sr-only hidden md:inline">{mdLabel}</span>
        </>
      )}
    </Link>
  )
}
