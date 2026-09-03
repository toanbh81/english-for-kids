import { useState } from 'react'
import { dayKey, getActivity, streak, weekDots } from '../progress/activity'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { Button, HomeLabel, WeekDots } from '../components/ui'
import { PageShell, PageBody, PageFooter } from '../components/ui/page'

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
  // Spec decision 20: a mission that closed with zero stars still closed — the screen stops
  // celebrating (no confetti, no cheering Foxy) rather than turning into a failure page.
  const zero = starsToday === 0
  const s = streak(now, events)

  return (
    // The phone stack of design M8b: the same column, sized so the whole celebration — mascot,
    // title, star pill and streak — fits a 667 px screen without scrolling. The iPad keeps its
    // bigger type from the tablet breakpoint up.
    <PageShell className="bg-gradient-to-b from-cream-50 to-[#FFEFD9]">
      <PageBody center className="items-center gap-4 text-center md:gap-5">
        {!zero && <Confetti />}

        <Foxy
          mood={zero ? 'happy' : 'cheer'}
          size="lg"
          className={
            zero
              ? 'animate-bob [&_svg]:h-[144px] [&_svg]:w-[150px]'
              : 'animate-bob [&_svg]:h-[145px] [&_svg]:w-[150px] md:[&_svg]:h-[155px] md:[&_svg]:w-[160px]'
          }
        />

        <h1 className="font-display text-[30px] font-extrabold leading-tight text-ink-900 md:text-[52px]">
          {zero ? <>Xong nhiệm vụ rồi! 🦊<br />Con đã rất cố gắng.</> : 'Nhiệm vụ hoàn thành! 🎉'}
        </h1>

        {zero ? (
          <div className="rounded-r18 bg-white px-[26px] py-3 text-[18px] font-bold text-ink-500 shadow-card-sm">
            Mai làm lại để lấy ⭐ nhé
          </div>
        ) : (
          // `md:leading-normal` is not decoration. `text-2xl` sets a 32 px line-height as well as a
          // 24 px size, and `md:text-[30px]` restores only the size — so the pill came out 56 px tall
          // instead of the 69 it has always been, and the whole centred stack shifted with it (the
          // mascot and the title 6 px down, the streak line and the way out 7 px up). Any
          // arbitrary-size restore has to restate the leading it is stepping on; 1.5 is the inherited
          // value the 30 px pill has always resolved against.
          <div className="inline-flex items-center gap-2 rounded-full bg-sun-50 px-8 py-3 font-display text-2xl font-extrabold text-sun-700 shadow-chunky-sun md:text-[30px] md:leading-normal">
            +{starsToday} ⭐
          </div>
        )}

        <div className="w-full max-w-[380px]">
          <WeekDots dots={weekDots(now, events)} />
        </div>

        <p className="font-display text-base font-extrabold text-ink-500 md:text-2xl">
          {s === 0 ? '🔥 Bắt đầu chuỗi mới từ hôm nay!' : `🔥 Chuỗi ${s} ngày liên tiếp — giỏi lắm!`}
        </p>
      </PageBody>
      <PageFooter>
        <Button to="/" size="lg" variant="secondary" className="flex-1"><HomeLabel /></Button>
      </PageFooter>
    </PageShell>
  )
}
