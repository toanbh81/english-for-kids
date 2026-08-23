/**
 * The sentence as the child has to *say* it, not merely read it: the words carrying sentence
 * stress are bigger and coral, and a ‿ sits between two words that link into one another
 * ("red‿apple"). Both marks are decoration — the connector is `aria-hidden` and the whole line
 * carries one `aria-label` with the plain words, so a screen reader hears the sentence and not a
 * string of fragments.
 */
export function StressedSentence({ words, stress, link = [] }: {
  words: string[]
  stress: number[]
  link?: [number, number][]
}) {
  const stressed = new Set(stress)
  // Only *adjacent* pairs can be drawn as one connector between two neighbours; a non-adjacent
  // pair in the content would otherwise render a ‿ pointing at the wrong gap.
  const linked = new Set(link.filter(([a, b]) => b === a + 1).map(([a]) => a))

  return (
    <p
      aria-label={words.join(' ')}
      className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center font-display font-extrabold leading-tight"
    >
      {words.map((w, i) => (
        <span key={i} className="inline-flex items-baseline">
          <span
            data-testid="star-word"
            className={stressed.has(i)
              ? 'font-display text-[48px] text-coral-text'
              : 'font-display text-[40px] text-ink-900'}
          >
            {w}
          </span>
          {linked.has(i) && (
            <span aria-hidden="true" data-testid="link-mark" className="px-1 text-[32px] text-teal-600">‿</span>
          )}
        </span>
      ))}
    </p>
  )
}
