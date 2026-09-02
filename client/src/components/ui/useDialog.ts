import { useContext } from 'react'
import { DialogContext } from './DialogContext'
import type { DialogContextValue, DialogOptions, PromptOptions } from './DialogContext'

export type { DialogOptions, PromptOptions }

/** `confirm`/`destructive`/`prompt` replace the browser's native confirm/prompt globals app-wide —
 * see `ParentDashboard`'s reset, sign-out, add-profile and rename-profile flows. */
export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used inside a <DialogProvider>')
  return ctx
}
