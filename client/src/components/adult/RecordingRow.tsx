// R22/Q18 — decision 8 (44px row, banded score) and 30 (playing/error states). Row height is 44,
// not the old child-sized 64 (decision 1); the play button is 36 inside a 44 hit band.
const SCORE = (s: number) => (s >= 80 ? 'text-good-700' : s >= 50 ? 'text-sun-700' : 'text-fix-700')

function formatTs(ts: number): string {
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} ${hh}:${min}`
}

export function RecordingRow({ ts, text, score, playing, error, onPlay }: {
  ts: number
  text: string
  score?: number
  playing?: boolean
  error?: boolean
  onPlay: () => void
}) {
  return (
    <div className="flex flex-col">
      <div data-testid="recording-row" className={`flex h-11 items-center gap-2.5 border-b border-line-200 ${error ? 'bg-fix-50' : ''}`}>
        <button
          type="button"
          aria-label={playing ? 'Dừng' : 'Phát'}
          onClick={onPlay}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white after:absolute after:-inset-1 after:content-['']"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="shrink-0 text-[11px] font-extrabold text-ink-300">{formatTs(ts)}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-900">{text}</span>
        {typeof score === 'number' && (
          <span data-testid="recording-score" className={`shrink-0 text-[11px] font-extrabold ${SCORE(score)}`}>{score}</span>
        )}
        {error && <span className="shrink-0 text-[11px] font-extrabold text-fix-700">Không phát được</span>}
      </div>
      {playing && <div data-testid="recording-progress" className="h-[3px] w-full animate-pulse bg-teal-500" />}
    </div>
  )
}
