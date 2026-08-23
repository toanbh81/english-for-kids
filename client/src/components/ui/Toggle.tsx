/** 58×32 track with a white knob, plus its label — the whole row is the switch, so the
 * tap target stays child-sized. */
export function Toggle({ on, onChange, emoji, label, className = '' }: {
  on: boolean
  onChange: (next: boolean) => void
  emoji?: string
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`inline-flex min-h-[64px] items-center gap-3 px-2 ${className}`}
    >
      <span className={`relative block h-8 w-[58px] rounded-full transition-colors ${on ? 'bg-teal-500' : 'bg-line-200'}`}>
        <span className={`absolute top-1 block h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[30px]' : 'left-1'}`} />
      </span>
      {emoji && <span aria-hidden="true" className="text-xl">{emoji}</span>}
      <span className="font-bold text-ink-500">{label}</span>
    </button>
  )
}
