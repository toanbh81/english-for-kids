import { EmptyState } from '../ui'

/** R19/Q17 — decision 7 (colours/shape) and 27 (the 7/14 switch). `range` is decided by the
 * SCREEN (14 default at `md:`/`ipad:`, 7 on the phone — `PHONE_DAYS` from Phase 12 stays correct);
 * this component only slices the `days` array it is handed down to the last `range` entries and
 * draws them. `onRangeChange` is optional: the phone has no switch at all (decision 27), so a
 * screen that never offers one simply omits the prop and the switch never renders. */
const BAR = (m: number, isToday: boolean) =>
  isToday ? 'bg-coral-500' : m >= 20 ? 'bg-teal-500' : m > 0 ? 'bg-sun-400' : 'bg-line-200 h-1'

// A zero-minute bar floors at 4%, not 2%: at the phone's 86px plot, 2% is 1.7px — thinner than the
// grid line itself and reads as "no bar", not "no minutes".
const barHeightPct = (m: number, scaleMax: number) => Math.max(4, (m / scaleMax) * 100)

function formatDayLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

// I3: 26px visible, 46px tapped — `after:-inset-2.5` is the adult zone's hit band, mandatory on
// every control whose visible box is under 44.
const RANGE_BTN = "relative h-[26px] rounded-lg px-2 text-[12px] font-extrabold after:absolute after:-inset-2.5 after:content-['']"

export function MinutesChart({ days, limitMinutes, range, todayKey, onRangeChange }: {
  days: { day: string; minutes: number }[]
  limitMinutes: number
  range: 7 | 14
  todayKey: string
  onRangeChange?: (range: 7 | 14) => void
}) {
  if (days.length === 0) {
    return (
      <EmptyState
        adult
        variant="dashed"
        emoji="📈"
        title="Chưa có lịch sử luyện"
        sub="Biểu đồ hiện từ ngày học đầu tiên."
      />
    )
  }

  const shown = days.slice(-range)
  const scaleMax = Math.max(1, limitMinutes, ...shown.map(d => d.minutes))
  const targetTopPct = Math.min(100, Math.max(0, 100 - (limitMinutes / scaleMax) * 100))
  const midIdx = Math.floor(shown.length / 2)

  return (
    <div data-testid="minutes-chart" className="flex flex-col gap-2">
      {onRangeChange && (
        <div className="flex justify-end">
          <div data-testid="range-switch" className="hidden rounded-r10 bg-sand p-[3px] md:inline-flex">
            {([7, 14] as const).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                className={`${RANGE_BTN} ${r === range ? 'bg-white shadow-[0_2px_0_#E2D5C0]' : 'text-ink-500'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <div data-testid="minutes-plot" className="relative flex h-[86px] items-end gap-[9px] md:h-[120px] md:gap-1.5">
        <div
          data-testid="target-line"
          className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-sun-400"
          style={{ top: `${targetTopPct}%` }}
        />
        {/* Fix round, finding 2: right-anchored, this sat in the same top-right corner as the 7/14
          * range switch one row up — whenever the seeded activity never crosses the daily limit,
          * `scaleMax === limitMinutes` and the target line (and this label) sit at the very top of
          * the plot, so `translateY(-100%)` pushed the label up into the switch's row with no gap
          * between them. Left-anchoring keeps the label on its dashed line without ever sharing the
          * switch's corner, at every viewport (the switch itself is `hidden` below `md:`, so there
          * is nothing to collide with on a phone either way). */}
        <span className="pointer-events-none absolute left-0 text-[10px] font-bold text-sun-700" style={{ top: `${targetTopPct}%`, transform: 'translateY(-100%)' }}>
          mục tiêu {limitMinutes}'
        </span>
        {shown.map(d => (
          <div key={d.day} className="flex h-full max-w-[26px] flex-1 items-end">
            <div
              data-testid="minute-bar"
              data-minutes={d.minutes}
              className={`w-full rounded-[7px] ${BAR(d.minutes, d.day === todayKey)}`}
              style={{ height: `${barHeightPct(d.minutes, scaleMax)}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex justify-between">
        <span data-testid="day-label" className="text-[10px] font-bold text-ink-300">{formatDayLabel(shown[0].day)}</span>
        <span data-testid="day-label" className="text-[10px] font-bold text-ink-300">{formatDayLabel(shown[midIdx].day)}</span>
        <span data-testid="day-label" className="text-[10px] font-bold text-coral-text">hôm nay</span>
      </div>
    </div>
  )
}
