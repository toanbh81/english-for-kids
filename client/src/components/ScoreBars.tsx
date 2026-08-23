import type { PronunciationResult } from '../scoring/types'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** The four numbers Azure gives back, as short teal bars. Prosody is optional in the result
 * (Web Speech never reports it), so it falls back to accuracy rather than drawing an empty bar. */
export function ScoreBars({ result }: { result: PronunciationResult }) {
  const bars: { label: string; value: number }[] = [
    { label: 'Chính xác', value: result.accuracy },
    { label: 'Trôi chảy', value: result.fluency },
    { label: 'Đầy đủ', value: result.completeness },
    { label: 'Ngữ điệu', value: result.prosody ?? result.accuracy },
  ]
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {bars.map(b => (
        <div key={b.label} className="flex flex-col items-start gap-1.5">
          <div className="h-3 w-[130px] overflow-hidden rounded-full bg-line-200">
            <div
              data-testid="score-bar"
              aria-label={`${b.label} ${clamp(b.value)}%`}
              className="h-full rounded-full bg-teal-500"
              style={{ width: `${clamp(b.value)}%` }}
            />
          </div>
          <span className="text-[15px] font-bold text-ink-300">{b.label}</span>
        </div>
      ))}
    </div>
  )
}
