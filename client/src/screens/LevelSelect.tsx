import { Link, useParams } from 'react-router-dom'
import { LEVELS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, NotFound, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { SoundLevel } from './SoundLevel'

/** 64 px pill — a tap target, not just a label, so it is a chip in look only. */
const STAIRS_LINK =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-teal-50 px-6 font-display text-lg font-extrabold text-teal-600 shadow-card-sm active:translate-y-[2px]'

export function LevelSelect() {
  const { levelId } = useParams()
  // Tập âm is taught by sound, so `/level/sound-zoo` shows the 9 sound tiles instead of the
  // 27 word cards. Every other level keeps the card grid below.
  if (levelId === 'sound-zoo') return <SoundLevel />
  const level = LEVELS.find(l => l.id === levelId)
  if (!level) return <NotFound what="bậc" />
  return (
    <PageShell>
      {/* Back goes to the map — Home is the topic map now, not a list of levels. */}
      <PageHeader back={<BackButton to="/" label="Về trang chủ" mdLabel="Về bản đồ" />}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">{level.title}</h1>
      </PageHeader>
      <PageBody>
        {/* The stairs at `/levels` are how the child gets from one level to the next; a body row
            (not the header's 56px-wide right cell, which it overflowed and covered the subtitle)
            keeps it reachable at every width. */}
        <Link to="/levels" className={`${STAIRS_LINK} self-end`}>🗣️ Xem các bậc</Link>

        <p className="text-center text-[15px] font-bold text-ink-500 md:text-lg">Chạm vào một thẻ để luyện nói nhé!</p>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {level.cards.map(c => (
            <Link
              key={c.id}
              to={`/practice/${c.id}`}
              className="flex flex-col items-center gap-2 rounded-xl3 bg-white p-5 shadow-card active:translate-y-[2px]"
            >
              <span aria-hidden="true" className="text-[56px] leading-none">{c.emoji}</span>
              <span className="font-display text-2xl font-extrabold text-ink-900">{c.text}</span>
              <StarRow value={getStars(c.id)} />
            </Link>
          ))}
        </div>
      </PageBody>
    </PageShell>
  )
}
