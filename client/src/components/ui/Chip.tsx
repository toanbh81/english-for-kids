import type { ReactNode } from 'react'

export type ChipTone = 'teal' | 'coral' | 'sun' | 'neutral'
export type ChipSize = 'sm' | 'md'

const TONE: Record<ChipTone, string> = {
  teal: 'bg-teal-50 text-teal-600',
  coral: 'bg-coral-50 text-coral-text',
  sun: 'bg-sun-50 text-sun-700',
  neutral: 'bg-cream-50 text-ink-500',
}

const SIZE: Record<ChipSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
}

/** Small pill label — speed, counts, "Nghe mẫu", scene hints. */
export function Chip({ tone = 'neutral', size = 'md', className = '', children }: {
  tone?: ChipTone
  size?: ChipSize
  className?: string
  children?: ReactNode
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-display font-extrabold ${SIZE[size]} ${TONE[tone]} ${className}`}>
      {children}
    </span>
  )
}
