/** The parent-facing note that the simple (Web Speech) engine is running instead of Azure. Only
 * `webspeech` draws anything — `azure` and `null`/`undefined` render nothing, so a screen can pass
 * whatever it knows about the active engine without an extra conditional of its own. */
export function EngineBadge({ engine }: { engine: 'azure' | 'webspeech' | null | undefined }) {
  if (engine !== 'webspeech') return null
  return (
    <span data-testid="engine-badge" className="text-[11px] font-extrabold text-ink-300 md:rounded-r10 md:bg-sand md:px-2.5 md:py-1.5 md:text-[12px] md:text-sand-text">
      ◌ chế độ đơn giản
    </span>
  )
}
