import type { StoryWord } from '../content/stories/types'

type Props = { words: StoryWord[]; activeIndex: number; onWordTap: (i: number) => void; subtitle?: string }
export function Karaoke({ words, activeIndex, onWordTap, subtitle }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        {words.map((word, i) => (
          <button key={i} onClick={() => onWordTap(i)}
            className={`min-h-[64px] px-2 text-4xl font-extrabold ${
              i === activeIndex ? 'text-coral scale-110' : i < activeIndex ? 'text-slate-400' : 'text-slate-800'
            }`}>
            {word.w}
          </button>
        ))}
      </div>
      {subtitle && <p className="text-2xl text-slate-500">{subtitle}</p>}
    </div>
  )
}
