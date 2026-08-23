export type FoxyMood = 'idle' | 'listening' | 'happy' | 'cheer' | 'surprised'

const FACE: Record<FoxyMood, string> = {
  idle: '🦊',
  listening: '🦊👂',
  happy: '🦊😊',
  cheer: '🦊🎉',
  surprised: '🦊😮',
}

const SIZE = {
  sm: 'text-4xl',
  md: 'text-6xl',
  lg: 'text-8xl',
} as const

export function Foxy({ mood, size = 'md', say }: { mood: FoxyMood; size?: 'sm' | 'md' | 'lg'; say?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {say && (
        <div data-testid="foxy-bubble" className="rounded-2xl bg-white shadow px-4 py-2 text-lg font-bold text-slate-700">
          {say}
        </div>
      )}
      <div
        data-testid="foxy"
        data-mood={mood}
        className={`${SIZE[size]} rounded-full bg-cream shadow-inner leading-none select-none`}
      >
        {FACE[mood]}
      </div>
    </div>
  )
}
