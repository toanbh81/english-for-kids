/** The one thing to fix next, in a warm "sticky note" card so it reads as a tip, not a telling-off.
 *
 * The phone version is the design's compact tip (§5 M3b): a 28 px tongue, an 18 px corner and
 * 13-ish px of text, so the card costs a result screen ~40 px instead of ~90. Everything `md:`
 * says is the landscape card unchanged — the tip is never dropped at any width, only tightened,
 * because how to move the tongue is the only actionable thing on the screen. */
export function HintCard({ hint }: { hint: { word: string; phoneme?: string; tip: string } }) {
  return (
    <div className="flex max-w-xl items-center gap-3 rounded-[18px] border-[3px] border-[#FFDF9E] bg-[#FFF6E0] px-3.5 py-2.5 md:gap-4 md:rounded-xl3 md:px-5">
      <span aria-hidden="true" className="text-[28px] leading-none md:text-[44px]">👅</span>
      <div>
        <div className="font-display text-base font-extrabold text-ink-900 md:text-xl">
          Sửa từ này: <span className="text-fix-700">{hint.word}</span>
          {hint.phoneme && <span className="font-bold text-ink-500"> (âm "{hint.phoneme}")</span>}
        </div>
        <div className="text-sm font-bold leading-relaxed text-ink-500 md:text-lg md:leading-7">{hint.tip}</div>
      </div>
    </div>
  )
}
