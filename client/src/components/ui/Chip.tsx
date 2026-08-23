import type { ReactNode } from 'react'

export type ChipTone = 'teal' | 'coral' | 'sun' | 'neutral'

const TONE: Record<ChipTone, string> = {
  teal: 'bg-teal-50 text-teal-600',
  coral: 'bg-coral-50 text-coral-text',
  sun: 'bg-sun-50 text-sun-700',
  neutral: 'bg-cream-50 text-ink-500',
}

/** Small pill label — speed, counts, "Nghe mẫu", scene hints. */
export function Chip({ tone = 'neutral', className = '', children }: { tone?: ChipTone; className?: string; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-display text-lg font-extrabold ${TONE[tone]} ${className}`}>
      {children}
    </span>
  )
}
