type Props = { state: 'idle' | 'recording' | 'processing' | 'disabled'; level: number; onPress: () => void }

/** The big coral mic of the handoff: 150 px at rest inside a soft halo, 190 px while recording
 * with two expanding rings. The glyph scales with the live input level so the child can see the
 * app hearing them. */
export function MicButton({ state, level, onPress }: Props) {
  const recording = state === 'recording'
  const label = recording ? 'Dừng' : state === 'processing' ? 'Đang chấm…' : 'Bấm để nói'
  return (
    <button
      aria-label={label}
      disabled={state === 'disabled' || state === 'processing'}
      onClick={onPress}
      className={[
        'relative flex items-center justify-center rounded-full bg-coral-500 text-white',
        'shadow-[0_10px_0_#E05A3A,0_0_0_12px_#FFE3D7] transition-transform',
        'active:translate-y-[3px] disabled:opacity-50',
        recording ? 'h-[190px] w-[190px] text-[76px] animate-pulse-soft' : 'h-[150px] w-[150px] text-[62px]',
      ].join(' ')}
    >
      {recording && (
        <>
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-coral-500/50 animate-ring" />
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-coral-500/40 animate-ring" style={{ animationDelay: '.7s' }} />
        </>
      )}
      <span
        aria-hidden="true"
        className="relative leading-none transition-transform"
        style={recording ? { transform: `scale(${1 + level * 0.18})` } : undefined}
      >
        {state === 'processing' ? '⏳' : recording ? '⏹' : '🎤'}
      </span>
    </button>
  )
}
