import { useState } from 'react'
import { getActivity } from '../progress/activity'
import { getBand } from '../progress/band'
import { lessonStatus } from '../progress/lesson'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Card, Chip } from '../components/ui'

/** Today's lesson, one concrete step at a time: emoji + label, ✓ once done, and a teal ring on the
 * first undone item so the child never has to decide where to start — the single CTA takes them
 * straight there. */
export function DailyMission() {
  // Read the log once per mount, like Home does: every query below shares this snapshot.
  const [{ status, band }] = useState(() => {
    const events = getActivity()
    const now = Date.now()
    return { status: lessonStatus(now, events), band: getBand().value }
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
          return (
            <Card key={item.route} className={`p-5 ${isCurrent ? 'border-4 border-teal-500' : ''}`}>
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
            </Card>
          )
        })}

        <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
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
