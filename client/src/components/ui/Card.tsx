import type { ComponentPropsWithoutRef } from 'react'

/**
 * White panel on the cream canvas, lifted by the hard offset `shadow-card`.
 *
 * Forwards every other `<div>` prop (`data-testid` included) rather than swallowing it: React's JSX
 * checking exempts `data-*`/`aria-*` attributes from a custom component's prop types entirely, so
 * `<Card data-testid="x">` type-checked fine even while this component only ever read `className`
 * and `children` — the attribute was accepted at compile time and then silently never reached the
 * DOM. A `queryByTestId` for it can only ever fail, which makes it a negative assertion that was
 * never actually testing what it looked like it was testing.
 */
export function Card({ className = '', children, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={`rounded-xl3 bg-white shadow-card ${className}`} {...rest}>{children}</div>
}
