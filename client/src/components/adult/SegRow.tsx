export type SegTone = 'on' | 'off' | 'dim'

export type Seg = {
  key: string
  label: string
  tone: SegTone
  onClick: () => void
  ariaLabel?: string
}

// R23/R24 / quyết định 6. `dim` là tone THỨ BA, không phải `off` mờ đi: nó nói "đang được chọn
// hộ, không phải do bạn bấm" (Bài học · Tự động → bậc hiện tại).
const TONE: Record<SegTone, string> = {
  on: 'bg-coral-500 text-white shadow-chunky-coral',
  off: 'border-2 border-line-200 bg-cream-50 text-ink-500',
  dim: 'border-2 border-dashed border-[#D9CBB4] bg-[#EFE2CC] text-ink-500',
}

const SEG = 'h-11 flex-1 rounded-r12 font-display text-[13px] font-extrabold whitespace-nowrap active:translate-y-[2px]'

/** A row of 44px segmented-control buttons (brief §1.1, decision 6). Does not use `Button`/`Chip`
 * — base classes must win over `className`, so each look here is its own real tone, not an
 * override fighting a shared component's base classes (risk 6). */
export function SegRow({ segs, className = '' }: { segs: Seg[]; className?: string }) {
  return (
    <div data-testid="seg-row" className={`flex gap-2 ${className}`}>
      {segs.map(seg => (
        <button
          key={seg.key}
          type="button"
          data-testid="seg"
          data-tone={seg.tone}
          aria-label={seg.ariaLabel}
          aria-pressed={seg.tone === 'on'}
          onClick={seg.onClick}
          className={`${SEG} ${TONE[seg.tone]}`}
        >
          {seg.label}
        </button>
      ))}
    </div>
  )
}
