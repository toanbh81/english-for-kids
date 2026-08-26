export type StarsSize = 'md' | 'sm'

/** `sm` is the row size: on a short landscape screen the stars share a line with the score and the
 * unlock badge instead of taking a band of their own, and 58 px would push the CTA off the fold.
 *
 * Both sizes come down on a phone, to the 36 px the design gives the stars in the compressed
 * result card (brief §5 M3b). `md:` puts the landscape number back, so from the tablet breakpoint
 * up — every width an iPad ever renders at — this is the same row it always was. */
const SIZE: Record<StarsSize, string> = {
  md: 'gap-2 text-[36px] md:gap-3 md:text-[58px]',
  sm: 'gap-2 text-[36px] md:text-[40px]',
}

/** Result stars. `animate` drops them in one after another (.22 s apart) so the child watches
 * them land instead of finding them already there. */
export function Stars({ value, animate, size = 'md' }: { value: 0 | 1 | 2 | 3; animate?: boolean; size?: StarsSize }) {
  return (
    <div className={`flex leading-none ${SIZE[size]}`}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          data-testid={i <= value ? 'star-filled' : 'star-empty'}
          className={`${i <= value ? 'text-sun-400' : 'text-[#E2D5C0]'} ${animate && i <= value ? 'animate-star-drop' : ''}`}
          style={animate && i <= value ? { animationDelay: `${(i - 1) * 0.22}s` } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  )
}
