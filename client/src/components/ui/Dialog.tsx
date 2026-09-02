import { useEffect, useRef, useState } from 'react'

/**
 * One request in flight at a time (see `DialogProvider`). `confirm`/`destructive` differ only in
 * button colour — a plain "OK, are you sure" vs. an irreversible-and-red one — and `prompt` swaps
 * the body paragraph for a labelled input with its own maxLength/counter.
 */
export type DialogRequest =
  | { kind: 'confirm' | 'destructive'; title: string; body: string; confirmLabel: string; cancelLabel?: string; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; label: string; initial?: string; maxLength?: number; confirmLabel?: string; resolve: (v: string | null) => void }

/** Adult UI (brief §2.8): 44 px controls, 12–14 px text, no Foxy — the same register as the rest
 * of `ParentDashboard`, not the 64 px child screens. */
export function Dialog({ req, busy }: { req: DialogRequest; busy: boolean }) {
  const [value, setValue] = useState(req.kind === 'prompt' ? (req.initial ?? '') : '')
  const first = useRef<HTMLElement>(null)
  useEffect(() => { first.current?.focus() }, [])
  const max = req.kind === 'prompt' ? (req.maxLength ?? 40) : 0
  const short = value.trim().split(/\s+/).slice(-2).join(' ')
  // The "nothing happened" answer, shared by the scrim click and the Huỷ button.
  const cancel = () => { if (req.kind === 'prompt') req.resolve(null); else req.resolve(false) }
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
            <input id="dlg-prompt-input" ref={first as never} value={value} maxLength={max} onChange={e => setValue(e.target.value.slice(0, max))} className="h-11 rounded-r12 border-2 border-teal-500 px-3 text-[15px] font-bold text-ink-900 outline-none" />
            <span className="flex justify-between text-[11px] font-bold text-ink-300"><span>{short && short !== value.trim() ? `Hiện trong app dưới dạng "${short}" nếu quá dài` : ''}</span><span>{value.length}/{max}</span></span>
          </div>
        )}
        <div className="mt-1 flex justify-end gap-2.5">
          <button type="button" disabled={busy} onClick={cancel} className="min-h-[44px] rounded-r12 border-2 border-sand-edge px-4 text-[14px] font-extrabold text-ink-500">{req.kind === 'prompt' ? 'Huỷ' : (req.cancelLabel ?? 'Huỷ')}</button>
          {req.kind === 'prompt'
            ? <button type="button" disabled={busy || !value.trim()} onClick={() => req.resolve(value.trim())} className="min-h-[44px] rounded-r12 bg-teal-500 px-4 text-[14px] font-extrabold text-white">{req.confirmLabel ?? 'Lưu'}</button>
            : <button type="button" disabled={busy} onClick={() => req.resolve(true)} className={`min-h-[44px] rounded-r12 px-4 text-[14px] font-extrabold text-white ${req.kind === 'destructive' ? 'bg-fix-700' : 'bg-coral-500'}`}>{busy ? '…' : req.confirmLabel}</button>}
        </div>
      </div>
    </div>
  )
}
