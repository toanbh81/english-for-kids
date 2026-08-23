import { useEffect, useState } from 'react'

const PIECE_COUNT = 24
const LIFETIME_MS = 2000

const EMOJI = ['🎉', '⭐', '🦊']
const DOT_COLORS = ['bg-coral', 'bg-teal', 'bg-star']

/** Positions come from the piece index, never Math.random: the shower looks scattered but two
 * renders lay the pieces out identically, which keeps it testable and avoids a re-render
 * reshuffling mid-fall. */
const PIECES = Array.from({ length: PIECE_COUNT }, (_, i) => ({
  emoji: i % 2 === 0 ? EMOJI[(i / 2) % EMOJI.length] : null,
  color: DOT_COLORS[i % DOT_COLORS.length],
  left: (i * 37) % 100, // 37 is coprime with 100, so the pieces spread across the width
  delay: ((i * 13) % 40) / 100, // 0–0.39 s, so they do not all fall in one curtain
}))

/** A one-shot celebration layer: it covers the screen without swallowing taps and takes itself
 * off the page after 2 s, so the caller can render it and forget about it. */
export function Confetti() {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setGone(true), LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [])

  if (gone) return null

  return (
    <div data-testid="confetti" aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={
            p.emoji
              ? 'absolute -top-10 text-3xl animate-confetti-fall'
              : `absolute -top-10 w-3 h-3 rounded-full animate-confetti-fall ${p.color}`
          }
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s` }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}
