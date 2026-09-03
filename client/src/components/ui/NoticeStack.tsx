import { useContext } from 'react'
import type { NoticeKind, NoticeProps } from './Notice'
import { Notice } from './Notice'
import { DialogContext } from './DialogContext'

/** Most urgent first. Ties (two `info`s, say) keep the order the caller gave them, because
 * `Array.prototype.sort` is stable — that is what lets Home push over-limit/milestone/A2HS in a
 * fixed, meaningful order and trust the stack not to shuffle same-priority items. */
const PRIORITY: Record<NoticeKind, number> = { error: 0, warn: 1, pending: 2, credential: 3, success: 4, info: 5 }

/** Round-3 §0.3: at most 2 banners show; the rest collapse into one row naming the first hidden
 * one, which opens a `Dialog` listing them all. Uses `useContext` directly rather than
 * `useDialog()` — that hook throws without a `<DialogProvider>`, and this component is rendered
 * bare in `ui.test.tsx`; the real app always has a provider (`main.tsx`), so `dialog?.` only
 * matters there. Without a provider the button still renders — it is simply a no-op. */
export function NoticeStack({ items, max = 2, className = '', adult }: { items: NoticeProps[]; max?: number; className?: string; adult?: boolean }) {
  const dialog = useContext(DialogContext)
  const sorted = [...items].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
  const shown = sorted.slice(0, max)
  const hidden = sorted.slice(max)
  if (!sorted.length) return null
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {shown.map((n, i) => <Notice key={i} {...n} adult={adult} />)}
      {hidden.length > 0 && (
        <button
          type="button"
          onClick={() => { void dialog?.confirm({
            title: 'Thông báo khác',
            body: hidden.map(n => `• ${n.title}`).join('\n'),
            confirmLabel: 'Đã hiểu',
            cancelLabel: 'Đóng',
          }) }}
          className="min-h-[44px] text-center text-[12px] font-extrabold text-ink-500"
        >
          +{hidden.length} thông báo ({hidden[0].title}) ▸
        </button>
      )}
    </div>
  )
}
