/** Dark ink pill at the top of the screen. Renders nothing when there is no message;
 * pair it with `useToast()` for the auto-hide. */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div
      role="status"
      data-testid="toast"
      className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-6 py-3 font-display text-lg font-extrabold text-cream-50 shadow-card-sm"
    >
      {message}
    </div>
  )
}
