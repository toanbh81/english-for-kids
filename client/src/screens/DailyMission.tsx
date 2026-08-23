import { useState } from 'react'
import { getActivity, missionStatus } from '../progress/activity'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Card, Chip } from '../components/ui'
import type { ChipTone } from '../components/ui'

type StepKey = 'story' | 'speak' | 'word'

const STEPS: { key: StepKey; emoji: string; title: string; minutes: string; tone: ChipTone; target: number; to: string; cta: string }[] = [
  { key: 'story', emoji: '🎧', title: 'Nghe 1 truyện', minutes: '≈ 4 phút', tone: 'teal', target: 1, to: '/stories', cta: 'Bắt đầu 🎧' },
  { key: 'speak', emoji: '🗣️', title: '5 thẻ phát âm', minutes: '≈ 5 phút', tone: 'coral', target: 5, to: '/level/sound-zoo', cta: 'Bắt đầu 🗣️' },
  { key: 'word', emoji: '🧩', title: '3 từ mới', minutes: '≈ 3 phút', tone: 'sun', target: 3, to: '/words', cta: 'Bắt đầu 🧩' },
]

/** The three small steps of today's mission, in order, with the one to do next ringed in teal so
 * the child never has to decide where to start. */
export function DailyMission() {
  // Read the log once per mount, like Home does: every query below shares this array.
  const [{ events, now }] = useState(() => ({ events: getActivity(), now: Date.now() }))
  const status = missionStatus(now, events)

  const doneFlags = STEPS.map(step => status[step.key] >= step.target)
  const currentIndex = doneFlags.indexOf(false) // -1 once the whole mission is finished

  return (
    <main className="relative h-full overflow-y-auto bg-cream-50 p-6">
      <BackButton to="/" label="Về bản đồ" />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pt-4">
        <header className="text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Nhiệm vụ hôm nay 🌞</h1>
          <p className="mt-1 text-lg font-bold text-ink-500">3 bước nhỏ — khoảng 12 phút thôi!</p>
        </header>

        {STEPS.map((step, i) => {
          const stepDone = doneFlags[i]
          const isCurrent = i === currentIndex
          return (
            <Card key={step.key} className={`p-5 ${isCurrent ? 'border-4 border-teal-500' : ''}`}>
              <div className="flex items-center gap-4">
                <span aria-hidden="true" className="text-5xl">{step.emoji}</span>
                <div className="flex-1">
                  <div className="font-display text-2xl font-extrabold text-ink-900">{step.title}</div>
                  {isCurrent && (
                    <div className="mt-1 font-display text-base font-extrabold text-teal-600">
                      Bước {i + 1} · bắt đầu ở đây!
                    </div>
                  )}
                </div>
                {stepDone
                  ? <span className="font-display text-xl font-extrabold text-good-700">✓ Xong</span>
                  : <Chip tone={step.tone}>{step.minutes}</Chip>}
              </div>
            </Card>
          )
        })}

        <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
          <Foxy mood="cheer" size="md" />
          {currentIndex === -1
            ? <Button to="/" size="lg" variant="secondary">Về bản đồ 🏝️</Button>
            : <Button to={STEPS[currentIndex].to} size="lg" pulse>{STEPS[currentIndex].cta}</Button>}
        </div>
      </div>
    </main>
  )
}
