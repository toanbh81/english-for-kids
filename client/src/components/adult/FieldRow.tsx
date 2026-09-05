import type { ReactNode } from 'react'

// The input class strings themselves live in `./fieldStyles` (one definition each, C1) — a `.tsx`
// that exports both a component and helper functions trips `react(only-export-components)`.

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
