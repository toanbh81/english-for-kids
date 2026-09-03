import { Link } from 'react-router-dom'
import { Foxy } from '../Foxy'

const HERO = 'min-h-0 flex-1 justify-center gap-3 bg-transparent p-0'

/** A centred "nothing here yet" card — emoji, title, sub and an optional outline CTA (brief
 * §2.6). `adult` shrinks it for the parent dashboard's denser type scale; the child variant is
 * the default. `size="hero"` (brief §2 A6, the empty-today card) swaps the emoji for a 120×116
 * bobbing Foxy and grows the type; it also fills the remaining body height instead of sitting in
 * its own cream card. */
export function EmptyState({ emoji, title, sub, cta, adult, size = 'md', className = '' }: {
  emoji?: string
  title: string
  sub: string
  cta?: { label: string; to: string }
  adult?: boolean
  size?: 'md' | 'hero'
  className?: string
}) {
  const hero = size === 'hero'
  return (
    <div data-testid="empty-state" className={`flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-r18 bg-cream-50 p-4 text-center ${hero ? HERO : ''} ${className}`}>
      {hero
        ? <Foxy mood="idle" size="lg" className="animate-bob [&_svg]:h-[116px] [&_svg]:w-[120px]" />
        : emoji && <span aria-hidden="true" className={`leading-none ${adult ? 'text-[24px]' : 'text-[34px]'}`}>{emoji}</span>}
      <div className={`font-display font-extrabold leading-tight text-ink-900 ${hero ? 'text-[22px]' : (adult ? 'text-[14px]' : 'text-[16px]')}`}>{title}</div>
      <div className={`font-bold leading-snug text-ink-500 ${hero ? 'text-[14px]' : 'text-[12px]'}`}>{sub}</div>
      {cta && <Link to={cta.to} className="mt-1 inline-flex min-h-[44px] items-center rounded-r14 border-[3px] border-teal-line bg-white px-4 font-display text-[14px] font-extrabold text-teal-600">{cta.label}</Link>}
    </div>
  )
}
