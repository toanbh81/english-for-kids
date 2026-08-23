import { SceneDots } from './ui/SceneDots'
import { Toggle } from './ui/Toggle'

const STEP = 'flex h-[64px] w-[64px] items-center justify-center rounded-2xl bg-white text-3xl text-ink-500 shadow-card-sm active:translate-y-[2px]'
const SPEED_CHIP = 'flex h-[46px] w-[52px] items-center justify-center rounded-[14px] text-2xl transition-colors'
const SPEED_ACTIVE = 'bg-coral-50 ring-[3px] ring-inset ring-peach-400'

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
  /** The player draws its own dots over the picture; standalone uses keep them here. */
  dots?: boolean
}

/** Speed pill · scene steps around the 104 px play button · music and subtitle switches.
 * Every control keeps the state in its accessible name, so a screen reader hears
 * "Nhạc nền bật" rather than an unlabelled emoji. */
export function PlayerControls({
  playing, rate, musicOn, subtitles, sceneIndex, sceneCount,
  onToggle, onRate, onPrev, onNext, onMusic, onSubtitles, dots = true,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        {/* One button, two chips: the highlighted animal is the speed playing now, and the
            accessible name says the speed the tap switches to. */}
        <button
          aria-label={rate === 1 ? 'Tốc độ 0.75' : 'Tốc độ 1'}
          onClick={onRate}
          className="flex min-h-[64px] items-center gap-2 rounded-xl2 bg-white p-2 shadow-card-sm active:translate-y-[2px]"
        >
          <span aria-hidden="true" className={`${SPEED_CHIP} ${rate === 0.75 ? SPEED_ACTIVE : ''}`}>🐢</span>
          <span aria-hidden="true" className={`${SPEED_CHIP} ${rate === 1 ? SPEED_ACTIVE : ''}`}>🐇</span>
        </button>

        <button aria-label="Cảnh trước" onClick={onPrev} className={STEP}>
          <span aria-hidden="true">⏮</span>
        </button>

        <button
          aria-label={playing ? 'Tạm dừng' : 'Phát'}
          onClick={onToggle}
          className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-teal-500 text-[44px] text-white shadow-[0_8px_0_#1FA396] active:translate-y-[3px] active:shadow-[0_5px_0_#1FA396]"
        >
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        </button>

        <button aria-label="Cảnh sau" onClick={onNext} className={STEP}>
          <span aria-hidden="true">⏭</span>
        </button>

        <div className="flex flex-col">
          <Toggle
            role="button"
            ariaLabel={musicOn ? 'Nhạc nền bật' : 'Nhạc nền tắt'}
            on={musicOn}
            onChange={onMusic}
            emoji="🎵"
            label="Nhạc nền"
          />
          <Toggle
            role="button"
            ariaLabel={subtitles ? 'Phụ đề bật' : 'Phụ đề tắt'}
            on={subtitles}
            onChange={onSubtitles}
            emoji="🇻🇳"
            label="Phụ đề Việt"
          />
        </div>
      </div>

      {dots && <SceneDots count={sceneCount} active={sceneIndex} />}
    </div>
  )
}
