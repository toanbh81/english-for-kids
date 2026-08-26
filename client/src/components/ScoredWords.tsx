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
    // 24 px words in a 64 px chip on a phone (design §5 M3b), the 34 px of the landscape frame
    // from `md` up. The tap target never moves: `min-h-[64px]` is unprefixed at every width.
    //
    // `md:leading-none` on the glyph is not redundant. A `text-*` scale step sets a line-height as
    // well as a font size, and a prefixed one is emitted *after* every plain utility — so
    // `md:text-2xl` quietly overrides an unprefixed `leading-none` and the glyph grew 24 px → 32.
    // Any `md:text-<scale>` restore has to restate the leading it is stepping on.
    <div className="flex flex-wrap justify-center gap-2.5 md:gap-4">
      {words.map((w, i) => {
        const tone = TONE[w.tone]
        return (
          <button
            key={i}
            onClick={() => onWordTap?.(w.word)}
            aria-label={`${w.word} ${tone.label}`}
            className={`flex min-h-[64px] items-center justify-center gap-2 rounded-xl2 border-[3px] px-4 font-display font-extrabold md:px-5 ${tone.chip} ${tone.text} active:translate-y-[2px]`}
          >
            <span className={`text-2xl leading-none md:text-[34px] ${tone.text}`}>{w.word}</span>
            <span aria-hidden="true" className="text-xl leading-none md:text-2xl md:leading-none">{tone.glyph}</span>
          </button>
        )
      })}
    </div>
  )
}
