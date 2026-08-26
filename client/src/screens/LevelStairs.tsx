import { Link } from 'react-router-dom'
import { LEVELS, PAIRS, SENTENCE_STARS, SOUNDS, STORY_VOICE } from '../content'
import { getStars, soundStars as starsForSound } from '../progress/store'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip, PAGE_SHELL, StarRow } from '../components/ui'

type Stars = 0 | 1 | 2 | 3

type Step = { key: string; emoji: string; name: string; to?: string; lift: string }

/** Bottom-left to top-right: each step sits a little higher than the one before, so the five
 * games read as a staircase the child climbs. The lifts only apply from `ipad` up — below that the
 * steps stack into a plain list. */
const STEPS: Step[] = [
  { key: 'sound-zoo', emoji: '🦁', name: 'Tập âm', to: '/level/sound-zoo', lift: 'ipad:mt-[240px]' },
  { key: 'word-pop', emoji: '🎈', name: 'Đọc từ', to: '/level/word-pop', lift: 'ipad:mt-[180px]' },
  { key: 'minimal-pairs', emoji: '👯', name: 'Nghe & chọn', to: '/level/minimal-pairs', lift: 'ipad:mt-[120px]' },
  { key: 'sentence-stars', emoji: '⭐', name: 'Sentence Stars', to: '/level/sentence-stars', lift: 'ipad:mt-[60px]' },
  { key: 'story-voice', emoji: '🎭', name: 'Story Voice', to: '/level/story-voice', lift: 'ipad:mt-0' },
]

/**
 * Phase 10, design §11 M7. **The staircase is two layouts of one DOM**, and which one you get is
 * decided entirely by prefixes — the phase's binding rule (see the block comment in
 * `screens/SoundPractice.tsx`): every phone rule sits at the default breakpoint, `md:` (768) puts
 * the exact previous value back, and the `ipad:` diagonal is not touched at all.
 *
 * Below 768 the steps are the design's bottom-up zigzag: a `flex-col-reverse` column, so step 1 is
 * the bottom stair and the child climbs upwards, with odd rows pushed to the right edge and a
 * dotted trail drawn behind them. From 768 up it is the two-column grid it has always been, and
 * from `ipad` up the five-across diagonal with `lift` doing the climbing.
 *
 * `self-start` / `self-end` are the zigzag, and they are undone with `md:self-auto` rather than
 * dropped: inside the grid `align-self` is what `items-end` sets, so leaving a bare `self-start`
 * on would move a step to the top of its grid row at 1194 too.
 */
const TILE = 'flex h-[84px] w-[236px] max-w-full flex-row items-center justify-start gap-2.5 rounded-[20px] px-3.5 max-md:min-w-0'
  + ' md:h-[180px] md:w-full md:max-w-[220px] md:flex-col md:justify-center md:gap-2 md:rounded-xl3 md:px-0'

/** The dotted trail that joins the five zigzag rows, bottom-left up to top-left. The viewBox is
 * the design's 350×560 and `preserveAspectRatio="none"` stretches it over whatever the column
 * actually is, exactly as `Home`'s map trail does — the dashes are decoration, not measurement.
 * Row *i* counting from the bottom sits at y = 560 − 56 − i·112, on the left at x 118 and on the
 * right at x 232 (a 236 px tile centred in a 350 px band). */
const TRAIL = STEPS.map((_, i) => `${i === 0 ? 'M' : 'L'}${i % 2 === 0 ? 118 : 232} ${504 - i * 112}`).join(' ')

/** The best a child has done on any card of a level — one row of stars per step. */
function levelStars(id: string): Stars {
  const cards = LEVELS.find(l => l.id === id)?.cards ?? []
  return cards.reduce<Stars>((best, c) => (getStars(c.id) > best ? getStars(c.id) : best), 0)
}

/** Tập âm keeps its stars per *sound*, not per card — a sound only clears once all 3 of its words
 * score high (Phase 9 derives that from the `sword:<cardId>` keys, with the retired `sound:<ph>`
 * key as a floor), so the step's stars are the best across the 9 sounds.
 *
 * Phase 5 is what moved them off the cards; before that each `sz-*` card had its own star. Those
 * keys are still sitting in a returning child's storage, and reading only the new ones emptied the
 * step and looked like the app had wiped their progress — so the step takes the best of both. */
