export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      data-testid="skeleton"
      aria-hidden="true"
      className={`rounded-lg bg-[linear-gradient(90deg,#F3EADA_25%,#FFF7EA_50%,#F3EADA_75%)] bg-[length:400px_100%] animate-shimmer ${className}`}
    />
  )
}

export function AccountCardSkeleton() {
  return (
    <div data-testid="skeleton-account" className="flex h-[168px] flex-col gap-2.5 rounded-r16 bg-white p-3.5">
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

export function RemoteRowSkeleton() {
  return (
    <div className="flex h-[72px] items-center gap-3 rounded-r16 bg-white p-3.5">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-[160px]" />
        <Skeleton className="h-3 w-[70%]" />
      </div>
    </div>
  )
}
