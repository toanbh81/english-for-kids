import type { ReactNode } from 'react'

type Split = { teach: ReactNode; act: ReactNode }

/** The scrolling region. `center` centres short content; `split` is the speaking layout —
 * landscape: teach `flex:1` | act 440; portrait: teach `flex:1` over act 300 (brief §1). */
export function PageBody({ center, split, className = '', children }: { center?: boolean; split?: Split; className?: string; children?: ReactNode }) {
  if (split) {
    return (
      <div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:mt-4 ipad:flex-row ipad:gap-6 ipad:overflow-visible ${className}`}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center ipad:min-h-0 ipad:overflow-y-auto">{split.teach}</div>
        <div className="flex flex-col items-center justify-center md:h-[300px] md:shrink-0 ipad:h-auto ipad:max-h-full ipad:w-[440px] ipad:shrink-0 ipad:min-h-0 ipad:overflow-y-auto ipad:gap-4">{split.act}</div>
      </div>
    )
  }
  return (
    <div data-testid="page-body" className={`mt-2.5 flex min-h-0 flex-1 flex-col overflow-y-auto md:mt-4 ${center ? 'justify-center' : ''} ${className}`}>
      {children}
    </div>
  )
}
