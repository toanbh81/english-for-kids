import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LEVELS, PAIRS, SENTENCE_STARS, SOUNDS, STORY_VOICE } from '../content'
import { getStars, soundStars as starsForSound } from '../progress/store'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody, PageFooter } from '../components/ui/page'

type Stars = 0 | 1 | 2 | 3

type Step = { key: string; emoji: string; name: string; to?: string }

/** Bottom-left to top-right: each step sits a little higher than the one before, so the five
 * games read as a staircase the child climbs. */
const STEPS: Step[] = [
  { key: 'sound-zoo', emoji: '🦁', name: 'Tập âm', to: '/level/sound-zoo' },
  { key: 'word-pop', emoji: '🎈', name: 'Đọc từ', to: '/level/word-pop' },
  { key: 'minimal-pairs', emoji: '👯', name: 'Nghe & chọn', to: '/level/minimal-pairs' },
  { key: 'sentence-stars', emoji: '⭐', name: 'Sentence Stars', to: '/level/sentence-stars' },
  { key: 'story-voice', emoji: '🎭', name: 'Story Voice', to: '/level/story-voice' },
]

/**
 * Phase 14, §2 A9 (design round 3, R21/R22). **The staircase is still two layouts of one DOM**,
 * but the split moved: below `ipad` it is one zigzag — a `flex-col-reverse` scroll region, step 1
 * at the bottom, odd rows pushed to the right edge, a dotted trail drawn behind them — used by
 * both the phone AND iPad portrait (portrait only gets bigger cells, `md:h-[96px] md:w-[300px]`,
 * never the old two-column grid). From `ipad` (landscape) up the five steps leave that flow
 * entirely: the region switches to `ipad:block` and every step is positioned by percentage —
 * `left = 10% + i·20%`, `top = 70% − i·17.5%` of the region's own box — so the diagonal holds at
 * every iPad height (692–834) without five hand-tuned `mt-` values.
 */
const TILE = 'flex h-[84px] w-[236px] max-w-full flex-row items-center gap-2.5 rounded-r20 px-3.5 max-md:min-w-0'
  + ' short:h-[72px] md:h-[96px] md:w-[300px]'
  + ' ipad:h-[176px] ipad:w-[176px] ipad:flex-col ipad:justify-center ipad:gap-1.5 ipad:rounded-r26 ipad:p-3 ipad:shrink-0'

/** The dotted trail that joins the five zigzag rows, bottom-left up to top-left — used by both the
 * phone and iPad-portrait zigzag. The viewBox is the design's 350×560 and `preserveAspectRatio=
 * "none"` stretches it over whatever the column actually is, exactly as `Home`'s map trail does —
 * the dashes are decoration, not measurement. Row *i* counting from the bottom sits at
 * y = 560 − 56 − i·112, on the left at x 118 and on the right at x 232 (a 236 px tile centred in a
 * 350 px band). */
const TRAIL = STEPS.map((_, i) => `${i === 0 ? 'M' : 'L'}${i % 2 === 0 ? 118 : 232} ${504 - i * 112}`).join(' ')

/** The iPad-landscape trail joins the same five centres the steps are positioned at — `left`/`top`
 * as fractions of the design's 1080×600 viewBox — so the dashes always run through the diagonal
 * regardless of the actual iPad height `preserveAspectRatio="none"` stretches it to. */
