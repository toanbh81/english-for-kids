import type { ReactNode } from 'react'

/**
 * The dashboard grid (brief §1.2 P2, decision 4): ONE DOM tree, DOM order = phone order — the two
 * wider frames only change the column count (`grid-cols-1 md:grid-cols-2 ipad:grid-cols-3`), never
 * reorder children. A `Panel col='full'` spans the row via its own `md:col-span-2 ipad:col-span-3`
 * and must accept its phone position in exchange for that iPad-landscape third column (risk 4).
 */
export function PanelGrid({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div data-testid="panel-grid" className={`grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3.5 ipad:grid-cols-3 ${className}`}>{children}</div>
}
