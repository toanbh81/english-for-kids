import type { ReactNode } from 'react'

const SIZE = { md: 'text-[15px] py-[7px]', lg: 'text-[17px] py-[9px]' } as const

/** Two chip halves stuck together — teal left, coral right — e.g. "Âm 2/9" | "Từ 1/3". */
export function ChipPair({ left, right, size = 'md', className = '' }: {
  left: ReactNode
  right: ReactNode
  size?: 'md' | 'lg'
  className?: string
}) {
  const s = SIZE[size]
  return (
    <span data-testid="chip-pair" className={`inline-flex font-display font-extrabold ${className}`}>
      <span className={`rounded-l-r12 rounded-r-none bg-teal-50 px-3 text-teal-600 md:rounded-l-r14 ${s}`}>{left}</span>
      <span className={`rounded-r-r12 rounded-l-none bg-coral-50 px-3 text-coral-text md:rounded-r-r14 ${s}`}>{right}</span>
    </span>
  )
}
