export type ProgressTone = 'teal' | 'coral' | 'sun'

const TONE: Record<ProgressTone, string> = {
  teal: 'bg-gradient-to-r from-teal-500 to-good-300',
  coral: 'bg-coral-500',
  sun: 'bg-sun-400',
}

/** Rounded track with a tone-coloured fill; `value` is a 0–100 percentage and is clamped. */
export function ProgressBar({ value, tone = 'teal', className = '' }: { value: number; tone?: ProgressTone; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-3.5 w-full overflow-hidden rounded-full bg-line-200 ${className}`}
    >
      <div data-testid="progress-fill" className={`h-full rounded-full ${TONE[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