function soundStars(): Stars {
  const bySound = SOUNDS.reduce<Stars>((best, s) => {
    const stars = starsForSound(s.ph)
    return stars > best ? stars : best
  }, 0)
  const legacy = levelStars('sound-zoo')
  return bySound > legacy ? bySound : legacy
}

/** Minimal Pairs keeps its stars per *pair*, not per card, so it needs its own reducer. */
function pairStars(): Stars {
  return PAIRS.reduce<Stars>((best, p) => {
    const s = getStars(`pair:${p.id}`)
    return s > best ? s : best
  }, 0)
}

/** Sentence Stars keeps its stars per *sentence*, mirroring the pair/sound reducers above. */
function sentenceStarStars(): Stars {
  return SENTENCE_STARS.reduce<Stars>((best, s) => {
    const stars = getStars(`sstar:${s.id}`)
    return stars > best ? stars : best
  }, 0)
}

/** Story Voice keeps its stars per *passage*. */
function storyVoiceStars(): Stars {
  return STORY_VOICE.reduce<Stars>((best, v) => {
    const stars = getStars(`voice:${v.id}`)
    return stars > best ? stars : best
  }, 0)
}

export function LevelStairs() {
  const stars: Record<string, Stars> = {
    'sound-zoo': soundStars(),
    'word-pop': levelStars('word-pop'),
    'minimal-pairs': pairStars(),
    'sentence-stars': sentenceStarStars(),
    'story-voice': storyVoiceStars(),
  }
  // Foxy waits on the first *playable* step that is not finished yet; once every step is 3★ he
  // has nowhere left to climb, so he stands on the last one instead.
  const current = STEPS.find(s => s.to && stars[s.key] < 3) ?? STEPS[STEPS.length - 1]
  const foxyOn = current.key
  // The step Foxy is standing on is the one the pinned CTA offers, named the way the design names
  // it: "Luyện bậc 2: Đọc từ 🎈".
  const currentIndex = STEPS.indexOf(current) + 1

  return (
    // The phone frame is a column that does not scroll: header, the zigzag (which takes what is
    // left) and the CTA on the bottom edge. The CTA is a *sibling* of the scrolling region, never
    // a `sticky` overlay — a pinned block with an opaque background covers the content under it on
    // the first paint of a screen that is already too tall. From 768 up `md:block` hands the
    // screen straight back to the plain scrolling block it has always been.
    <main className={`relative flex h-full flex-col overflow-y-auto bg-cream-50 px-5 max-md:overflow-hidden md:block md:px-6 ${PAGE_SHELL}`}>
      {/* M7 has no blob (design §11). It is also what puts 80 px of horizontal overflow inside
          `main` at 390 px, since `overflow-y-auto` makes the x axis scrollable too. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 hidden h-[320px] w-[320px] rounded-full bg-teal-50 md:block" />

      <div className="relative flex flex-col gap-3 max-md:min-h-0 max-md:flex-1 md:gap-6">
        {/* One header row on a phone — back button, title and subtitle side by side (§11). The
            wrapper is `contents` from 768 up, so both children go back to being direct children of
            the column exactly where they were. */}
        <div className="flex items-center gap-3 md:contents">
          {/* 64 px, not the design's 56: the spec's binding rules put the tap-target floor at 64
              with no exception, and a back arrow is the control a child hits most often. */}
          <BackButton to="/" label="Về trang chủ" mdLabel="Về bản đồ" className="max-md:h-16 max-md:w-16 max-md:text-2xl md:self-start" />

          <header className="text-left max-md:flex-1 md:text-center">
            {/* The design titles this screen in Vietnamese, which is also what the way in from
                Home is called ("🗣️ Các bậc luyện nói"). Only the phone gets the new wording: the
                landscape frame is unchanged this phase. */}
            <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[40px]">
              <span className="md:hidden">Các bậc luyện nói 🗣️</span>
              <span className="hidden md:inline">Speak Lab 🗣️</span>
            </h1>
            <p className="mt-0.5 text-[13px] font-bold text-ink-500 md:mt-1 md:text-lg">Leo từng bậc — mỗi bậc một trò mới!</p>
          </header>
        </div>

        {/* `justify-around`, not the design's `space-between`: it puts each row's centre at
            exactly (2i+1)/10 of the column, which is where the trail below draws its corners at
            every viewport height. `space-between` would leave the dotted line ~24 px off the top
            and bottom stairs at 844 and further out at 667. */}
        <div className="relative flex flex-col-reverse justify-around gap-2 overflow-y-auto py-1.5 max-md:min-h-0 max-md:flex-1 md:grid md:grid-cols-2 md:items-end md:justify-items-center md:gap-5 md:overflow-visible md:py-0 ipad:grid-cols-5 ipad:items-start">
          <svg
            aria-hidden="true"
            viewBox="0 0 350 560"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full md:hidden"
          >
            <path d={TRAIL} stroke="#EAD9BE" strokeWidth={9} strokeLinecap="round" strokeDasharray="2 18" fill="none" />
          </svg>

          {STEPS.map((step, i) => (
            <div
              key={step.key}
              data-testid={`step-${step.key}`}
              // `max-w-full` + the tile's `min-w-0`: at 320 px the design's 236 px tile and the
              // 64 px fox together want 306 px of a 280 px column, so the tile gives up the
              // difference rather than the fox being clipped off the edge.
              className={`flex flex-row items-center gap-1.5 max-md:relative max-md:z-[1] max-md:max-w-full ${i % 2 === 0 ? 'self-start' : 'self-end'} md:w-full md:flex-col md:gap-2 md:self-auto ${step.lift}`}
            >
              {/* Above the step from 768 up, beside it on a phone (`order-2`), and simply absent
                  on a phone when it is not this child's step — an invisible 64 px box next to a
                  right-hand tile would push it off the zigzag's right edge. */}
              <div className={`h-16 max-md:shrink-0 md:h-[96px] ${foxyOn === step.key ? 'order-2 animate-bob md:order-none' : 'invisible max-md:hidden'}`}>
                {foxyOn === step.key && <Foxy mood="cheer" size="sm" />}
              </div>

              {step.to ? (
                <Link to={step.to} className={`${TILE} bg-white shadow-card active:translate-y-[2px] ${foxyOn === step.key ? 'max-md:shadow-[0_6px_0_#1FA396,0_0_0_3px_#2EC4B6]' : ''}`}>
                  <span aria-hidden="true" className="text-[30px] leading-none md:text-[56px]">{step.emoji}</span>
                  <span className="font-display text-[16px] font-extrabold text-ink-900 md:text-[21px]">{step.name}</span>
                  <StarRow value={stars[step.key]} className="max-md:gap-0 max-md:text-xs" />
                  {/* The design's status tag, phone only: the landscape tile says the same thing
                      with Foxy standing on it and has no room to spare. */}
                  <span className="ml-auto font-display text-[13px] font-extrabold text-ink-300 md:hidden">
                    {foxyOn === step.key ? 'ĐANG HỌC' : stars[step.key] === 3 ? '✓' : ''}
                  </span>
                </Link>
              ) : (
                <div className={`${TILE} bg-[#F3EADA] opacity-75 shadow-[0_8px_0_#E2D5C0] max-md:shadow-[0_5px_0_#E2D5C0]`}>
                  <span aria-hidden="true" className="text-[30px] leading-none md:text-[48px]">🔒</span>
                  <span className="font-display text-[16px] font-extrabold text-[#A79781] md:text-[21px]">{step.name}</span>
                  <Chip tone="neutral" size="sm" className="max-md:hidden">Sắp có</Chip>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* The design's pinned CTA (§11), phone only. It is the last child of the non-scrolling
            column above, so it always sits on the bottom edge without covering anything. */}
        {current.to && (
          <Button
            to={current.to}
            className="max-md:min-h-[64px] max-md:w-full max-md:shrink-0 max-md:rounded-[20px] max-md:px-4 max-md:text-xl md:hidden"
          >
            Luyện bậc {currentIndex}: {current.name} {current.emoji}
          </Button>
        )}
      </div>
    </main>
  )
}
