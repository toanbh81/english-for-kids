/**
 * The adult zone's input chrome, in ONE place — the three shapes every adult text field takes.
 *
 * Final wave / C1. The old shape was `FIELD_INPUT` (with `border-sand-edge` baked in) plus an
 * appended `FIELD_INPUT_ERROR` (`border-fix-700`) on the error path, and a hand-copied third
 * variant (`OTP_INPUT`) inside `AccountCard.tsx`. Both halves of that pair set the same CSS
 * property, so the winner is stylesheet order, not JSX order — and Tailwind emits
 * `.border-sand-edge` *after* `.border-fix-700`, which meant every error border in this zone
 * rendered sand (and the Account card's OTP box, which also carried `border-teal-500`, rendered
 * teal). The tests that asserted the red class passed the whole time, because
 * `toHaveClass('border-fix-700')` says nothing about whether the class wins.
 *
 * The rule the three builders enforce is `ParentQuestion.tsx`'s: **one border colour per state and
 * one font-size token per box**, so the rendered result is a guarantee rather than a coin flip.
 *
 * It is a plain module rather than more exports on `FieldRow.tsx` because a `.tsx` file that
 * exports both a component and helper functions trips `react(only-export-components)`, which is
 * the lint warning this same wave was asked to clear.
 */

/** Geometry only — never a colour, never a size. */
const FIELD_BASE = 'h-11 w-full truncate rounded-r12 border-2 px-3 text-ink-900 outline-none'
/** Centred Baloo with 6px tracking — the face both code boxes share; the SIZE stays with each. */
const CODE_FACE = 'text-center font-display font-extrabold tracking-[6px]'
/** The single decision point for a field's border colour. `rest` is the non-error colour. */
const border = (error?: boolean, rest = 'border-sand-edge focus:border-teal-500'): string =>
  (error ? 'border-fix-700' : rest)

/** The standard 14px text field — 3 call sites share this instead of each re-typing it (brief §1.1). */
export const fieldInput = (error?: boolean): string =>
  `${FIELD_BASE} text-[14px] font-bold ${border(error)}`

/** A2's OTP / recovery-code input: Baloo 22, tracking 6, centred (brief §2 A2 ④⑤). */
export const codeInput = (error?: boolean): string =>
  `${FIELD_BASE} ${CODE_FACE} text-[22px] ${border(error)}`

/**
 * The Account card's own OTP box (brief §2 row ⑥): Baloo **20**, not 22 ("ô 22 là của A2"), and
 * teal at rest rather than sand. Same chrome, one size token, one border colour.
 */
export const otpInput = (error?: boolean): string =>
  `${FIELD_BASE} ${CODE_FACE} text-[20px] ${border(error, 'border-teal-500')}`
