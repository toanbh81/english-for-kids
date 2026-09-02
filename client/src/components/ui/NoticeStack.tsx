import type { NoticeKind, NoticeProps } from './Notice'
import { Notice } from './Notice'

/** Most urgent first. Ties (two `info`s, say) keep the order the caller gave them, because
 * `Array.prototype.sort` is stable — that is what lets Home push over-limit/milestone/A2HS in a
 * fixed, meaningful order and trust the stack not to shuffle same-priority items. */
const PRIORITY: Record<NoticeKind, number> = { error: 0, warn: 1, pending: 2, credential: 3, success: 4, info: 5 }

export function NoticeStack({ items, max = 2, className = '' }: { items: NoticeProps[]; max?: number; className?: string }) {
  const sorted = [...items].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
  const shown = sorted.slice(0, max)
  const rest = sorted.length - shown.length
  if (!sorted.length) return null
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {shown.map((n, i) => <Notice key={i} {...n} />)}
      {rest > 0 && <div className="text-center text-[12px] font-bold text-ink-300">+{rest} thông báo</div>}
    </div>
  )
}
