/** The one thing to fix next, in a warm "sticky note" card so it reads as a tip, not a telling-off. */
export function HintCard({ hint }: { hint: { word: string; phoneme?: string; tip: string } }) {
  return (
    <div className="flex max-w-xl items-center gap-4 rounded-xl3 border-[3px] border-[#FFDF9E] bg-[#FFF6E0] px-6 py-4">
      <span aria-hidden="true" className="text-[44px] leading-none">👅</span>
      <div>
        <div className="font-display text-xl font-extrabold text-ink-900">
          Sửa từ này: <span className="text-fix-700">{hint.word}</span>
          {hint.phoneme && <span className="font-bold text-ink-500"> (âm "{hint.phoneme}")</span>}
        </div>
        <div className="text-lg font-bold text-ink-500">{hint.tip}</div>
      </div>
    </div>
  )
}
