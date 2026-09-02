import { Link } from 'react-router-dom'

/** A centred "nothing here yet" card — emoji, title, sub and an optional outline CTA (brief
 * §2.6). `adult` shrinks it for the parent dashboard's denser type scale; the child variant is
 * the default. */
export function EmptyState({ emoji, title, sub, cta, adult, className = '' }: { emoji: string; title: string; sub: string; cta?: { label: string; to: string }; adult?: boolean; className?: string }) {
  return (
    <div data-testid="empty-state" className={`flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-r18 bg-cream-50 p-4 text-center ${className}`}>
      <span aria-hidden="true" className={`leading-none ${adult ? 'text-[24px]' : 'text-[34px]'}`}>{emoji}</span>
      <div className={`font-display font-extrabold leading-tight text-ink-900 ${adult ? 'text-[14px]' : 'text-[16px]'}`}>{title}</div>
      <div className="text-[12px] font-bold leading-snug text-ink-500">{sub}</div>
      {cta && <Link to={cta.to} className="mt-1 inline-flex min-h-[44px] items-center rounded-r14 border-[3px] border-teal-line bg-white px-4 font-display text-[14px] font-extrabold text-teal-600">{cta.label}</Link>}
    </div>
  )
}
