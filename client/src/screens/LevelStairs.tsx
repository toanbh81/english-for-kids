import { Link } from 'react-router-dom'
import { LEVELS, PAIRS } from '../content'
import { getStars } from '../progress/store'
import { Foxy } from '../components/Foxy'
import { BackButton, Chip, StarRow } from '../components/ui'

type Stars = 0 | 1 | 2 | 3

type Step = { key: string; emoji: string; name: string; to?: string; lift: string }

/** Bottom-left to top-right: each step sits a little higher than the one before, so the five
 * games read as a staircase the child climbs. The lifts only apply from `lg` up — below that the
 * steps stack into a plain list. */
const STEPS: Step[] = [
  { key: 'sound-zoo', emoji: '🦁', name: 'Tập âm', to: '/level/sound-zoo', lift: 'lg:mt-[240px]' },
  { key: 'word-pop', emoji: '🎈', name: 'Đọc từ', to: '/level/word-pop', lift: 'lg:mt-[180px]' },
  { key: 'minimal-pairs', emoji: '👯', name: 'Nghe & chọn', to: '/level/minimal-pairs', lift: 'lg:mt-[120px]' },
  { key: 'sentence-stars', emoji: '⭐', name: 'Sentence Stars', lift: 'lg:mt-[60px]' },
  { key: 'story-voice', emoji: '🎭', name: 'Story Voice', lift: 'lg:mt-0' },
]

const TILE = 'flex h-[180px] w-full max-w-[220px] flex-col items-center justify-center gap-2 rounded-xl3'

/** The best a child has done on any card of a level — one row of stars per step. */
function levelStars(id: string): Stars {
  const cards = LEVELS.find(l => l.id === id)?.cards ?? []
  return cards.reduce<Stars>((best, c) => (getStars(c.id) > best ? getStars(c.id) : best), 0)
}

/** Minimal Pairs keeps its stars per *pair*, not per card, so it needs its own reducer. */
function pairStars(): Stars {
  return PAIRS.reduce<Stars>((best, p) => {
    const s = getStars(`pair:${p.id}`)
    return s > best ? s : best
  }, 0)
}

export function LevelStairs() {
  const stars: Record<string, Stars> = {
    'sound-zoo': levelStars('sound-zoo'),
    'word-pop': levelStars('word-pop'),
    'minimal-pairs': pairStars(),
  }
  // Foxy waits on the first *playable* step that is not finished yet — never on a locked one,
  // which is where he ended up once both open levels were done.
  const foxyOn = (STEPS.find(s => s.to && stars[s.key] < 3) ?? STEPS[1]).key

  return (
    <main className="relative h-full overflow-y-auto bg-cream-50 p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-[320px] w-[320px] rounded-full bg-teal-50" />

      <div className="relative flex flex-col gap-6">
        <BackButton to="/" label="Về bản đồ" className="self-start" />

        <header className="text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Speak Lab 🗣️</h1>
          <p className="mt-1 text-lg font-bold text-ink-500">Leo từng bậc — mỗi bậc một trò mới!</p>
        </header>

        <div className="grid grid-cols-1 items-end justify-items-center gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-start">
          {STEPS.map(step => (
            <div key={step.key} data-testid={`step-${step.key}`} className={`flex w-full flex-col items-center gap-2 ${step.lift}`}>
              <div className={`h-[96px] ${foxyOn === step.key ? 'animate-bob' : 'invisible'}`}>
                {foxyOn === step.key && <Foxy mood="cheer" size="sm" />}
              </div>

              {step.to ? (
                <Link to={step.to} className={`${TILE} bg-white shadow-card active:translate-y-[2px]`}>
                  <span aria-hidden="true" className="text-[56px] leading-none">{step.emoji}</span>
                  <span className="font-display text-[21px] font-extrabold text-ink-900">{step.name}</span>
                  <StarRow value={stars[step.key]} />
                </Link>
              ) : (
                <div className={`${TILE} bg-[#F3EADA] opacity-75 shadow-[0_8px_0_#E2D5C0]`}>
                  <span aria-hidden="true" className="text-[48px] leading-none">🔒</span>
                  <span className="font-display text-[21px] font-extrabold text-[#A79781]">{step.name}</span>
                  <Chip tone="neutral" size="sm">Sắp có</Chip>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
