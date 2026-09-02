// LevelBars.tsx — brief §2.2: 7 bars 6×(10–28) under the recording mic, driven by the input level.
const BASE = [10, 18, 28, 22, 14, 24, 12]
export function LevelBars({ level }: { level: number }) {
  const k = 0.4 + 0.6 * Math.max(0, Math.min(1, level))
  return (
    <div aria-hidden="true" className="flex h-7 items-center gap-[5px]">
      {BASE.map((h, i) => (
        <div key={i} data-testid="level-bar" className="w-1.5 rounded-[3px] bg-coral-500 transition-[height] duration-100" style={{ height: `${Math.round(h * k)}px` }} />
      ))}
    </div>
  )
}
