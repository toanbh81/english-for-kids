import { STORIES } from '../content/stories'
import { getStars } from '../progress/store'
import { BackButton, ListRow, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { Foxy } from '../components/Foxy'

// brief §2 C1: nền đĩa theo truyện. Chưa có token cho ba hex nền — chúng là màu của truyện,
// không phải vai trò trong hệ thống.
const DISC: Record<string, string> = { 'little-fox': 'bg-[#FFE7D2]', 'at-the-zoo': 'bg-sun-50', 'my-breakfast': 'bg-teal-50' }

export function StoryList() {
  return (
    <PageShell>
      <PageHeader
        back={<BackButton to="/" label="Về nhà" />}
        title="🎧 Nghe kể chuyện"
        sub={`${STORIES.length} truyện · nghe rồi làm quiz`}
      />
      <PageBody fade gap={8}>
        {/* Phone: 3 rows (h=96) with a disc coloured for the story — 3 stories on a 390px phone
            is the opposite problem from the review deck's 64 words, so the Foxy filler below
            eats the leftover space instead of the rows stretching to reach it. */}
        <div className="flex flex-col gap-2 md:hidden">
          {STORIES.map(s => (
            <ListRow
              key={s.id}
              to={`/story/${s.id}`}
              h={96}
              disc={{ emoji: s.emoji, bg: DISC[s.id] ?? 'bg-cream-50' }}
              // Fix wave M2: Vietnamese title first, English second — matches TopicHub's own story
              // rows (brief §2 A8's artboard), which is what this fix wave rules the two screens
              // should agree on.
              title={s.titleVi}
              sub={`${s.title} · ${s.scenes.length} cảnh`}
              stars={getStars(`story:${s.id}`)}
              chevron
              ariaLabel={s.titleVi}
            />
          ))}
        </div>
        <div data-testid="story-filler" className="flex flex-1 flex-col items-center justify-center gap-2 md:hidden">
          <Foxy mood="idle" size="md" className="animate-bob [&_svg]:h-[93px] [&_svg]:w-[96px]" />
          <p className="text-[14px] font-bold text-ink-500">Nghe truyện xong thì làm quiz nhé! 🦊</p>
        </div>
        {/* iPad: 3 small tiles centred on their own track — not `ListGrid`, whose 5/6-column
            track would leave 3 tiles stranded on the left (same exception as B2/SoundWordList). */}
        <div data-testid="story-tiles" className="hidden md:grid md:grid-cols-[repeat(3,200px)] md:justify-center md:gap-3">
          {STORIES.map(s => (
            <Tile
              key={s.id}
              to={`/story/${s.id}`}
              size="sm"
              emoji={s.emoji}
              title={s.title}
              stars={getStars(`story:${s.id}`)}
            />
          ))}
        </div>
      </PageBody>
    </PageShell>
  )
}
