import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LEVELS } from '../content'
import { totalStars } from '../progress/store'
import { getActivity, missionStatus, streak, weekDots, minutesToday } from '../progress/activity'
import { getLimitMinutes } from '../progress/limit'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { MissionCard } from '../components/MissionCard'
import { StreakWeek } from '../components/StreakWeek'

const MODULE_CARDS = [
  { to: '/stories', emoji: '🎧', label: 'Nghe kể chuyện', bg: 'bg-coral text-white' },
  ...LEVELS.map(l => ({ to: `/level/${l.id}`, emoji: '🗣️', label: l.title, bg: 'bg-teal text-white' })),
  { to: '/words', emoji: '🧩', label: 'Từ vựng', bg: 'bg-star text-slate-800' },
  { to: '/sentences', emoji: '🧱', label: 'Ghép câu', bg: 'bg-good text-white' },
]

export function Home() {
  // One read of the activity log per mount, shared by every query below — the log is a single
  // localStorage entry, and each query used to parse it again.
  const [{ events, now }] = useState(() => ({ events: getActivity(), now: Date.now() }))
  const status = missionStatus(now, events)
  const hasProgress = status.story > 0 || status.speak > 0 || status.word > 0
  const mood: FoxyMood = status.done ? 'cheer' : hasProgress ? 'happy' : 'idle'
  const say = status.done
    ? 'Hoàn thành nhiệm vụ rồi! 🎉'
    : hasProgress
      ? 'Giỏi lắm, tiếp tục nhé!'
      : 'Chào bé! Hôm nay mình học gì nào?'
  const overLimit = minutesToday(now, events) >= getLimitMinutes()

  return (
    <main className="h-full overflow-y-auto flex flex-col items-center gap-6 p-6 relative">
      <h1 className="sr-only">Speak Up!</h1>

      <section className="flex flex-col items-center gap-3">
        <Foxy mood={mood} size="lg" say={say} />
        <StreakWeek dots={weekDots(now, events)} streak={streak(now, events)} />
        <div className="text-2xl font-extrabold">⭐ {totalStars()} sao</div>
      </section>

      {overLimit && (
        <div
          data-testid="limit-banner"
          className="w-full max-w-md rounded-2xl bg-star/30 text-slate-800 text-lg font-bold text-center px-4 py-3"
        >
          Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!
        </div>
      )}

      <MissionCard status={status} />

      <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
        {MODULE_CARDS.map(card => (
          <Link
            key={card.to}
            to={card.to}
            className={`min-h-[64px] h-32 rounded-3xl ${card.bg} text-2xl font-extrabold flex flex-col items-center justify-center gap-1 shadow-lg active:scale-95`}
          >
            <span className="text-4xl">{card.emoji}</span>
            <span>{card.label}</span>
          </Link>
        ))}
      </section>

      <Link
        to="/parent"
        className="min-h-[64px] min-w-[64px] self-end mt-2 px-4 rounded-2xl bg-white shadow text-lg font-bold flex items-center justify-center active:scale-95"
      >
        👨‍👩‍👧 Phụ huynh
      </Link>
    </main>
  )
}
