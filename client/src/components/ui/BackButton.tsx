import { Link } from 'react-router-dom'

/** 66 px round white "←". The visible glyph is decorative, so the destination is named
 * by `aria-label` for screen readers. */
export function BackButton({ to, label = 'Quay lại', className = '' }: { to: string; label?: string; className?: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      // `shrink-0`: it lives in flex headers next to content that can be much wider than the
      // viewport (a long level's progress dots), and a squeezed 66 px circle drops below the
      // 64 px tap-target floor exactly where a small finger needs it most.
      className={`inline-flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full bg-white text-3xl text-ink-900 shadow-card-sm active:translate-y-[2px] ${className}`}
    >
      <span aria-hidden="true">←</span>
    </Link>
  )
}