const LANDSCAPE_TRAIL = STEPS.map((_, i) => {
  const x = ((10 + i * 20) / 100) * 1080
  const y = ((70 - i * 17.5) / 100) * 600
  return `${i === 0 ? 'M' : 'L'}${x} ${y}`
}).join(' ')

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

  // The zigzag reads bottom-up (step 1 at the bottom), so a child opening the screen should see
  // step 1 first rather than the top of a tall scroll region — scroll the stair region to its own
  // bottom once, on mount.
  const regionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = regionRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  return (
    <PageShell>
      <PageHeader
        back={<BackButton to="/" label="Về trang chủ" mdLabel="Về bản đồ" />}
        title="Các bậc luyện nói 🗣️"
        sub="Leo từng bậc — mỗi bậc một trò mới!"
      />
      <PageBody className="relative">
        {/* M7 has no blob (design §11) — and from iPad-portrait up the zigzag itself now fills the
            corner this decoration used to sit in, so it stays landscape-only. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 hidden h-[320px] w-[320px] rounded-full bg-teal-50 ipad:block" />

        <div
          data-testid="stairs-region"
          ref={regionRef}
          className="relative flex min-h-0 flex-1 flex-col-reverse justify-between gap-2 overflow-y-auto py-1.5 md:mt-4 ipad:block ipad:overflow-visible"
        >
          {/* Phone / iPad-portrait trail — the same zigzag at both sizes, just bigger cells. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 350 560"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full ipad:hidden"
          >
            <path d={TRAIL} stroke="#EAD9BE" strokeWidth={9} strokeLinecap="round" strokeDasharray="2 18" fill="none" />
          </svg>
          {/* iPad-landscape trail — the same five centres the steps below are positioned at. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1080 600"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 hidden h-full w-full ipad:block"
          >
            <path d={LANDSCAPE_TRAIL} stroke="#EAD9BE" strokeWidth={10} strokeLinecap="round" strokeDasharray="2 22" fill="none" />
          </svg>

          {STEPS.map((step, i) => (
            <div
              key={step.key}
              data-testid={`step-${step.key}`}
              // Positioned by percentage always; the `style` only takes effect once `ipad:absolute`
              // switches the box out of the zigzag's normal flow. Below `ipad` the box stays
              // `position: static`, on purpose — `top`/`left` apply to any *non-static* box, so a
              // stray `relative` here would let this same inline style shove the box around the
              // zigzag too. `z-[1]` still lifts it above the absolutely-positioned trail SVG
              // without that: flex items honour `z-index` even while `position: static`.
              style={{ left: `${10 + i * 20}%`, top: `${70 - i * 17.5}%` }}
              className={`flex flex-row items-center gap-1.5 z-[1] max-md:max-w-full ${i % 2 === 0 ? 'self-start' : 'self-end'}`
                + ' ipad:absolute ipad:h-[176px] ipad:w-[176px] ipad:flex-col ipad:items-center ipad:justify-end ipad:gap-0 ipad:-translate-x-1/2'}
            >
              {/* Beside the tile on a phone / iPad portrait (`order-2`), above it on iPad
                  landscape (`ipad:order-none` inside the `ipad:flex-col` box) — and simply absent
                  on a phone when it is not this child's step, since an invisible box next to a
                  right-hand tile would push it off the zigzag's right edge. */}
              <div className={`shrink-0 h-[56px] w-[58px] -ml-1.5 ipad:ml-0 ipad:-mb-1.5 ipad:h-[77px] ipad:w-[80px] ${foxyOn === step.key ? 'order-2 animate-bob ipad:order-none' : 'invisible max-md:hidden'}`}>
                {foxyOn === step.key && (
                  <Foxy
                    mood="cheer"
                    size="sm"
                    className="h-[56px] w-[58px] [&_svg]:h-[56px] [&_svg]:w-[58px] ipad:h-[77px] ipad:w-[80px] ipad:[&_svg]:h-[77px] ipad:[&_svg]:w-[80px]"
                  />
                )}
              </div>

              {step.to ? (
                <Link to={step.to} className={`${TILE} bg-white shadow-card active:translate-y-[2px] ${foxyOn === step.key ? 'max-md:shadow-[0_6px_0_#1FA396,0_0_0_3px_#2EC4B6] ipad:shadow-[0_8px_0_#1FA396,0_0_0_4px_#2EC4B6]' : ''}`}>
                  <span aria-hidden="true" className="text-[30px] leading-none ipad:text-[52px]">{step.emoji}</span>
                  {/* Fix round 1: giving the name `flex-1` right next to the star row still wasn't
                      enough room on a 236 px phone tile — "Sentence Stars"/"Nghe & chọn" started
                      ellipsizing even with a short "✓" tag, since stars (~39 px) were still
                      competing for the same line. The artboard's own structure is the actual fix:
                      name and stars stack in their own column (full tile width, stars below) with
                      the tag a separate trailing sibling — so the name only ever shares a line
                      with the *tag*, not the tag AND the stars. `md:contents`/`ipad:contents`
                      remove this wrapper from the box tree at 768 px and up: portrait (768–1023,
                      more width, never had this bug) and landscape (`ipad:flex-col` on `TILE`
                      itself already stacks emoji/name/stars/tag) both fall straight back to name
                      and `StarRow` being direct `TILE` children, byte-for-byte the reviewed,
                      working structure — only the phone/`short:` column below is new. */}
                  <div className="flex min-w-0 flex-1 flex-col md:contents ipad:contents">
                    <span className="truncate font-display text-[16px] font-extrabold text-ink-900 ipad:text-[19px]">{step.name}</span>
                    <StarRow value={stars[step.key]} size="13" className="ipad:text-[14px]" />
                  </div>
                  {/* The design's status tag — visible at every frame now, iPad portrait included,
                      since portrait reuses this same tile and has no landscape row to say it
                      another way. `whitespace-nowrap`/`shrink-0` keep "ĐANG HỌC" itself from
                      wrapping into "ĐANG"/"HỌC" once the name above stops yielding it width. */}
                  <span className="ml-auto shrink-0 whitespace-nowrap font-display text-[12px] font-extrabold text-ink-300 ipad:min-h-[14px]">
                    {foxyOn === step.key ? 'ĐANG HỌC' : stars[step.key] === 3 ? '✓' : ''}
                  </span>
                </Link>
              ) : (
                <div className={`${TILE} bg-[#F3EADA] opacity-75 shadow-[0_8px_0_#E2D5C0] max-md:shadow-[0_5px_0_#E2D5C0]`}>
                  <span aria-hidden="true" className="text-[30px] leading-none ipad:text-[48px]">🔒</span>
                  <span className="font-display text-[16px] font-extrabold text-[#A79781] ipad:text-[19px]">{step.name}</span>
                  <Chip tone="neutral" size="sm" className="hidden ipad:inline-flex">Sắp có</Chip>
                </div>
              )}
            </div>
          ))}
        </div>
      </PageBody>
      {/* The design's pinned CTA (§11) — a sibling of the scrolling body, never a `sticky` overlay
          covering the content under it, and no longer phone-only: iPad landscape gets it too
          (R21), centred and capped at 420 px wide. */}
      {current.to && (
        <PageFooter>
          <Button
            to={current.to}
            className="min-h-[64px] w-full shrink-0 rounded-[20px] px-4 text-xl ipad:mx-auto ipad:h-[64px] ipad:w-[420px] ipad:rounded-r20 ipad:text-[20px]"
          >
            Luyện bậc {currentIndex}: {current.name} {current.emoji}
          </Button>
        </PageFooter>
      )}
    </PageShell>
  )
}
