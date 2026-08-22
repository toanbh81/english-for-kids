import type { WordTone } from '../scoring/types'
const ICON: Record<WordTone, { glyph: string; label: string }> = {
  good: { glyph: '✓', label: 'tốt' }, ok: { glyph: '~', label: 'tạm được' }, fix: { glyph: '!', label: 'cần sửa' } }
export function ScoredWords({ words, onWordTap }: { words: { word: string; tone: WordTone }[]; onWordTap?: (w: string) => void }) {
  return <div className="flex flex-wrap justify-center gap-4 text-4xl font-extrabold">{words.map((w, i) =>
    <button key={i} onClick={() => onWordTap?.(w.word)} aria-label={`${w.word} ${ICON[w.tone].label}`}
      className={`text-${w.tone} flex items-center justify-center gap-1 min-h-[64px] px-2`}>
      <span className={`text-${w.tone}`}>{w.word}</span><span aria-hidden className="text-xl">{ICON[w.tone].glyph}</span>
    </button>)}</div>
}
