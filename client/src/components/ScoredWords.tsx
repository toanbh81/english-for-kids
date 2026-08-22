import type { WordTone } from '../scoring/types'
const ICON: Record<WordTone, { glyph: string; label: string }> = {
  good: { glyph: '✓', label: 'tốt' }, ok: { glyph: '~', label: 'tạm được' }, fix: { glyph: '!', label: 'cần sửa' } }
export function ScoredWords({ words, onWordTap }: { words: { word: string; tone: WordTone }[]; onWordTap?: (w: string) => void }) {
  return <div className="flex flex-wrap justify-center gap-4 text-4xl font-extrabold">{words.map((w, i) =>
    <button key={i} onClick={() => onWordTap?.(w.word)} className={`text-${w.tone} flex items-baseline gap-1`}>
      <span className={`text-${w.tone}`}>{w.word}</span><span aria-label={ICON[w.tone].label} className="text-xl">{ICON[w.tone].glyph}</span>
    </button>)}</div>
}
