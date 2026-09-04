import { Link } from 'react-router-dom'
import { Foxy } from '../Foxy'

const HERO = 'min-h-0 flex-1 justify-center gap-3 bg-transparent p-0'
const CARD = 'min-h-[150px] rounded-r18 bg-cream-50'
// A thin dashed placeholder — no card fill, half the card's height — for a chart-shaped "nothing
// yet" that sits inside a section that already has its own card (brief §1/§2: the history chart).
const DASHED = 'min-h-[120px] rounded-r12 border-2 border-dashed border-sand-edge bg-transparent'

/** A centred "nothing here yet" card — emoji, title, sub and an optional outline CTA (brief
 * §2.6). `adult` shrinks it for the parent dashboard's denser type scale; the child variant is
 * the default. `size="hero"` (brief §2 A6, the empty-today card) swaps the emoji for a 120×116
 * bobbing Foxy and grows the type; it also fills the remaining body height instead of sitting in
 * its own cream card. `variant="dashed"` swaps the cream card skin for a thin dashed box —
 * independent of `size`/`hero`, whose own skin still wins when both are set. */
export function EmptyState({ emoji, title, sub, cta, adult, size = 'md', variant = 'card', className = '' }: {
  emoji?: string
  title: string
  sub: string
  cta?: { label: string; to: string }
  adult?: boolean
  size?: 'md' | 'hero'
  variant?: 'card' | 'dashed'
  className?: string
}) {
  const hero = size === 'hero'
  const skin = hero ? HERO : variant === 'dashed' ? DASHED : CARD
  return (
    <div data-testid="empty-state" className={`flex flex-col items-center justify-center gap-1.5 p-4 text-center ${skin} ${className}`}>
      {hero
        ? <Foxy mood="idle" size="lg" className="animate-bob [&_svg]:h-[116px] [&_svg]:w-[120px]" />
        : emoji && <span aria-hidden="true" className={`leading-none ${adult ? 'text-[24px]' : 'text-[34px]'}`}>{emoji}</span>}
      <div className={`font-display font-extrabold leading-tight text-ink-900 ${hero ? 'text-[22px]' : (adult ? 'text-[14px]' : 'text-[16px]')}`}>{title}</div>
      <div className={`font-bold leading-snug text-ink-500 ${hero ? 'text-[14px]' : 'text-[12px]'}`}>{sub}</div>
      {cta && <Link to={cta.to} className="mt-1 inline-flex min-h-[44px] items-center rounded-r14 border-[3px] border-teal-line bg-white px-4 font-display text-[14px] font-extrabold text-teal-600">{cta.label}</Link>}
    </div>
  )
}
