import type { ReactNode } from 'react'

/**
 * Adult "gate" card (brief §2 P1 ParentGate, A1 ProfileGate, A2 CloudStart): the same card tokens
 * as `Dialog.tsx`'s `role="dialog"` panel — 420 px cap, r20, p5 (20px), gap 12 — but placed in
 * `PageBody`'s center instead of a scrim, and with a card shadow (`0 6px 0 #EFE2CC`) instead of
 * the dialog's drop shadow. The TEXT inside is left-aligned: the four call sites this replaces
 * dropped their old `max-w-md` (448) and `text-center`. The CARD itself is centred on the page —
 * `mx-auto` (round-4 fix wave 1: `PageBody`'s `center` path only centres vertically, and a
 * fixed-width flex child otherwise sits flush at the cross-axis start, i.e. flush left) — so this
 * one component carries its own horizontal centring rather than asking the shared `PageBody` to
 * grow a rule for its three callers.
 */
export function GateCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div data-testid="gate-card" className={`mx-auto flex w-[min(420px,calc(100%-32px))] flex-col gap-3 rounded-r20 bg-white p-5 text-left shadow-[0_6px_0_#EFE2CC] ${className}`}>
      {children}
    </div>
  )
}

/**
 * The soft blurred pair of blobs every gate card sits over (brief §1.1 "Blob nền", §2 P1/A1/A2).
 * Decorative and absolutely positioned behind the card — `PageShell` needs `className="relative"`
 * for this to anchor to. `md:` alone covers both iPad frames (decision 35: "iPad dọc của ba cổng =
 * iPad ngang" — no `ipad:` rule touches the same properties here, so the one breakpoint serves both).
 *
 * `-z-10` (round-4 fix wave 1): a positioned box at the default `z-index:auto` paints AFTER, i.e.
 * ON TOP OF, the static in-flow siblings around it — `PageHeader`/`PageBody`/`GateCard` are all
 * static — regardless of DOM order, so without this the blobs could paint over the card wherever
 * their boxes overlap. `PageShell`'s `<main className="relative">` is the positioned ancestor that
 * establishes the stacking context this negative index resolves within, so `-z-10` stays behind
 * the page's own content instead of escaping to some other ancestor's stack.
 */
export function GateBlobs() {
  return (
    <div data-testid="gate-blobs" aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -bottom-[110px] -left-[90px] h-[280px] w-[280px] rounded-full bg-sand md:-bottom-[160px] md:-left-[120px] md:h-[420px] md:w-[420px]" />
      <div className="absolute -right-[100px] -top-[120px] hidden h-[360px] w-[360px] rounded-full bg-teal-50 md:block" />
    </div>
  )
}
