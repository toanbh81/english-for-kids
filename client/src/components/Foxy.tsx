import type { ReactNode } from 'react'
import { SpeechBubble } from './ui/SpeechBubble'

export type FoxyMood = 'idle' | 'listening' | 'happy' | 'cheer' | 'surprised'

// Palette of the mascot from the Claude Design handoff (docs/design/foxy-svg-reference.js).
const FUR = '#FF8A5C'
const DARK = '#5B4038'
const EAR_INNER = '#FFD6BE'
const MUZZLE = '#FFF6EA'
const BLUSH = '#FFB899'

const PX = { sm: 64, md: 96, lg: 160 } as const

/** The drawing is 120×116, so the rendered box is slightly shorter than it is wide. */
const ASPECT = 116 / 120

type EyeShape = 'open' | 'closed' | 'happy' | 'wow'

function eye(cx: number, shape: EyeShape): ReactNode {
  const stroke = { stroke: DARK, strokeWidth: 3.5, fill: 'none', strokeLinecap: 'round' as const }
  if (shape === 'closed') return <path key={`e${cx}`} d={`M${cx - 7} 62 Q${cx} 70 ${cx + 7} 62`} {...stroke} />
  if (shape === 'happy') return <path key={`e${cx}`} d={`M${cx - 7} 64 Q${cx} 55 ${cx + 7} 64`} {...stroke} />
  return <circle key={`e${cx}`} cx={cx} cy={61} r={shape === 'wow' ? 7 : 5} fill={DARK} />
}

function face(mood: FoxyMood): ReactNode {
  switch (mood) {
    case 'listening':
      return (
        <>
          {eye(44, 'closed')}{eye(76, 'closed')}
          <circle cx={60} cy={91} r={4.5} fill={DARK} />
        </>
      )
    case 'happy':
    case 'cheer':
      return (
        <>
          {eye(44, 'happy')}{eye(76, 'happy')}
          <path d="M47 88 Q60 103 73 88 Z" fill={DARK} />
          <ellipse cx={60} cy={94} rx={6} ry={4} fill="#FF8A8A" />
          <circle cx={27} cy={80} r={6} fill={BLUSH} />
          <circle cx={93} cy={80} r={6} fill={BLUSH} />
          {mood === 'cheer' && (
            <>
              <circle cx={12} cy={58} r={4} fill="#FFC533" />
              <circle cx={108} cy={52} r={5} fill="#FFC533" />
              <circle cx={104} cy={96} r={3.5} fill="#2EC4B6" />
            </>
          )}
        </>
      )
    case 'surprised':
      return (
        <>
          {eye(44, 'wow')}{eye(76, 'wow')}
          <ellipse cx={60} cy={92} rx={5.5} ry={7} fill={DARK} />
        </>
      )
    default:
      return (
        <>
          {eye(44, 'open')}{eye(76, 'open')}
          <path d="M52 90 Q60 97 68 90" stroke={DARK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        </>
      )
  }
}

/** The app's mascot. `mood` swaps only the eyes and mouth, so he stays recognisably the same
 * fox while reacting to what the child just did. */
export function Foxy({ mood, size = 'md', say, className = '' }: {
  mood: FoxyMood
  size?: 'sm' | 'md' | 'lg'
  say?: string
  className?: string
}) {
  const px = PX[size]
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <div data-testid="foxy" data-mood={mood} className="shrink-0 select-none">
        {/* Decorative: Foxy's mood repeats what the surrounding copy already says, so announcing
            "Foxy" on every screen would only add noise for a screen reader. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 120 116"
          width={px}
          height={Math.round(px * ASPECT)}
          className="block"
        >
          <path d="M24 44 L12 6 L48 26 Z" fill={FUR} />
          <path d="M96 44 L108 6 L72 26 Z" fill={FUR} />
          <path d="M27 36 L21 16 L38 26 Z" fill={EAR_INNER} />
          <path d="M93 36 L99 16 L82 26 Z" fill={EAR_INNER} />
          <circle cx={60} cy={68} r={44} fill={FUR} />
          <ellipse cx={60} cy={84} rx={27} ry={19} fill={MUZZLE} />
          <circle cx={60} cy={78} r={5.5} fill={DARK} />
          {face(mood)}
        </svg>
      </div>
      {say && (
        <div data-testid="foxy-bubble">
          <SpeechBubble title={say} className="max-w-[280px]" />
        </div>
      )}
    </div>
  )
}
