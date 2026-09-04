import type { ReactNode } from 'react'

/** Standard input class string — 6 call sites share this instead of each re-typing it (brief §1.1). */
export const FIELD_INPUT = 'h-11 w-full truncate rounded-r12 border-2 border-sand-edge px-3 text-[14px] font-bold text-ink-900 outline-none focus:border-teal-500'
export const FIELD_INPUT_ERROR = 'border-fix-700'
/** OTP / recovery-code input: Baloo 22, tracking 6, centered (brief §2 A2 ④⑤). */
export const FIELD_INPUT_CODE = 'text-center font-display text-[22px] font-extrabold tracking-[6px]'

/**
 * A labelled form row (brief §1.1, decision 5). The error gutter ALWAYS reserves 18px, even empty
 * — a form that jumps 18px on a mistake pushes the button right out from under the finger that's
 * tapping it. `input` is built by the call site so it keeps its own `value`/`onChange`/`aria-label`;
 * `action` is an optional 44px "Thử lại" that lives inside that same gutter.
 */
export function FieldRow({
  label,
  input,
  error,
  help,
  action,
  htmlFor,
}: {
  label: string
  input: ReactNode
  error?: string
  help?: string
  action?: { label: string; onClick: () => void }
  htmlFor?: string
}) {
  return (
    <div data-testid="field-row" className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[12px] font-extrabold text-ink-500">{label}</label>
      {input}
      <div data-testid="field-error" className="flex min-h-[18px] items-center gap-2 text-[12px] font-extrabold leading-[1.4] text-fix-700">
        {error && <span className="min-w-0 flex-1">{error}</span>}
        {error && action && <button type="button" onClick={action.onClick} className="h-11 shrink-0 rounded-r12 border-2 border-sand-edge px-3 text-[12px] font-extrabold text-ink-500">{action.label}</button>}
      </div>
      {help && <p className="text-[11px] font-bold leading-snug text-ink-300">{help}</p>}
    </div>
  )
}
