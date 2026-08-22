const TAP = 'min-h-[64px] min-w-[64px] flex items-center justify-center rounded-2xl bg-white shadow text-3xl active:scale-95'

type Props = {
  playing: boolean
  rate: 0.75 | 1
  musicOn: boolean
  subtitles: boolean
  sceneIndex: number
  sceneCount: number
  onToggle: () => void
  onRate: () => void
  onPrev: () => void
  onNext: () => void
  onMusic: () => void
  onSubtitles: () => void
}
export function PlayerControls({
  playing, rate, musicOn, subtitles, sceneIndex, sceneCount,
  onToggle, onRate, onPrev, onNext, onMusic, onSubtitles,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <button aria-label="Cảnh trước" onClick={onPrev} className={TAP}>
          <span aria-hidden>⏮</span>
        </button>
        <button aria-label={playing ? 'Tạm dừng' : 'Phát'} onClick={onToggle}
          className="w-24 h-24 rounded-full bg-coral text-white text-5xl flex items-center justify-center active:scale-95">
          <span aria-hidden>{playing ? '⏸' : '▶'}</span>
        </button>
        <button aria-label="Cảnh sau" onClick={onNext} className={TAP}>
          <span aria-hidden>⏭</span>
        </button>
      </div>
      <div className="flex items-center gap-4">
        <button aria-label={rate === 1 ? 'Tốc độ 0.75' : 'Tốc độ 1'} onClick={onRate} className={TAP}>
          <span aria-hidden>{rate === 1 ? '🐢' : '🐇'}</span>
        </button>
        <button aria-label={musicOn ? 'Nhạc nền bật' : 'Nhạc nền tắt'} onClick={onMusic} className={TAP}>
          <span aria-hidden>🎵</span>
        </button>
        <button aria-label={subtitles ? 'Phụ đề bật' : 'Phụ đề tắt'} onClick={onSubtitles} className={TAP}>
          <span aria-hidden>🇻🇳</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: sceneCount }, (_, i) => (
          <span key={i} data-testid="scene-dot" data-active={i === sceneIndex ? 'true' : 'false'}
            className={`w-3 h-3 rounded-full ${i === sceneIndex ? 'bg-coral' : 'bg-slate-300'}`} />
        ))}
      </div>
    </div>
  )
}
