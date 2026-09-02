import type { ReactNode } from 'react'
import { PAGE_SHELL } from '../pageShell'

const GUTTER = { '16': 'px-4', '20': 'px-5', '24': 'px-6' } as const

/** Brief §1: the one frame. Phone gutter 16 (a screen may ask for 20), iPad 24; body is the only
 * scroller, so the shell itself never scrolls (`overflow-hidden`). Vertical padding is the
 * safe-area shell: phone 47+8 / 34+10, iPad 20/24. */
export function PageShell({ gutter = '16', className = '', children }: { gutter?: keyof typeof GUTTER; className?: string; children: ReactNode }) {
  return (
    <main className={`flex h-full flex-col overflow-hidden bg-cream-50 ${GUTTER[gutter]} md:px-6 [--page-pad-top:1.25rem] [--page-pad-bottom:1.25rem] md:[--page-pad-bottom:1.5rem] ${PAGE_SHELL} ${className}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 flex-col">{children}</div>
    </main>
  )
}
