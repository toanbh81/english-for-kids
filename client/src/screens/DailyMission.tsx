import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getActivity } from '../progress/activity'
import { getLesson, lessonStatus } from '../progress/lesson'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip } from '../components/ui'

/** The mission row: the `Card` surface, laid out as a row rather than the kit's centred stack. */
const ITEM_CARD = 'rounded-xl3 bg-white p-5 shadow-card'

/** Today's lesson, one concrete step at a time: emoji + label, ✓ once done, and a teal ring on the
 * first undone item so the child never has to decide where to start — the single CTA takes them
 * straight there, and every step that is still open is a tap target of its own. */
export function DailyMission() {
  // Read the log once per mount, like Home does: every query below shares this snapshot. The band
  // comes off the lesson record, not from `getBand()` — a parent who changes the difficulty at
  // lunchtime must not have the chip disagree with the items the child is actually looking at.
  const [{ status, band }] = useState(() => {
    const events = getActivity()
    const now = Date.now()
    return { status: lessonStatus(now, events), band: getLesson(now, events).band }
  })

  // -1 once every item is done; also -1 for an empty lesson, which is why the finished branch
  // below checks `status.done` (it already guards `items.length > 0`) rather than this index.
  const currentIndex = status.items.findIndex(item => !item.done)

  return (
    <main className="relative h-full overflow-y-auto bg-cream-50 p-6">
      <BackButton to="/" label="Về bản đồ" />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pt-4">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Nhiệm vụ hôm nay 🌞</h1>
          <div className="flex items-center gap-3">
            <Chip tone="sun">Bậc ⭐ {band}</Chip>
            <Chip tone="teal">{status.doneCount}/{status.total}</Chip>
          </div>
        </header>

        {status.items.map((item, i) => {
          const isCurrent = i === currentIndex
          const ring = isCurrent ? 'border-4 border-teal-500' : ''
          const body = (
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="text-5xl">{item.emoji}</span>
              <div className="flex-1">
                <div className="font-display text-2xl font-extrabold text-ink-900">{item.label}</div>
                {isCurrent && (
                  <div className="mt-1 font-display text-base font-extrabold text-teal-600">
                    bắt đầu ở đây!
                  </div>
                )}
              </div>
              {item.done && (
                <span className="font-display text-xl font-extrabold text-good-700">✓ Xong</span>
              )}
            </div>
          )

          // A finished step is a record, not a destination: it stays an inert card with its ✓, so
          // a stray tap cannot send the child back through work they already did. Everything still
          // open is a tap target — the child reads the list and picks, instead of being funnelled
          // through the one CTA at the bottom.
          return item.done
            ? <div key={item.route} className={`${ITEM_CARD} ${ring}`}>{body}</div>
            : (
              <Link key={item.route} to={item.route} className={`${ITEM_CARD} ${ring} block transition-transform active:scale-95`}>
                {body}
              </Link>
            )
        })}

        {/* Sticky, so a long lesson can never push the one thing the child came here to tap below
          * the fold. The cream gradient fades the list out underneath it rather than cutting it
          * off, and `-mx-6` lets that fade reach the screen edges through the page padding. */}
        <div className="sticky bottom-0 -mx-6 mt-1 flex flex-wrap items-end justify-between gap-4 bg-gradient-to-t from-cream-50 from-60% to-transparent px-6 pb-3 pt-8">
          <Foxy mood="cheer" size="md" />
          {status.done
            ? <Button to="/" size="lg" variant="secondary">Về bản đồ 🏝️</Button>
            : currentIndex !== -1
              ? <Button to={status.items[currentIndex].route} size="lg" pulse>Bắt đầu {status.items[currentIndex].emoji}</Button>
              // An empty lesson (nothing generated yet) has no item to point at and nothing to
              // celebrate either — the list above renders empty and there is simply no CTA.
              : null}
        </div>
      </div>
    </main>
  )
}
