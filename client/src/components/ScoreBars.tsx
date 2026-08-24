import type { PronunciationResult } from '../scoring/types'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** The four numbers Azure gives back, as short teal bars. Prosody is optional in the result
 * (Web Speech never reports it): an unmeasured bar stays empty and its label reads "Ngữ điệu —",
 * because painting accuracy in the prosody slot would contradict the chip above it that has just
 * said the intonation could not be marked at all. */
export function ScoreBars({ result }: { result: PronunciationResult }) {
  const bars: { label: string; value: number | null }[] = [
    { label: 'Chính xác', value: result.accuracy },
    { label: 'Trôi chảy', value: result.fluency },
    { label: 'Đầy đủ', value: result.completeness },
    { label: 'Ngữ điệu', value: result.prosody ?? null },
  ]
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {bars.map(b => (
        <div key={b.label} className="flex flex-col items-start gap-1.5">
          <div className="h-3 w-[130px] overflow-hidden rounded-full bg-line-200">
            <div
              data-testid="score-bar"
              data-value={b.value === null ? 'none' : String(clamp(b.value))}
              aria-label={b.value === null ? `${b.label} chưa chấm được` : `${b.label} ${clamp(b.value)}%`}
              className="h-full rounded-full bg-teal-500"
              style={{ width: b.value === null ? '0%' : `${clamp(b.value)}%` }}
            />
          </div>
          <span className="text-[15px] font-bold text-ink-300">{b.value === null ? `${b.label} —` : b.label}</span>
        </div>
      ))}
    </div>
  )
}
