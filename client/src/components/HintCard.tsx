/** The one thing to fix next, in a warm "sticky note" card so it reads as a tip, not a
 * telling-off. Brief §2.4 ④ — the single compact variant, at every width. */
export function HintCard({ hint }: { hint: { word: string; phoneme?: string; tip: string } }) {
  return (
    <div className="flex items-center gap-2.5 rounded-r16 border-[3px] border-[#FFDF9E] bg-[#FFF6E0] px-3 py-[9px]">
      <span aria-hidden="true" className="text-[24px]">👅</span>
      <div className="text-[13px] font-bold text-sun-700">
        Sửa từ này: {hint.word}{hint.phoneme ? ` (âm "${hint.phoneme}")` : ''} — {hint.tip}
      </div>
    </div>
  )
}
