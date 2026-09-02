// WordChip.tsx — brief §2.4 ②: 40 px, never a button (spec decision 3).
export type WordTone = 'good' | 'ok' | 'fix' | 'unknown'
const TONE: Record<WordTone, { cls: string; glyph: string; label: string }> = {
  good: { cls: 'bg-good-50 text-good-700 border-good-300', glyph: '✓', label: 'đúng' },
  ok: { cls: 'bg-ok-50 text-ok-700 border-ok-300', glyph: '～', label: 'tạm được' },
  fix: { cls: 'bg-fix-50 text-fix-700 border-fix-300', glyph: '✗', label: 'cần sửa' },
  unknown: { cls: 'bg-white text-ink-500 border-sand-edge', glyph: '?', label: 'chưa chấm được' },
}
export function WordChip({ word, tone }: { word: string; tone: WordTone }) {
  const t = TONE[tone]
  return (
    <span data-testid="word-chip" data-tone={tone} aria-label={`${word} ${t.label}`} className={`inline-flex h-10 items-center rounded-r12 border-[3px] px-3 font-display text-[15px] font-extrabold ${t.cls}`}>
      <span aria-hidden="true">{t.glyph} </span>{word}
    </span>
  )
}
