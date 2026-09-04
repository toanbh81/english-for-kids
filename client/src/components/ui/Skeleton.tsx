export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      data-testid="skeleton"
      aria-hidden="true"
      className={`rounded-lg bg-[linear-gradient(90deg,#F3EADA_25%,#FFF7EA_50%,#F3EADA_75%)] bg-[length:400px_100%] animate-shimmer ${className}`}
    />
  )
}

/**
 * No `bg-white`/padding of its own — this is placed inside the account `Card`, which already
 * supplies both. Only the height is fixed here, so the card doesn't jump once real content lands.
 */
export function AccountCardSkeleton() {
  return (
    <div data-testid="skeleton-account" className="flex h-[150px] flex-col gap-2.5">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-[120px]" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[70%]" />
      <div className="mt-auto flex gap-2.5">
        <Skeleton className="h-11 flex-1 rounded-r12" />
        <Skeleton className="h-11 w-[90px] rounded-r12" />
      </div>
    </div>
  )
}

/**
 * Carries its own `border-line-200` — while a row is loading it IS the whole `<li>` (see
 * `ParentDashboard`), so it has to draw the same outline the loaded row's own `<li>` draws, or the
 * row's edge would jump the moment its stats arrive.
 */
export function RemoteRowSkeleton() {
  return (
    <div className="flex h-[72px] items-center gap-3 rounded-r16 border border-line-200 bg-white p-3.5">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-[160px]" />
        <Skeleton className="h-3 w-[70%]" />
      </div>
    </div>
  )
}
