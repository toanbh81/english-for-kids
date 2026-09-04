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
