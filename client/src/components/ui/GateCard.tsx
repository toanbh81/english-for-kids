import type { ReactNode } from 'react'

/**
 * Adult "gate" card (brief §2 P1 ParentGate, A1 ProfileGate, A2 CloudStart): the same card tokens
 * as `Dialog.tsx`'s `role="dialog"` panel — 420 px cap, r20, p5 (20px), gap 12 — but placed in
 * `PageBody`'s center instead of a scrim, and with a card shadow (`0 6px 0 #EFE2CC`) instead of
 * the dialog's drop shadow. Left-aligned: the four call sites this replaces dropped their old
 * `max-w-md` (448) and `text-center`.
 */
export function GateCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div data-testid="gate-card" className={`flex w-[min(420px,calc(100%-32px))] flex-col gap-3 rounded-r20 bg-white p-5 text-left shadow-[0_6px_0_#EFE2CC] ${className}`}>
      {children}
    </div>
  )
}

/**
 * The soft blurred pair of blobs every gate card sits over (brief §1.1 "Blob nền", §2 P1/A1/A2).
 * Decorative and absolutely positioned behind the card — `PageShell` needs `className="relative"`
 * for this to anchor to. `md:` alone covers both iPad frames (decision 35: "iPad dọc của ba cổng =
 * iPad ngang" — no `ipad:` rule touches the same properties here, so the one breakpoint serves both).
 */
export function GateBlobs() {
  return (
    <div data-testid="gate-blobs" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -bottom-[110px] -left-[90px] h-[280px] w-[280px] rounded-full bg-sand md:-bottom-[160px] md:-left-[120px] md:h-[420px] md:w-[420px]" />
      <div className="absolute -right-[100px] -top-[120px] hidden h-[360px] w-[360px] rounded-full bg-teal-50 md:block" />
    </div>
  )
}
