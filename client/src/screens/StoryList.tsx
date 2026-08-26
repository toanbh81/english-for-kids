import { Link } from 'react-router-dom'
import { STORIES } from '../content/stories'
import { getStars } from '../progress/store'
import { BackButton, CARD_LINK, PAGE_SHELL, StarRow } from '../components/ui'

export function StoryList() {
  return (
    <main className={`h-full overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <BackButton to="/" label="Về nhà" className="self-start" />
        <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">🎧 Nghe kể chuyện</h1>
        <div className="grid grid-cols-3 gap-6">
          {STORIES.map(s => (
            <Link key={s.id} to={`/story/${s.id}`} className={CARD_LINK}>
              <span aria-hidden="true" className="text-[72px] leading-none">{s.emoji}</span>
              <span className="text-center font-display text-[26px] font-extrabold leading-tight text-ink-900">{s.title}</span>
              <span className="text-center text-lg font-bold text-ink-500">{s.titleVi}</span>
              <StarRow value={getStars(`story:${s.id}`)} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
