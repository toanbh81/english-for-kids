import type { ReactNode } from 'react'

/** Foxy's speech bubble: rounded except the bottom-left corner, which points back at him. */
export function SpeechBubble({ title, subtitle, className = '' }: { title: ReactNode; subtitle?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[22px] rounded-bl-[6px] bg-white px-5 py-3 shadow-card-sm ${className}`}>
      <div className="font-display text-xl font-extrabold text-ink-900">{title}</div>
      {subtitle && <div className="mt-0.5 text-sm font-bold text-ink-500">{subtitle}</div>}
    </div>
  )
}
