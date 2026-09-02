import { Link } from 'react-router-dom'
import { STORIES } from '../content/stories'
import { getStars } from '../progress/store'
import { BackButton, CARD_LINK, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

export function StoryList() {
  return (
    <PageShell>
      <PageHeader back={<BackButton to="/" label="Về nhà" />}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">🎧 Nghe kể chuyện</h1>
      </PageHeader>
      <PageBody>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
          {STORIES.map(s => (
            <Link key={s.id} to={`/story/${s.id}`} className={CARD_LINK}>
              <span aria-hidden="true" className="text-[72px] leading-none">{s.emoji}</span>
              <span className="text-center font-display text-[26px] font-extrabold leading-tight text-ink-900">{s.title}</span>
              <span className="text-center text-lg font-bold text-ink-500">{s.titleVi}</span>
              <StarRow value={getStars(`story:${s.id}`)} />
            </Link>
          ))}
        </div>
      </PageBody>
    </PageShell>
  )
}
