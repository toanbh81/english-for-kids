import { createContext } from 'react'

/** Split out of `DialogProvider.tsx` so that file exports only the component — react-refresh
 * (oxlint's `react/only-export-components`) otherwise warns about a context living beside it. */
export type DialogOptions = {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  /**
   * The work the confirm/destructive button itself triggers, e.g. a reset or a sign-out. When
   * present, clicking that button keeps the dialog open and busy — buttons disabled, the confirm
   * label swapped for "…", the scrim and Escape ignored — until the callback settles, and only
   * then resolves the dialog `true` and closes it. A thrown error still closes and resolves
   * `true`: the caller owns its own error handling (see `ParentDashboard.handleReset`).
   * Without it, the button resolves `true` and closes immediately, as before.
   */
  onConfirm?: () => Promise<unknown>
}
export type PromptOptions = {
  title: string
  label: string
  initial?: string
  maxLength?: number
  confirmLabel?: string
  /** The prompt's equivalent of `DialogOptions.onConfirm`: given the trimmed value, keeps the
   * dialog open and busy until it settles, then resolves the dialog with that value and closes. */
  onSubmit?: (value: string) => Promise<unknown>
}

export type DialogContextValue = {
  confirm: (o: DialogOptions) => Promise<boolean>
  destructive: (o: DialogOptions) => Promise<boolean>
  prompt: (o: PromptOptions) => Promise<string | null>
}

export const DialogContext = createContext<DialogContextValue | null>(null)
