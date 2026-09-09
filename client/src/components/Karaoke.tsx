import type { StoryWord } from '../content/stories/types'

type Props = {
  words: StoryWord[]
  activeIndex: number
  onWordTap: (i: number) => void
  subtitle?: string
  className?: string
}

/** The story line, one tappable word at a time: the word being read turns coral on a soft coral
 * pill, words already read fade to the warm `#CDBFA9` of the handoff, the rest stay ink.
 *
 * **Every word is the same size, and that is a fix, not a simplification.** The design (§9 M6) had
 * the active word swell from 32 px to 44 px, which changes its line box AND its width: on a real
 * iPad the line re-wrapped under the child's eyes and the row grew and shrank by ~15 px on every
 * word, and since the picture above is the flexible one, the whole scene jumped up and down for
 * the length of the story. Colour carries the same "this word, now" meaning at a constant size, so
 * nothing above the line can move. The pill uses the padding the button already had, so it costs
 * no layout either.
 *
 * One size also means the line holds MORE words before it wraps: the 44 px word was what pushed a
 * seven-word sentence onto a second row. Measured on the three stories that ship, every scene is a
 * single row from `md` up at 32 px, so no height is reserved here — a reserved second row would
 * have cost the picture above 58 px on every scene to guard a wrap that never happens. A longer
 * scene added later resizes the picture once, at that scene, which is not the per-word jump this
 * fix is about.
 *
 * On a phone the sizes come down to the design's 21 px (§9 M6), which is what keeps a seven-word
 * line to two rows at 390 px instead of four.
 *
 * **Named exception to the child 64 px floor (Q11 / R24):** a karaoke word is a SECONDARY target
 * (replay one word), not the screen's main action, so its hit is only 44×44 — `min-h-[44px]`,
 * padding `px-1.5 py-2`, gap 4 (`gap-x-1`), no `min-w-[64px]`. The 64 px floor still applies to
 * every primary control on this screen (▶, the mic, CTAs, quiz answer cards). */
export function Karaoke({ words, activeIndex, onWordTap, subtitle, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-center gap-x-1 gap-y-0.5">
        {words.map((word, i) => (
          <button key={i} type="button" onClick={() => onWordTap(i)}
            className={`min-h-[44px] inline-flex items-center justify-center rounded-r16 px-1.5 py-2 font-display text-[21px] font-extrabold leading-tight transition-colors md:text-[32px] ${
              i === activeIndex
                ? 'bg-coral-50 text-coral-text'
                : i < activeIndex
                  ? 'text-[#CDBFA9]'
                  : 'text-ink-900'
            }`}>
            {word.w}
          </button>
        ))}
      </div>
      {/* Arbitrary sizes on both sides on purpose: `text-sm` would also write a 20 px line-height
          that `md:text-[19px]` does not undo, and the landscape line would silently lose 8.5 px. */}
      {subtitle && <p className="text-[14px] font-bold text-ink-300 md:text-[19px]">{subtitle}</p>}
    </div>
  )
}
