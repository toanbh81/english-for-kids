import type { ReactNode } from 'react'

/** White panel on the cream canvas, lifted by the hard offset `shadow-card`. */
export function Card({ className = '', children }: { className?: string; children?: ReactNode }) {
  return <div className={`rounded-xl3 bg-white shadow-card ${className}`}>{children}</div>
}
