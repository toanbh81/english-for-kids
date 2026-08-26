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
  // Four bars in one wide row is the landscape shape, and it has to stay that shape: brief §15
  // names a 2×2 grid on the iPad as one of the ten things that break 1194×834 — it doubles the
  // block's height and pushes "Tiếp theo" off the bottom, a bug this app has already fixed once.
  // So the grid is the *phone* shape only, and `md:` hands the row straight back. Colours, bar
  // radius and the teal fill are the same at every width; the design changes only the arrangement.
  return (
    <div className="grid w-full grid-cols-2 gap-x-3.5 gap-y-2.5 md:flex md:w-auto md:flex-wrap md:justify-center md:gap-6">
      {bars.map(b => (
        <div key={b.label} className="flex flex-col items-start gap-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-line-200 md:h-3 md:w-[130px]">
            <div
              data-testid="score-bar"
              data-value={b.value === null ? 'none' : String(clamp(b.value))}
              aria-label={b.value === null ? `${b.label} chưa chấm được` : `${b.label} ${clamp(b.value)}%`}
              className="h-full rounded-full bg-teal-500"
              style={{ width: b.value === null ? '0%' : `${clamp(b.value)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-ink-300 md:text-[15px] md:leading-normal">{b.value === null ? `${b.label} —` : b.label}</span>
        </div>
      ))}
    </div>
  )
}
