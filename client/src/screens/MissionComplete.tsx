import { useState } from 'react'
import { dayKey, getActivity, streak } from '../progress/activity'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { Button, HomeLabel, PAGE_SHELL } from '../components/ui'

// "Stars earned today" has no store of its own — stars are kept per card, not per day. So the
// screen counts today's practice events that cleared the passing bar (the same 60 that unlocks a
// word card): one well-said story line, card or sentence = one star to celebrate.
const PASS_SCORE = 60
const STAR_KINDS = ['speak', 'word', 'sentence'] as const

/** Shown once a day, right after the third mission step lands. Home sends the child here instead
 * of throwing confetti over the map. */
export function MissionComplete() {
  const [{ events, now }] = useState(() => ({ events: getActivity(), now: Date.now() }))
  const today = dayKey(now)
  const starsToday = events.filter(
    e => dayKey(e.ts) === today
      && (STAR_KINDS as readonly string[]).includes(e.kind)
      && (e.score ?? 0) >= PASS_SCORE,
  ).length

  return (
    // The phone stack of design M8b: the same column, sized so the whole celebration — mascot,
    // title, star pill, streak and the way out — fits a 667 px screen without scrolling. The iPad
    // keeps its bigger type from the tablet breakpoint up.
    <main className={`relative flex h-full flex-col items-center justify-center gap-4 overflow-y-auto bg-gradient-to-b from-cream-50 to-[#FFEFD9] px-6 text-center md:gap-5 md:px-8 ${PAGE_SHELL}`}>
      <Confetti />

      <Foxy mood="cheer" size="lg" className="animate-bob [&_svg]:h-[145px] [&_svg]:w-[150px] md:[&_svg]:h-[155px] md:[&_svg]:w-[160px]" />

      <h1 className="font-display text-[30px] font-extrabold leading-tight text-ink-900 md:text-[52px]">
        Nhiệm vụ hoàn thành! 🎉
      </h1>

      <div className="inline-flex items-center gap-2 rounded-full bg-sun-50 px-8 py-3 font-display text-2xl font-extrabold text-sun-700 shadow-chunky-sun md:text-[30px]">
        +{starsToday} ⭐
      </div>

      <p className="font-display text-base font-extrabold text-ink-500 md:text-2xl">
        🔥 Chuỗi {streak(now, events)} ngày liên tiếp — giỏi lắm!
      </p>

      <Button to="/" size="lg" variant="secondary"><HomeLabel /></Button>
    </main>
  )
}
