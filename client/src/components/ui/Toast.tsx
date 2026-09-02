/** Dark ink pill at the top of the screen. Renders nothing when there is no message;
 * pair it with `useToast()` for the auto-hide. */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      data-testid="toast"
      className="fixed left-1/2 top-[max(1rem,calc(env(safe-area-inset-top)_+_8px))] z-50 w-[min(360px,calc(100%-32px))] -translate-x-1/2 rounded-r16 bg-[#2B2320] px-[18px] py-3 text-center font-sans text-[15px] font-extrabold leading-[1.35] text-cream-50 shadow-toast line-clamp-2 md:top-4"
    >
      {message}
    </div>
  )
}
