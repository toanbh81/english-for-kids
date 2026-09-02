import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * One request in flight at a time (see `DialogProvider`). `confirm`/`destructive` differ only in
 * button colour — a plain "OK, are you sure" vs. an irreversible-and-red one — and `prompt` swaps
 * the body paragraph for a labelled input with its own maxLength/counter.
 *
 * `onConfirm`/`onSubmit` are optional: when the caller passes one, the confirm/save button keeps
 * this dialog open and `busy` (see below) until the callback settles, instead of resolving and
 * closing immediately.
 */
export type DialogRequest =
  | { kind: 'confirm' | 'destructive'; title: string; body: string; confirmLabel: string; cancelLabel?: string; onConfirm?: () => Promise<unknown>; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; label: string; initial?: string; maxLength?: number; confirmLabel?: string; onSubmit?: (value: string) => Promise<unknown>; resolve: (v: string | null) => void }

/**
 * Adult UI (brief §2.8): 44 px controls, 12–14 px text, no Foxy — the same register as the rest
 * of `ParentDashboard`, not the 64 px child screens.
 *
 * `busy` is local state, not a prop from `DialogProvider`: it belongs to the one action THIS
 * dialog's confirm/save button just triggered, and nothing outside this component needs to see it
 * mid-flight — the provider only ever learns the final answer, once, when `resolve` fires.
 */
export function Dialog({ req }: { req: DialogRequest }) {
  const [value, setValue] = useState(req.kind === 'prompt' ? (req.initial ?? '') : '')
  const [busy, setBusy] = useState(false)
  // The element that gets focus on open: the confirm/destructive button for those two kinds (so a
  // keyboard/AT user lands on the one control that matters), the input for a prompt.
  const first = useRef<HTMLElement>(null)
  useEffect(() => { first.current?.focus() }, [])

  // The "nothing happened" answer, shared by the scrim click, the Huỷ button and Escape. Wrapped
  // in `useCallback` (deps: just `req`, stable for this dialog's whole lifetime) so the effect
  // below can name it as a dependency honestly instead of suppressing the lint rule.
  const cancel = useCallback(() => {
    if (req.kind === 'prompt') req.resolve(null)
    else req.resolve(false)
  }, [req])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || busy) return
      cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, cancel])

  const max = req.kind === 'prompt' ? (req.maxLength ?? 40) : 0
  const short = value.trim().split(/\s+/).slice(-2).join(' ')

  /** The confirm/destructive/save button's own handler. With no `onConfirm`/`onSubmit`, resolves
   * and closes immediately, exactly as before. With one, goes busy, awaits it — swallowing a
   * throw, since the caller owns its own error handling and reporting — then resolves and closes
   * either way, so a failed reset or sign-out never leaves the dialog stuck open. */
  async function confirmAction() {
    if (req.kind === 'prompt') {
      const trimmed = value.trim()
      if (!req.onSubmit) { req.resolve(trimmed); return }
      setBusy(true)
      try { await req.onSubmit(trimmed) } catch { /* the caller handles its own errors */ }
      req.resolve(trimmed)
      return
    }
    if (!req.onConfirm) { req.resolve(true); return }
    setBusy(true)
    try { await req.onConfirm() } catch { /* the caller handles its own errors */ }
    req.resolve(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(74,59,51,.45)] p-4" onClick={() => { if (!busy) cancel() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={e => e.stopPropagation()} className="flex w-[min(420px,calc(100%-32px))] flex-col gap-3 rounded-r20 bg-white p-5 shadow-dialog">
        <h2 id="dlg-title" className="font-display text-[18px] font-extrabold leading-tight text-ink-900">{req.title}</h2>
        {req.kind !== 'prompt' && <p className="text-[13px] font-bold leading-relaxed text-ink-500">{req.body}</p>}
        {req.kind === 'prompt' && (
          // A `<label htmlFor>` rather than a wrapping one: `getByLabelText` computes a wrapping
          // label's accessible name from ALL of its text content, and the counter/hint row below
          // would fold into that name ("Tên của bé2/40") otherwise.
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dlg-prompt-input" className="text-[12px] font-extrabold text-ink-500">{req.label}</label>
            <input id="dlg-prompt-input" ref={first as never} disabled={busy} value={value} maxLength={max} onChange={e => setValue(e.target.value.slice(0, max))} className="h-11 rounded-r12 border-2 border-teal-500 px-3 text-[15px] font-bold text-ink-900 outline-none disabled:opacity-50" />
            <span className="flex justify-between text-[11px] font-bold text-ink-300"><span>{short && short !== value.trim() ? `Hiện trong app dưới dạng "${short}" nếu quá dài` : ''}</span><span>{value.length}/{max}</span></span>
          </div>
        )}
        <div className="mt-1 flex justify-end gap-2.5">
          <button type="button" disabled={busy} onClick={cancel} className="min-h-[44px] rounded-r12 border-2 border-sand-edge px-4 text-[14px] font-extrabold text-ink-500">{req.kind === 'prompt' ? 'Huỷ' : (req.cancelLabel ?? 'Huỷ')}</button>
          {req.kind === 'prompt'
            ? <button type="button" disabled={busy || !value.trim()} onClick={() => { void confirmAction() }} className="min-h-[44px] rounded-r12 bg-teal-500 px-4 text-[14px] font-extrabold text-white">{busy ? '…' : (req.confirmLabel ?? 'Lưu')}</button>
            : <button type="button" ref={first as never} disabled={busy} onClick={() => { void confirmAction() }} className={`min-h-[44px] rounded-r12 px-4 text-[14px] font-extrabold text-white ${req.kind === 'destructive' ? 'bg-fix-700' : 'bg-coral-500'}`}>{busy ? '…' : req.confirmLabel}</button>}
        </div>
      </div>
    </div>
  )
}
