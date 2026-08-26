import { SceneDots } from './ui/SceneDots'
import { Toggle } from './ui/Toggle'

/**
 * Phone rules live at the default breakpoint and `md:` (768) restores the landscape value exactly
 * — the phase-10 idiom (see the block comment in `screens/SoundPractice.tsx`).
 *
 * The one structural change below 768 is the `order-*` run. All five controls are in one
 * `flex-wrap` row, and at 390 px they need two lines; left to itself the wrap puts the speed pill
 * and ⏮ on the first line and the play button on the second, which is the opposite of the design's
 * "cụm điều khiển ghim đáy" (§9 M6: transport on its own row, options under it). The orders pull
 * ⏮ · ▶ · ⏭ (260 px at the design's sizes) onto the first line and leave speed + subtitles for the
 * second; `md:order-none` hands the DOM order back from 768 up, where the whole thing is one row.
 */
const TRANSPORT = 'order-1 md:order-none'
const STEP = `flex h-[64px] w-[64px] items-center justify-center rounded-2xl bg-white text-3xl text-ink-500 shadow-card-sm active:translate-y-[2px] ${TRANSPORT}`
const SPEED_CHIP = 'flex h-10 w-11 items-center justify-center rounded-[14px] text-xl transition-colors md:h-[46px] md:w-[52px] md:text-2xl'
const SPEED_ACTIVE = 'bg-coral-50 ring-[3px] ring-inset ring-peach-400'

type Props = {
  playing: boolean
  rate: 0.75 | 1
  subtitles: boolean
  sceneIndex: number
  sceneCount: number
  onToggle: () => void
  onRate: () => void
  onPrev: () => void
  onNext: () => void
  onSubtitles: () => void
  /** The player draws its own dots over the picture; standalone uses keep them here. */
  dots?: boolean
}

/** Speed pill · scene steps around the 104 px play button · subtitle switch.
 * Every control keeps the state in its accessible name, so a screen reader hears
 * "Phụ đề bật" rather than an unlabelled emoji. */
export function PlayerControls({
  playing, rate, subtitles, sceneIndex, sceneCount,
  onToggle, onRate, onPrev, onNext, onSubtitles, dots = true,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        {/* One button, two chips: the highlighted animal is the speed playing now, and the
            accessible name says the speed the tap switches to. */}
        <button
          aria-label={rate === 1 ? 'Tốc độ 0.75' : 'Tốc độ 1'}
          onClick={onRate}
          className="order-2 flex min-h-[64px] items-center gap-2 rounded-xl2 bg-white p-2 shadow-card-sm active:translate-y-[2px] md:order-none"
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
          className={`flex h-24 w-24 items-center justify-center rounded-full bg-teal-500 text-[38px] text-white shadow-[0_8px_0_#1FA396] active:translate-y-[3px] active:shadow-[0_5px_0_#1FA396] md:h-[104px] md:w-[104px] md:text-[44px] ${TRANSPORT}`}
        >
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        </button>

        <button aria-label="Cảnh sau" onClick={onNext} className={STEP}>
          <span aria-hidden="true">⏭</span>
        </button>

        <div className="order-3 flex flex-col md:order-none">
          {/* The design shrinks this switch to a 14 px line of text (§9 M6); it stays a real
              switch — the brief's Q12 leaves the static-text version unresolved and a toggle the
              child cannot press is not a smaller toggle. Only the label shrinks, which is what
              gets speed + subtitles onto one 375 px row. */}
          <Toggle
            role="button"
            ariaLabel={subtitles ? 'Phụ đề bật' : 'Phụ đề tắt'}
            on={subtitles}
            onChange={onSubtitles}
            emoji="🇻🇳"
            label="Phụ đề Việt"
            className="max-md:gap-2 max-md:px-0 max-md:text-[14px]"
          />
        </div>
      </div>

      {dots && <SceneDots count={sceneCount} active={sceneIndex} />}
    </div>
  )
}
