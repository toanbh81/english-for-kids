import type { StoryWord } from '../content/stories/types'

type Props = {
  words: StoryWord[]
  activeIndex: number
  onWordTap: (i: number) => void
  subtitle?: string
  className?: string
}

/** The story line, one tappable word at a time: the word being read swells to 44 px coral,
 * words already read fade to the warm `#CDBFA9` of the handoff, the rest stay ink.
 *
 * On a phone those two sizes come down to the design's 28 / 21 px (§9 M6), which is what keeps
 * a seven-word line to two rows at 390 px instead of four.
 *
 * **Named exception to the child 64 px floor (Q11 / R24):** a karaoke word is a SECONDARY target
 * (replay one word), not the screen's main action, so its hit is only 44×44 — `min-h-[44px]`,
 * padding `px-1.5 py-2`, gap 4 (`gap-x-1`), no `min-w-[64px]`. The 64 px floor still applies to
 * every primary control on this screen (▶, the mic, CTAs, quiz answer cards). */
export function Karaoke({ words, activeIndex, onWordTap, subtitle, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0.5">
        {words.map((word, i) => (
          <button key={i} type="button" onClick={() => onWordTap(i)}
            className={`min-h-[44px] inline-flex items-center justify-center px-1.5 py-2 font-display font-extrabold leading-tight transition-all ${
              i === activeIndex
                ? 'text-[28px] text-coral-text md:text-[44px]'
                : i < activeIndex
                  ? 'text-[21px] text-[#CDBFA9] md:text-[32px]'
                  : 'text-[21px] text-ink-900 md:text-[32px]'
            }`}>
            {word.w}
          </button>
        ))}
      </div>
      {/* Arbitrary sizes on both sides on purpose: `text-sm` would also write a 20 px line-height
          that `md:text-[19px]` does not undo, and the landscape line would silently lose 8.5 px. */}
      {subtitle && <p className="text-[14px] font-bold text-ink-300 md:text-[19px]">{subtitle}</p>}
    </div>
  )
}
