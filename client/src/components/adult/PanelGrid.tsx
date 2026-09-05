import type { ReactNode } from 'react'

/**
 * The dashboard grid (brief §1.2 P2, decision 4): ONE DOM tree, DOM order = phone order — the wider
 * frames only change the column count, never reorder children. A `Panel col='full'` spans the row
 * via its own `md:col-span-2` / `ipad:[column-span:all]` and must accept its phone position in
 * exchange for that iPad-landscape third column (risk 4).
 *
 * **Final wave / I1 — at `ipad:` this stops being a grid.** A 3-column CSS *grid* lays the page out
 * as stacked bands, and a grid row is as tall as its tallest cell: the iPad frame's 1080px was the
 * sum of three band maxima, with ~250px of white space inside "Điểm trung bình" and "Âm hay sai"
 * paid for by their taller row-mates. Multi-column packing (`columns-3`) flows the panels DOWN the
 * columns instead, so a short panel costs exactly its own height. `break-inside-avoid` keeps a
 * panel whole (a card split across a column boundary is the one failure mode this lever has), and
 * `col='full'` becomes `column-span: all`, which still puts "Tài khoản" at the top and "Tiến độ từ
 * xa" full-width at the bottom — spec decision 24's order, unchanged. Verified on the committed
 * `ipad/parent-dashboard*.png` shots.
 */
export function PanelGrid({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      data-testid="panel-grid"
      className={`grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3.5 ipad:block ipad:columns-3 ipad:gap-3.5 ipad:[&>*]:mb-3.5 ipad:[&>*]:break-inside-avoid ${className}`}
    >
      {children}
    </div>
  )
}
