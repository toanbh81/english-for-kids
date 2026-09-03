/**
 * Brief §2 B3/B2 — the "âm" tier both screens share: a warm peach card with the mouth tile, the
 * IPA symbol, the child's tip and a round speaker button. SoundPractice (B3) renders it beside its
 * own word tile; SoundWordList (B2) renders it alone above the word grid — same component, same
 * card, so the two screens read as one place (brief §2 "cùng component với B3").
 *
 * `wiggle` plays only on SoundPractice while the child is mid-recording ("Ghi: tầng âm giữ …
 * ô khẩu hình wiggle") — SoundWordList never records, so it never passes it. `mdWide` widens the
 * card to 640px on iPad for B2's mic-less single column; B3 leaves it at the 560px its act column
 * leaves the teach column.
 *
 * The mouth tile, IPA and speaker share one row that wraps on a phone (`md:contents` — see
 * `SoundWordList`'s old header for the same trick); from `md` up the tip rejoins that row via
 * `md:order-3`, matching the design's single horizontal line ("tầng âm hàng ngang").
 */
export function SoundTier({ ph, ipa, tip, onPlay, audioMissing, wiggle, mdWide }: {
  ph: string
  ipa: string
  tip?: string
  onPlay: () => void
  audioMissing?: boolean
  wiggle?: boolean
  mdWide?: boolean
}) {
  return (
    <div
      data-testid="sound-tier"
      data-ph={ph}
      className={`flex w-full flex-col gap-2.5 rounded-r20 bg-peach-50 px-3.5 py-3 text-left shadow-[0_6px_0_#F2DFC9] md:flex-row md:flex-nowrap md:items-center md:gap-4 md:rounded-r24 md:px-5 md:py-4 ${mdWide ? 'md:max-w-[640px]' : 'md:max-w-[560px]'}`}
    >
      <div className="flex w-full flex-wrap items-center gap-3.5 md:contents">
        <span data-testid="mouth-tile" aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-r16 bg-white text-[30px] leading-none md:order-1 md:h-16 md:w-16">
          <span className={wiggle ? 'animate-wiggle' : undefined}>👄</span>
        </span>
        <div className="flex-1 font-display text-[40px] font-extrabold leading-none text-[#C08457] md:order-2 md:flex-initial md:text-[72px] md:text-coral-text">/{ipa}/</div>
        <button
          type="button"
          aria-label="Nghe âm lẻ"
          onClick={onPlay}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-500 text-[22px] leading-none text-white shadow-chunky-teal transition-transform active:translate-y-[2px] md:order-4 md:h-16 md:w-16 md:text-[26px]"
        >
          🔊
        </button>
        {audioMissing && <p className="w-full text-sm font-bold text-ink-300 md:order-5 md:w-auto md:text-lg">Chưa có audio âm này</p>}
      </div>
      {tip && <p className="text-[13px] font-bold leading-relaxed text-sun-700 line-clamp-2 md:order-3 md:flex-1 md:text-[17px]">{tip}</p>}
    </div>
  )
}
