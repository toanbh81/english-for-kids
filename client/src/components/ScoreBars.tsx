import type { PronunciationResult } from '../scoring/types'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const fillClass = (value: number) => (value >= 80 ? 'bg-good-300' : value >= 55 ? 'bg-sun-400' : 'bg-bar-low')

/** The four numbers Azure gives back, always a 2×2 grid (brief §15 — the landscape wide row
 * doubled the block's height on an iPad and pushed "Tiếp theo" off the bottom, a bug this app
 * has already fixed once). Prosody is optional in the result (Web Speech never reports it): an
 * unmeasured bar stays empty and its label reads "—", because painting accuracy in the prosody
 * slot would contradict the chip above it that has just said the intonation could not be marked
 * at all. */
export function ScoreBars({ result }: { result: PronunciationResult }) {
  const bars: { label: string; value: number | null }[] = [
    { label: 'Chính xác', value: result.accuracy },
    { label: 'Trôi chảy', value: result.fluency },
    { label: 'Đầy đủ', value: result.completeness },
    { label: 'Ngữ điệu', value: result.prosody ?? null },
  ]
  return (
    <div data-testid="score-bars" className="grid w-full grid-cols-2 gap-x-3.5 gap-y-2">
      {bars.map(b => (
        <div key={b.label} className="flex flex-col gap-1">
          <div className="flex justify-between text-[12px] font-extrabold">
            <span className="text-ink-500">{b.label}</span>
            <span className="text-ink-900">{b.value === null ? '—' : `${clamp(b.value)}%`}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-r10 bg-track">
            <div
              data-testid="score-bar"
              data-value={b.value === null ? 'none' : String(clamp(b.value))}
              aria-label={b.value === null ? `${b.label} chưa chấm được` : `${b.label} ${clamp(b.value)}%`}
              className={`h-full rounded-r10 ${b.value === null ? 'bg-bar-low' : fillClass(clamp(b.value))}`}
              style={{ width: b.value === null ? '0%' : `${clamp(b.value)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
