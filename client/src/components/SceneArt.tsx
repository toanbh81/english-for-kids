type Props = { emoji: string; bg: string; image?: string }
export function SceneArt({ emoji, bg, image }: Props) {
  return (
    <div style={{ background: bg }} className="rounded-2xl flex items-center justify-center overflow-hidden">
      {image ? (
        <img src={image} alt="" className="object-contain max-h-full" />
      ) : (
        <span className="text-[160px]">{emoji}</span>
      )}
    </div>
  )
}
