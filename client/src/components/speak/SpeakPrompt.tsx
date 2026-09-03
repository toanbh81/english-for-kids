import { Foxy } from '../Foxy'
import type { FoxyMood } from '../Foxy'

/** Brief §1: Foxy 60×58 on a phone / 72×70 on iPad next to a speech bubble that reads the
 * prompt and, while recording, the seconds remaining in coral. */
export function SpeakPrompt({ mood, say, seconds }: { mood: FoxyMood; say: string; seconds?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-[58px] w-[60px] shrink-0 md:h-[70px] md:w-[72px]"><Foxy mood={mood} size="sm" /></div>
      <div className="rounded-r16 rounded-bl-[6px] bg-white px-3.5 py-[9px] font-display text-[15px] font-extrabold text-ink-900 shadow-card-xs md:px-4 md:py-2.5 md:text-[17px]">
        {say}{seconds !== undefined && <> <span className="text-coral-text">{seconds} giây</span></>}
      </div>
    </div>
  )
}
