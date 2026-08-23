type Props = { emoji: string; bg: string; image?: string; className?: string }

/** The scene picture: fills its block at the handoff's 28 px radius so the player can
 * overlay the back button and the scene pills on top of it. */
export function SceneArt({ emoji, bg, image, className = '' }: Props) {
  return (
    <div
      style={{ background: bg }}
      className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[28px] ${className}`}
    >
      {image ? (
        <img src={image} alt="" className="max-h-full object-contain" />
      ) : (
        <span className="text-[160px] leading-none">{emoji}</span>
      )}
    </div>
  )
}
