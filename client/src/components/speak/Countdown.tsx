export function Countdown({ seconds }: { seconds: number }) {
  return (
    <div data-testid="countdown" aria-live="polite" className={`flex h-24 w-24 items-center justify-center rounded-full bg-peach-50 font-display text-[44px] font-extrabold leading-none text-coral-text ${seconds >= 10 ? 'tracking-[-2px]' : ''}`}>
      {seconds}
    </div>
  )
}
