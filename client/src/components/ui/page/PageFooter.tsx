import type { ReactNode } from 'react'

/** Sibling of the body, never sticky (spec decision 7). The 40 px fade is a pseudo-element so
 * the body's last row is readable through it. On iPad portrait the row is centred at 572. */
export function PageFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <footer className={`relative flex w-full gap-2.5 pt-2.5 before:pointer-events-none before:absolute before:-top-10 before:left-[-16px] before:right-[-16px] before:h-10 before:bg-gradient-to-b before:from-transparent before:to-cream-50 before:content-[''] md:mx-auto md:max-w-[572px] md:gap-3 md:before:left-[-24px] md:before:right-[-24px] ipad:mx-0 ipad:max-w-none ${className}`}>
      {children}
    </footer>
  )
}
