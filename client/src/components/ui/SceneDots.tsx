/** Pill of dots showing which of `count` scenes is showing (0-based `active`). */
export function SceneDots({ count, active, className = '' }: { count: number; active: number; className?: string }) {
  return (
    <span
      data-testid="scene-dots"
      aria-hidden="true"
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 shadow-card-sm ${className}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`block h-2.5 w-2.5 rounded-full ${i === active ? 'bg-coral-500' : 'bg-line-200'}`} />
      ))}
    </span>
  )
}
