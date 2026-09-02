import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Dialog } from './Dialog'
import type { DialogRequest } from './Dialog'
import { DialogContext } from './DialogContext'
import type { DialogContextValue, DialogOptions, PromptOptions } from './DialogContext'

/**
 * One request on screen at a time.
 *
 * `current` mirrors `request` for `open` to read synchronously — updated in an effect (never
 * during render) so `open`'s own `resolve()` call, which schedules further state updates of its
 * own, never runs nested inside `setRequest`'s updater, where React would apply it out of order.
 *
 * `busyRef` mirrors the CURRENT request's `busy` flag the same way, via `Dialog`'s
 * `onBusyChange`. Two rules follow from it:
 *
 *  - **A busy dialog can never be replaced.** `open()` checks it before touching anything: while
 *    busy, the NEW request is refused — its OWN `resolve` is called directly with the neutral
 *    answer (`false`/`null`), never through the `settle`-wrapped version below, because this
 *    request never became the active one and must not clear whichever dialog IS active. The busy
 *    dialog is left exactly as it was. Every control inside a busy dialog is already `disabled`,
 *    so without this check the only way to reach a second `open()` is a trigger ELSEWHERE on the
 *    screen the parent forgot to disable (Tab out of the disabled dialog, or a background
 *    button) — and that used to cancel the in-flight action out from under itself, since the old
 *    "second request replaces the first" rule made no exception for busy.
 *  - **Each ACCEPTED request gets its own `id`,** which becomes `Dialog`'s React `key` in the
 *    render below. A genuinely replaced (non-busy) request must remount, not update in place —
 *    reusing the same component instance would carry the OLD request's `busy`/`value` state into
 *    the new one and skip the mount-only focus effect. `resolve` is only wrapped with `settle`
 *    (which clears `request`) at the moment a request is actually accepted into state — a
 *    refused request's `resolve` must never carry that side effect.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null)
  const current = useRef<DialogRequest | null>(null)
  const busyRef = useRef(false)
  const nextId = useRef(0)
  useEffect(() => { current.current = request }, [request])

  const settle = useCallback(() => {
    busyRef.current = false
    setRequest(null)
  }, [])

  const open = useCallback((req: DialogRequest) => {
    if (busyRef.current) {
      // Refused: answer as if dismissed, WITHOUT settling — this request was never accepted, so
      // it must not clear the dialog that actually is on screen.
      if (req.kind === 'prompt') req.resolve(null)
      else req.resolve(false)
      return
    }
    const prev = current.current
    if (prev) {
      if (prev.kind === 'prompt') prev.resolve(null)
      else prev.resolve(false)
    }
    busyRef.current = false
    // Wrapped here, not by the caller: only a request that is actually being accepted may close
    // the dialog when it later resolves.
    const accepted: DialogRequest = req.kind === 'prompt'
      ? { ...req, resolve: (v: string | null) => { settle(); req.resolve(v) } }
      : { ...req, resolve: (v: boolean) => { settle(); req.resolve(v) } }
    setRequest(accepted)
  }, [settle])

  const handleBusyChange = useCallback((busy: boolean) => { busyRef.current = busy }, [])

  const confirm = useCallback((o: DialogOptions) => new Promise<boolean>(resolve => {
    open({ id: ++nextId.current, kind: 'confirm', ...o, resolve })
  }), [open])

  const destructive = useCallback((o: DialogOptions) => new Promise<boolean>(resolve => {
    open({ id: ++nextId.current, kind: 'destructive', ...o, resolve })
  }), [open])

  const prompt = useCallback((o: PromptOptions) => new Promise<string | null>(resolve => {
    open({ id: ++nextId.current, kind: 'prompt', ...o, resolve })
  }), [open])

  const value: DialogContextValue = { confirm, destructive, prompt }

  return (
    <DialogContext.Provider value={value}>
      {children}
      {request && <Dialog key={request.id} req={request} onBusyChange={handleBusyChange} />}
    </DialogContext.Provider>
  )
}
