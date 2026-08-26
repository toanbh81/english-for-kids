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
 * a seven-word line to two rows at 390 px instead of four. The 64 px tap floor per word is
 * **not** scaled with them: it is the whole reason a five-year-old can hit "a" or "is" at all,
 * so a smaller word only gets more padding around it, never a smaller target. */
export function Karaoke({ words, activeIndex, onWordTap, subtitle, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-center gap-x-2">
        {words.map((word, i) => (
          <button key={i} type="button" onClick={() => onWordTap(i)}
            className={`min-h-[64px] min-w-[64px] inline-flex items-center justify-center px-2 font-display font-extrabold leading-tight transition-all ${
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
