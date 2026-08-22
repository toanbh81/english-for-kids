type Props = { state: 'idle' | 'recording' | 'processing' | 'disabled'; level: number; onPress: () => void }
export function MicButton({ state, level, onPress }: Props) {
  const ring = state === 'recording' ? 1 + level * 0.35 : 1
  const label = state === 'recording' ? 'Dừng' : state === 'processing' ? 'Đang chấm…' : 'Bấm để nói'
  return (
    <button aria-label={label} disabled={state === 'disabled' || state === 'processing'} onClick={onPress}
      className="relative w-32 h-32 rounded-full bg-coral text-white text-5xl shadow-lg disabled:opacity-50 active:scale-95 transition">
      {state === 'recording' && <span className="absolute inset-0 rounded-full bg-coral/40" style={{ transform: `scale(${ring})` }} />}
      <span className="relative">{state === 'processing' ? '⏳' : state === 'recording' ? '⏹' : '🎤'}</span>
    </button>
  )
}
