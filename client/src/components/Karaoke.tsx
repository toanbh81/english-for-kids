import type { StoryWord } from '../content/stories/types'

type Props = { words: StoryWord[]; activeIndex: number; onWordTap: (i: number) => void; subtitle?: string }

/** The story line, one tappable word at a time: the word being read swells to 44 px coral,
 * words already read fade to the warm `#CDBFA9` of the handoff, the rest stay ink. */
export function Karaoke({ words, activeIndex, onWordTap, subtitle }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-baseline justify-center gap-x-2">
        {words.map((word, i) => (
          <button key={i} type="button" onClick={() => onWordTap(i)}
            className={`min-h-[64px] min-w-[64px] inline-flex items-center justify-center px-2 font-display font-extrabold leading-tight transition-all ${
              i === activeIndex
                ? 'text-[44px] text-coral-text'
                : i < activeIndex
                  ? 'text-[32px] text-[#CDBFA9]'
                  : 'text-[32px] text-ink-900'
            }`}>
            {word.w}
          </button>
        ))}
      </div>
      {subtitle && <p className="text-[19px] font-bold text-ink-300">{subtitle}</p>}
    </div>
  )
}
