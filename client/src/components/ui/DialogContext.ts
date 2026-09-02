import { createContext } from 'react'

/** Split out of `DialogProvider.tsx` so that file exports only the component — react-refresh
 * (oxlint's `react/only-export-components`) otherwise warns about a context living beside it. */
export type DialogOptions = { title: string; body: string; confirmLabel: string; cancelLabel?: string }
export type PromptOptions = { title: string; label: string; initial?: string; maxLength?: number; confirmLabel?: string }

export type DialogContextValue = {
  confirm: (o: DialogOptions) => Promise<boolean>
  destructive: (o: DialogOptions) => Promise<boolean>
  prompt: (o: PromptOptions) => Promise<string | null>
  /** Around an awaited confirm/sign-out/etc: disables the dialog's buttons and the scrim, and
   * swaps the confirm label for "…" — see `ParentDashboard.handleReset`/`handleSignOut`. */
  setBusy: (busy: boolean) => void
}

export const DialogContext = createContext<DialogContextValue | null>(null)
