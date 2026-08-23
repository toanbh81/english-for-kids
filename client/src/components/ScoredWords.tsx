import type { WordTone } from '../scoring/types'

/** One chip per word, tinted by how it was said. The classes are written out per tone (never
 * built by string concatenation) so Tailwind keeps them in the build. */
const TONE: Record<WordTone, { chip: string; text: string; glyph: string; label: string }> = {
  good: { chip: 'bg-good-50 border-good-300', text: 'text-good-700', glyph: '✓', label: 'tốt' },
  ok: { chip: 'bg-ok-50 border-ok-300', text: 'text-ok-700', glyph: '～', label: 'tạm được' },
  fix: { chip: 'bg-fix-50 border-fix-300', text: 'text-fix-700', glyph: '✗', label: 'cần sửa' },
}

export function ScoredWords({ words, onWordTap }: { words: { word: string; tone: WordTone }[]; onWordTap?: (w: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {words.map((w, i) => {
        const tone = TONE[w.tone]
        return (
          <button
            key={i}
            onClick={() => onWordTap?.(w.word)}
            aria-label={`${w.word} ${tone.label}`}
            className={`flex min-h-[64px] items-center justify-center gap-2 rounded-xl2 border-[3px] px-5 font-display font-extrabold ${tone.chip} ${tone.text} active:translate-y-[2px]`}
          >
            <span className={`text-[34px] leading-none ${tone.text}`}>{w.word}</span>
            <span aria-hidden="true" className="text-2xl leading-none">{tone.glyph}</span>
          </button>
        )
      })}
    </div>
  )
}
