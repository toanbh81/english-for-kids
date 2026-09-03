import { Countdown } from './Countdown'
import { LevelBars } from './LevelBars'

export type MicState = 'idle' | 'recording' | 'processing' | 'disabled' | 'locked'
type Props = { state: MicState; level: number; onPress: () => void; secondsLeft?: number; caption?: string }

const LABEL: Record<MicState, string> = { idle: 'Bấm để nói', recording: 'Dừng', processing: 'Đang chấm…', disabled: 'Bấm để nói', locked: 'Hôm nay đã hết giờ' }
const CAPTION: Record<MicState, string | null> = { idle: 'Chạm để nói nào!', recording: null, processing: 'Foxy đang chấm…', disabled: 'Đang chuẩn bị máy chấm…', locked: 'Mai gặp lại nhé 🌙' }

/** Brief §2.2. The block reserves 214 px (190 + 24 for the bars) at md so the mic grows in place
 * without moving the CTA; on a phone the recording mic is 150 inside halos that reach 190.
 * The level bars and the countdown badge lay out responsively (spec decision 5): a row on a
 * phone and on real iPad landscape (`ipad:`), a column with the badge above the bars on iPad
 * portrait (`md:` without `ipad:` — the same idiom `PageBody` uses for this split, which works
 * here because `ipad:` now outranks `md:` on specificity, see tailwind.config.ts).
 *
 * `caption` overrides the per-state default (`CAPTION` above) — SentenceBuilder (round 2, C9)
 * reuses `state="disabled"` for its own "sentence not built yet" mic, which needs "Xếp đúng câu
 * trước nhé" rather than the scorer's "Đang chuẩn bị máy chấm…". Omitted, the table is unchanged,
 * so every other screen keeps its existing caption. */
export function MicButton({ state, level, onPress, secondsLeft, caption }: Props) {
  const rec = state === 'recording'
  const off = state === 'disabled' || state === 'processing' || state === 'locked'
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-[174px] w-[174px] items-center justify-center md:h-[214px] md:w-[214px]">
        {rec && [0, 0.7].map(d => (
          <span key={d} data-testid="mic-halo" aria-hidden="true" className="absolute h-[150px] w-[150px] rounded-full bg-coral-50 animate-halo md:h-[190px] md:w-[190px]" style={{ animationDelay: `${d}s` }} />
        ))}
        {state === 'disabled' && <span data-testid="mic-spinner" aria-hidden="true" className="absolute h-[144px] w-[144px] rounded-full border-[6px] border-dashed border-[#FFB899] animate-spin md:h-[172px] md:w-[172px]" />}
        <button
          aria-label={LABEL[state]}
          disabled={off}
          onClick={onPress}
          className={[
            'relative z-[1] flex items-center justify-center rounded-full bg-coral-500 text-white shadow-mic transition-transform active:translate-y-[3px]',
            'disabled:active:translate-y-0',
            state === 'disabled' ? 'opacity-50' : state === 'processing' ? 'opacity-70' : state === 'locked' ? 'opacity-40' : '',
            rec ? 'h-[150px] w-[150px] text-[60px] md:h-[190px] md:w-[190px] md:text-[76px]' : 'h-[124px] w-[124px] text-[50px] md:h-[150px] md:w-[150px] md:text-[60px]',
          ].join(' ')}
        >
          <span aria-hidden="true" className="leading-none transition-transform" style={rec ? { transform: `scale(${1 + level * 0.18})` } : undefined}>
            {state === 'processing' ? '⏳' : state === 'locked' ? '🌙' : rec ? '■' : '🎤'}
          </span>
        </button>
      </div>
      {rec && (
        <div data-testid="countdown-row" className="flex items-center flex-row gap-3.5 md:flex-col md:gap-3 ipad:flex-row ipad:gap-4">
          <LevelBars level={level} />
          {secondsLeft !== undefined && <span className="md:order-first ipad:order-none"><Countdown seconds={secondsLeft} /></span>}
        </div>
      )}
      {!rec && (caption ?? CAPTION[state]) && <p className="text-[15px] font-bold text-ink-500 md:text-[18px]">{caption ?? CAPTION[state]}</p>}
    </div>
  )
}
