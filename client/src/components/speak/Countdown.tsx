export function Countdown({ seconds }: { seconds: number }) {
  return (
    <div data-testid="countdown" aria-live="polite" className={`inline-flex min-w-[56px] items-center justify-center rounded-full bg-peach-50 px-3 py-1 font-display text-[44px] font-extrabold leading-none text-coral-text md:min-w-[70px] md:text-[56px] ${seconds >= 10 ? 'tracking-[-2px]' : ''}`}>
      {seconds}
    </div>
  )
}
