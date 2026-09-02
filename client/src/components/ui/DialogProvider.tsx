import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import type { DialogRequest } from './Dialog'
import { DialogContext } from './DialogContext'
import type { DialogContextValue, DialogOptions, PromptOptions } from './DialogContext'

/**
 * One request on screen at a time. A second call while one is still open resolves the FIRST one
 * with its "nothing happened" answer (`false` for confirm/destructive, `null` for prompt) before
 * the new one replaces it, so no caller is left with a promise that never settles.
 *
 * `current` mirrors `request` for `open` to read synchronously — updated in an effect (never
 * during render) so `open`'s own `resolve()` call, which schedules further state updates of its
 * own, never runs nested inside `setRequest`'s updater, where React would apply it out of order.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const current = useRef<DialogRequest | null>(null)
  useEffect(() => { current.current = request }, [request])

  const open = useCallback((req: DialogRequest) => {
    const prev = current.current
    if (prev) {
      if (prev.kind === 'prompt') prev.resolve(null)
      else prev.resolve(false)
    }
    setBusy(false)
    setRequest(req)
  }, [])

  const settle = useCallback(() => {
    setRequest(null)
    setBusy(false)
  }, [])

  const confirm = useCallback((o: DialogOptions) => new Promise<boolean>(resolve => {
    open({ kind: 'confirm', ...o, resolve: (v: boolean) => { settle(); resolve(v) } })
  }), [open, settle])

  const destructive = useCallback((o: DialogOptions) => new Promise<boolean>(resolve => {
    open({ kind: 'destructive', ...o, resolve: (v: boolean) => { settle(); resolve(v) } })
  }), [open, settle])

  const prompt = useCallback((o: PromptOptions) => new Promise<string | null>(resolve => {
    open({ kind: 'prompt', ...o, resolve: (v: string | null) => { settle(); resolve(v) } })
  }), [open, settle])

  const value: DialogContextValue = { confirm, destructive, prompt, setBusy }

  return (
    <DialogContext.Provider value={value}>
      {children}
      {request && <Dialog req={request} busy={busy} />}
    </DialogContext.Provider>
  )
}
